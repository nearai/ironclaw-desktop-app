import { React } from '../../../lib/html.js';
import { fetchTimeline } from '../../../lib/api.js';
import { messagesFromTimeline, pendingMessagesAfterTimeline } from '../lib/history-messages.js';

const PAGE_SIZE = 50;

export function useHistory(threadId, options = {}) {
  const { getPendingMessages, setPendingMessages } = options;
  const [state, setState] = React.useState({
    messages: [],
    nextCursor: null,
    isLoading: false
  });
  // Synchronous reentrancy guard — `isLoading` in state is async so
  // it can't gate overlapping calls (scroll-to-load + onRunCompleted
  // refetch can fire in the same tick). The ref flips before the
  // first await and clears in `finally` so a thrown timeline call
  // doesn't permanently wedge the next load.
  const loadingRef = React.useRef(false);

  const loadHistory = React.useCallback(
    async (cursor, loadOptions = {}) => {
      const { preserveClientOnly = false } = loadOptions;
      if (!threadId) {
        setState({ messages: [], nextCursor: null, isLoading: false });
        return;
      }
      if (loadingRef.current) return;
      loadingRef.current = true;
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const data = await fetchTimeline({
          threadId,
          limit: PAGE_SIZE,
          cursor
        });

        const pendingMessages = cursor ? [] : getPendingMessages?.() || [];
        const renderable = messagesFromTimeline(data.messages || [], pendingMessages);

        // RebornTimelineResponse.next_cursor === null means we reached the
        // start of the thread. Do not clear optimistic accepted user rows just
        // because timeline was empty: Reborn can accept the turn, then fail at
        // model auth before projecting the user record. Keep pending rows until
        // timeline actually confirms them.
        if (!cursor) {
          setPendingMessages?.(pendingMessagesAfterTimeline(data.messages || [], pendingMessages));
        }

        setState((prev) => {
          const merged = cursor
            ? mergePage(renderable, prev.messages)
            : mergeFullRefresh(renderable, prev.messages, { preserveClientOnly });
          return {
            messages: merged,
            nextCursor: data.next_cursor || null,
            isLoading: false
          };
        });
      } catch (err) {
        setState((s) => ({ ...s, isLoading: false }));
        // Stay loud — surface to the SPA error boundary rather than
        // silently masking timeline outages.
        console.error('Failed to load timeline:', err);
      } finally {
        loadingRef.current = false;
      }
    },
    [threadId, getPendingMessages, setPendingMessages]
  );

  React.useEffect(() => {
    setState({
      messages: [],
      nextCursor: null,
      isLoading: Boolean(threadId)
    });
    if (threadId) loadHistory();
  }, [threadId, loadHistory]);

  return {
    messages: state.messages,
    hasMore: Boolean(state.nextCursor),
    nextCursor: state.nextCursor,
    isLoading: state.isLoading,
    loadHistory,
    setMessages: (updater) =>
      setState((s) => ({
        ...s,
        messages: typeof updater === 'function' ? updater(s.messages) : updater
      }))
  };
}

function mergePage(older, current) {
  const ids = new Set(current.map((m) => m.id));
  return [...older.filter((m) => !ids.has(m.id)), ...current];
}

function mergeFullRefresh(fresh, current, options = {}) {
  const { preserveClientOnly = false } = options;
  const ids = new Set(fresh.map((m) => m?.id).filter(Boolean));
  const preserved = current.filter((message) => {
    if (!message || typeof message.id !== 'string' || ids.has(message.id)) {
      return false;
    }
    if (isRuntimeActivityMessage(message)) return true;
    return preserveClientOnly && message.id.startsWith('err-');
  });
  return preserved.length > 0 ? [...fresh, ...preserved] : fresh;
}

function isRuntimeActivityMessage(message) {
  return message?.role === 'tool_activity' || message?.role === 'thinking';
}
