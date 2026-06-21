import { THREAD_STATE } from '../../../lib/thread-state.js';
import {
  normalizeThreadAttentionDetail,
  threadAttentionDetailFromGate
} from '../../../lib/thread-attention-details.js';
import { firstArtifact, savedWorkHref } from './workbench-work-items.js';

const SOURCE_RAIL_STATES = new Set(['in-progress', 'needs-reconnect']);

// Real connector-derived rail rows. The Workbench home is a forward-looking
// "what needs me" surface, not an ops console: unread mail becomes a "Needs a
// reply" group and upcoming calendar events become an "Upcoming" group. Both
// derive from live Composio reads and degrade to nothing on empty/error — they
// never fabricate a row.
function connectorReplyRows(inbox = {}) {
  const messages = Array.isArray(inbox.messages) ? inbox.messages : [];
  return messages
    .filter((message) => message && message.unread)
    .map((message) => ({
      id: `reply-${message.id}`,
      groupId: 'needs-reply',
      kind: 'inbox',
      icon: 'mail',
      title: message.subject || '(no subject)',
      badge: 'Unread',
      detail: message.sender ? `From ${message.sender}` : 'In your inbox',
      // No href: an inbox row opens the in-app reading panel (see WorkbenchDock),
      // not a route. Carry the real ids the panel needs to fetch the message.
      messageId: message.messageId || message.id || '',
      threadId: message.threadId || '',
      sender: message.sender || '',
      subject: message.subject || '',
      timestamp: message.timestamp || ''
    }));
}

function connectorUpcomingRows(calendar = {}) {
  const events = Array.isArray(calendar.events) ? calendar.events : [];
  return events.map((event) => ({
    id: `upcoming-${event.id}`,
    groupId: 'upcoming',
    kind: 'calendar',
    icon: 'calendar',
    title: event.title || '(untitled event)',
    badge: event.when || 'Scheduled',
    detail: event.location ? event.location : 'On your calendar',
    href: event.link || '/v2/workbench',
    timestamp: event.start || ''
  }));
}

function normalizeThread(thread) {
  const id = String(thread?.id || thread?.thread_id || '').trim();
  if (!id) return null;
  const updatedAt = thread?.updated_at || thread?.created_at || '';
  const attentionDetail = threadAttentionDetailFromThread(thread, updatedAt);
  const state = normalizeThreadState(thread?.state);
  return {
    id,
    title: String(thread?.title || '').trim() || `Thread ${id.slice(0, 8)}`,
    state: attentionDetail && state !== THREAD_STATE.FAILED ? THREAD_STATE.NEEDS_ATTENTION : state,
    turnCount: Number(thread?.turn_count || thread?.turnCount || 0),
    updatedAt,
    attentionDetail
  };
}

function normalizeThreadState(value) {
  const state = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
  if (state === THREAD_STATE.NEEDS_ATTENTION || state === 'needs_your_attention') {
    return THREAD_STATE.NEEDS_ATTENTION;
  }
  if (
    [
      'needs_approval',
      'requires_approval',
      'approval_required',
      'awaiting_approval',
      'waiting_for_approval',
      'auth_required',
      'blocked_on_auth',
      'needs_input',
      'waiting_for_input',
      'requires_attention'
    ].includes(state)
  ) {
    return THREAD_STATE.NEEDS_ATTENTION;
  }
  if (state === THREAD_STATE.FAILED || state === 'error') return THREAD_STATE.FAILED;
  if (state === THREAD_STATE.RUNNING || state === 'processing') return THREAD_STATE.RUNNING;
  return '';
}

function threadState(thread, threadStates) {
  const fromStore =
    threadStates && typeof threadStates.get === 'function' ? threadStates.get(thread.id) : '';
  const state = normalizeThreadState(fromStore || thread.state);
  if (thread.attentionDetail && state !== THREAD_STATE.FAILED) return THREAD_STATE.NEEDS_ATTENTION;
  return state;
}

function sourceRows(sourceReadiness = []) {
  return sourceReadiness
    .filter((item) => SOURCE_RAIL_STATES.has(item.state))
    .map((item) => ({
      id: `source-${item.id}`,
      groupId: item.state === 'needs-reconnect' ? 'blocked' : 'working',
      kind: 'source',
      icon: item.tone === 'danger' ? 'flag' : 'plug',
      title: item.displayName,
      badge: item.statusLabel,
      detail: item.body,
      href: '/extensions/registry',
      priority: item.priority ?? 9
    }))
    .sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
}

