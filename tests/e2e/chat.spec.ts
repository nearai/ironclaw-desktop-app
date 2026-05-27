// E2E: send a chat message and see the user bubble + mocked assistant
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

  // No onboarding redirect should fire (the pre-seed in mockTauri
  // prevents it). Land directly on the chat surface. Wait for
  // `connection.client` to resolve so the "New Chat" button is enabled.
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
