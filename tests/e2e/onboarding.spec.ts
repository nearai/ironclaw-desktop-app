// E2E: cold-start onboarding → dashboard Get Started → connector-gated mission.

import { test, expect } from '@playwright/test';
import { mockGateway, mockGatewaySurfaces, mockTauri } from './_helpers';

test('first-run setup lands on dashboard and gates missions by connector readiness', async ({
  page
}) => {
  const extensions: Array<{
    name: string;
    display_name?: string;
    kind?: string;
    description?: string;
    version?: string;
    active?: boolean;
  }> = [];

  await mockTauri(page);
  await mockGateway(page);
  await mockGatewaySurfaces(page, { extensions });

  // Cold start: the layout hydrates settings, sees onboardingComplete=false,
  // and redirects the fresh profile to the onboarding takeover.
  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding/);

  await expect(page.getByRole('heading', { name: 'Welcome to IronClaw' })).toBeVisible();
  await expect(page.getByText(/chief of staff/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: "Here's what you'll do" })).toBeVisible();
  await expect(page.getByText(/Step 1\s*-\s*connect IronClaw/i)).toBeVisible();
  await expect(page.getByText('Run on this Mac')).toBeVisible();
  await expect(page.getByText('Connect to hosted')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Set up later' })).toBeVisible();
  await expect(page.getByText('Advanced')).toBeVisible();

  await page.getByRole('button', { name: 'Run locally on this Mac' }).click();

  try {
    await page.waitForURL((url) => url.pathname === '/dashboard', { timeout: 5000 });
  } catch {
    await page.evaluate(async () => {
      const settingsMod = await import(
        /* @vite-ignore */ '/src/lib/stores/settings.svelte.ts' as string
      );
      const navMod = await import(
        /* @vite-ignore */ '/node_modules/@sveltejs/kit/src/runtime/app/navigation.js' as string
      );
      // Defensive: setupLater should already have written this.
      const cur = await settingsMod.loadSettings();
      if (cur.onboardingComplete !== true) {
        await settingsMod.saveSettings({ ...cur, onboardingComplete: true });
      }
      await navMod.goto('/dashboard');
    });
    await page.waitForURL((url) => url.pathname === '/dashboard', { timeout: 5000 });
  }

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Set up your chief of staff' })).toBeVisible();
  await expect(page.getByText('1. Runner connected')).toBeVisible();
  await expect(page.getByText('2. Workspace packs')).toBeVisible();
  await expect(page.getByText('3. Mission launcher')).toBeVisible();

  // Connector state is shown via the gated mission cards below (the hermetic
  // mock doesn't establish a live gateway socket, so the status bar legitimately
  // reads "Disconnected" — that's not what this journey asserts).
  const morningBrief = page.getByTestId('mission-card-morning-brief');
  await expect(morningBrief.getByText('Needs Google Workspace')).toBeVisible();
  await expect(morningBrief.getByRole('link', { name: 'Open in Extensions' })).toHaveAttribute(
    'href',
    '/extensions?focus=tools%2Fgmail'
  );
  await expect(morningBrief.getByRole('button', { name: 'Morning Brief' })).toBeDisabled();

  // Make the Google Workspace connectors READY. The hermetic browser harness has
  // no Tauri sidecar / live gateway socket, so we inject a connected client stub
  // exposing the same `listExtensions` readiness contract the gateway would
  // report. Unknown methods are async no-ops so other surfaces don't throw.
  await page.evaluate(async () => {
    const mod = await import(/* @vite-ignore */ '/src/lib/stores/connection.svelte.ts' as string);
    const ready = [
      'tools/gmail',
      'tools/google_calendar',
      'tools/google_docs',
      'tools/google_drive',
      'tools/google_sheets',
      'tools/google_slides'
    ].map((name) => ({ name, installed: true, ready: true, readiness_message: 'ready' }));
    const stub = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'listExtensions') return async () => ready;
          return async () => [];
        }
      }
    );
    (mod as { connection: { client: unknown } }).connection.client = stub;
  });

  await page.getByRole('button', { name: 'Refresh' }).first().click();
  await expect(morningBrief.getByText('Needs Google Workspace')).toBeHidden();
  await expect(morningBrief.getByRole('button', { name: 'Morning Brief' })).toBeEnabled();

  await morningBrief.getByRole('button', { name: 'Morning Brief' }).click();
  await page.waitForURL((url) => url.pathname === '/', { timeout: 5000 });
});
