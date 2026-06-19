import { V2_BASE, apiFetch } from './api.js';

export async function getOutboundPreferences() {
  return normalizeOutboundPreferences(await apiFetch(`${V2_BASE}/outbound/preferences`));
}

export function listOutboundDeliveryTargets() {
  return apiFetch(`${V2_BASE}/outbound/targets`);
}

export function setOutboundPreferences({ finalReplyTargetId } = {}) {
  return apiFetch(`${V2_BASE}/outbound/preferences`, {
    method: 'POST',
    body: JSON.stringify({
      final_reply_target_id: finalReplyTargetId ?? null
    })
  });
}

export function normalizeOutboundPreferences(payload) {
  const preferences =
    payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const normalized = { ...preferences };
  if (!Object.prototype.hasOwnProperty.call(normalized, 'final_reply_target')) {
    normalized.final_reply_target = null;
  }
  if (
    typeof normalized.final_reply_target_status !== 'string' ||
    normalized.final_reply_target_status.length === 0
  ) {
    normalized.final_reply_target_status = normalized.final_reply_target
      ? 'configured'
      : 'none_configured';
  }
  return normalized;
}
