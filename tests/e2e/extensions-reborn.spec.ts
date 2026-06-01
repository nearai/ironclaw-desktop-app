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
