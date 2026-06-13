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

test('static front door: cold open shows backed needs-you and handled receipts', async ({
  page
}) => {
  const consoleIssues: string[] = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });

  await page.addInitScript(() => {
    window.localStorage.setItem(
      'ironclaw:v2-thread-attention',
      JSON.stringify([['thread-needs-you', 'needs_attention']])
    );
  });
  await installFrontDoorMocks(page);

  await page.goto('/v2/chat?token=frontdoor-static-token');
  await expect(
    page.getByRole('heading', { name: 'What should IronClaw handle next?' })
  ).toBeVisible();

  const panel = page.getByTestId('frontdoor-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByText('Needs you')).toBeVisible();
  await expect(panel.getByText('Legal review approval')).toBeVisible();
  await expect(panel.getByText('Needs approval')).toBeVisible();
  await expect(panel.getByRole('link', { name: /Legal review approval/ })).toHaveAttribute(
    'href',
    '/v2/chat/thread-needs-you'
  );

  await expect(panel.getByText('Handled')).toBeVisible();
  await expect(panel.getByText('Daily digest')).toBeVisible();
  await expect(panel.getByText('Completed')).toBeVisible();
  await expect(panel.getByRole('link', { name: /Daily digest/ })).toHaveAttribute(
    'href',
    '/v2/automations'
  );

  expect(consoleIssues).toEqual([]);
});

async function installFrontDoorMocks(page: Page) {
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
      return json(route, { ok: true, models: ['auto', 'z-ai/glm-4.5'] });
    }
    if (path === '/api/webchat/v2/threads' && method === 'GET') {
      return json(route, {
        threads: [
          {
            id: 'thread-needs-you',
            thread_id: 'thread-needs-you',
            title: 'Legal review approval',
            turn_count: 4,
            updated_at: '2026-06-13T17:45:00.000Z'
          },
          {
            id: 'thread-recent',
            thread_id: 'thread-recent',
            title: 'Draft launch memo',
            turn_count: 2,
            updated_at: '2026-06-13T16:30:00.000Z'
          }
        ],
        next_cursor: null
      });
    }
    if (path === '/api/webchat/v2/automations' && method === 'GET') {
      return json(route, {
        automations: [
          {
            id: 'daily-digest',
            name: 'Daily digest',
            state: 'active',
            source: { type: 'schedule', cron: '0 8 * * *' },
            last_status: 'ok',
            last_run_at: '2026-06-13T17:30:00.000Z',
            next_run_at: '2026-06-14T08:00:00.000Z',
            created_at: '2026-06-01T08:00:00.000Z'
          }
        ],
        next_cursor: null
      });
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
