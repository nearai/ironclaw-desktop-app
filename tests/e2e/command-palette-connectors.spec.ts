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

test('Cmd+K exposes connector setup actions before the user finds Extensions', async ({ page }) => {
  await mockTauri(page, { settings: SETTINGS, token: 'tok' });
  await mockGateway(page);
  await mockGatewaySurfaces(page, {
    registryExtensions: [
      {
        name: 'gmail',
        display_name: 'Gmail',
        kind: 'wasm_tool',
        description: 'Gmail workspace connector.'
      }
    ]
  });

  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();

  await page.keyboard.down('Meta');
  await page.keyboard.press('K');
  await page.keyboard.up('Meta');

  await page.getByLabel('Command palette search').fill('gmail');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  const connectGmail = palette.getByText('Connect Gmail', { exact: true });
  await expect(connectGmail).toBeVisible();
  await connectGmail.click();

  await page.waitForURL((url) => url.pathname === '/extensions');
  await expect(page.getByRole('heading', { name: 'Extensions' })).toBeVisible();
  await expect(page.getByText('Gmail workspace connector.')).toBeVisible();
});
