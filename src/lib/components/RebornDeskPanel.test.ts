// Render smoke tests for the Desk panel's "Needs you" gate inbox. A Desk built
// on a seeded, null-client controller is injected; we assert the calm caught-up
// state, the gate card render, and that Approve/Deny route through to the
// controller's resolveGate.

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';

import RebornDeskPanel from './RebornDeskPanel.svelte';
import { RebornChatController } from '$lib/stores/reborn-chat.svelte';
import { RebornDesk } from '$lib/stores/reborn-desk.svelte';
import { OpenLoopStore } from '$lib/stores/open-loops.svelte';
import { initialChatState, type RebornGate } from '$lib/api/reborn';

function deskWith(gate: RebornGate | null): {
  desk: RebornDesk;
  chat: RebornChatController;
  loops: OpenLoopStore;
} {
  const chat = new RebornChatController(() => null);
  chat.state = { ...initialChatState(), pendingGate: gate };
  const loops = new OpenLoopStore();
  return { desk: new RebornDesk(chat, loops), chat, loops };
}

describe('RebornDeskPanel', () => {
  it('shows the calm "all caught up" state when nothing is pending', () => {
    const { desk } = deskWith(null);
    const { getByTestId, getByText } = render(RebornDeskPanel, { props: { desk } });
    expect(getByTestId('desk-caught-up')).toBeTruthy();
    expect(getByText("You're all caught up")).toBeTruthy();
  });

  it('renders a Needs-you card for a pending gate', () => {
    const { desk } = deskWith({
      kind: 'gate',
      runId: 'r1',
      gateRef: 'g1',
      headline: 'Send the Q3 deck to Priya?',
      body: ''
    });
    const { getByText } = render(RebornDeskPanel, { props: { desk } });
    expect(getByText('Send the Q3 deck to Priya?')).toBeTruthy();
    expect(getByText('Approve')).toBeTruthy();
    expect(getByText('Deny')).toBeTruthy();
  });

  it('routes Approve and Deny to the controller resolveGate', async () => {
    const { desk, chat } = deskWith({ kind: 'gate', runId: 'r1', gateRef: 'g1', headline: 'OK?' });
    const resolve = vi.spyOn(chat, 'resolveGate').mockResolvedValue(undefined);
    const { getByText } = render(RebornDeskPanel, { props: { desk } });
    await fireEvent.click(getByText('Approve'));
    expect(resolve).toHaveBeenCalledWith('approved');
    await fireEvent.click(getByText('Deny'));
    expect(resolve).toHaveBeenCalledWith('denied');
  });

  it('renders open-loop cards and routes Done / Dismiss', async () => {
    const { desk, loops } = deskWith(null);
    const a = loops.add('Send the deck to Priya');
    // mockImplementation so the spies don't call through and mutate the store
    // (which would remove the card before we click the second button).
    const done = vi.spyOn(desk, 'resolveLoop').mockImplementation(() => {});
    const dismiss = vi.spyOn(desk, 'dismissLoop').mockImplementation(() => {});
    const { getByText } = render(RebornDeskPanel, { props: { desk } });
    expect(getByText('Send the deck to Priya')).toBeTruthy();
    await fireEvent.click(getByText('Done'));
    expect(done).toHaveBeenCalledWith(a!.id);
    await fireEvent.click(getByText('Dismiss'));
    expect(dismiss).toHaveBeenCalledWith(a!.id);
  });
});
