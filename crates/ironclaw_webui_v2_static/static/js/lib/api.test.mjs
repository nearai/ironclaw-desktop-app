import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FetchEventStream,
  connectorRead,
  connectorWrite,
  connectorsConnected,
  gatewayStatus,
  sendMessage
} from './api.js';

function waitFor(assertion, { timeout = 1000, interval = 10 } = {}) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      try {
        const result = assertion();
        if (result) {
          resolve(result);
          return;
        }
      } catch (err) {
        reject(err);
        return;
      }
      if (Date.now() - started > timeout) {
        reject(new Error('Timed out waiting for assertion'));
        return;
      }
      setTimeout(tick, interval);
    };
    tick();
  });
}

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
    timezone: 'America/Toronto',
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
  assert.equal(body.timezone, 'America/Toronto');
  assert.deepEqual(body.attachments, [
    {
      filename: 'template.pdf',
      mime_type: 'application/pdf',
      // The gateway (WebUiInboundAttachment) requires `data_base64`; emitting
      // `base64` 422s. Regression-lock the wire field name.
      data_base64: 'dGVtcGxhdGU='
    }
  ]);
});

test('connector read adapters target read-only connector routes with bearer auth', async () => {
  const originalFetch = globalThis.fetch;
  const originalSessionStorage = globalThis.sessionStorage;
  const calls = [];
  const signal = new AbortController().signal;

  globalThis.sessionStorage = {
    getItem: () => 'token-1',
    setItem: () => {},
    removeItem: () => {}
  };
  globalThis.fetch = async (path, options = {}) => {
    calls.push({ path, options });
    return new Response(
      JSON.stringify(path.endsWith('/connected') ? { connected: ['gmail'] } : { rows: [] }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    );
  };

  try {
    assert.deepEqual(await connectorsConnected({ signal }), { connected: ['gmail'] });
    assert.deepEqual(
      await connectorRead({
        toolkit: ' gmail ',
        tool: ' GMAIL_FETCH_EMAILS ',
        arguments: { max_results: 3, query: 'in:inbox' },
        signal
      }),
      { rows: [] }
    );

    assert.equal(calls.length, 2);
    assert.equal(calls[0].path, '/api/webchat/v2/connectors/connected');
    assert.equal(calls[0].options.signal, signal);
    assert.equal(calls[0].options.headers.get('Authorization'), 'Bearer token-1');
    assert.equal(calls[1].path, '/api/webchat/v2/connectors/read');
    assert.equal(calls[1].options.method, 'POST');
    assert.equal(calls[1].options.signal, signal);
    assert.equal(calls[1].options.headers.get('Content-Type'), 'application/json');
    assert.equal(calls[1].options.headers.get('Authorization'), 'Bearer token-1');
    assert.deepEqual(JSON.parse(calls[1].options.body), {
      toolkit: 'gmail',
      tool: 'GMAIL_FETCH_EMAILS',
      arguments: { max_results: 3, query: 'in:inbox' }
    });
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.sessionStorage = originalSessionStorage;
  }
});

test('connectorRead accepts Composio read verbs in any segment position', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (path, options = {}) => {
    calls.push({ path, options });
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    await connectorRead({ toolkit: 'gmail', tool: 'GMAIL_FETCH_EMAILS' });
    await connectorRead({ toolkit: 'googlecalendar', tool: 'GOOGLECALENDAR_EVENTS_LIST' });
    await connectorRead({ toolkit: 'googlecalendar', tool: 'GOOGLECALENDAR_EVENTS_FIND' });
    await connectorRead({ toolkit: 'googledocs', tool: 'GOOGLEDOCS_DOCUMENT_READ' });

    assert.deepEqual(
      calls.map((call) => JSON.parse(call.options.body).tool),
      [
        'GMAIL_FETCH_EMAILS',
        'GOOGLECALENDAR_EVENTS_LIST',
        'GOOGLECALENDAR_EVENTS_FIND',
        'GOOGLEDOCS_DOCUMENT_READ'
      ]
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('connectorRead refuses mutating tools before making a network request', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    await assert.rejects(
      connectorRead({ toolkit: 'gmail', tool: 'GMAIL_SEND_EMAIL', arguments: { to: 'x' } }),
      /read-only FETCH, LIST, GET, SEARCH, FIND, or READ/
    );
    await assert.rejects(
      connectorRead({ toolkit: 'gmail', tool: 'GMAIL_LIST_AND_DELETE_EMAILS' }),
      /read-only FETCH, LIST, GET, SEARCH, FIND, or READ/
    );
    await assert.rejects(
      connectorRead({ toolkit: 'googlecalendar', tool: 'GOOGLECALENDAR_EVENTS_INSERT' }),
      /read-only FETCH, LIST, GET, SEARCH, FIND, or READ/
    );
    await assert.rejects(
      connectorRead({ toolkit: 'gmail', tool: 'GMAIL__FETCH_EMAILS' }),
      /read-only FETCH, LIST, GET, SEARCH, FIND, or READ/
    );
    await assert.rejects(
      connectorRead({ toolkit: '', tool: 'GMAIL_FETCH_EMAILS' }),
      /requires a toolkit/
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('connectorWrite targets the gated connector write route for Gmail draft creation', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const signal = new AbortController().signal;
  globalThis.fetch = async (path, options = {}) => {
    calls.push({ path, options });
    return new Response(
      JSON.stringify({ successful: true, data: { response_data: { id: 'd1' } } }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    );
  };

  try {
    assert.deepEqual(
      await connectorWrite({
        toolkit: ' gmail ',
        tool: 'GMAIL_CREATE_EMAIL_DRAFT',
        arguments: {
          recipient_email: 'customer@example.com',
          subject: 'Re: Terms',
          body: 'Thanks - draft only.',
          thread_id: 'thread-1'
        },
        signal
      }),
      { successful: true, data: { response_data: { id: 'd1' } } }
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, '/api/webchat/v2/connectors/write');
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.signal, signal);
    assert.deepEqual(JSON.parse(calls[0].options.body), {
      toolkit: 'gmail',
      tool: 'GMAIL_CREATE_EMAIL_DRAFT',
      arguments: {
        recipient_email: 'customer@example.com',
        subject: 'Re: Terms',
        body: 'Thanks - draft only.',
        thread_id: 'thread-1'
      }
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('connectorWrite refuses off-allowlist writes before making a network request', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    await assert.rejects(
      connectorWrite({ toolkit: 'gmail', tool: 'GMAIL_DELETE_EMAIL', arguments: { id: 'm1' } }),
      /gated draft\/send allowlist/
    );
    await assert.rejects(
      connectorWrite({ toolkit: '', tool: 'GMAIL_CREATE_EMAIL_DRAFT' }),
      /requires a toolkit/
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
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
    assert.match(status.model_execution_failure_summary, /non-NEAR model provider/i);
    assert.ok(calls.some((call) => call.command === 'has_llm_provider_credential'));
  } finally {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
    globalThis.sessionStorage = originalSessionStorage;
  }
});

test('FetchEventStream parses split frames, named events, comments, and final buffered data', async () => {
  const originalFetch = globalThis.fetch;
  const encoder = new TextEncoder();
  const calls = [];
  const namedEvents = [];
  const messages = [];
  let opened = false;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(': heartbeat\r\n\r\nid: gate-1\r\nevent: gate\r\n'));
          controller.enqueue(
            encoder.encode('data: {"tool":"send_email"}\r\ndata: confirm\r\n\r\n')
          );
          controller.enqueue(encoder.encode('data: tail frame without delimiter'));
          controller.close();
        }
      }),
      {
        status: 200,
        headers: { 'content-type': 'text/event-stream' }
      }
    );
  };

  try {
    const stream = new FetchEventStream(new URL('http://127.0.0.1:3000/events'), 'token-1');
    stream.onopen = () => {
      opened = true;
    };
    stream.onmessage = (event) => messages.push(event);
    stream.addEventListener('gate', (event) => namedEvents.push(event));

    await waitFor(() => opened && namedEvents.length === 1 && messages.length === 1);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.headers.Accept, 'text/event-stream');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer token-1');
    assert.deepEqual(namedEvents[0], {
      type: 'gate',
      data: '{"tool":"send_email"}\nconfirm',
      lastEventId: 'gate-1'
    });
    assert.deepEqual(messages[0], {
      type: 'message',
      data: 'tail frame without delimiter',
      lastEventId: ''
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('FetchEventStream surfaces HTTP errors through onerror', async () => {
  const originalFetch = globalThis.fetch;
  const errors = [];

  globalThis.fetch = async () =>
    new Response('no stream here', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'content-type': 'text/plain' }
    });

  try {
    const stream = new FetchEventStream(new URL('http://127.0.0.1:3000/events'), '');
    stream.onerror = (error) => errors.push(error);

    await waitFor(() => errors.length === 1);

    assert.equal(errors[0].name, 'ApiError');
    assert.equal(errors[0].status, 503);
    assert.equal(errors[0].statusText, 'Service Unavailable');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('FetchEventStream treats a clean server stream-end as a disconnect (fires onerror so reconnect runs)', async () => {
  const originalFetch = globalThis.fetch;
  const encoder = new TextEncoder();
  const errors = [];
  const messages = [];

  globalThis.fetch = async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: hello\r\n\r\n'));
          controller.close();
        }
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } }
    );

  try {
    const stream = new FetchEventStream(new URL('http://127.0.0.1:3000/events'), '');
    stream.onmessage = (event) => messages.push(event);
    stream.onerror = (error) => errors.push(error);

    await waitFor(() => messages.length === 1 && errors.length === 1);

    // The frame still delivered, then the clean close surfaced as an error so
    // useSSE's reconnect path fires instead of the channel going silently dead.
    assert.equal(messages[0].data, 'hello');
    assert.equal(errors[0].name, 'ApiError');
    assert.equal(errors[0].status, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('FetchEventStream does not fire onerror when closed before the stream ends', async () => {
  const originalFetch = globalThis.fetch;
  const encoder = new TextEncoder();
  const errors = [];

  let streamController = null;
  globalThis.fetch = async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          streamController = controller;
          controller.enqueue(encoder.encode('data: one\r\n\r\n'));
        }
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } }
    );

  try {
    const stream = new FetchEventStream(new URL('http://127.0.0.1:3000/events'), '');
    let got = 0;
    stream.onmessage = () => {
      got += 1;
    };
    stream.onerror = (error) => errors.push(error);
    await waitFor(() => got === 1);
    // Intentional teardown: close() then end the stream — no error should fire.
    stream.close();
    streamController.close();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(errors.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('FetchEventStream aborts the in-flight fetch when closed', async () => {
  const originalFetch = globalThis.fetch;
  let capturedSignal = null;
  const errors = [];

  globalThis.fetch = async (_url, options) => {
    capturedSignal = options.signal;
    return new Promise((_resolve, reject) => {
      capturedSignal.addEventListener(
        'abort',
        () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        },
        { once: true }
      );
    });
  };

  try {
    const stream = new FetchEventStream(new URL('http://127.0.0.1:3000/events'), '');
    stream.onerror = (error) => errors.push(error);

    await waitFor(() => capturedSignal);
    stream.close();
    await waitFor(() => capturedSignal.aborted);

    assert.deepEqual(errors, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
