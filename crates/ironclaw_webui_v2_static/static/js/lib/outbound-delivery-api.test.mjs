import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getOutboundPreferences,
  listOutboundDeliveryTargets,
  normalizeOutboundPreferences,
  setOutboundPreferences
} from './outbound-delivery-api.js';

function setupFetch(calls) {
  globalThis.window = {
    location: { origin: 'https://app.test' }
  };
  globalThis.sessionStorage = {
    getItem: () => '',
    setItem: () => {},
    removeItem: () => {}
  };
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
}

test('outbound delivery APIs use the Reborn routes and clear-to-null payload', async () => {
  const calls = [];
  setupFetch(calls);

  await getOutboundPreferences();
  await listOutboundDeliveryTargets();
  await setOutboundPreferences({ finalReplyTargetId: 'slack:dm' });
  await setOutboundPreferences({});

  assert.equal(calls[0].path, '/api/webchat/v2/outbound/preferences');
  assert.equal(calls[1].path, '/api/webchat/v2/outbound/targets');
  assert.equal(calls[2].path, '/api/webchat/v2/outbound/preferences');
  assert.equal(calls[2].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[2].options.body), { final_reply_target_id: 'slack:dm' });
  assert.deepEqual(JSON.parse(calls[3].options.body), { final_reply_target_id: null });
});

test('normalizeOutboundPreferences preserves honest none-configured delivery state', () => {
  assert.deepEqual(normalizeOutboundPreferences({ final_reply_target_status: 'none_configured' }), {
    final_reply_target_status: 'none_configured',
    final_reply_target: null
  });
  assert.deepEqual(normalizeOutboundPreferences({}), {
    final_reply_target: null,
    final_reply_target_status: 'none_configured'
  });
});
