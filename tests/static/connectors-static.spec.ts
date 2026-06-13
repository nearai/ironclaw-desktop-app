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

const registryEntries = [
  {
    id: 'gmail',
    display_name: 'Gmail',
    kind: 'wasm_tool',
    description: 'Read, triage, draft, and prepare email work with approval gates.',
    package_ref: { kind: 'extension', id: 'tools/gmail' },
    keywords: ['email', 'google', 'inbox']
  },
  {
    id: 'google-calendar',
    display_name: 'Google Calendar',
    kind: 'wasm_tool',
    description: 'Find meetings, protect focus blocks, and prepare schedule changes.',
    package_ref: { kind: 'extension', id: 'tools/google_calendar' },
    keywords: ['calendar', 'google', 'schedule']
  },
  {
    id: 'notion',
    display_name: 'Notion',
    kind: 'mcp_server',
    description: 'Search team knowledge, draft pages, and keep decisions visible.',
    package_ref: { kind: 'extension', id: 'mcp-servers/notion' },
    keywords: ['knowledge', 'docs', 'wiki']
  },
  {
    id: 'slack',
    display_name: 'Slack',
    kind: 'wasm_channel',
    description: 'Summarize channels, prepare replies, and surface urgent asks.',
    package_ref: { kind: 'extension', id: 'channels/slack' },
    keywords: ['messages', 'team', 'channels']
  }
];

test('static connectors: registry clicks keep slash refs out of lifecycle URLs', async ({
  page
}) => {
  const calls: CapturedCall[] = [];
  await installConnectorMocks(page, calls);

  await page.goto('/v2/extensions/registry?token=connector-static-token');
  await expect(page.getByTestId('registry-card-gmail')).toBeVisible();

  await clickRegistryConnect(page, 'gmail');
  await expect
    .poll(() => hasPath(calls, '/api/webchat/v2/extensions/gmail/setup/oauth/start'))
    .toBe(true);
  await expectGoogleSetupLinks(page, 'gmail');

  await clickRegistryConnect(page, 'google-calendar');
  await expect
    .poll(() => hasPath(calls, '/api/webchat/v2/extensions/google-calendar/setup/oauth/start'))
    .toBe(true);
  await expectGoogleSetupLinks(page, 'google-calendar');

  await clickRegistryConnect(page, 'notion');
  await expect
    .poll(() => hasPath(calls, '/api/webchat/v2/extensions/notion/setup/oauth/start'))
    .toBe(true);
  await expect(
    page.getByTestId('registry-card-notion').getByRole('button', { name: 'Retry connect' })
  ).toBeVisible();

  await clickRegistryConnect(page, 'slack');
  await expect.poll(() => hasPath(calls, '/api/webchat/v2/extensions/slack/activate')).toBe(true);
  await expect(
    page.getByTestId('registry-card-slack').getByRole('button', { name: 'Connected' })
  ).toBeDisabled();

  const installCalls = calls.filter((call) => call.path === '/api/webchat/v2/extensions/install');
  expect(installCalls.map((call) => call.body?.package_ref?.id)).toEqual([
    'tools/gmail',
    'tools/google_calendar',
    'mcp-servers/notion',
    'channels/slack'
  ]);

  const lifecycleCalls = calls.filter((call) => call.path !== '/api/webchat/v2/extensions/install');
  for (const call of lifecycleCalls) {
    expect(call.path).not.toContain('tools/');
    expect(call.path).not.toContain('channels/');
    expect(call.path).not.toContain('mcp-servers/');
    expect(call.path).not.toContain('google_calendar');
  }
});

test('static connectors: chat connect prompts open an honest extension setup path', async ({
  page
}) => {
  const calls: CapturedCall[] = [];
  await installConnectorMocks(page, calls);

  await page.goto('/v2/chat?token=connector-static-token');
  await expect(
    page.getByRole('heading', { name: 'What should IronClaw handle next?' })
  ).toBeVisible();

  await page.getByPlaceholder('Ask IronClaw anything.').fill('connect notion for my team docs');
  await page.getByRole('button', { name: 'Send message' }).click();

  const recovery = page.getByTestId('connector-recovery-card');
  await expect(recovery).toBeVisible();
  await expect(recovery).toContainText('Open Notion setup');
  await expect(recovery.getByRole('link', { name: 'Open setup' })).toHaveAttribute(
    'href',
    '/v2/extensions/registry?setup=1&focus=notion'
  );

  await recovery.getByRole('link', { name: 'Open setup' }).click();
  await expect(page).toHaveURL(/\/v2\/extensions\/registry\?setup=1&focus=notion/);
  await expect(page.getByTestId('registry-card-notion')).toBeVisible();
});

test('static connectors: failed connector runs recover to extension setup', async ({ page }) => {
  const calls: CapturedCall[] = [];
  await installConnectorMocks(page, calls);

  await page.goto('/v2/chat/thread-connector-failure?token=connector-static-token');
  await page.locator('textarea').first().waitFor({ timeout: 20_000 });

  await expect(page.getByText('Notion tool is not installed for this run.')).toBeVisible({
    timeout: 20_000
  });
  const recovery = page.getByTestId('connector-recovery-card');
  await expect(recovery).toBeVisible();
  await expect(recovery).toContainText('Open Notion setup');
  await expect(recovery.getByRole('link', { name: 'Open setup' })).toHaveAttribute(
    'href',
    '/v2/extensions/registry?setup=1&focus=notion'
  );

  await recovery.getByRole('link', { name: 'Open setup' }).click();
  await expect(page).toHaveURL(/\/v2\/extensions\/registry\?setup=1&focus=notion/);
  await expect(page.getByTestId('registry-card-notion')).toBeVisible();
});

