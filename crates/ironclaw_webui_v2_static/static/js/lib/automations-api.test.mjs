import assert from 'node:assert/strict';
import test from 'node:test';

import { listAutomations } from './automations-api.js';

function setupBrowserEnv({ token = '', fetchImpl } = {}) {
  globalThis.sessionStorage = {
    getItem: () => token,
    setItem: () => {},
    removeItem: () => {}
  };
  globalThis.fetch =
    fetchImpl ||
    (async () =>
      new Response(JSON.stringify({ automations: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }));
}

test('listAutomations reads through the v2 automations route', async () => {
  const calls = [];
  setupBrowserEnv({
    token: 'token-1',
    fetchImpl: async (path, options) => {
      calls.push({ path, options });
      return new Response(JSON.stringify({ automations: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
  });

  const response = await listAutomations({ limit: 50, runLimit: 25 });

  assert.deepEqual(response, { automations: [] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/webchat/v2/automations?limit=50&run_limit=25');
  assert.equal(calls[0].options.credentials, 'same-origin');
  assert.equal(calls[0].options.headers.get('Authorization'), 'Bearer token-1');
});

test('listAutomations omits the query string when no filters are supplied', async () => {
  const calls = [];
  setupBrowserEnv({
    fetchImpl: async (path, options) => {
      calls.push({ path, options });
      return new Response(JSON.stringify({ automations: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
  });

  await listAutomations();

  assert.equal(calls[0].path, '/api/webchat/v2/automations');
});

test('listAutomations propagates api errors from the automations route', async () => {
  setupBrowserEnv({
    fetchImpl: async () =>
      new Response('temporarily unavailable', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'content-type': 'text/plain' }
      })
  });

  await assert.rejects(listAutomations({ limit: 50 }), (error) => {
    assert.equal(error.name, 'ApiError');
    assert.equal(error.status, 503);
    assert.equal(error.statusText, 'Service Unavailable');
    assert.equal(error.body, 'temporarily unavailable');
    return true;
  });
});
