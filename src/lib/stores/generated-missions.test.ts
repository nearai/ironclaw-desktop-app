import { beforeEach, describe, expect, it } from 'vitest';
import { generatedMissions } from './generated-missions.svelte';
import { composerInsert } from './templates.svelte';
import { workItems } from './work-items.svelte';
import type { GeneratedMission } from '$lib/util/mission-generator';

function installLocalStorageShim() {
  const store = new Map<string, string>();
  const shim = {
    get length() {
      return store.size;
    },
    key(i: number) {
      return Array.from(store.keys())[i] ?? null;
    },
    getItem(k: string) {
      return store.has(k) ? (store.get(k) as string) : null;
    },
    setItem(k: string, v: string) {
      store.set(String(k), String(v));
    },
    removeItem(k: string) {
      store.delete(k);
    },
    clear() {
      store.clear();
    }
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: shim });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: shim });
  }
}

function mission(overrides: Partial<GeneratedMission> = {}): GeneratedMission {
  return {
    id: 'm1',
    title: 'Review the vendor contract',
    item: 'Inbox item',
    why: 'There are approval-sensitive terms.',
    mode: 'approval',
    run_instruction: 'Review the document and prepare red flags.',
    deliverable: 'Risk memo',
    domain: 'legal',
    domains: [],
    context: [
      {
        label: 'Document(s) to review',
        state: 'available',
        provenance: 'Inbox item'
      }
    ],
    risky_actions: [
      {
        action: 'Send markup',
        kind: 'send',
        payload: 'Send the markup to the counterparty.',
        reason: 'External message.'
      }
    ],
    expected_artifacts: [{ type: 'risk-memo', title: 'Risk memo', provenance: ['Inbox item'] }],
    watches: [],
    ...overrides
  };
}

describe('generatedMissions.run', () => {
  beforeEach(() => {
    installLocalStorageShim();
    workItems.items = [];
    (workItems as unknown as { hydrated: boolean }).hydrated = false;
    generatedMissions.reset();
    composerInsert.consume();
  });

  it('creates a durable work item before inserting the mission into chat', () => {
    const text = generatedMissions.run(mission());

    expect(workItems.items).toHaveLength(1);
    expect(workItems.items[0].domain).toBe('legal');
    expect(workItems.items[0].runbookIds).toEqual(['legal']);
    expect(workItems.items[0].dossier.some((entry) => entry.state === 'available')).toBe(true);
    expect(workItems.items[0].approvalBoundaries.some((gate) => gate.kind === 'send')).toBe(true);
    expect(workItems.items[0].artifacts.some((artifact) => artifact.type === 'risk-memo')).toBe(
      true
    );
    expect(text).toContain('Work item: Review the vendor contract');
    expect(composerInsert.consume()?.text).toContain('Review the document');
  });

  it('does not silently guess a runbook when the generated mission has no domain', () => {
    const text = generatedMissions.run(mission({ domain: 'unknown', context: [] }));

    expect(workItems.items).toHaveLength(0);
    expect(text).toContain('could not attach this to a durable work item');
    expect(text).toContain('Propose this');
  });
});
