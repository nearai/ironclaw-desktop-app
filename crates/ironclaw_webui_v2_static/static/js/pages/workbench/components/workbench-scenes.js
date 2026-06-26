import { useQuery } from '@tanstack/react-query';

import { Icon } from '../../../design-system/icons.js';
import { fetchTimeline, sendMessage } from '../../../lib/api.js';
import { React, html } from '../../../lib/html.js';
import { cn } from '../../../utils/cn.js';
import { useSSE } from '../../chat/hooks/useSSE.js';
import { isTerminalToolStatus, messagesFromTimeline } from '../../chat/lib/history-messages.js';
import { useChatEvents } from '../../chat/lib/useChatEvents.js';
import {
  createToolActivityState,
  resetToolActivityState
} from '../../chat/lib/tool-activity-state.js';
import { fetchApprovalsFeed } from '../lib/approvals-feed-api.js';
import { WorkbenchRunTimeline } from './workbench-run-timeline.js';

function cleanText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function latestMessage(messages, role) {
  return [...(Array.isArray(messages) ? messages : [])]
    .reverse()
    .find((message) => message?.role === role && cleanText(message.content));
}

function hasRenderableRun(messages) {
  return (Array.isArray(messages) ? messages : []).some((message) => {
    if (!message) return false;
    if (message.role === 'tool_activity') return true;
    if (message.role === 'user' || message.role === 'assistant') {
      return Boolean(String(message.content || '').trim());
    }
    return false;
  });
}

function workbenchRuntimeMessageKey(message) {
  if (!message) return '';
  if (message.role === 'tool_activity') {
    return `tool:${message.invocationId || message.callId || message.id || ''}`;
  }
  return (
    message.id || `${message.role || 'message'}:${message.sequence || ''}:${message.content || ''}`
  );
}

function workbenchRuntimeMessageRank(message) {
  if (!message) return 99;
  if (message.role === 'user') return 10;
  if (message.role === 'thinking') return 20;
  if (message.role === 'tool_activity') return 30;
  if (message.role === 'assistant') return 40;
  if (message.role === 'error') return 50;
  return 90;
}

function workbenchRuntimeUpdatedAt(message) {
  const timestamp = Date.parse(message?.updatedAt || message?.timestamp || '');
  return Number.isFinite(timestamp) ? timestamp : null;
}

function preferWorkbenchToolMessage(current, incoming) {
  const currentTerminal = isTerminalToolStatus(current?.toolStatus);
  const incomingTerminal = isTerminalToolStatus(incoming?.toolStatus);
  if (currentTerminal && !incomingTerminal) return current;
  if (incomingTerminal && !currentTerminal)
    return { ...current, ...incoming, id: current.id || incoming.id };

  const currentUpdatedAt = workbenchRuntimeUpdatedAt(current);
  const incomingUpdatedAt = workbenchRuntimeUpdatedAt(incoming);
  if (
    currentUpdatedAt !== null &&
    incomingUpdatedAt !== null &&
    currentUpdatedAt > incomingUpdatedAt
  ) {
    return current;
  }
  return { ...current, ...incoming, id: current.id || incoming.id };
}

export function mergeWorkbenchRuntimeMessages(timelineMessages = [], liveMessages = []) {
  const merged = [];
  const indexByKey = new Map();

  for (const message of [...timelineMessages, ...liveMessages]) {
    const key = workbenchRuntimeMessageKey(message);
    if (key && indexByKey.has(key)) {
      const index = indexByKey.get(key);
      merged[index] =
        message?.role === 'tool_activity'
          ? preferWorkbenchToolMessage(merged[index], message)
          : merged[index];
      continue;
    }
    if (key) indexByKey.set(key, merged.length);
    merged.push(message);
  }

  return merged
    .map((message, index) => ({ message, index }))
    .sort((left, right) => {
      const rank =
        workbenchRuntimeMessageRank(left.message) - workbenchRuntimeMessageRank(right.message);
      return rank || left.index - right.index;
    })
    .map(({ message }) => message);
}

// The first user message sent to the runtime is the verbose prompt scaffold
// (buildWorkbenchChatDraft: "Workbench request / Task / Execution preferences…").
// That belongs in the model's context, NOT on screen — the user should see the clean
// question they typed (work.title). Replace the FIRST user message's display content
// with the brief; follow-ups from the inline composer are already clean.
function withCleanQuestion(messages, title) {
  const clean = cleanText(title);
  if (!clean) return messages;
  let swapped = false;
  return messages.map((message) => {
    if (!swapped && message && message.role === 'user') {
      swapped = true;
      return { ...message, content: clean };
    }
    return message;
  });
}

