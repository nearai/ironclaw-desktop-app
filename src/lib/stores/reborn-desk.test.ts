// Tests for the Desk store's "Needs you" gate-inbox derivation. A controller
// with a null client (no I/O) is seeded with a pendingGate; we assert the card
// projection, the caught-up state, and that approve/deny delegate to the
// controller's resolveGate. The reducer/transport are covered elsewhere.

import { describe, expect, it, vi } from 'vitest';

import { RebornChatController } from './reborn-chat.svelte';
import { RebornDesk } from './reborn-desk.svelte';
import { initialChatState, type RebornGate } from '$lib/api/reborn';

function deskWithGate(gate: RebornGate | null): { desk: RebornDesk; chat: RebornChatController } {
  const chat = new RebornChatController(() => null);
  chat.state = { ...initialChatState(), pendingGate: gate };
  return { desk: new RebornDesk(chat), chat };
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
