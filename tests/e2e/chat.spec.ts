// E2E: send a chat message and see the user bubble + mocked assistant
// reply render in the stream.
//
// We seed settings with `onboardingComplete: true` to skip the wizard.
// The layout's first-run guard has a race against `connection.init`
// (the sidebar's onMount calls init() and takes the `initialized` flag
// BEFORE the layout's onMount fires; the layout's `init().then(...)`
// then returns immediately while `connection.settings` still holds
// `DEFAULT_SETTINGS` where `onboardingComplete` is `false`). That bumps
// us to `/onboarding` on first paint. We bypass it by re-asserting the
// settings + driving SvelteKit's goto directly from a `page.evaluate`
// — clicking the wizard's "Skip onboarding" button is unreliable under
// Vite dev's HMR rebinding, and the JS-driven path avoids that.
//
// The mocked gateway answers `/api/chat/send` with `{message_id,
// thread_id, status: queued}` and `/api/chat/events` with a single SSE
// frame carrying `Mocked reply`, then a `message_end`.

import { test, expect } from '@playwright/test';
import { mockGateway, mockTauri } from './_helpers';

test('user can send a message and see it in the stream', async ({ page }) => {
  await mockTauri(page, {
    settings: {
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
      // Pin the legacy /api/chat path. Our mock exposes the responses-API
      // route as a 404 by default; this flag also forces the legacy
      // pipeline so the test stays deterministic on the well-trodden
      // path the prompt exercises.
      useResponsesApi: false,
      engineV2Enabled: false
    },
    token: 'mock-token-abc'
  });

  await mockGateway(page, {
    threads: [],
    mockedReply: 'Mocked reply'
  });

  await page.goto('/');

  // Settle the layout's redirect race (see file-level comment). The
  // race fires somewhere between 200ms and 1.5s after navigation. Race
  // a "wait for redirect" against a "wait for chat surface" — whichever
  // resolves first wins.
  const sawRedirect = await Promise.race([
    page
      .waitForURL(/\/onboarding/, { timeout: 4000 })
      .then(() => true)
      .catch(() => false),
    page
      .getByRole('button', { name: /^New Chat$/ })
      .waitFor({ timeout: 4000 })
      .then(() => false)
      .catch(() => false)
  ]);

  if (sawRedirect || page.url().includes('/onboarding')) {
    // Bounced. Re-confirm the settings and use a direct module-level
    // `goto('/')` to return — this works around an apparent
    // click-handler binding issue in the wizard's Skip button under
    // Vite dev mode, which the chat surface doesn't share.
    await page.evaluate(async () => {
      // Re-import the modules from the Vite module cache so we hit
      // the same singleton instances the app uses.
      const settingsMod = await import(
        /* @vite-ignore */ '/src/lib/stores/settings.svelte.ts' as string
      );
      const connMod = await import(
        /* @vite-ignore */ '/src/lib/stores/connection.svelte.ts' as string
      );
      const navMod = await import(
        /* @vite-ignore */ '/node_modules/@sveltejs/kit/src/runtime/app/navigation.js' as string
      );
      const cur = await settingsMod.loadSettings();
      await settingsMod.saveSettings({ ...cur, onboardingComplete: true });
      await connMod.connection.reloadSettings();
      await navMod.goto('/');
    });
    await page.waitForURL((url) => !url.pathname.startsWith('/onboarding'), {
      timeout: 5000
    });
  }

  // Wait for `connection.client` to resolve (token + URL hydrated) so
  // the "New Chat" button is enabled. The button lives in the left
  // thread rail and renders unconditionally once the chat surface
  // mounts; `disabled` flips false once `connection.client` is non-null.
  const newChat = page.getByRole('button', { name: /^New Chat$/ });
  await expect(newChat).toBeEnabled({ timeout: 10_000 });
  await newChat.click();

  // The composer textarea is keyboard-focused after `onNewChat()`. We
  // lock onto the stable placeholder text "Message IronClaw…" (only
  // present once the connection-store client is non-null) so the
  // locator survives any re-render the thread-create flow triggers.
  const composer = page.getByPlaceholder('Message IronClaw…');
  await expect(composer).toBeEnabled({ timeout: 5000 });
  await composer.fill('Hello agent');

  // Send via Enter. The component listens for Enter (no Shift) and
  // routes to `onSend()`, which posts to /api/chat/send + opens the
  // SSE stream via EventSource against /api/chat/events.
  await composer.press('Enter');

  // The optimistic user bubble renders immediately. The user bubble has
  // class `whitespace-pre-wrap` (no markdown for plain-text); the
  // visible text is verbatim, so a permissive text locator catches it.
  await expect(page.getByText('Hello agent', { exact: true })).toBeVisible({
    timeout: 4000
  });

  // The mocked SSE stream feeds 'Mocked reply' into the assistant
  // bubble. MarkdownView renders the text inside `.markdown-body` —
  // plain text without markup just shows up as a text node, so the
  // generic getByText catches it.
  await expect(page.getByText('Mocked reply').first()).toBeVisible({
    timeout: 4000
  });
});
