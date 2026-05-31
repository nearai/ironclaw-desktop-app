// E2E: send a Reborn chat message and see the user bubble + mocked assistant
// reply render in the stream.
//
// We seed settings with `onboardingComplete: true` to skip the wizard.
// The `mockTauri()` helper detects that flag and pre-seeds the
// connection store before the layout mounts, so the layout's first-run
// guard sees the right `onboardingComplete` value and never bounces us
// to `/onboarding`. (Without the pre-seed there's a known race: the
// sidebar's onMount takes the `initialized` flag before the layout's
// runs, then the layout's `init().then(...)` callback fires against
// `DEFAULT_SETTINGS` and unconditionally redirects.)
//
// The mocked gateway answers `/api/chat/send` with `{message_id,
// thread_id, status: queued}` and `/api/chat/events` with a single SSE
// frame carrying `Mocked reply`, then a `message_end`.

import { test, expect } from '@playwright/test';
import { mockGateway, mockGatewaySurfaces, mockTauri } from './_helpers';

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
      useResponsesApi: false,
      engineV2Enabled: false
    },
    token: 'mock-token-abc'
  });

  await mockGateway(page, {
    threads: [],
    mockedReply: 'Mocked reply'
  });
  await mockGatewaySurfaces(page);

  await page.goto('/');

  // No onboarding redirect should fire (the pre-seed in mockTauri
  // prevents it). Land directly on the Reborn chat surface.
  await expect(page.getByTestId('reborn-chat-panel')).toBeVisible({
    timeout: 10_000
  });

  // Lock onto the stable placeholder text "Message IronClaw…" (only present
  // once the connection-store client is non-null).
  const composer = page.getByPlaceholder('Message IronClaw…');
  await expect(composer).toBeEnabled({ timeout: 5000 });
  await composer.fill('Hello agent');
  await expect(composer).toHaveValue('Hello agent');

  await composer.press('Enter');

  await expect(page.getByText('Hello agent', { exact: true })).toBeVisible({
    timeout: 4000
  });

  await expect(page.getByText('Mocked reply').first()).toBeVisible({
    timeout: 4000
  });
});