function ThinkingIndicator({ attention = false }) {
  if (attention) {
    return html`<div
      className="wb13-chat-working is-attention"
      data-testid="workbench-run-attention"
    >
      <${Icon} name="flag" />
      <span>A step needs your attention — reply below to steer it.</span>
    </div>`;
  }
  return html`<div className="wb13-chat-working" data-testid="workbench-run-live">
    <span className="wb13-typing" aria-hidden="true"><i></i><i></i><i></i></span>
    <span>Thinking…</span>
  </div>`;
}

// The conversation itself: the clean question, each tool step, and the assistant's
// reply — streamed via SSE + the timeline poll, rendered in place. This is the real
// in-Workbench chat surface; nothing is fabricated and nothing hands off to the
// desktop chat.
function ConversationThread({ work, timelineQuery, liveMessages }) {
  const messages = React.useMemo(() => {
    const timelineMessages = messagesFromTimeline(timelineQuery.data?.messages || [], []);
    const merged = mergeWorkbenchRuntimeMessages(timelineMessages, liveMessages);
    return withCleanQuestion(merged, work?.title);
  }, [timelineQuery.data, liveMessages, work]);

  if (hasRenderableRun(messages)) {
    const assistant = latestMessage(messages, 'assistant');
    const failedTool = messages.some(
      (message) =>
        message &&
        message.role === 'tool_activity' &&
        (message.toolError || message.toolStatus === 'error')
    );
    const working = !assistant && !failedTool;
    return html`
      <div className="wb13-chat-thread" data-testid="workbench-live-thread-preview">
        <${WorkbenchRunTimeline} messages=${messages} />
        ${working ? html`<${ThinkingIndicator} />` : null}
        ${failedTool && !assistant ? html`<${ThinkingIndicator} attention=${true} />` : null}
      </div>
    `;
  }

  if (timelineQuery.isError) {
    return html`
      <div className="wb13-runtime-state is-warning">
        <${Icon} name="flag" />
        <span>
          <strong>Live preview unavailable.</strong>
          The run is still attached; the reply appears here the moment the timeline returns.
        </span>
      </div>
    `;
  }

  // No rows yet — show the clean question + a thinking indicator so the turn never
  // looks empty while the first token is in flight.
  const question = cleanText(work?.title);
  return html`
    <div className="wb13-chat-thread" data-testid="workbench-live-thread-preview">
      ${question
        ? html`<ol className="wb13-run">
            <li className="wb13-run-row is-user">
              <span className="wb13-run-marker" aria-hidden="true"><${Icon} name="spark" /></span>
              <div className="wb13-run-body">
                <div className="wb13-run-role">You asked</div>
                <p className="wb13-run-text">${question}</p>
              </div>
            </li>
          </ol>`
        : null}
      <${ThinkingIndicator} />
    </div>
  `;
}

// In-place approval gates: the pending gates for THIS run's thread, surfaced
// read-only. Resolving a gate is a real outbound action (behind the send sign-off),
// so this view only shows what is waiting — it never approves or denies here.
function WorkbenchRunApprovals({ approvals }) {
  const rows = Array.isArray(approvals) ? approvals : [];
  if (!rows.length) return null;
  return html`
    <div className="wb13-run-gates" data-testid="workbench-run-approvals">
      <div className="wb13-run-gates-head">
        <${Icon} name="shield" />
        <span>Waiting on your approval</span>
        <span className="wb13-run-gates-count">${rows.length}</span>
      </div>
      ${rows.map(
        (row) => html`
          <div key=${row.id} className="wb13-run-gate">
            <span className="wb13-run-gate-icon"><${Icon} name=${row.icon || 'shield'} /></span>
            <div className="wb13-run-gate-body">
              <div className="wb13-run-gate-title">${row.title}</div>
              ${row.detail ? html`<div className="wb13-run-gate-detail">${row.detail}</div>` : null}
            </div>
          </div>
        `
      )}
    </div>
  `;
}

