import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { Icon } from '../../../design-system/icons.js';
import { fetchTimeline } from '../../../lib/api.js';
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
import { actionRows, outputHint } from '../lib/workbench-scenes-registry.js';
import { WorkbenchRunTimeline } from './workbench-run-timeline.js';

function cleanText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function SceneSummary({ work }) {
  return html`
    <div className=${cn('wb13-scene-summary', `is-${work.scene.id}`)}>
      <div className="wb13-scene-mark"><${Icon} name="pulse" /></div>
      <div>
        <div className="wb13-scene-kicker">${work.scene.label}</div>
        <h2>${work.scene.title}</h2>
        <p>${work.scene.detail}</p>
      </div>
      <${Link}
        to=${`/chat/${encodeURIComponent(work.threadId)}`}
        className="wb13-button is-primary"
      >
        Open live thread
      <//>
    </div>
  `;
}

function SceneActionRows({ sceneId }) {
  return html`
    <div className="wb13-scene-rows">
      ${actionRows(sceneId).map(
        ([title, detail, state]) => html`
          <div key=${title} className="wb13-scene-row">
            <span className="wb13-row-icon"
              ><${Icon}
                name=${state === 'Blocked' ? 'flag' : state === 'Scheduled' ? 'clock' : 'shield'}
            /></span>
            <span>
              <span className="wb13-row-title">${title}</span>
              <span className="wb13-row-copy">${detail}</span>
            </span>
            <span
              className=${cn(
                'wb13-scene-state',
                state === 'Blocked' && 'is-blocked',
                state === 'Draft' && 'is-draft',
                state === 'Approval' && 'is-approval'
              )}
            >
              ${state}
            </span>
          </div>
        `
      )}
    </div>
  `;
}

function preferenceRows(work) {
  const preferences = work?.preferences || {};
  return [
    ['Model', preferences.model || 'Active NEAR AI Cloud model'],
    ['Effort', preferences.effort || 'Standard'],
    ['Sources', preferences.sources || 'Auto sources'],
    ['Timing', preferences.timing || 'Not specified']
  ];
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

function TimelinePreview({ work, timelineQuery, liveMessages }) {
  const messages = React.useMemo(() => {
    const timelineMessages = messagesFromTimeline(timelineQuery.data?.messages || [], []);
    return mergeWorkbenchRuntimeMessages(timelineMessages, liveMessages);
  }, [timelineQuery.data, liveMessages]);
  const user = latestMessage(messages, 'user');

  if (hasRenderableRun(messages)) {
    // Run state from the live timeline alone — no fabrication. A landed
    // assistant reply means done (a tool error_kind can precede a successful
    // recovery, so a reply always wins). A failed tool with no reply yet is the
    // honest "needs attention" state. Otherwise the run is still working.
    const assistant = latestMessage(messages, 'assistant');
    const failedTool = messages.some(
      (message) =>
        message &&
        message.role === 'tool_activity' &&
        (message.toolError || message.toolStatus === 'error')
    );
    const runState = assistant ? 'done' : failedTool ? 'attention' : 'running';
    return html`
      <div className="wb13-runtime-preview" data-testid="workbench-live-thread-preview">
        <div className="wb13-runtime-preview-head">
          <${Icon} name="pulse" />
          <span>Live run</span>
          ${runState === 'running'
            ? html`<span className="wb13-run-live" data-testid="workbench-run-live">Working…</span>`
            : null}
          ${runState === 'attention'
            ? html`<span
                className="wb13-run-live is-attention"
                data-testid="workbench-run-attention"
                >Needs attention</span
              >`
            : null}
        </div>
        <${WorkbenchRunTimeline} messages=${messages} />
        <${Link} to=${`/chat/${encodeURIComponent(work.threadId)}`} className="wb13-button is-sm">
          Review full thread
        <//>
      </div>
    `;
  }

  if (timelineQuery.isError) {
    return html`
      <div className="wb13-runtime-state is-warning">
        <${Icon} name="flag" />
        <span>
          <strong>Live preview unavailable.</strong>
          Open the live thread to inspect the run. Workbench will not invent a draft without the
          timeline.
        </span>
      </div>
    `;
  }

  return html`
    <div className="wb13-runtime-state">
      <${Icon} name="shield" />
      <span>
        <strong>${user ? 'Runtime accepted the request.' : 'Waiting on the live thread.'}</strong>
        ${user
          ? 'The request is in the registered Chat timeline. Assistant output will appear here when it lands.'
          : `When the thread returns ${outputHint(work.scene.id)}, they will appear here for review.`}
      </span>
    </div>
  `;
}

// In-place approval gates: the pending gates for THIS run's thread, surfaced
// read-only on the run card. The route is per-thread, so we scope to
// work.threadId. Resolving a gate is a real outbound action (Phase 4, behind
// the send sign-off), so this view only shows what is waiting and links into
// the live thread to act — it never approves or denies here.
function WorkbenchRunApprovals({ approvals, threadId }) {
  const rows = Array.isArray(approvals) ? approvals : [];
  if (!rows.length) return null;
  const fallbackHref = threadId ? `/chat/${encodeURIComponent(threadId)}` : '/workbench';
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
            <${Link} to=${row.href || fallbackHref} className="wb13-button is-sm"> Review <//>
          </div>
        `
      )}
    </div>
  `;
}

function RuntimeWorkspace({ work, timelineQuery, approvals, liveMessages }) {
  return html`
    <div className="wb13-scene-grid">
      <div className="wb13-scene-panel">
        <div className="wb13-scene-title">Current request</div>
        <p className="wb13-scene-copy">${cleanText(work.title, 'Workbench request')}</p>
        <${TimelinePreview}
          work=${work}
          timelineQuery=${timelineQuery}
          liveMessages=${liveMessages}
        />
        <${WorkbenchRunApprovals} approvals=${approvals} threadId=${work.threadId} />
        <div className="wb13-source-card is-hold">
          <${Icon} name="shield" />
          <strong>External actions still need approval.</strong>
          <p>
            Sending, posting, filing, or changing another system remains owned by the live approval
            gate.
          </p>
          <span>Live run activity stays visible here; external changes remain gated.</span>
        </div>
      </div>
      <div className="wb13-scene-panel">
        <div className="wb13-scene-title">Preferences sent</div>
        <div className="wb13-pref-list">
          ${preferenceRows(work).map(
            ([label, value]) => html`
              <div key=${label} className="wb13-pref-row">
                <span>${label}</span>
                <strong>${value}</strong>
              </div>
            `
          )}
        </div>
        <${Link} to=${`/chat/${encodeURIComponent(work.threadId)}`} className="wb13-button is-sm">
          Continue in live thread
        <//>
      </div>
    </div>
  `;
}

function SceneBody({ work, timelineQuery, approvals, liveMessages }) {
  return html`<${RuntimeWorkspace}
    work=${work}
    timelineQuery=${timelineQuery}
    approvals=${approvals}
    liveMessages=${liveMessages}
  />`;
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
    <section className="wb13-section wb13-scene" data-testid="workbench-scene-workspace">
      <${SceneSummary} work=${work} />
      <${SceneActionRows} sceneId=${work.scene.id} />
      <${SceneBody}
        work=${work}
        timelineQuery=${timelineQuery}
        approvals=${approvalsQuery.data || []}
        liveMessages=${liveMessages}
      />
    </section>
  `;
}
