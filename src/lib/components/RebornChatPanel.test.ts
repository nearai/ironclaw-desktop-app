// Render smoke tests for the IronClaw Reborn (WebChat v2) chat panel. A
// mock-client controller (no I/O) is injected and pre-seeded so the
// initial-mount effect (which never resets on first bind) preserves the
// state; we assert the message branches, the gate banner + its actions, and
// the composer's send/stop affordances. MarkdownView is mocked out so we
// don't pull the marked/DOMPurify/highlight pipeline into a unit test.

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';

import RebornChatPanel from './RebornChatPanel.svelte';
import { RebornChatController } from '$lib/stores/reborn-chat.svelte';
import { initialChatState, type RebornChatState } from '$lib/api/reborn';

vi.mock('./MarkdownView.svelte', () => ({ default: () => null }));

function controllerWith(state: Partial<RebornChatState>): RebornChatController {
  const c = new RebornChatController(() => null);
  c.state = { ...initialChatState(), ...state };
  return c;
}

describe('RebornChatPanel', () => {
  it('renders the empty state and composer when there are no messages', () => {
    const { getByPlaceholderText, getByText } = render(RebornChatPanel, {
      props: { threadId: null, controller: controllerWith({}) }
    });
    expect(getByPlaceholderText('Message IronClaw…')).toBeTruthy();
    expect(getByText('Send a message to start a conversation.')).toBeTruthy();
  });

  it('disables Send for an empty draft and enables it once text is entered', async () => {
    const { getByText, getByLabelText } = render(RebornChatPanel, {
      props: { threadId: null, controller: controllerWith({}) }
    });
    const send = getByText('Send') as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    await fireEvent.input(getByLabelText('Message input'), { target: { value: 'hello' } });
    expect(send.disabled).toBe(false);
  });

  it('renders user, error, and tool bubbles from controller state', () => {
    const { getByText } = render(RebornChatPanel, {
      props: {
        threadId: null,
        controller: controllerWith({
          messages: [
            { id: 'u1', role: 'user', content: 'hi there' },
            { id: 'e1', role: 'error', content: 'The run failed before producing a reply.' },
            {
              id: 'tool-1',
              role: 'tool_activity',
              toolName: 'builtin.http',
              toolStatus: 'success'
            }
          ]
        })
      }
    });
    expect(getByText('hi there')).toBeTruthy();
    expect(getByText('The run failed before producing a reply.')).toBeTruthy();
    expect(getByText('builtin.http')).toBeTruthy();
  });

  it('shows the gate banner and routes Approve to the controller', async () => {
    const controller = controllerWith({
      pendingGate: {
        kind: 'gate',
        runId: 'r1',
        gateRef: 'g1',
        headline: 'Approve shell?',
        body: ''
      }
    });
    const resolve = vi.spyOn(controller, 'resolveGate').mockResolvedValue(undefined);
    const { getByText } = render(RebornChatPanel, { props: { threadId: 't1', controller } });
    expect(getByText('Approve shell?')).toBeTruthy();
    await fireEvent.click(getByText('Approve'));
    expect(resolve).toHaveBeenCalledWith('approved');
  });

  it('swaps Send for Stop while processing and routes Stop to cancel', async () => {
    const controller = controllerWith({ isProcessing: true });
    const cancel = vi.spyOn(controller, 'cancel').mockResolvedValue(undefined);
    const { getByText, queryByText } = render(RebornChatPanel, {
      props: { threadId: 't1', controller }
    });
    expect(queryByText('Send')).toBeNull();
    await fireEvent.click(getByText('Stop'));
    expect(cancel).toHaveBeenCalled();
  });
});
