import { describe, it, expect } from 'vitest';
import { buildProposalPrompt, parseProposedMissions, type ContextItem } from './mission-generator';

const ITEMS: ContextItem[] = [
  { kind: 'email', label: 'Inbox — Northwind MSA', body: 'Please countersign the MSA…' },
  { kind: 'note', label: 'Call — Beacon Robotics', body: 'Pilot, $25k floated…' }
];

describe('buildProposalPrompt', () => {
  it('embeds every item label + body and asks for strict JSON', () => {
    const p = buildProposalPrompt(ITEMS);
    expect(p).toContain('Inbox — Northwind MSA');
    expect(p).toContain('Call — Beacon Robotics');
    expect(p).toContain('Please countersign the MSA');
    expect(p).toContain('STRICT JSON');
    expect(p).toMatch(/not.*advice/i);
  });

  it('throws when there is no context', () => {
    expect(() => buildProposalPrompt([])).toThrow();
  });
});

describe('parseProposedMissions', () => {
  const good = JSON.stringify([
    {
      title: 'Review the Northwind MSA before signing',
      item: 'Inbox — Northwind MSA',
      why: 'It auto-renews and caps their liability, not yours.',
      mode: 'approval',
      run_instruction: 'Review the MSA and flag risky clauses with redlines.',
      deliverable: 'A clause-by-clause review memo.'
    },
    {
      title: 'Draft the Beacon pilot follow-up',
      item: 'Call — Beacon Robotics',
      why: 'You promised a number + term sheet by end of week.',
      mode: 'dry-run',
      run_instruction: 'Draft a follow-up email and a 1-page term sheet.',
      deliverable: 'A ready-to-send draft.'
    }
  ]);

  it('parses a clean JSON array', () => {
    const m = parseProposedMissions(good);
    expect(m).toHaveLength(2);
    expect(m[0].title).toContain('Northwind');
    expect(m[0].mode).toBe('approval');
    expect(m[1].mode).toBe('dry-run');
    expect(m[0].id).toBeTruthy();
  });

  it('tolerates ```json fences and leading prose', () => {
    const wrapped = 'Sure, here are the actions:\n```json\n' + good + '\n```';
    expect(parseProposedMissions(wrapped)).toHaveLength(2);
  });

  it('drops elements missing a title or run_instruction', () => {
    const partial = JSON.stringify([
      { title: 'No instruction' },
      { run_instruction: 'No title' },
      { title: 'Valid', run_instruction: 'Do it' }
    ]);
    const m = parseProposedMissions(partial);
    expect(m).toHaveLength(1);
    expect(m[0].title).toBe('Valid');
  });

  it('defaults unknown/missing mode to approval (safe)', () => {
    const m = parseProposedMissions(
      JSON.stringify([{ title: 'X', run_instruction: 'Y', mode: 'whatever' }])
    );
    expect(m[0].mode).toBe('approval');
  });

  it('gives each mission a unique id', () => {
    const dup = JSON.stringify([
      { title: 'Same', run_instruction: 'a' },
      { title: 'Same', run_instruction: 'b' }
    ]);
    const m = parseProposedMissions(dup);
    expect(m).toHaveLength(2);
    expect(m[0].id).not.toBe(m[1].id);
  });

  it('returns [] on garbage, non-array, or empty input', () => {
    expect(parseProposedMissions('')).toEqual([]);
    expect(parseProposedMissions('not json at all')).toEqual([]);
    expect(parseProposedMissions('{"title":"obj not array"}')).toEqual([]);
    expect(parseProposedMissions('[oops')).toEqual([]);
  });
});
