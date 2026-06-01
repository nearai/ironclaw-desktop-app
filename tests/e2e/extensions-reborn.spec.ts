import { expect, test } from '@playwright/test';
import { mockGateway, mockGatewaySurfaces, mockTauri, type TauriMockSettings } from './_helpers';

const SETTINGS: TauriMockSettings = {
  activeProfileId: 'default',
  profiles: [
    {
      id: 'default',
      name: 'Default',
      mode: 'remote',
      remoteBaseUrl: 'http://127.0.0.1:18789',
      localBaseUrl: 'http://127.0.0.1:3100',
      llmBackend: 'nearai',
      llmProviderId: 'nearai'
    }
  ],
  onboardingComplete: true,
  adminMode: false,
  trayEnabled: true,
  useResponsesApi: false,
  engineV2Enabled: false
};

test('legacy prefixed extension focus opens setup through the Reborn bare name', async ({
  page
}) => {
  await mockTauri(page, { settings: SETTINGS, token: 'tok' });
  await mockGateway(page);
  await mockGatewaySurfaces(page, {
    extensions: [
      {
        name: 'gmail',
        display_name: 'Gmail',
        kind: 'wasm_tool',
        description: 'Gmail workspace connector.',
        active: false
      }
    ]
  });

  const setupUrls: string[] = [];
  await page.route(/\/api\/extensions\/[^/]+\/setup(?:\?.*)?$/, async (route) => {
    setupUrls.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        secrets: [{ name: 'google_oauth_token', prompt: 'Google OAuth token', optional: false }],
        fields: []
      })
    });
  });

  await page.goto('/extensions?focus=tools%2Fgmail&setup=1');
  await page.evaluate(async () => {
    const mod = await import(/* @vite-ignore */ '/src/lib/stores/connection.svelte.ts' as string);
    const connection = (
      mod as {
        connection: { token: string | null; status: string };
      }
    ).connection;
    connection.token = 'tok';
    connection.status = 'connected';
  });

  await expect(page.getByRole('heading', { name: 'Extensions' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Gmail' })).toBeVisible();
  await expect(page.getByText('Google OAuth token')).toBeVisible();
  expect(setupUrls).toHaveLength(1);
  expect(setupUrls[0]).toContain('/api/extensions/gmail/setup');
  expect(setupUrls[0]).not.toContain('tools%2Fgmail');
});

test('offline setup deep link preserves connector intent instead of showing a generic dead end', async ({
  page
}) => {
  await mockTauri(page, { settings: SETTINGS, token: null });
  await mockGateway(page, { profile: null });
  await mockGatewaySurfaces(page, { extensions: [] });

  await page.goto('/extensions?focus=gmail&setup=1');

  await expect(page.getByRole('heading', { name: 'Extensions' })).toBeVisible();
  await expect(page.getByText('Connect IronClaw to set up Gmail')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Settings' })).toHaveAttribute(
    'href',
    '/settings'
  );
  await expect(page.getByRole('link', { name: 'Connect runner' })).toHaveAttribute(
    'href',
    '/onboarding'
  );
});

test('same-route extension focus navigation opens setup through the Reborn bare name', async ({
  page
}) => {
  await mockTauri(page, { settings: SETTINGS, token: 'tok' });
  await mockGateway(page);
  await mockGatewaySurfaces(page, {
    extensions: [
      {
        name: 'gmail',
        display_name: 'Gmail',
        kind: 'wasm_tool',
        description: 'Gmail workspace connector.',
        active: false
      }
    ]
  });

  const setupUrls: string[] = [];
  await page.route(/\/api\/extensions\/[^/]+\/setup(?:\?.*)?$/, async (route) => {
    setupUrls.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        secrets: [{ name: 'google_oauth_token', prompt: 'Google OAuth token', optional: false }],
        fields: []
      })
    });
  });

  await page.goto('/extensions');
  await page.evaluate(async () => {
    const mod = await import(/* @vite-ignore */ '/src/lib/stores/connection.svelte.ts' as string);
    const connection = (
      mod as {
        connection: { token: string | null; status: string };
      }
    ).connection;
    connection.token = 'tok';
    connection.status = 'connected';
  });
  await expect(page.getByRole('heading', { name: 'Extensions' })).toBeVisible();

  await page.evaluate(() => {
    const link = document.createElement('a');
    link.href = '/extensions?focus=tools%2Fgmail&setup=1';
    link.textContent = 'Open Gmail setup';
    link.setAttribute('data-testid', 'same-route-focus-link');
    document.body.appendChild(link);
  });
  await page.getByTestId('same-route-focus-link').click();

  await expect(page.getByRole('dialog', { name: 'Gmail' })).toBeVisible();
  await expect(page.getByText('Google OAuth token')).toBeVisible();
  expect(setupUrls.at(-1)).toContain('/api/extensions/gmail/setup');
  expect(setupUrls.at(-1)).not.toContain('tools%2Fgmail');
});

test('OAuth setup drawer starts and polls device login through the Reborn bare name', async ({
  page
}) => {
  await mockTauri(page, { settings: SETTINGS, token: 'tok' });
  await mockGateway(page);
  await mockGatewaySurfaces(page, {
    extensions: [
      {
        name: 'gmail',
        display_name: 'Gmail',
        kind: 'wasm_tool',
        description: 'Gmail workspace connector.',
        active: false
      }
    ]
  });

  const setupUrls: string[] = [];
  await page.route(/\/api\/extensions\/[^/]+\/setup(?:\?.*)?$/, async (route) => {
    setupUrls.push(route.request().url());
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'configured' })
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        fields: [
          {
            key: 'google_oauth',
            label: 'Google OAuth',
            type: 'oauth',
            required: true,
            description: 'Sign in with Google.'
          }
        ]
      })
    });
  });

  const loginUrls: string[] = [];
  const loginBodies: unknown[] = [];
  await page.route(/\/api\/extensions\/[^/]+\/login\/start$/, async (route) => {
    loginUrls.push(route.request().url());
    loginBodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        device_code: 'oauth-session-1',
        verification_uri: 'https://accounts.example.test/device',
        user_code: 'ABCD-EFGH',
        expires_in: 600,
        interval: 0.1
      })
    });
  });
  await page.route(/\/api\/extensions\/[^/]+\/login\/poll$/, async (route) => {
    loginUrls.push(route.request().url());
    loginBodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        status: 'completed',
        activated: true,
        session_id: 'oauth-session-1'
      })
    });
  });

  await page.goto('/extensions?focus=tools%2Fgmail&setup=1');
  await page.evaluate(async () => {
    const mod = await import(/* @vite-ignore */ '/src/lib/stores/connection.svelte.ts' as string);
    const connection = (
      mod as {
        connection: { token: string | null; status: string };
      }
    ).connection;
    connection.token = 'tok';
    connection.status = 'connected';
  });

  await expect(page.getByRole('dialog', { name: 'Gmail' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in with Gmail' }).click();

  await expect(page.getByText('ABCD-EFGH')).toBeVisible();
  await expect(page.getByText('Authorized')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();

  expect(setupUrls[0]).toContain('/api/extensions/gmail/setup');
  expect(loginUrls).toEqual([
    expect.stringContaining('/api/extensions/gmail/login/start'),
    expect.stringContaining('/api/extensions/gmail/login/poll')
  ]);
  expect(loginUrls.join('\n')).not.toContain('tools%2Fgmail');
  expect(loginBodies[0]).toMatchObject({ session_id: expect.any(String) });
  expect(loginBodies[1]).toEqual({ session_id: 'oauth-session-1' });
});