function attentionDetailForThread(threadAttentionDetails, threadId) {
  if (!threadAttentionDetails || !threadId) return null;
  if (typeof threadAttentionDetails.get === 'function') return threadAttentionDetails.get(threadId);
  if (typeof threadAttentionDetails === 'object') return threadAttentionDetails[threadId] || null;
  return null;
}

function threadAttentionDetailFromThread(thread, timestamp) {
  const direct = normalizeThreadAttentionDetail(
    thread?.attention_detail ||
      thread?.attentionDetail ||
      thread?.pending_attention ||
      thread?.pendingAttention
  );
  if (direct) {
    return {
      ...direct,
      timestamp: direct.timestamp || timestamp || ''
    };
  }

  const gate = firstGateCandidate(
    thread?.pending_gate,
    thread?.pendingGate,
    thread?.pending_gates,
    thread?.pendingGates,
    thread?.approval_gate,
    thread?.approvalGate,
    thread?.auth_gate,
    thread?.authGate
  );
  return gate ? threadAttentionDetailFromGate(gate, timestamp || undefined) : null;
}

function firstGateCandidate(...values) {
  for (const value of values) {
    if (Array.isArray(value)) {
      const gate = value.find((item) => item && typeof item === 'object');
      if (gate) return gate;
    } else if (value && typeof value === 'object') {
      return value;
    }
  }
  return null;
}

function threadAttentionRows(threads, threadStates, threadAttentionDetails) {
  return threads
    .map((thread) => {
      const state = threadState(thread, threadStates);
      if (state !== THREAD_STATE.NEEDS_ATTENTION && state !== THREAD_STATE.FAILED) return null;
      const detail =
        state === THREAD_STATE.NEEDS_ATTENTION
          ? thread.attentionDetail || attentionDetailForThread(threadAttentionDetails, thread.id)
          : null;
      return {
        id: `thread-${thread.id}`,
        groupId: state === THREAD_STATE.FAILED ? 'blocked' : 'needs-approval',
        kind: 'thread',
        icon: state === THREAD_STATE.FAILED ? 'flag' : detail?.icon || 'shield',
        title: detail?.title || thread.title,
        badge: state === THREAD_STATE.FAILED ? 'Needs recovery' : detail?.badge || 'Needs approval',
        detail:
          state === THREAD_STATE.FAILED
            ? 'A run failed and needs a next step.'
            : detail?.detail || 'An approval or auth gate is waiting in this thread.',
        href: `/chat/${thread.id}`,
        timestamp: detail?.timestamp || thread.updatedAt
      };
    })
    .filter(Boolean);
}

function runningThreadRows(threads, threadStates) {
  return threads
    .map((thread) => {
      if (threadState(thread, threadStates) !== THREAD_STATE.RUNNING) return null;
      return {
        id: `running-${thread.id}`,
        groupId: 'working',
        kind: 'thread',
        icon: 'pulse',
        title: thread.title,
        badge: 'Working',
        detail: 'A run is active in this thread.',
        href: `/chat/${thread.id}`,
        timestamp: thread.updatedAt
      };
    })
    .filter(Boolean);
}

function recentThreadRows(threads, threadStates) {
  return threads
    .filter((thread) => thread.turnCount > 0)
    .filter((thread) => {
      const state = threadState(thread, threadStates);
      return (
        state !== THREAD_STATE.RUNNING &&
        state !== THREAD_STATE.NEEDS_ATTENTION &&
        state !== THREAD_STATE.FAILED
      );
    })
    .map((thread) => ({
      id: `recent-${thread.id}`,
      groupId: 'needs-review',
      kind: 'thread',
      icon: 'chat',
      title: thread.title,
      badge: 'Recent',
      detail: `${thread.turnCount} ${thread.turnCount === 1 ? 'turn' : 'turns'} in the thread.`,
      href: `/chat/${thread.id}`,
      timestamp: thread.updatedAt
    }));
}

