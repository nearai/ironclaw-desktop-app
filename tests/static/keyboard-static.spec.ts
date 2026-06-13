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

async function installStaticInteractionMocks(page: Page) {
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
    if (path === '/api/webchat/v2/llm/active' && method === 'POST') {
      return json(route, { ok: true, active: llmProviders.active });
    }
    if (path === '/api/webchat/v2/threads' && method === 'GET') {
      return json(route, {
        threads: [
          {
            id: 'thread-keyboard-proof',
            thread_id: 'thread-keyboard-proof',
            title: 'Keyboard proof thread',
            updated_at: '2026-06-13T12:00:00.000Z'
          }
        ],
        next_cursor: null
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

async function activeElementSummary(page: Page) {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element) return '';
    return [
      element.getAttribute('aria-label'),
      element.getAttribute('placeholder'),
      element.getAttribute('title'),
      element.textContent
    ]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  });
}

test.beforeEach(async ({ page }) => {
  await installStaticInteractionMocks(page);
});

test('static keyboard: composer reaches model, attach, and send controls in order', async ({
  page
}) => {
  await page.goto('/v2/chat?token=static-keyboard-token');
  await expect(
    page.getByRole('heading', { name: 'What should IronClaw handle next?' })
  ).toBeVisible();

  const composer = page.getByPlaceholder('Ask IronClaw anything.');
  await composer.fill('Draft a services agreement from my attachment');
  await composer.focus();

  await page.keyboard.press('Tab');
  await expect.poll(() => activeElementSummary(page)).toContain('Chat model settings');

  await page.keyboard.press('Tab');
  await expect.poll(() => activeElementSummary(page)).toContain('Attach files');

  await page.keyboard.press('Tab');
  await expect.poll(() => activeElementSummary(page)).toContain('Send message');
});

test('static keyboard: model selector opens, closes, and keeps setup reachable', async ({
  page
}) => {
  await page.goto('/v2/chat?token=static-keyboard-token');
  await expect(page.getByRole('button', { name: 'Chat model settings' })).toBeVisible();

  await page.getByRole('button', { name: 'Chat model settings' }).focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Chat model settings' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Model source')).toBeVisible();
  await expect(
    dialog.getByRole('link', { name: 'Manage NEAR AI Cloud in Settings' })
  ).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await page.getByRole('button', { name: 'Chat model settings' }).press('Enter');
  await page.getByRole('link', { name: 'Manage NEAR AI Cloud in Settings' }).press('Enter');
  await expect(page).toHaveURL(/\/v2\/settings\/inference/);
  await expect(page.getByRole('heading', { name: 'NEAR AI Cloud' })).toBeVisible();
});

test('static keyboard: command palette navigates without exposing hidden surfaces', async ({
  page
}) => {
  await page.goto('/v2/chat?token=static-keyboard-token');
  await page.keyboard.press('Control+K');

  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await expect(palette).toBeVisible();
  await expect(palette.getByText('Go to Chat')).toBeVisible();
  await expect(palette.getByText('Go to Connections')).toBeVisible();
  await expect(palette.getByText('Go to Settings')).toBeVisible();

  for (const hidden of ['Automations', 'Projects', 'Missions', 'Jobs', 'Routines', 'Admin']) {
    await expect(palette.getByText(hidden, { exact: false })).toHaveCount(0);
  }

  await page.getByPlaceholder(/Type a command or search/).fill('connections');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/v2\/extensions/);
  await expect(page.getByRole('heading', { name: 'No apps connected yet' })).toBeVisible();
});

test('static keyboard: connections and setup pages expose primary actions to tab focus', async ({
  page
}) => {
  await page.goto('/v2/extensions?token=static-keyboard-token');
  await expect(page.getByRole('heading', { name: 'No apps connected yet' })).toBeVisible();

  await page.getByRole('link', { name: 'Browse apps' }).focus();
  await expect.poll(() => activeElementSummary(page)).toContain('Browse apps');
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/v2\/extensions\/registry/);
  await expect(page.getByRole('heading', { name: 'Gmail' })).toBeVisible();

  await page.goto('/v2/settings/inference?token=static-keyboard-token');
  await expect(page.getByRole('heading', { name: 'NEAR AI Cloud' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Model' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Model' }).focus();
  await expect.poll(() => activeElementSummary(page)).toContain('Model');
});
