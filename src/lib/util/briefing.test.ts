import { describe, expect, it } from 'vitest';

import { buildBriefingPrompt, type BriefingThread } from './briefing';

function thread(
  id: string,
  title: string,
  updatedAt: string,
  messageCount?: number
): BriefingThread {
  return { id, title, updatedAt, messageCount };
}

describe('briefing util', () => {
  const now = new Date('2026-05-28T12:00:00Z');

  it('returns a non-empty prompt containing the briefing date', () => {
    const prompt = buildBriefingPrompt({
      now,
      threads: [thread('a', 'Launch plan', '2026-05-28T10:00:00Z')]
    });

    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain('2026-05-28');
  });

  it('sorts threads most-recently-updated first and caps to maxThreads', () => {
    const prompt = buildBriefingPrompt({
      now,
      maxThreads: 2,
      threads: [
        thread('old', 'Old planning', '2026-05-25T09:00:00Z'),
        thread('new', 'New planning', '2026-05-28T09:00:00Z'),
        thread('middle', 'Middle planning', '2026-05-27T09:00:00Z')
      ]
    });

    expect(prompt.indexOf('New planning')).toBeLessThan(prompt.indexOf('Middle planning'));
    expect(prompt).not.toContain('Old planning');
  });

  it('includes open loops when provided', () => {
    const prompt = buildBriefingPrompt({
      now,
      threads: [],
      openLoops: ['Follow up with design', 'Send budget revision']
    });

    expect(prompt).toContain('Follow up with design');
    expect(prompt).toContain('Send budget revision');
  });

  it('empty input still asks for a fresh-start plan', () => {
    const prompt = buildBriefingPrompt({ now, threads: [] });

    expect(prompt).toContain('fresh-start plan for the day from scratch');
    expect(prompt).toContain('top 3 priorities');
  });

  it('does not throw for unparseable updatedAt and sorts it last', () => {
    const build = () =>
      buildBriefingPrompt({
        now,
        threads: [
          thread('bad', 'Broken timestamp', 'not-a-date'),
          thread('good', 'Valid timestamp', '2026-05-28T09:00:00Z')
        ]
      });

    expect(build).not.toThrow();

    const prompt = build();
    expect(prompt.indexOf('Valid timestamp')).toBeLessThan(prompt.indexOf('Broken timestamp'));
    expect(prompt).toContain('recency unknown');
  });

  it('includes deterministic recency hints and message counts', () => {
    const prompt = buildBriefingPrompt({
      now,
      threads: [thread('a', 'Two days ago', '2026-05-26T11:00:00Z', 12)]
    });

    expect(prompt).toContain('updated 2 days ago');
    expect(prompt).toContain('12 messages');
  });
});