function savedWorkRows(savedItems) {
  const rows = [];
  for (const item of Array.isArray(savedItems) ? savedItems : []) {
    const artifact = firstArtifact(item);
    const href = savedWorkHref(item);
    const timestamp = item.updated_at || item.created_at || '';
    const approvals = Array.isArray(item?.openApprovals) ? item.openApprovals : [];
    approvals.forEach((approval, index) => {
      rows.push({
        id: `approval-${item.id}-${approval?.id || index}`,
        groupId: 'needs-approval',
        kind: 'approval',
        icon: 'shield',
        title: approval?.title || item.title || 'Approval waiting',
        badge: 'Needs approval',
        detail:
          approval?.summary ||
          approval?.detail ||
          approval?.barDetail ||
          'A prepared external action is held until you review it.',
        href,
        timestamp
      });
    });

    const watches = Array.isArray(item?.watches) ? item.watches : [];
    watches.forEach((watch, index) => {
      rows.push({
        id: `watch-${item.id}-${watch?.id || index}`,
        groupId: 'scheduled',
        kind: 'watch',
        icon: 'clock',
        title: watch?.title || item.title || 'Scheduled work',
        badge: watch?.cadence || watch?.status || 'Scheduled',
        detail:
          watch?.detail ||
          watch?.summary ||
          'Recurring work prepares privately and asks before delivery.',
        href,
        timestamp
      });
    });

    const receipts = Array.isArray(item?.receipts) ? item.receipts : [];
    receipts.forEach((receipt, index) => {
      rows.push({
        id: `receipt-${item.id}-${receipt?.id || index}`,
        groupId: 'receipts',
        kind: 'receipt',
        icon: receipt?.kind === 'mail' ? 'mail' : 'file',
        title: receipt?.title || receipt?.label || item.title || 'Receipt saved',
        badge: receipt?.status || receipt?.tag || 'Receipt',
        detail: receipt?.detail || receipt?.sub || 'Recorded from completed work.',
        href,
        timestamp: receipt?.when || timestamp
      });
    });

    if (artifact) {
      rows.push({
        id: `saved-${item.id}`,
        groupId: approvals.length ? 'needs-approval' : 'needs-review',
        kind: 'work',
        icon: 'file',
        title: item.title || artifact.title || 'Saved work',
        badge: approvals.length
          ? 'Held for review'
          : artifact.status === 'ready'
            ? 'Ready to review'
            : 'Saved',
        detail: artifact.title || 'Prepared work saved to Work.',
        href,
        timestamp
      });
    }
  }
  return rows;
}

function automationRows(automations) {
  const rows = [];
  for (const [index, automation] of (Array.isArray(automations) ? automations : []).entries()) {
    const id = automationId(automation, index);
    const title = automation?.display_name || automation?.name || 'Scheduled automation';
    const latestRun = automation?.latest_run || null;
    const currentRun = automation?.current_run || null;
    const href = currentRun?.chat_path || latestRun?.chat_path || '/automations';
    const nextRun = automation?.next_run_label || 'Not scheduled';
    const schedule = automation?.schedule_label || automation?.state_label || 'Scheduled';

    if (automation?.has_running_run || currentRun?.status === 'running') {
      rows.push({
        id: `automation-running-${id}`,
        groupId: 'working',
        kind: 'automation',
        icon: 'pulse',
        title,
        badge: 'Running',
        detail: currentRun?.fired_label
          ? `Current scheduled run started ${currentRun.fired_label}.`
          : 'A scheduled run is active.',
        href,
        timestamp:
          currentRun?.timestamp_source || currentRun?.submitted_at || automation?.updated_at || ''
      });
    }

    if (automationLatestRunFailed(automation)) {
      rows.push({
        id: `automation-failed-${id}`,
        groupId: 'blocked',
        kind: 'automation',
        icon: 'flag',
        title,
        badge: 'Run failed',
        detail: latestRun?.completed_label
          ? `Last scheduled run failed ${latestRun.completed_label}.`
          : 'The latest scheduled run needs recovery.',
        href,
        timestamp:
          latestRun?.completed_at ||
          latestRun?.timestamp_source ||
          automation?.last_run_at ||
          automation?.updated_at ||
          ''
      });
    }

    if (automationIsActiveSchedule(automation)) {
      rows.push({
        id: `automation-scheduled-${id}`,
        groupId: 'scheduled',
        kind: 'automation',
        icon: 'clock',
        title,
        badge: schedule,
        detail:
          nextRun && nextRun !== 'Not scheduled'
            ? `Next run: ${nextRun}.`
            : 'Scheduled work prepares privately and asks before delivery.',
        href: '/automations',
        timestamp: automation?.next_run_at || automation?.updated_at || automation?.created_at || ''
      });
    }

    if (latestRun?.status === 'ok') {
      rows.push({
        id: `automation-receipt-${id}-${latestRun.run_id || latestRun.timestamp || 'latest'}`,
        groupId: 'receipts',
        kind: 'automation',
        icon: 'check',
        title,
        badge: 'Completed',
        detail: latestRun.completed_label
          ? `Scheduled run completed ${latestRun.completed_label}.`
          : 'Scheduled run completed.',
        href: latestRun.chat_path || '/automations',
        timestamp:
          latestRun.completed_at ||
          latestRun.timestamp_source ||
          automation?.last_run_at ||
          automation?.updated_at ||
          ''
      });
    }
  }
  return rows;
}

