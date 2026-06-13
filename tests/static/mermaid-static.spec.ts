import { expect, test, type Page, type Route } from '@playwright/test';

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
  active: {
    provider_id: 'nearai',
    model: 'auto'
  }
};

const mermaidReply = [
  'Here is the flow:',
  '',
  '```mermaid',
  'graph TD',
  '  A[Review request] --> B{Needs approval?}',
  '  B -->|Yes| C[Ask user]',
  '  B -->|No| D[Ship receipt]',
  '```'
].join('\n');

test('static mermaid renderer is lazy, on-click, and renders sanitized SVG', async ({ page }) => {
  await installMermaidApiMocks(page);

  await page.goto('http://127.0.0.1:1420/v2/chat/thread-mermaid?token=static-mermaid-token');
  await expect(page.getByText('Here is the flow:')).toBeVisible();

  await expect(page.locator('script[src$="vendor/mermaid.min.js"]')).toHaveCount(0);
  await expect(page.locator('[data-md-renderer="mermaid"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Render diagram' })).toBeVisible();

  await page.getByRole('button', { name: 'Render diagram' }).click();

  await expect(page.locator('script[src$="vendor/mermaid.min.js"]')).toHaveCount(1);
  await expect(page.locator('.v2-mermaid-card__output svg')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.v2-mermaid-card__output script')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rendered' })).toBeDisabled();
});

async function installMermaidApiMocks(page: Page) {
  await page.route(/\/(api|auth)\//, async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    if (path === '/api/gateway/status') {
      return json(route, gatewayStatus);
    }
    if (path === '/api/webchat/v2/llm/providers') {
      return json(route, llmProviders);
    }
    if (path === '/api/webchat/v2/llm/list-models' && method === 'POST') {
      return json(route, { ok: true, models: ['auto', 'z-ai/glm-4.5', 'gpt-oss-120b'] });
    }
    if (path === '/api/webchat/v2/threads' && method === 'GET') {
      return json(route, {
        threads: [
          {
            thread_id: 'thread-mermaid',
            id: 'thread-mermaid',
            title: 'Mermaid proof thread'
          }
        ],
        next_cursor: null
      });
    }
    if (path === '/api/webchat/v2/threads/thread-mermaid/timeline') {
      return json(route, {
        messages: [
          {
            kind: 'assistant',
            message_id: 'msg-assistant-mermaid',
            content: mermaidReply,
            sequence: 1,
            turn_run_id: 'run-mermaid',
            created_at: '2026-06-13T12:00:00.000Z'
          }
        ],
        summary_artifacts: [],
        next_cursor: null
      });
    }
    if (path === '/api/webchat/v2/threads/thread-mermaid/events') {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream; charset=utf-8',
        body: ': connected\n\n'
      });
    }
    if (path === '/api/webchat/v2/automations' && method === 'GET') {
      return json(route, { automations: [], next_cursor: null });
    }
    if (path === '/api/webchat/v2/extensions/registry') {
      return json(route, { entries: [] });
    }
    if (path === '/api/webchat/v2/extensions') {
      return json(route, { extensions: [] });
    }
    if (path === '/api/webchat/v2/channels/connectable') {
      return json(route, { channels: [] });
    }
    if (path === '/auth/providers') {
      return json(route, { providers: [] });
    }

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
