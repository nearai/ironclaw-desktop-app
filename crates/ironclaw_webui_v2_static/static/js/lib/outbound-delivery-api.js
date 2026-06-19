import { V2_BASE, apiFetch } from './api.js';

export function getOutboundPreferences() {
  return apiFetch(`${V2_BASE}/outbound/preferences`);
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
