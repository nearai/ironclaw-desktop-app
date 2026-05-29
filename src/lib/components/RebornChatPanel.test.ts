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
import { RebornThreadStore } from '$lib/stores/reborn-threads.svelte';
import { initialChatState, type RebornChatState } from '$lib/api/reborn';

vi.mock('./MarkdownView.svelte', () => ({ default: () => null }));

function controllerWith(state: Partial<RebornChatState>): RebornChatController {
  const c = new RebornChatController(() => null);
  c.state = { ...initialChatState(), ...state };
  return c;
}

/** A fresh, isolated thread store with a null client (load no-ops). */
function freshThreads(): RebornThreadStore {
  return new RebornThreadStore(() => null);
}

describe('RebornChatPanel', () => {
  it('renders the empty state and composer when there are no messages', () => {
    const { getByPlaceholderText, getByText } = render(RebornChatPanel, {
      props: { controller: controllerWith({}), threads: freshThreads() }
    });
    expect(getByPlaceholderText('Message IronClaw…')).toBeTruthy();
    expect(getByText('Send a message to start a conversation.')).toBeTruthy();
  });

  it('disables Send for an empty draft and enables it once text is entered', async () => {
    const { getByText, getByLabelText } = render(RebornChatPanel, {
      props: { controller: controllerWith({}), threads: freshThreads() }
    });
    const send = getByText('Send') as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    await fireEvent.input(getByLabelText('Message input'), { target: { value: 'hello' } });
    expect(send.disabled).toBe(false);
  });

  it('renders user, error, and tool bubbles from controller state', () => {
    const { getByText } = render(RebornChatPanel, {
      props: {
        threads: freshThreads(),
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
    const { getByText } = render(RebornChatPanel, {
      props: { controller, threads: freshThreads() }
    });
    expect(getByText('Approve shell?')).toBeTruthy();
    await fireEvent.click(getByText('Approve'));
    expect(resolve).toHaveBeenCalledWith('approved');
  });

  it('swaps Send for Stop while processing and routes Stop to cancel', async () => {
    const controller = controllerWith({ isProcessing: true });
    const cancel = vi.spyOn(controller, 'cancel').mockResolvedValue(undefined);
    const { getByText, queryByText } = render(RebornChatPanel, {
      props: { controller, threads: freshThreads() }
    });
    expect(queryByText('Send')).toBeNull();
    await fireEvent.click(getByText('Stop'));
    expect(cancel).toHaveBeenCalled();
  });

  it('lists threads in the rail, selects on click, and New chat clears selection', async () => {
    const threads = freshThreads();
    threads.threads = [{ thread_id: 't1', title: 'Quarterly review' }];
    const { getByText } = render(RebornChatPanel, {
      props: { controller: controllerWith({}), threads }
    });
    expect(getByText('Quarterly review')).toBeTruthy();
    await fireEvent.click(getByText('Quarterly review'));
    expect(threads.currentId).toBe('t1');
    await fireEvent.click(getByText('New chat'));
    expect(threads.currentId).toBeNull();
  });

  it('shows skeleton rows while loading with no threads yet (no empty text)', () => {
    const threads = freshThreads();
    threads.isLoading = true; // null-client load() no-ops, so this survives mount
    const { container, queryByText } = render(RebornChatPanel, {
      props: { controller: controllerWith({}), threads }
    });
    expect(container.querySelector('[data-testid="reborn-rail-skeleton"]')).toBeTruthy();
    expect(queryByText('No conversations yet.')).toBeNull();
  });

  it('renders a relative timestamp for a thread that carries one', () => {
    const threads = freshThreads();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    threads.threads = [{ thread_id: 't1', title: 'Budget review', updated_at: twoHoursAgo }];
    const { getByText } = render(RebornChatPanel, {
      props: { controller: controllerWith({}), threads }
    });
    expect(getByText('Budget review')).toBeTruthy();
    expect(getByText('2h ago')).toBeTruthy();
  });
});