function automationId(automation, index) {
  return String(
    automation?.automation_id ||
      automation?.id ||
      automation?.display_name ||
      automation?.name ||
      index
  )
    .trim()
    .replace(/\s+/g, '-');
}

function automationIsActiveSchedule(automation) {
  return (
    automation?.state === 'active' ||
    automation?.state === 'scheduled' ||
    automation?.state_tone === 'gold'
  );
}

function automationLatestRunFailed(automation) {
  return (
    automation?.latest_run?.status === 'error' ||
    automation?.last_status === 'error' ||
    automation?.last_status_tone === 'danger' ||
    String(automation?.last_status_label || '').toLowerCase() === 'error'
  );
}

function compareByTimestampDesc(a, b) {
  return timestampValue(b.timestamp) - timestampValue(a.timestamp);
}

function timestampValue(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function limitRows(rows, limit) {
  const visible = rows.slice(0, limit);
  return { rows: visible, total: rows.length, overflow: Math.max(0, rows.length - visible.length) };
}

export function buildWorkbenchStateRail({
  threads = [],
  threadStates = new Map(),
  threadAttentionDetails = new Map(),
  savedItems = [],
  automations = [],
  sourceReadiness = [],
  inbox = null,
  calendar = null,
  limit = 3
} = {}) {
  const normalizedThreads = (Array.isArray(threads) ? threads : [])
    .map(normalizeThread)
    .filter(Boolean);
  const rows = [
    ...connectorReplyRows(inbox || {}),
    ...sourceRows(sourceReadiness),
    ...threadAttentionRows(normalizedThreads, threadStates, threadAttentionDetails),
    ...runningThreadRows(normalizedThreads, threadStates),
    ...recentThreadRows(normalizedThreads, threadStates),
    ...savedWorkRows(savedItems),
    ...automationRows(automations),
    ...connectorUpcomingRows(calendar || {})
  ];

  return WORKBENCH_STATE_GROUPS.map((group) => ({
    ...group,
    ...limitRows(
      rows.filter((row) => row.groupId === group.id).sort(group.sort || compareByTimestampDesc),
      limit
    )
  }));
}

// Upcoming events sort ascending (soonest first); everything else sorts by most
// recent activity.
function compareByTimestampAsc(a, b) {
  return timestampValue(a.timestamp) - timestampValue(b.timestamp);
}

export const WORKBENCH_STATE_GROUPS = Object.freeze([
  {
    id: 'needs-reply',
    label: 'Needs a reply',
    emptyTitle: 'Inbox is clear.',
    emptyDetail: 'Unread mail that needs you will appear here.'
  },
  {
    id: 'needs-approval',
    label: 'Needs approval',
    emptyTitle: 'Nothing waiting.',
    emptyDetail: 'Approvals that need your review will appear here.'
  },
  {
    id: 'blocked',
    label: 'Blocked',
    emptyTitle: 'Nothing blocked.',
    emptyDetail: 'Reconnects and failed runs will show here.'
  },
  {
    id: 'working',
    label: 'Working',
    emptyTitle: 'No active work.',
    emptyDetail: 'Running threads and setup work will show here.'
  },
  {
    id: 'needs-review',
    label: 'Ready to review',
    emptyTitle: 'Nothing ready yet.',
    emptyDetail: 'Drafts, briefs, and saved artifacts will appear here.'
  },
  {
    id: 'upcoming',
    label: 'Upcoming',
    sort: compareByTimestampAsc,
    emptyTitle: 'Nothing on the calendar.',
    emptyDetail: 'Your next calendar events will appear here.'
  },
  {
    id: 'scheduled',
    label: 'Scheduled',
    emptyTitle: 'No scheduled work.',
    emptyDetail: 'Recurring work that asks before delivery will appear here.'
  },
  {
    id: 'receipts',
    label: 'Recent receipts',
    emptyTitle: 'No receipts yet.',
    emptyDetail: 'Completed actions and saved receipts will appear here.'
  }
]);
