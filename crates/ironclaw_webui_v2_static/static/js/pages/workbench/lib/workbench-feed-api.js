import { V2_BASE, apiFetch } from '../../../lib/api.js';

const GROUP_ALIASES = new Map([
  ['needs_reply', 'needs-reply'],
  ['reply', 'needs-reply'],
  ['inbox', 'needs-reply'],
  ['mail', 'needs-reply'],
  ['email', 'needs-reply'],
  ['needs_approval', 'needs-approval'],
  ['approval', 'needs-approval'],
  ['approvals', 'needs-approval'],
  ['decision', 'needs-approval'],
  ['needs_decision', 'needs-approval'],
  ['blocked', 'blocked'],
  ['error', 'blocked'],
  ['failed', 'blocked'],
  ['reconnect', 'blocked'],
  ['working', 'working'],
  ['running', 'working'],
  ['in_progress', 'working'],
  ['needs_review', 'needs-review'],
  ['review', 'needs-review'],
  ['ready', 'needs-review'],
  ['changed', 'needs-review'],
  ['upcoming', 'upcoming'],
  ['calendar', 'upcoming'],
  ['scheduled', 'scheduled'],
  ['schedule', 'scheduled'],
  ['watch', 'scheduled'],
  ['receipt', 'receipts'],
  ['receipts', 'receipts'],
  ['completed', 'receipts'],
  ['done', 'receipts'],
  ['audit', 'receipts']
]);

const GROUP_DEFAULTS = Object.freeze({
  'needs-reply': {
    badge: 'Needs reply',
    detail: 'A source item needs a response.',
    icon: 'mail'
  },
  'needs-approval': {
    badge: 'Needs approval',
    detail: 'Prepared work is waiting for your decision.',
    icon: 'shield'
  },
  blocked: {
    badge: 'Blocked',
    detail: 'Something needs recovery before work can continue.',
    icon: 'flag'
  },
  working: {
    badge: 'Working',
    detail: 'Work is currently running.',
    icon: 'pulse'
  },
  'needs-review': {
    badge: 'Ready to review',
    detail: 'Prepared work is ready for review.',
    icon: 'file'
  },
  upcoming: {
    badge: 'Upcoming',
    detail: 'An upcoming commitment is on your calendar.',
    icon: 'calendar'
  },
  scheduled: {
    badge: 'Scheduled',
    detail: 'Recurring work is scheduled.',
    icon: 'clock'
  },
  receipts: {
    badge: 'Receipt',
    detail: 'Completed work was recorded.',
    icon: 'check'
  }
});

export async function fetchWorkbenchFeed({ fetcher = apiFetch, signal } = {}) {
  return normalizeWorkbenchFeed(await fetcher(`${V2_BASE}/workbench/feed`, { signal }));
}

export function workbenchFeedReadSupported(gatewayStatus) {
  const value =
    gatewayStatus?.capabilities?.workbench_feed_read ??
    gatewayStatus?.capabilities?.pending_feed_read ??
    gatewayStatus?.capabilities?.changed_feed_read ??
    gatewayStatus?.features?.workbench_feed_read ??
    gatewayStatus?.features?.pending_feed_read ??
    gatewayStatus?.workbench?.feed_read ??
    gatewayStatus?.feed?.read;
  return value === true || value === 'true' || value === 'available' || value === 'enabled';
}

export function normalizeWorkbenchFeed(response) {
  const rawItems = firstNonEmptyArray(
    response?.feed,
    response?.pending,
    response?.changes,
    response?.items,
    response?.data?.items,
    response
  );
  return rawItems.map(normalizeFeedItem).filter(Boolean);
}

function normalizeFeedItem(item) {
  if (!item || typeof item !== 'object') return null;
  const groupId = normalizeGroupId(
    item.group_id || item.groupId || item.group || item.bucket || item.lane || item.category
  );
  if (!groupId) return null;

  const title = safeText(
    item.title || item.headline || item.subject || item.label || item.name,
    ''
  );
  if (!title) return null;

  const threadId = safeText(item.thread_id || item.threadId || item.thread?.id, '');
  const timestamp =
    safeText(
      item.updated_at ||
        item.updatedAt ||
        item.created_at ||
        item.createdAt ||
        item.occurred_at ||
        item.occurredAt ||
        item.due_at ||
        item.dueAt ||
        item.timestamp,
      ''
    ) || '';
  const explicitId = safeText(
    item.id ||
      item.feed_id ||
      item.feedId ||
      item.item_id ||
      item.itemId ||
      item.event_id ||
      item.eventId,
    ''
  );
  const id =
    explicitId || (threadId && timestamp ? `${groupId}:${threadId}:${timestamp}:${title}` : '');
  if (!id) return null;

  const defaults = GROUP_DEFAULTS[groupId];
  return {
    id,
    groupId,
    title,
    badge: safeText(
      item.badge || item.status_label || item.statusLabel || item.status,
      defaults.badge
    ),
    detail: safeText(item.detail || item.summary || item.body || item.description, defaults.detail),
    icon: safeText(item.icon, '') || feedIcon(item, defaults.icon),
    href: feedHref(item, threadId),
    timestamp,
    source: safeText(item.source || item.provider || item.toolkit, '')
  };
}

function normalizeGroupId(value) {
  const key = safeText(value, '')
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
  return GROUP_ALIASES.get(key) || '';
}

function feedIcon(item, fallback) {
  const text = [
    item.kind,
    item.source,
    item.tool,
    item.tool_name,
    item.toolName,
    item.provider,
    item.provider_id,
    item.providerId,
    item.category
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/gmail|email|mail/.test(text)) return 'mail';
  if (/slack|channel|chat/.test(text)) return 'chat';
  if (/calendar|meeting|event/.test(text)) return 'calendar';
  if (/schedule|automation|watch/.test(text)) return 'clock';
  if (/drive|docs|file|document|notion/.test(text)) return 'file';
  if (/receipt|audit|completed|done/.test(text)) return 'check';
  return fallback;
}

function feedHref(item, threadId) {
  const href = safeText(item.href || item.chat_path || item.chatPath || item.path, '');
  if (href && (href.startsWith('/') || /^https?:\/\//i.test(href))) return href;
  return threadId ? `/chat/${encodeURIComponent(threadId)}` : '/workbench';
}

function firstNonEmptyArray(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) return value;
  }
  return [];
}

function safeText(value, fallback) {
  const text = String(value || '').trim();
  return text || fallback;
}
