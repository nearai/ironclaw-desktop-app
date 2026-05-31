// Tests for the Desk store's "Needs you" gate-inbox derivation. A controller
// with a null client (no I/O) is seeded with a pendingGate; we assert the card
// projection, the caught-up state, and that approve/deny delegate to the
// controller's resolveGate. The reducer/transport are covered elsewhere.

import { describe, expect, it, vi } from 'vitest';

import { RebornChatController } from './reborn-chat.svelte';
import { RebornDesk } from './reborn-desk.svelte';
import { OpenLoopStore } from './open-loops.svelte';
import { connection } from './connection.svelte';
import { initialChatState, type RebornGate } from '$lib/api/reborn';
import type { Job } from '$lib/api/types';

function deskWithGate(gate: RebornGate | null): { desk: RebornDesk; chat: RebornChatController } {
  const chat = new RebornChatController(() => null);
  chat.state = { ...initialChatState(), pendingGate: gate };
  // Inject a fresh empty loop store so gate tests are isolated from any
  // open-loops singleton state.
  return { desk: new RebornDesk(chat, new OpenLoopStore()), chat };
}

describe('RebornDesk gate inbox', () => {
  it('is caught up with no pending gate', () => {
    const { desk } = deskWithGate(null);
    expect(desk.gateCards).toEqual([]);
    expect(desk.caughtUp).toBe(true);
  });

  it('projects a pending gate into a Needs-you card', () => {
    const { desk } = deskWithGate({
      kind: 'gate',
      runId: 'r1',
      gateRef: 'g1',
      headline: 'Run shell `rm -rf build`?',
      body: 'Clears the build dir.'
    });
    expect(desk.caughtUp).toBe(false);
    expect(desk.gateCards).toEqual([
      {
        id: 'r1:g1',
        kind: 'gate',
        runId: 'r1',
        gateRef: 'g1',
        headline: 'Run shell `rm -rf build`?',
        body: 'Clears the build dir.'
      }
    ]);
  });

  it('defaults the headline for an auth gate with none, and tolerates empty body', () => {
    const { desk } = deskWithGate({ kind: 'auth_required', runId: 'r2', gateRef: 'a2' });
    expect(desk.gateCards[0]).toMatchObject({
      id: 'r2:a2',
      kind: 'auth_required',
      headline: 'Authorization required',
      body: ''
    });
  });

  it('ignores an unusable gate missing runId/gateRef', () => {
    const { desk } = deskWithGate({ kind: 'gate', runId: '', gateRef: '', headline: 'x' });
    expect(desk.gateCards).toEqual([]);
    expect(desk.caughtUp).toBe(true);
  });

  it('approve / deny delegate to the controller resolveGate', async () => {
    const { desk, chat } = deskWithGate({ kind: 'gate', runId: 'r1', gateRef: 'g1' });
    const resolve = vi.spyOn(chat, 'resolveGate').mockResolvedValue(undefined);
    await desk.approve();
    expect(resolve).toHaveBeenCalledWith('approved');
    await desk.deny();
    expect(resolve).toHaveBeenCalledWith('denied');
  });
});

describe('RebornDesk open loops', () => {
  function deskWithLoops(): { desk: RebornDesk; loops: OpenLoopStore } {
    const chat = new RebornChatController(() => null);
    chat.state = { ...initialChatState() };
    const loops = new OpenLoopStore();
    return { desk: new RebornDesk(chat, loops), loops };
  }

  it('projects active open loops into loop cards in order', () => {
    const { desk, loops } = deskWithLoops();
    loops.add('Send Priya the deck');
    loops.add('Reply to the board email');
    expect(desk.loopCards.map((c) => c.text)).toEqual([
      'Send Priya the deck',
      'Reply to the board email'
    ]);
  });

  it('resolveLoop drops it from active; dismissLoop removes it', () => {
    const { desk, loops } = deskWithLoops();
    const a = loops.add('one');
    const b = loops.add('two');
    desk.resolveLoop(a!.id);
    expect(desk.loopCards.map((c) => c.text)).toEqual(['two']);
    desk.dismissLoop(b!.id);
    expect(desk.loopCards).toEqual([]);
  });

  it('addLoop captures a (trimmed) commitment and ignores empty input', () => {
    const { desk } = deskWithLoops();
    desk.addLoop('  Follow up with Sam  ');
    expect(desk.loopCards.map((c) => c.text)).toEqual(['Follow up with Sam']);
    desk.addLoop('   ');
    expect(desk.loopCards).toHaveLength(1);
  });
});

describe('RebornDesk handled jobs', () => {
  function deskWithJobs(jobsReader?: () => Promise<Job[]>): RebornDesk {
    const chat = new RebornChatController(() => null);
    chat.state = { ...initialChatState() };
    return new RebornDesk(chat, new OpenLoopStore(), jobsReader ?? null);
  }

  it('stays empty when there is no connected jobs client', async () => {
    const previousToken = connection.token;
    connection.token = null;
    const desk = deskWithJobs();
    try {
      await desk.loadHandled();
      expect(desk.handledCards).toEqual([]);
    } finally {
      connection.token = previousToken;
    }
  });

  it('projects recent jobs into Handled cards', async () => {
    const desk = deskWithJobs(async () => [
      {
        id: 'job-completed-123456',
        title: 'Draft weekly investor update',
        state: 'completed',
        user_id: 'default',
        created_at: '2026-05-31T08:00:00Z'
      },
      {
        id: 'job-running-123456',
        title: 'Research vendor renewal',
        state: 'in_progress',
        user_id: 'default',
        created_at: '2026-05-31T09:00:00Z',
        started_at: '2026-05-31T09:01:00Z'
      },
      {
        id: 'job-failed-123456',
        title: '',
        state: 'failed',
        user_id: 'default',
        created_at: '2026-05-31T10:00:00Z'
      }
    ]);

    await desk.loadHandled();

    expect(desk.handledCards).toEqual([
      {
        id: 'job-completed-123456',
        title: 'Draft weekly investor update',
        status: 'done',
        detail: 'Completed',
        at: '2026-05-31T08:00:00Z'
      },
      {
        id: 'job-running-123456',
        title: 'Research vendor renewal',
        status: 'running',
        detail: 'Running',
        at: '2026-05-31T09:01:00Z'
      },
      {
        id: 'job-failed-123456',
        title: 'Job job-fail...',
        status: 'failed',
        detail: 'Failed',
        at: '2026-05-31T10:00:00Z'
      }
    ]);
  });

  it('degrades to empty handled cards when the jobs request fails', async () => {
    const desk = deskWithJobs(async () => {
      throw new Error('gateway unavailable');
    });

    await desk.loadHandled();

    expect(desk.handledCards).toEqual([]);
  });
});
