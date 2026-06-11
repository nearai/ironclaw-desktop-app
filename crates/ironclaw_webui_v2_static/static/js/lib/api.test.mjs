import assert from 'node:assert/strict';
import test from 'node:test';

import { gatewayStatus, listAutomations, sendMessage } from './api.js';

test('listAutomations reads through the v2 automations route', async () => {
  const calls = [];
  globalThis.sessionStorage = {
    getItem: () => 'token-1',
    setItem: () => {},
    removeItem: () => {}
  };
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options });
    return new Response(JSON.stringify({ automations: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };

  const response = await listAutomations({ limit: 50 });

  assert.deepEqual(response, { automations: [] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/webchat/v2/automations?limit=50');
  assert.equal(calls[0].options.credentials, 'same-origin');
  assert.equal(calls[0].options.headers.get('Authorization'), 'Bearer token-1');
});

test('listAutomations propagates api errors from the automations route', async () => {
  globalThis.sessionStorage = {
    getItem: () => '',
    setItem: () => {},
    removeItem: () => {}
  };
  globalThis.fetch = async () =>
    new Response('temporarily unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'content-type': 'text/plain' }
    });

  await assert.rejects(listAutomations({ limit: 50 }), (error) => {
    assert.equal(error.name, 'ApiError');
    assert.equal(error.status, 503);
    assert.equal(error.statusText, 'Service Unavailable');
    assert.equal(error.body, 'temporarily unavailable');
    return true;
  });
});

test('sendMessage sends composer attachments as Reborn attachment payloads', async () => {
  const calls = [];
  globalThis.sessionStorage = {
    getItem: () => 'token-1',
    setItem: () => {},
    removeItem: () => {}
  };
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options });
    return new Response(
      JSON.stringify({
        outcome: 'submitted',
        thread_id: 'thread-1',
        run_id: 'run-1'
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    );
  };

  await sendMessage({
    threadId: 'thread-1',
    content: 'draft from the attachment',
    attachments: [
      {
        name: 'template.pdf',
        mime_type: 'application/pdf',
        data_base64: 'dGVtcGxhdGU=',
        size: 8
      }
    ],
    clientActionId: 'action-1'
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/webchat/v2/threads/thread-1/messages');
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.client_action_id, 'action-1');
  assert.equal(body.content, 'draft from the attachment');
  assert.deepEqual(body.attachments, [
    {
      filename: 'template.pdf',
      mime_type: 'application/pdf',
      base64: 'dGVtcGxhdGU='
    }
  ]);
});

test('gatewayStatus fallback keeps default NEAR.AI sendable while execution is unverified', async () => {
  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;
  const originalSessionStorage = globalThis.sessionStorage;
  const encoder = new TextEncoder();
  const calls = [];

  const storage = {
    getItem: () => '',
    setItem: () => {},
    removeItem: () => {}
  };
  globalThis.localStorage = storage;
  globalThis.sessionStorage = storage;
  globalThis.window = {
    __TAURI_INTERNALS__: {
      invoke: async (command, args = {}) => {
        calls.push({ command, args });
        if (command === 'gateway_http_fetch') {
          return {
            status: 404,
            status_text: 'Not Found',
            url: args.request.url,
            headers: [['content-type', 'text/plain']],
            data: Array.from(encoder.encode('Not Found'))
          };
        }
        if (command === 'get_settings') {
          return {
            activeProfileId: 'default',
            profiles: [
              {
                id: 'default',
                llmProviderId: 'nearai',
                llmBackend: 'nearai',
                llmModelId: 'auto'
              }
            ]
          };
        }
        if (command === 'has_llm_provider_credential') return false;
        throw new Error(`unexpected command ${command}`);
      }
    }
  };

  try {
    const status = await gatewayStatus();

    assert.equal(status.llm_backend, 'nearai');
    assert.equal(status.llm_model, 'auto');
    assert.equal(status.model_readiness, 'unverified');
    assert.equal(status.model_execution_failure_category, undefined);
    assert.equal(status.model_execution_failure_summary, undefined);
    assert.ok(!calls.some((call) => call.command === 'has_llm_provider_credential'));
  } finally {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
    globalThis.sessionStorage = originalSessionStorage;
  }
});

test('gatewayStatus fallback blocks BYO-key providers when desktop credentials are missing', async () => {
  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;
  const originalSessionStorage = globalThis.sessionStorage;
  const encoder = new TextEncoder();
  const calls = [];

  const storage = {
    getItem: () => '',
    setItem: () => {},
    removeItem: () => {}
  };
  globalThis.localStorage = storage;
  globalThis.sessionStorage = storage;
  globalThis.window = {
    __TAURI_INTERNALS__: {
      invoke: async (command, args = {}) => {
        calls.push({ command, args });
        if (command === 'gateway_http_fetch') {
          return {
            status: 404,
            status_text: 'Not Found',
            url: args.request.url,
            headers: [['content-type', 'text/plain']],
            data: Array.from(encoder.encode('Not Found'))
          };
        }
        if (command === 'get_settings') {
          return {
            activeProfileId: 'default',
            profiles: [
              {
                id: 'default',
                llmProviderId: 'openai',
                llmBackend: 'openai',
                llmModelId: 'gpt-4o'
              }
            ]
          };
        }
        if (command === 'has_llm_provider_credential') return false;
        throw new Error(`unexpected command ${command}`);
      }
    }
  };

  try {
    const status = await gatewayStatus();

    assert.equal(status.llm_backend, 'openai');
    assert.equal(status.llm_model, 'gpt-4o');
    assert.equal(status.model_readiness, 'blocked');
    assert.equal(status.model_execution_failure_category, 'model_credentials_unavailable');
    assert.match(status.model_execution_failure_summary, /OpenAI/i);
    assert.ok(calls.some((call) => call.command === 'has_llm_provider_credential'));
  } finally {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
    globalThis.sessionStorage = originalSessionStorage;
  }
});