// Inline follow-up composer — continue the conversation WITHOUT leaving the Workbench.
// Posts to the existing thread; the SSE stream + timeline refetch render the reply in
// place. This is what makes the Ask a real in-Workbench chat, not a desktop hand-off.
function WorkbenchRunComposer({ threadId, onSent }) {
  const [text, setText] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [err, setErr] = React.useState('');
  const submit = async () => {
    const content = text.trim();
    if (!content || sending || !threadId) return;
    setSending(true);
    setErr('');
    try {
      let timezone = 'UTC';
      try {
        timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      } catch (_) {
        timezone = 'UTC';
      }
      await sendMessage({ threadId, content, timezone });
      setText('');
      if (typeof onSent === 'function') onSent();
    } catch (_) {
      setErr('Could not send that. Try again.');
    } finally {
      setSending(false);
    }
  };
  return html`
    <form
      className="wb13-run-composer"
      onSubmit=${(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        className="wb13-approve-textarea"
        rows="2"
        data-testid="workbench-run-composer"
        aria-label="Continue this conversation"
        placeholder="Reply or ask a follow-up — it stays here in the Workbench."
        value=${text}
        onInput=${(event) => setText(event.currentTarget.value)}
        onKeyDown=${(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            submit();
          }
        }}
      ></textarea>
      <div className="wb13-run-composer-row">
        <span className="x">⌘↵ to send · stays in the Workbench</span>
        <button
          type="submit"
          className="wb13-button is-primary is-sm"
          data-testid="workbench-run-send"
          disabled=${!text.trim() || sending}
        >
          ${sending ? 'Sending…' : 'Send'}
        </button>
      </div>
      ${err
        ? html`<div className="wb13-reader-note is-error" role="alert">
            <${Icon} name="flag" /><span>${err}</span>
          </div>`
        : null}
    </form>
  `;
}

export function WorkbenchSceneWorkspace({ work }) {
  const threadId = work?.threadId || '';
  const [liveMessages, setLiveMessages] = React.useState([]);
  const activeRunRef = React.useRef(null);
  const pendingGateRef = React.useRef(null);
  const locallyResolvedGatesRef = React.useRef(new Map());
  const toolActivityStateRef = React.useRef(createToolActivityState());
  const setNoopProcessing = React.useCallback(() => {}, []);
  const setActiveRun = React.useCallback((next) => {
    activeRunRef.current = typeof next === 'function' ? next(activeRunRef.current) : next;
  }, []);
  const setPendingGate = React.useCallback((next) => {
    pendingGateRef.current = typeof next === 'function' ? next(pendingGateRef.current) : next;
  }, []);
  const timelineQuery = useQuery({
    queryKey: ['workbench-live-thread-preview', threadId],
    queryFn: () => fetchTimeline({ threadId, limit: 20 }),
    enabled: Boolean(threadId),
    staleTime: 2_000,
    refetchInterval: 5_000,
    retry: 1
  });
  const handleWorkbenchEvent = useChatEvents({
    threadId,
    setMessages: setLiveMessages,
    setIsProcessing: setNoopProcessing,
    setPendingGate,
    setActiveRun,
    activeRunRef,
    locallyResolvedGatesRef,
    toolActivityStateRef,
    onRunSettled: () => timelineQuery.refetch(),
    onRunCompleted: () => {},
    onRunFailed: () => {}
  });
  React.useEffect(() => {
    setLiveMessages([]);
    activeRunRef.current = null;
    pendingGateRef.current = null;
    locallyResolvedGatesRef.current = new Map();
    resetToolActivityState(toolActivityStateRef);
  }, [threadId]);
  useSSE({
    threadId,
    onEvent: handleWorkbenchEvent,
    enabled: Boolean(threadId)
  });
  // Per-thread pending approval gates for this run. Gated on the threadId, NOT
  // on a gateway capability flag (no backend emits approvals_read, so that gate
  // is permanently false); resilient like the other connector reads.
  const approvalsQuery = useQuery({
    queryKey: ['workbench-run-approvals', threadId],
    queryFn: ({ signal }) => fetchApprovalsFeed({ threadId, signal }),
    enabled: Boolean(threadId),
    staleTime: 2_000,
    refetchInterval: 5_000,
    retry: 1,
    throwOnError: false
  });

  if (!work) return null;

  return html`
    <section className="wb13-section wb13-chat" data-testid="workbench-scene-workspace">
      <${ConversationThread}
        work=${work}
        timelineQuery=${timelineQuery}
        liveMessages=${liveMessages}
      />
      <${WorkbenchRunApprovals} approvals=${approvalsQuery.data || []} />
      <${WorkbenchRunComposer} threadId=${threadId} onSent=${() => timelineQuery.refetch()} />
      <div className="wb13-chat-guard">
        <${Icon} name="shield" />
        <span
          >Reads and drafts stay here. Sending, posting, or changing another system needs your
          approval.</span
        >
      </div>
    </section>
  `;
}
