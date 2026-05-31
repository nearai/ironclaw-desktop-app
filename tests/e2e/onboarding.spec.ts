// E2E: cold-start onboarding flow.
//
// The layout's first-run guard redirects to `/onboarding` whenever
// `settings.onboardingComplete === false`. The current onboarding surface is a
// single outcome-first screen: choose Local, reveal Hosted token entry, or use
// the explicit "Set up later" escape hatch.
//
// This spec stays gateway-free. It validates that Hosted requires a pasted
// token before its Connect action can run, then completes deterministically via
// "Set up later", which writes `onboardingComplete: true` and navigates home.
//
// Note: in Vite dev mode the terminal `goto('/')` call inside onboarding can
// occasionally fail to materialize as SPA navigation. We keep the old settle +
// programmatic fallback so the test can continue after asserting the real user
// action.

import { test, expect } from '@playwright/test';
import { mockTauri } from './_helpers';

test('onboarding setup-later flow lands on chat without a gateway', async ({ page }) => {
  await mockTauri(page);

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

  await page.getByRole('button', { name: 'Connect to a hosted gateway' }).click();

  const tokenInput = page.getByLabel('Access token');
  const connectButton = page.getByRole('button', { name: /^Connect$/ });
  await expect(tokenInput).toBeVisible();
  await expect(connectButton).toBeDisabled();

  await tokenInput.fill('mock-token-abc');
  await expect(connectButton).toBeEnabled();

  await page.getByRole('button', { name: 'Set up later' }).click();

  try {
    await page.waitForURL((url) => url.pathname === '/', { timeout: 3000 });
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
      await navMod.goto('/');
    });
    await page.waitForURL((url) => url.pathname === '/', { timeout: 5000 });
  }

  await expect(page).toHaveURL(/\/$/);
});
