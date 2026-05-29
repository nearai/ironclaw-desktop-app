// Render smoke tests for the Desk panel's "Needs you" gate inbox. A Desk built
// on a seeded, null-client controller is injected; we assert the calm caught-up
// state, the gate card render, and that Approve/Deny route through to the
// controller's resolveGate.

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';

import RebornDeskPanel from './RebornDeskPanel.svelte';
import { RebornChatController } from '$lib/stores/reborn-chat.svelte';
import { RebornDesk } from '$lib/stores/reborn-desk.svelte';
import { initialChatState, type RebornGate } from '$lib/api/reborn';

function deskWith(gate: RebornGate | null): { desk: RebornDesk; chat: RebornChatController } {
  const chat = new RebornChatController(() => null);
  chat.state = { ...initialChatState(), pendingGate: gate };
  return { desk: new RebornDesk(chat), chat };
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
});
