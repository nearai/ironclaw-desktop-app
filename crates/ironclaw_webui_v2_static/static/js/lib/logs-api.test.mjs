import assert from 'node:assert/strict';
import test from 'node:test';

import { queryOperatorLogs } from './logs-api.js';

test('queryOperatorLogs maps all filters to query params', async () => {
  const calls = [];
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
    return new Response(JSON.stringify({ entries: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };

  await queryOperatorLogs({
    limit: 10,
    cursor: 'next',
    level: 'warn',
    target: 'sidecar',
    threadId: 'thread-1',
    runId: 'run-1',
    turnId: 'turn-1',
    toolCallId: 'tool-call-1',
    toolName: 'web.search',
    source: 'gateway'
  });

  const url = new URL(calls[0].path, 'https://app.test');
  assert.equal(url.pathname, '/api/webchat/v2/operator/logs');
  assert.equal(url.searchParams.get('limit'), '10');
  assert.equal(url.searchParams.get('cursor'), 'next');
  assert.equal(url.searchParams.get('level'), 'warn');
  assert.equal(url.searchParams.get('target'), 'sidecar');
  assert.equal(url.searchParams.get('thread_id'), 'thread-1');
  assert.equal(url.searchParams.get('run_id'), 'run-1');
  assert.equal(url.searchParams.get('turn_id'), 'turn-1');
  assert.equal(url.searchParams.get('tool_call_id'), 'tool-call-1');
  assert.equal(url.searchParams.get('tool_name'), 'web.search');
  assert.equal(url.searchParams.get('source'), 'gateway');
});
