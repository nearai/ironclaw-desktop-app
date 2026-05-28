import { test, expect, type Page } from '@playwright/test';
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
  adminMode: true,
  trayEnabled: true,
  useResponsesApi: false,
  engineV2Enabled: false
};

async function pinConnectionConnected(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seed = async (): Promise<void> => {
      try {
        const url = new URL('/src/lib/stores/connection.svelte.ts', window.location.origin).href;
        const mod = (await import(/* @vite-ignore */ url)) as {
          connection: { status: string };
        };
        mod.connection.status = 'connected';
        setTimeout(() => (mod.connection.status = 'connected'), 200);
        setTimeout(() => (mod.connection.status = 'connected'), 800);
      } catch {
        /* best-effort */
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => void seed(), { once: true });
    } else {
      void seed();
    }
  });
}

async function stubClientMethods(page: Page, overrides: Record<string, unknown>): Promise<void> {
  await page.addInitScript((ov: Record<string, unknown>) => {
    const seed = async (): Promise<void> => {
      try {
        const url = new URL('/src/lib/api/ironclaw.ts', window.location.origin).href;
        const mod = (await import(/* @vite-ignore */ url)) as {
          IronClawClient: { prototype: Record<string, unknown> };
        };
        for (const [name, value] of Object.entries(ov)) {
          mod.IronClawClient.prototype[name] = function stub() {
            return Promise.resolve(value);
          };
        }
      } catch {
        /* best-effort */
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => void seed(), { once: true });
    } else {
      void seed();
    }
  }, overrides);
}

test('/dashboard renders the default dashboard tile grid', async ({ page }) => {
  const now = new Date().toISOString();

  await mockTauri(page, { settings: SETTINGS, token: 'tok' });
  await mockGateway(page);
  await pinConnectionConnected(page);
  await stubClientMethods(page, {
    health: { ok: true, status: 'ok' },
    listThreads: [
      {
        id: 'thread-dashboard',
        title: 'Dashboard thread',
        created_at: now,
        updated_at: now,
        message_count: 3
      }
    ],
    listRoutines: [
      {
        id: 'routine-dashboard',
        name: 'Daily briefing',
        schedule: '0 9 * * *',
        enabled: true,
        last_run: now,
        next_run: new Date(Date.now() + 3_600_000).toISOString()
      }
    ],
    listSkills: [
      {
        name: 'research',
        description: 'Research assistant',
        version: '1.0.0',
        installed: true
      }
    ],
    pollThreadChanges: { changed: [], deleted: [], nextSince: Date.now() }
  });

  await page.goto('/dashboard');

  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('tile-grid')).toBeVisible();
  await expect(page.getByTestId('tile-title').filter({ hasText: 'Recent threads' })).toBeVisible();
  await expect(page.getByTestId('tile-title').filter({ hasText: 'Active routines' })).toBeVisible();
  await expect(page.getByTestId('tile-title').filter({ hasText: 'Recent skills' })).toBeVisible();
});
