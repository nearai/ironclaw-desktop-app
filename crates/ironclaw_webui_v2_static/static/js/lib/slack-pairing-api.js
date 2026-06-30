import { apiFetch } from './api.js';

export const SLACK_PAIRING_REDEEM_PATH = '/api/webchat/v2/extensions/pairing/redeem';

export function redeemSlackPairingCode(code) {
  return apiFetch(SLACK_PAIRING_REDEEM_PATH, {
    method: 'POST',
    body: JSON.stringify({ channel: 'slack', code })
  }).then((response) => {
    // A 2xx is not proof of a pairing: the gateway can answer 200 with
    // success:false or no linked identity. Derive success from the body and
    // only use the literal "connected" copy when we actually have proof.
    const success =
      response.success !== false && Boolean(response.connected || response.provider_user_id);
    return {
      success,
      provider: response.provider,
      provider_user_id: response.provider_user_id,
      message: response.message || (success ? 'Slack account connected.' : 'Slack pairing failed.')
    };
  });
}
