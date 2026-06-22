import { expect, test, type Page, type Route } from '@playwright/test';

// Live chat-window coverage: proves the chat surface renders an assistant reply
// AND that the composer actually sends the typed message to the gateway. Models
// the proven mermaid-static contract (timeline messages with kind:'assistant';
// the /events SSE is a keep-alive — content is delivered via the timeline). No
// real model: every route is mocked deterministically.

const gatewayStatus = {
  engine_v2_enabled: true,
  restart_enabled: false,
  total_connections: 0,
  llm_backend: 'nearai',
  llm_model: 'auto',
  model_execution_verified: true,
  model_readiness: 'ready',
  model_execution_readiness: 'ready'
};

const llmProviders = {
  providers: [
    {
      id: 'nearai',
      name: 'NEAR AI Cloud',
      description: 'Model access through NEAR AI Cloud.',
      adapter: 'nearai',
      default_model: 'auto',
      builtin: true,
      api_key_required: false,
      accepts_api_key: true,
      base_url_required: false,
      api_key_set: true
    }
  ],
  active: { provider_id: 'nearai', model: 'auto' }
};

const ASSISTANT_REPLY = 'Paris is the capital of France.';

test('static chat: the chat window renders an assistant reply from the timeline', async ({
  page
}) => {
  const consoleIssues: string[] = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) consoleIssues.push(message.text());
  });
  page.on('pageerror', (error) => consoleIssues.push(`pageerror: ${error.message}`));

  await installChatMocks(page, {});
  await page.goto('http://127.0.0.1:1420/v2/chat/thread-chatsend?token=static-chat-token');

  await expect(page.getByTestId('chat-message-scroll')).toBeVisible();
  // The seeded assistant message renders from the timeline read.
  await expect(page.getByText(ASSISTANT_REPLY)).toBeVisible({ timeout: 15_000 });

  // No noisy console errors while rendering the conversation.
  expect(consoleIssues.filter((line) => /error/i.test(line))).toEqual([]);
});

test('static chat: typing + Enter sends the message to the gateway and shows the reply', async ({
  page
}) => {
  const sent: Array<Record<string, unknown>> = [];
  await installChatMocks(page, { sent });
  await page.goto('http://127.0.0.1:1420/v2/chat/thread-chatsend?token=static-chat-token');

  const composer = page.getByTestId('chat-composer');
  await expect(composer).toBeVisible();
  const input = composer.locator('textarea');
  await expect(input).toBeVisible();

  const prompt = 'What is the capital of France?';
  await input.fill(prompt);
  await input.press('Enter');

  // The composer POSTed the typed message to the gateway (the real send path).
  await expect.poll(() => sent.length, { timeout: 10_000 }).toBeGreaterThan(0);
  const bodies = sent.map((body) => JSON.stringify(body));
  expect(bodies.some((body) => body.includes(prompt))).toBe(true);

  // And the assistant reply renders (delivered via the timeline read).
  await expect(page.getByText(ASSISTANT_REPLY)).toBeVisible({ timeout: 15_000 });
});

async function installChatMocks(page: Page, options: { sent?: Array<Record<string, unknown>> }) {
  const { sent = [] } = options;

  await page.route(/\/(api|auth)\//, async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    if (path === '/api/gateway/status') return json(route, gatewayStatus);
    if (path === '/api/webchat/v2/llm/providers') return json(route, llmProviders);
    if (path === '/api/webchat/v2/llm/list-models' && method === 'POST') {
      return json(route, { ok: true, models: ['auto', 'z-ai/glm-4.5', 'gpt-oss-120b'] });
    }
    if (path === '/api/webchat/v2/threads' && method === 'GET') {
      return json(route, {
        threads: [
          { thread_id: 'thread-chatsend', id: 'thread-chatsend', title: 'Chat send proof' }
        ],
        next_cursor: null
      });
    }
    if (path === '/api/webchat/v2/threads' && method === 'POST') {
      return json(route, {
        thread: { thread_id: 'thread-chatsend', id: 'thread-chatsend', title: 'Chat send proof' }
      });
    }
    if (path === '/api/webchat/v2/threads/thread-chatsend/messages' && method === 'POST') {
      const raw = route.request().postData() || '{}';
      try {
        sent.push(JSON.parse(raw));
      } catch {
        sent.push({ raw });
      }
      return json(route, {
        thread_id: 'thread-chatsend',
        run_id: 'run-chatsend',
        status: 'queued',
        accepted_message_ref: 'msg-chatsend'
      });
    }
    if (path === '/api/webchat/v2/threads/thread-chatsend/timeline') {
      return json(route, {
        messages: [
          {
            kind: 'assistant',
            message_id: 'msg-assistant-chatsend',
            content: ASSISTANT_REPLY,
            sequence: 1,
            turn_run_id: 'run-chatsend',
            created_at: '2026-06-22T12:00:00.000Z'
          }
        ],
        summary_artifacts: [],
        next_cursor: null
      });
    }
    if (path === '/api/webchat/v2/threads/thread-chatsend/events') {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream; charset=utf-8',
        body: ': connected\n\n'
      });
    }
    if (path === '/api/webchat/v2/automations' && method === 'GET') {
      return json(route, { automations: [], next_cursor: null });
    }
    if (path === '/api/webchat/v2/extensions/registry') return json(route, { entries: [] });
    if (path === '/api/webchat/v2/extensions') return json(route, { extensions: [] });
    if (path === '/api/webchat/v2/channels/connectable') return json(route, { channels: [] });
    if (path === '/auth/providers') return json(route, { providers: [] });

    return json(route, { ok: true });
  });
}

async function json(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(body)
  });
}