type CapturedCall = {
  method: string;
  path: string;
  body: any;
};

async function clickRegistryConnect(page: Page, id: string) {
  const card = page.getByTestId(`registry-card-${id}`);
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Connect' }).click();
}

async function expectGoogleSetupLinks(page: Page, id: string) {
  const links = page.getByTestId(`registry-card-${id}`).getByRole('link', {
    name: 'Open Google setup'
  });
  await expect(links).toHaveCount(2);
  await expect(links.first()).toHaveAttribute('href', '/v2/settings/inference#google-oauth');
  await expect(links.last()).toHaveAttribute('href', '/v2/settings/inference#google-oauth');
}

function hasPath(calls: CapturedCall[], path: string) {
  return calls.some((call) => call.path === path);
}

async function installConnectorMocks(page: Page, calls: CapturedCall[]) {
  await page.route(/\/(api|auth)\//, async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    if (path.startsWith('/api/webchat/v2/extensions')) {
      calls.push({ method, path, body: await requestJson(route) });
    }

    if (path === '/api/gateway/status') {
      return json(route, gatewayStatus);
    }
    if (path === '/api/webchat/v2/llm/providers') {
      return json(route, llmProviders);
    }
    if (path === '/api/webchat/v2/llm/list-models' && method === 'POST') {
      return json(route, { ok: true, models: ['auto', 'z-ai/glm-4.5', 'gpt-oss-120b'] });
    }
    if (path === '/api/webchat/v2/llm/active' && method === 'POST') {
      return json(route, { ok: true, active: llmProviders.active });
    }
    if (path === '/api/webchat/v2/threads' && method === 'GET') {
      return json(route, {
        threads: [
          {
            thread_id: 'thread-connector-failure',
            id: 'thread-connector-failure',
            title: 'Connector failure proof'
          }
        ],
        next_cursor: null
      });
    }
    if (path === '/api/webchat/v2/threads/thread-connector-failure/timeline') {
      return json(route, { messages: [], summary_artifacts: [], next_cursor: null });
    }
    if (path === '/api/webchat/v2/threads/thread-connector-failure/events') {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream; charset=utf-8',
        body: [
          ': connected',
          '',
          'id: connector-failure-1',
          'event: projection_update',
          `data: ${JSON.stringify({
            type: 'projection_update',
            state: {
              items: [
                { run_status: { run_id: 'run-connector-failure', status: 'running' } },
                {
                  run_status: {
                    run_id: 'run-connector-failure',
                    status: 'failed',
                    failure_category: 'missing_tool',
                    failure_summary: 'Notion tool is not installed for this run.'
                  }
                }
              ]
            }
          })}`,
          '',
          ''
        ].join('\n')
      });
    }
    if (path === '/api/webchat/v2/automations' && method === 'GET') {
      return json(route, { automations: [], next_cursor: null });
    }
    if (path === '/api/webchat/v2/extensions/registry') {
      return json(route, { entries: registryEntries });
    }
    if (path === '/api/webchat/v2/extensions' && method === 'GET') {
      return json(route, { extensions: [] });
    }
    if (path === '/api/webchat/v2/channels/connectable') {
      return json(route, { channels: [] });
    }
    if (path === '/auth/providers') {
      return json(route, { providers: [] });
    }
    if (path === '/api/webchat/v2/extensions/install' && method === 'POST') {
      return json(route, { success: true });
    }
    if (path.endsWith('/setup') && method === 'GET') {
      return json(route, setupResponseFor(path));
    }
    if (path.endsWith('/setup/oauth/start') && method === 'POST') {
      return json(route, oauthStartResponseFor(path));
    }
    if (path.endsWith('/activate') && method === 'POST') {
      return json(route, {
        success: true,
        phase: 'connected',
        authenticated: true,
        account_ready: true,
        account_label: 'workspace@example.com'
      });
    }

    return json(route, { ok: true });
  });
}

function setupResponseFor(path: string) {
  if (path.includes('/slack/')) {
    return { secrets: [] };
  }
  const provider = path.includes('/notion/')
    ? 'notion'
    : path.includes('/google-calendar/')
      ? 'google_calendar'
      : 'gmail';
  return {
    secrets: [
      {
        name: `${provider}_oauth`,
        provider,
        provided: false,
        setup: {
          kind: 'oauth',
          scopes: provider === 'notion' ? ['search'] : ['read']
        }
      }
    ]
  };
}

function oauthStartResponseFor(path: string) {
  if (path.includes('/notion/')) {
    return { success: false, message: 'No hosted Notion OAuth client is configured.' };
  }
  return { success: false, message: 'No hosted Google OAuth client is configured.' };
}

async function requestJson(route: Route) {
  const raw = route.request().postData();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function json(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(body)
  });
}
