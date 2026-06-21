import { V2_BASE, apiFetch } from '../../../lib/api.js';

export async function fetchApprovalsFeed({ fetcher = apiFetch, signal } = {}) {
  return normalizeApprovalsFeed(await fetcher(`${V2_BASE}/approvals`, { signal }));
}

export function approvalsFeedReadSupported(gatewayStatus) {
  const value =
    gatewayStatus?.capabilities?.approvals_read ??
    gatewayStatus?.capabilities?.approval_feed_read ??
    gatewayStatus?.capabilities?.pending_gates_read ??
    gatewayStatus?.features?.approvals_read ??
    gatewayStatus?.features?.approval_feed_read ??
    gatewayStatus?.approvals?.read;
  return value === true || value === 'true' || value === 'available' || value === 'enabled';
}

export function normalizeApprovalsFeed(response) {
  const rawApprovals = firstNonEmptyArray(
    response?.approvals,
    response?.pending_gates,
    response?.items,
    response?.data?.approvals,
    response
  );
  return rawApprovals.map(normalizeApproval).filter(Boolean);
}

function normalizeApproval(approval) {
  if (!approval || typeof approval !== 'object') return null;
  const threadId = safeText(approval.thread_id || approval.threadId || approval.thread?.id, '');
  const explicitTitle = safeText(
    approval.title ||
      approval.headline ||
      approval.action_label ||
      approval.actionLabel ||
      approval.subject,
    ''
  );
  const title = explicitTitle || 'Approval waiting';
  const explicitId = safeText(
    approval.id ||
      approval.approval_id ||
      approval.approvalId ||
      approval.gate_id ||
      approval.gateRef ||
      approval.client_action_id ||
      approval.clientActionId,
    ''
  );
  const id = explicitId || (threadId && explicitTitle ? `${threadId}:${explicitTitle}` : '');
  if (!id) return null;

  const destination = safeText(approval.destination || approval.to || approval.channel || '', '');
  const detail = safeText(
    approval.detail || approval.summary || approval.body || approval.description,
    destination
      ? `Prepared action to ${destination} is held for review.`
      : 'A prepared external action is held until you review it.'
  );

  return {
    id,
    title,
    badge: safeText(
      approval.badge || approval.status_label || approval.statusLabel,
      'Needs approval'
    ),
    detail,
    icon: approvalIcon(approval),
    href: approvalHref(approval, threadId),
    timestamp:
      safeText(
        approval.updated_at ||
          approval.updatedAt ||
          approval.created_at ||
          approval.createdAt ||
          approval.submitted_at ||
          approval.submittedAt,
        ''
      ) || '',
    threadId,
    destination
  };
}

function approvalIcon(approval) {
  const text = [
    approval.tool,
    approval.tool_name,
    approval.toolName,
    approval.provider,
    approval.provider_id,
    approval.providerId,
    approval.destination,
    approval.channel
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/gmail|email|mail/.test(text)) return 'mail';
  if (/slack|channel|chat/.test(text)) return 'chat';
  if (/drive|docs|file|document/.test(text)) return 'file';
  return 'shield';
}

function approvalHref(approval, threadId) {
  const href = safeText(approval.href || approval.chat_path || approval.chatPath, '');
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
