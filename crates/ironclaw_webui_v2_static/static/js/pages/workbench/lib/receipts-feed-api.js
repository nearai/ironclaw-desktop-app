import { V2_BASE, apiFetch } from '../../../lib/api.js';

export async function fetchReceiptsFeed({ fetcher = apiFetch, signal } = {}) {
  return normalizeReceiptsFeed(await fetcher(`${V2_BASE}/receipts`, { signal }));
}

export function receiptsFeedReadSupported(gatewayStatus) {
  const value =
    gatewayStatus?.capabilities?.receipts_read ??
    gatewayStatus?.capabilities?.receipt_feed_read ??
    gatewayStatus?.capabilities?.audit_read ??
    gatewayStatus?.features?.receipts_read ??
    gatewayStatus?.features?.receipt_feed_read ??
    gatewayStatus?.receipts?.read ??
    gatewayStatus?.audit?.read;
  return value === true || value === 'true' || value === 'available' || value === 'enabled';
}

export function normalizeReceiptsFeed(response) {
  const rawReceipts = firstNonEmptyArray(
    response?.receipts,
    response?.audit,
    response?.items,
    response?.data?.receipts,
    response
  );
  return rawReceipts.map(normalizeReceipt).filter(Boolean);
}

function normalizeReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object') return null;
  const threadId = safeText(receipt.thread_id || receipt.threadId || receipt.thread?.id, '');
  const timestamp =
    safeText(
      receipt.completed_at ||
        receipt.completedAt ||
        receipt.occurred_at ||
        receipt.occurredAt ||
        receipt.created_at ||
        receipt.createdAt ||
        receipt.updated_at ||
        receipt.updatedAt ||
        receipt.when ||
        receipt.timestamp,
      ''
    ) || '';
  const explicitTitle = safeText(
    receipt.title ||
      receipt.headline ||
      receipt.action_label ||
      receipt.actionLabel ||
      receipt.subject ||
      receipt.label,
    ''
  );
  const title = explicitTitle || 'Action completed';
  const explicitId = safeText(
    receipt.id ||
      receipt.receipt_id ||
      receipt.receiptId ||
      receipt.audit_id ||
      receipt.auditId ||
      receipt.action_id ||
      receipt.actionId ||
      receipt.run_id ||
      receipt.runId,
    ''
  );
  const id =
    explicitId ||
    (threadId && explicitTitle && timestamp ? `${threadId}:${timestamp}:${title}` : '');
  if (!id) return null;

  const destination = safeText(receipt.destination || receipt.to || receipt.channel || '', '');
  const detail = safeText(
    receipt.detail || receipt.summary || receipt.body || receipt.description || receipt.sub,
    destination ? `Recorded completed work for ${destination}.` : 'Recorded from completed work.'
  );

  return {
    id,
    title,
    badge: safeText(
      receipt.badge || receipt.status_label || receipt.statusLabel || receipt.status || receipt.tag,
      'Receipt'
    ),
    detail,
    icon: receiptIcon(receipt),
    href: receiptHref(receipt, threadId),
    timestamp,
    threadId,
    destination
  };
}

function receiptIcon(receipt) {
  const text = [
    receipt.kind,
    receipt.tool,
    receipt.tool_name,
    receipt.toolName,
    receipt.provider,
    receipt.provider_id,
    receipt.providerId,
    receipt.destination,
    receipt.channel
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/gmail|email|mail/.test(text)) return 'mail';
  if (/slack|channel|chat/.test(text)) return 'chat';
  if (/drive|docs|file|document/.test(text)) return 'file';
  return 'check';
}

function receiptHref(receipt, threadId) {
  const href = safeText(
    receipt.href ||
      receipt.artifact_href ||
      receipt.artifactHref ||
      receipt.chat_path ||
      receipt.chatPath ||
      receipt.receipt_path ||
      receipt.receiptPath,
    ''
  );
  if (href && (href.startsWith('/') || /^https?:\/\//i.test(href))) return href;
  return threadId ? `/chat/${encodeURIComponent(threadId)}` : '/work';
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
