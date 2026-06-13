import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

type AxeImpact = 'critical' | 'serious' | 'moderate' | 'minor';

interface Surface {
  label: string;
  path: string;
  authenticated?: boolean;
  waitFor: (page: Page) => Promise<void>;
}

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

const surfaces: Surface[] = [
  {
    label: 'onboarding',
    path: '/v2/welcome',
    waitFor: async (page) => {
      await expect(page.getByRole('heading', { name: 'IronClaw Desktop' })).toBeVisible();
    }
  },
  {
    label: 'chat',
    path: '/v2/chat',
    authenticated: true,
    waitFor: async (page) => {
      await expect(
        page.getByRole('heading', { name: 'What should IronClaw handle next?' })
      ).toBeVisible();
    }
  },
  {
    label: 'connections registry',
    path: '/v2/extensions/registry',
    authenticated: true,
    waitFor: async (page) => {
      await expect(page.getByText('Daily news digest')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Gmail' })).toBeVisible();
    }
  },
  {
    label: 'AI setup',
    path: '/v2/settings/inference',
    authenticated: true,
    waitFor: async (page) => {
      await expect(page.getByText('AI runtime')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'NEAR AI Cloud' })).toBeVisible();
    }
  }
];

async function installStaticApiMocks(page: Page) {
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
    if (path === '/api/webchat/v2/threads' && method === 'GET') {
      return json(route, { threads: [], next_cursor: null });
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

async function expectNoBlockingA11y(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
  const blocking = results.violations
    .filter((violation) => ['critical', 'serious'].includes(violation.impact || ''))
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact as AxeImpact,
      help: violation.help,
      helpUrl: violation.helpUrl,
      targets: violation.nodes.slice(0, 5).map((node) => ({
        selector: node.target.join(' > '),
        html: node.html.slice(0, 200)
      }))
    }));

  expect(
    blocking,
    `${label} has ${blocking.length} blocking a11y violation(s): ${JSON.stringify(blocking, null, 2)}`
  ).toEqual([]);
}

for (const surface of surfaces) {
  test(`static a11y: ${surface.label}`, async ({ page }) => {
    const consoleIssues: string[] = [];
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) {
        consoleIssues.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => {
      consoleIssues.push(`pageerror: ${error.message}`);
    });

    await installStaticApiMocks(page);
    const token = surface.authenticated ? '?token=static-a11y-token' : '';
    await page.goto(`${surface.path}${token}`);
    await surface.waitFor(page);

    await expectNoBlockingA11y(page, surface.label);
    expect(consoleIssues, `${surface.label} console should stay quiet`).toEqual([]);
  });
}
