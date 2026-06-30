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

test('static front door: cold open is composer-first — greeting + composer, no prepared-desk dashboard', async ({
  page
}) => {
  // The home is the single thing the user came to do: hand IronClaw a task. It is
  // a calm greeting and one prominent composer — NOT a 3-column dashboard. The old
  // prepared desk (Needs you / Handled rails, source-boundary strip, suggestion
  // cards) is gone; approvals surface in-thread, receipts live in Work, recent
  // threads live in the sidebar.
  const consoleIssues: string[] = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });

  await installFrontDoorMocks(page);
  await page.goto('/v2/chat?token=frontdoor-static-token');

  await expect(
    page.getByRole('heading', { name: 'What should IronClaw handle next?' })
  ).toBeVisible();
  await expect(page.getByTestId('chat-front-door')).toBeVisible();

  // The composer is the hero and is present on the cold open.
  const composer = page.getByTestId('chat-composer');
  await expect(composer).toBeVisible();
  await expect(composer.getByRole('button', { name: 'Send message' })).toBeVisible();

  // The prepared-desk dashboard is gone.
  await expect(page.getByTestId('frontdoor-panel')).toHaveCount(0);
  await expect(page.getByTestId('source-boundary')).toHaveCount(0);
  await expect(page.getByText('Needs you', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Handled', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Use prompt')).toHaveCount(0);

  // A provider is active in the mock, so no setup nudge competes with the composer.
  await expect(page.getByRole('link', { name: 'Open setup' })).toHaveCount(0);

  expect(consoleIssues).toEqual([]);
});

test('static front door at 390px: no horizontal overflow and composer touch targets stay >=44px', async ({
  page
}) => {
  // Mobile-first law: the chat front door must not overflow at 390px and every
  // composer control the user taps must clear the 44px touch-target minimum.
  await page.setViewportSize({ width: 390, height: 844 });
  await installFrontDoorMocks(page);

  await page.goto('/v2/chat?token=frontdoor-static-token');
  await expect(
    page.getByRole('heading', { name: 'What should IronClaw handle next?' })
  ).toBeVisible();
  await expect(page.getByTestId('chat-front-door')).toBeVisible();

  const overflow = await page.evaluate(() => {
    const de = document.documentElement;
    return {
      docOverflow: de.scrollWidth - de.clientWidth,
      bodyOverflow: document.body.scrollWidth - de.clientWidth
    };
  });
  expect(overflow.docOverflow).toBeLessThanOrEqual(1);
  expect(overflow.bodyOverflow).toBeLessThanOrEqual(1);

  const composer = page.getByTestId('chat-composer');
  for (const name of ['Chat model settings', 'Add to message', 'Send message']) {
    const control = composer.getByRole('button', { name }).first();
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box, `${name} should have a measurable box`).not.toBeNull();
    expect(box!.height, `${name} height >=44px`).toBeGreaterThanOrEqual(44);
    expect(box!.width, `${name} width >=44px`).toBeGreaterThanOrEqual(44);
  }
});

async function installFrontDoorMocks(
  page: Page,
  overrides: { threads?: unknown[]; automations?: unknown[] } = {}
) {
  const threads = overrides.threads ?? [];
  const automations = overrides.automations ?? [];
  await installFrontDoorRoutes(page, threads, automations);
}

async function installFrontDoorRoutes(page: Page, threads: unknown[], automations: unknown[]) {
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
      return json(route, { threads, next_cursor: null });
    }
    if (path === '/api/webchat/v2/automations' && method === 'GET') {
      return json(route, { automations, next_cursor: null });
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
