import { test, expect } from '@playwright/test';
import { mockGateway, mockTauri, type TauriMockSettings } from './_helpers';

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

test('/work lets a user create a local work item and change its status', async ({ page }) => {
  const title = 'Acme renewal plan';
  const objective = 'Decide renewal terms and prepare the approval packet.';

  await mockTauri(page, { settings: SETTINGS, token: 'tok' });
  await mockGateway(page, { threads: [] });
  await page.addInitScript(() => {
    window.localStorage.removeItem('ironclaw-work-items');
  });

  await page.goto('/work');

  await expect(page.getByRole('heading', { name: 'Work' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('No work items yet.')).toBeVisible();

  await page.getByRole('button', { name: 'New work item' }).click();

  const modal = page.getByRole('dialog', { name: 'New work item' });
  await expect(modal).toBeVisible();
  await modal.getByLabel('Title').fill(title);
  await modal.getByLabel('Objective').fill(objective);
  await modal.getByLabel('Domain').selectOption('legal');
  await modal.getByRole('button', { name: 'Create' }).click();

  await expect(modal).toBeHidden();

  const row = page.getByRole('button', { name: `Open work item ${title}` });
  await expect(row).toBeVisible();
  await expect(row).toContainText(title);
  await expect(row).toContainText('Legal');
  await expect(row).toContainText('Active');

  const detail = page.getByRole('region', { name: 'Work item detail' });
  await expect(detail.getByRole('heading', { name: title })).toBeVisible();
  await expect(detail).toContainText(objective);
  await expect(detail).toContainText('Legal');
  await expect(detail.getByRole('button', { name: 'Active' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  await detail.getByRole('button', { name: 'Blocked' }).click();

  await expect(detail.getByRole('button', { name: 'Blocked' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(row).toContainText('Blocked');

  await expect
    .poll(async () =>
      page.evaluate((expectedTitle) => {
        const raw = window.localStorage.getItem('ironclaw-work-items');
        const items = raw ? (JSON.parse(raw) as Array<{ title?: string; status?: string }>) : [];
        return items.find((item) => item.title === expectedTitle)?.status ?? null;
      }, title)
    )
    .toBe('blocked');
});
