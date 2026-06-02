import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

const port = Number(process.env.WEBUI_STATIC_SMOKE_PORT || '17620');
const gatewayOrigin = process.env.WEBUI_STATIC_SMOKE_GATEWAY_ORIGIN || 'http://127.0.0.1:17621';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/index.html`);
      if (response.ok) return;
    } catch {
      // Keep waiting.
    }
    await wait(250);
  }
  throw new Error('static WebUI server did not start');
}

function installTauriShim(page) {
  return page.addInitScript(
    ({ gatewayOrigin }) => {
      const sidecarPort = Number(new URL(gatewayOrigin).port);
      const state = {
        settings: {
          activeProfileId: 'default',
          profiles: [
            {
              id: 'default',
              name: 'Default',
              mode: 'remote',
              remoteBaseUrl: 'http://127.0.0.1:3000',
              localBaseUrl: 'http://127.0.0.1:3000',
              llmBackend: 'nearai',
              llmProviderId: 'nearai',
              llmModelId: 'auto',
              apiVersion: 'v2'
            }
          ],
          onboardingComplete: true
        },
        nextRid: 1,
        requests: new Map(),
        bodies: new Map()
      };

      window.localStorage.setItem('ironclaw:desktop-gateway-origin', 'http://127.0.0.1:3000');
      window.sessionStorage.setItem('ironclaw_token', 'stale-token-from-previous-run');

      function pick(obj, key) {
        return obj && typeof obj === 'object' && key in obj ? obj[key] : undefined;
      }

      async function dispatch(command, args) {
        switch (command) {
          case 'get_settings':
            return JSON.parse(JSON.stringify(state.settings));
          case 'sidecar_status':
            return { running: true, port: sidecarPort };
          case 'get_token':
            return 'desktop-token';
          case 'get_or_create_local_token':
            return 'local-token';
          case 'plugin:http|fetch': {
            const cfg = pick(args, 'clientConfig');
            if (!cfg?.url) throw new Error('missing plugin:http url');
            const rid = state.nextRid++;
            state.requests.set(
              rid,
              window.fetch(cfg.url, {
                method: cfg.method || 'GET',
                headers: cfg.headers ? Object.fromEntries(cfg.headers) : undefined,
                body: cfg.data ? new Uint8Array(cfg.data) : undefined
              })
            );
            return rid;
          }
          case 'plugin:http|fetch_send': {
            const rid = pick(args, 'rid');
            const request = state.requests.get(rid);
            if (!request) throw new Error(`unknown request ${rid}`);
            const response = await request;
            const responseRid = state.nextRid++;
            const bytes = new Uint8Array(await response.arrayBuffer());
            const chunk = new Uint8Array(bytes.length + 1);
            chunk.set(bytes, 0);
            chunk[chunk.length - 1] = 0;
            state.bodies.set(responseRid, [chunk, new Uint8Array([1])]);
            return {
              status: response.status,
              statusText: response.statusText,
              url: response.url,
              headers: Array.from(response.headers.entries()),
              rid: responseRid
            };
          }
          case 'plugin:http|fetch_read_body': {
            const rid = pick(args, 'rid');
            return Array.from(state.bodies.get(rid)?.shift() || new Uint8Array([1]));
          }
          case 'plugin:http|fetch_cancel':
          case 'plugin:http|fetch_cancel_body':
            return null;
          default:
            throw new Error(`unhandled invoke ${command}`);
        }
      }

      window.__TAURI_INTERNALS__ = {
        invoke: (command, args) => dispatch(command, args),
        transformCallback: () => 0,
        metadata: { currentWindow: { label: 'main' }, windows: [] }
      };
    },
    { gatewayOrigin }
  );
}

const server = spawn('node', ['scripts/serve-webui-static.mjs'], {
  env: {
    ...process.env,
    PORT: String(port),
    IRONCLAW_GATEWAY_ORIGIN: gatewayOrigin
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverOutput = '';
server.stdout.on('data', (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on('data', (chunk) => {
  serverOutput += chunk.toString();
});

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('close', () => errors.push('page closed'));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      errors.push(`${message.type()}: ${message.text()}`);
    }
  });

  await installTauriShim(page);
  const connectorRequests = [];
  const staleGatewayRequests = [];
  await page.route('http://127.0.0.1:3000/**', async (route) => {
    staleGatewayRequests.push(route.request().url());
    await route.abort();
  });
  let gatewayStatusPayload = {
    engine_v2_enabled: true,
    restart_enabled: true,
    llm_backend: 'nearai',
    llm_model: 'auto',
    model_execution_verified: false,
    model_readiness: 'unverified'
  };
  await page.route(`${gatewayOrigin}/api/gateway/status`, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(gatewayStatusPayload)
    });
  });
  await page.route(`${gatewayOrigin}/api/webchat/v2/threads`, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          thread: { thread_id: 'thread-smoke', title: 'Smoke thread' }
        })
      });
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ threads: [], next_cursor: null })
    });
  });
  const chatMessageRequests = [];
  const timelineRequests = [];
  await page.route(
    `${gatewayOrigin}/api/webchat/v2/threads/thread-smoke/messages`,
    async (route) => {
      chatMessageRequests.push(route.request().postDataJSON());
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          thread_id: 'thread-smoke',
          run_id: 'run-smoke',
          status: 'queued'
        })
      });
    }
  );
  await page.route(
    `${gatewayOrigin}/api/webchat/v2/threads/thread-smoke/timeline**`,
    async (route) => {
      timelineRequests.push(route.request().url());
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              kind: 'user',
              message_id: 'msg-user-smoke',
              content: 'Draft a services agreement from this attachment.',
              sequence: 1,
              created_at: '2026-06-02T08:00:00.000Z'
            },
            {
              kind: 'assistant',
              message_id: 'msg-assistant-smoke',
              content:
                '# Services agreement\n\n## Scope\n\nPrepared from the uploaded template with export-ready sections.',
              sequence: 2,
              turn_run_id: 'run-smoke',
              created_at: '2026-06-02T08:00:01.000Z'
            }
          ],
          summary_artifacts: [],
          next_cursor: null
        })
      });
    }
  );
  await page.route(
    `${gatewayOrigin}/api/webchat/v2/threads/thread-smoke/events**`,
    async (route) => {
      const frames = [
        `event: accepted\ndata: ${JSON.stringify({
          type: 'accepted',
          ack: { run_id: 'run-smoke', thread_id: 'thread-smoke', status: 'accepted' }
        })}\n\n`,
        `event: final_reply\ndata: ${JSON.stringify({
          type: 'final_reply',
          reply: {
            turn_run_id: 'run-smoke',
            text: '# Services agreement\n\n## Scope\n\nPrepared from the uploaded template with export-ready sections.',
            generated_at: '2026-06-02T08:00:01.000Z'
          }
        })}\n\n`
      ].join('');
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache'
        },
        body: frames
      });
    }
  );
  const failedRunMessageRequests = [];
  const failedRunTimelineRequests = [];
  const failedRunStateRequests = [];
  let failedRunMessageSubmitted = false;
  await page.route(
    `${gatewayOrigin}/api/webchat/v2/threads/thread-fail/messages`,
    async (route) => {
      failedRunMessageSubmitted = true;
      failedRunMessageRequests.push(route.request().postDataJSON());
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          thread_id: 'thread-fail',
          run_id: 'run-fail',
          status: 'queued'
        })
      });
    }
  );
  await page.route(
    `${gatewayOrigin}/api/webchat/v2/threads/thread-fail/timeline**`,
    async (route) => {
      failedRunTimelineRequests.push(route.request().url());
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          messages: failedRunMessageSubmitted
            ? [
                {
                  kind: 'user',
                  message_id: 'msg-user-failed-run',
                  content: 'Trigger failed run-state recovery.',
                  sequence: 1,
                  turn_run_id: 'run-fail',
                  created_at: '2026-06-02T08:01:00.000Z'
                }
              ]
            : [],
          summary_artifacts: [],
          next_cursor: null
        })
      });
    }
  );
  await page.route(
    `${gatewayOrigin}/api/webchat/v2/threads/thread-fail/runs/run-fail`,
    async (route) => {
      failedRunStateRequests.push(route.request().url());
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          turn_id: 'turn-fail',
          run_id: 'run-fail',
          status: 'Failed',
          event_cursor: 70,
          accepted_message_ref: 'msg:msg-user-failed-run',
          resolved_run_profile_id: 'reborn-planned-default',
          resolved_run_profile_version: 1,
          received_at: '2026-06-02T08:01:01.000Z',
          failure: { category: 'driver_unavailable' }
        })
      });
    }
  );
  await page.route(`${gatewayOrigin}/api/reborn/product-auth/manual-token/setup`, async (route) => {
    connectorRequests.push({
      url: route.request().url(),
      method: route.request().method(),
      body: route.request().postDataJSON(),
      authorization: route.request().headers().authorization || ''
    });
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        interaction_id: 'interaction-smoke',
        provider: 'google',
        label: 'Smoke Google',
        expires_at: '2030-01-01T00:00:00Z',
        invocation_id: 'invocation-smoke'
      })
    });
  });
  await page.route(
    `${gatewayOrigin}/api/reborn/product-auth/manual-token/secret-submit`,
    async (route) => {
      connectorRequests.push({
        url: route.request().url(),
        method: route.request().method(),
        body: route.request().postDataJSON(),
        authorization: route.request().headers().authorization || ''
      });
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          credential_ref: 'credential-google-smoke',
          status: 'configured',
          continuation: { type: 'setup_only' }
        })
      });
    }
  );
  await page.route(`${gatewayOrigin}/api/webchat/v2/**`, async (route) => {
    const webchatPath = new URL(route.request().url()).pathname;
    if (
      webchatPath === '/api/webchat/v2/threads' ||
      route.request().url().includes('/threads/thread-smoke/messages') ||
      route.request().url().includes('/threads/thread-smoke/timeline') ||
      route.request().url().includes('/threads/thread-smoke/events') ||
      route.request().url().includes('/threads/thread-fail/messages') ||
      route.request().url().includes('/threads/thread-fail/timeline') ||
      route.request().url().includes('/threads/thread-fail/runs/run-fail')
    ) {
      await route.fallback();
      return;
    }
    if (route.request().url().includes('/extensions/')) {
      const extensionName =
        new URL(route.request().url()).pathname.match(/\/extensions\/([^/]+)\/setup$/)?.[1] ||
        'unknown';
      const body = route.request().postDataJSON();
      connectorRequests.push({
        url: route.request().url(),
        method: route.request().method(),
        body,
        authorization: route.request().headers().authorization || ''
      });
      if (body?.action === 'submit') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'unsupported lifecycle action: submit' })
        });
        return;
      }
      if (body?.action === 'configure') {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            extension_name: extensionName,
            phase: 'unsupported_or_legacy',
            blockers: [
              {
                kind: 'runtime',
                ref_id: 'extension_auth_and_configure_not_yet_wired'
              }
            ],
            package_ref: { kind: 'extension', id: extensionName },
            payload: {}
          })
        });
        return;
      }
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          extension_name: extensionName,
          phase: 'active',
          blockers: [],
          package_ref: { kind: 'extension', id: extensionName },
          payload: {}
        })
      });
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true })
    });
  });
  await page.route(`${gatewayOrigin}/auth/providers`, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ providers: ['google'] })
    });
  });

  await page.goto(`http://127.0.0.1:${port}/index.html`, {
    waitUntil: 'domcontentloaded'
  });
  await page.getByText('Gateway session', { exact: true }).waitFor({ timeout: 20_000 });
  const bootstrappedOrigin = await page.evaluate(() =>
    window.localStorage.getItem('ironclaw:desktop-gateway-origin')
  );
  if (bootstrappedOrigin !== gatewayOrigin) {
    throw new Error(
      `desktop bootstrap did not replace stale gateway origin: ${bootstrappedOrigin}`
    );
  }
  const bootstrappedToken = await page.evaluate(() =>
    window.sessionStorage.getItem('ironclaw_token')
  );
  if (bootstrappedToken !== 'local-token') {
    throw new Error(`desktop bootstrap did not replace stale session token: ${bootstrappedToken}`);
  }
  if (staleGatewayRequests.length > 0) {
    throw new Error(`static app requested stale :3000 origin: ${staleGatewayRequests.join(', ')}`);
  }
  const bodyText = await page.locator('body').innerText();
  if (bodyText.includes('Gateway token')) {
    throw new Error('desktop bootstrap failed: login token form is still visible');
  }

  await page.goto(`http://127.0.0.1:${port}/chat`, {
    waitUntil: 'domcontentloaded'
  });
  await page
    .getByText('Configured (unverified): NEAR.AI / IronClaw default (auto)', { exact: true })
    .waitFor({ timeout: 20_000 });
  const modelControlText = await page.locator('[aria-label="Chat model controls"]').innerText();
  if (modelControlText.includes('OpenRouter') || modelControlText.includes('deepseek/')) {
    throw new Error(
      `static chat model control exposed unconfigured provider:\n${modelControlText}`
    );
  }
  if (modelControlText.includes('Running:')) {
    throw new Error(`static chat model control claimed execution readiness:\n${modelControlText}`);
  }
  await page.locator('[aria-label="Chat model controls"] button').click();
  const openModelControlText = await page.locator('[aria-label="Chat model controls"]').innerText();
  if (openModelControlText.includes('OpenRouter') || openModelControlText.includes('deepseek/')) {
    throw new Error(
      `static chat model picker exposed unconfigured provider:\n${openModelControlText}`
    );
  }
  await page.getByText(/This model has not completed a live run yet/).waitFor({ timeout: 20_000 });
  await page.getByText(/Leave auto to use IronClaw's NEAR\.AI default/).waitFor({
    timeout: 20_000
  });
  await page.keyboard.press('Escape');
  const composer = page.locator('textarea').first();
  await composer.waitFor({ timeout: 20_000 });
  const unverifiedPromptText = 'Hello from an unverified but configured model.';
  await composer.click();
  await composer.pressSequentially(unverifiedPromptText);
  const unverifiedSendButton = page.locator('button[aria-label="Send message"]').last();
  if (await unverifiedSendButton.isDisabled()) {
    throw new Error('static chat disabled Send while model only needed its first verification run');
  }
  await unverifiedSendButton.click();
  {
    const deadline = Date.now() + 20_000;
    while (chatMessageRequests.length === 0 && Date.now() < deadline) {
      await wait(100);
    }
  }
  if (chatMessageRequests.length === 0) {
    throw new Error('static chat did not POST while model only needed its first verification run');
  }
  const unverifiedPost = chatMessageRequests.at(-1);
  if (unverifiedPost?.content !== unverifiedPromptText) {
    throw new Error(
      `static chat did not post first-run verification prompt: ${JSON.stringify(unverifiedPost)}`
    );
  }
  chatMessageRequests.length = 0;
  timelineRequests.length = 0;

  gatewayStatusPayload = {
    ...gatewayStatusPayload,
    model_execution_verified: true,
    model_readiness: 'GREEN'
  };
  await page.goto(`http://127.0.0.1:${port}/chat`, {
    waitUntil: 'domcontentloaded'
  });
  await page
    .getByText('Verified: NEAR.AI / IronClaw default (auto)', { exact: true })
    .waitFor({ timeout: 20_000 });
  const verifiedComposer = page.locator('textarea').first();
  await verifiedComposer.waitFor({ timeout: 20_000 });
  const pdfBytes = Buffer.from('%PDF-1.4\nstatic smoke services agreement template');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'services-template.pdf',
    mimeType: 'application/pdf',
    buffer: pdfBytes
  });
  await page.getByText('services-template.pdf', { exact: true }).waitFor({ timeout: 20_000 });
  const promptText = 'Draft a services agreement from this attachment.';
  await verifiedComposer.click();
  await verifiedComposer.pressSequentially(promptText);
  if ((await verifiedComposer.inputValue()) !== promptText) {
    throw new Error('static chat composer did not retain typed prompt text');
  }
  const sendButton = page.locator('button[aria-label="Send message"]').last();
  await page.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll('button[aria-label="Send message"]'));
    const button = buttons.at(-1);
    return button && !button.disabled;
  });
  await sendButton.click();
  await page.getByText('Draft a services agreement from this attachment.').first().waitFor({
    timeout: 20_000
  });
  try {
    await page
      .getByText('Services agreement', { exact: true })
      .first()
      .waitFor({ timeout: 20_000 });
  } catch (err) {
    await mkdir('output/playwright', { recursive: true });
    let visibleBody = '<page closed>';
    if (!page.isClosed()) {
      await page
        .screenshot({
          path: 'output/playwright/static-work-product-attachment-chat-failure.png',
          fullPage: true
        })
        .catch(() => {});
      visibleBody = await page
        .locator('body')
        .innerText()
        .catch(() => '<body unavailable>');
    }
    throw new Error(
      `static chat did not render mocked work product reply; timelineRequests=${JSON.stringify(
        timelineRequests
      )}; errors=${JSON.stringify(errors)}; body=${JSON.stringify(visibleBody)}`,
      { cause: err }
    );
  }
  const chatPost = chatMessageRequests.at(-1);
  if (!chatPost) {
    throw new Error('static chat did not POST a message request');
  }
  if (chatPost.content !== promptText) {
    throw new Error(`static chat posted wrong content: ${JSON.stringify(chatPost)}`);
  }
  const attachment = chatPost.attachments?.[0];
  if (
    !attachment ||
    attachment.name !== 'services-template.pdf' ||
    attachment.mime_type !== 'application/pdf' ||
    attachment.data_base64 !== pdfBytes.toString('base64')
  ) {
    throw new Error(
      `static chat dropped or malformed attachment payload: ${JSON.stringify(chatPost)}`
    );
  }
  await mkdir('output/playwright', { recursive: true });
  await page.screenshot({
    path: 'output/playwright/static-work-product-attachment-chat.png',
    fullPage: true
  });

  await page.goto(`http://127.0.0.1:${port}/chat/thread-fail`, {
    waitUntil: 'domcontentloaded'
  });
  const failureComposer = page.locator('textarea').first();
  await failureComposer.waitFor({ timeout: 20_000 });
  const failurePromptText = 'Trigger failed run-state recovery.';
  await failureComposer.click();
  await failureComposer.pressSequentially(failurePromptText);
  await page.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll('button[aria-label="Send message"]'));
    const button = buttons.at(-1);
    return button && !button.disabled;
  });
  await page.locator('button[aria-label="Send message"]').last().click();
  await page
    .getByText(
      'The selected model is configured, but its execution driver is unavailable. Check provider setup or choose a verified model before retrying.'
    )
    .waitFor({
      timeout: 30_000
    });
  if (!failedRunMessageRequests.length || !failedRunTimelineRequests.length) {
    throw new Error(
      `failed-run UI did not exercise message+timeline routes: ${JSON.stringify({
        failedRunMessageRequests,
        failedRunTimelineRequests
      })}`
    );
  }
  if (!failedRunStateRequests.length) {
    throw new Error('failed-run UI did not call getRunState after timeline polling expired');
  }
  await page.screenshot({
    path: 'output/playwright/static-run-state-failure-visible.png',
    fullPage: true
  });

  async function assertNoCatalogRefLifecycle() {
    const leaked = connectorRequests.find(
      (request) =>
        request.url.includes('tools%2F') ||
        request.url.includes('tools/') ||
        request.url.includes('mcp-servers%2F') ||
        request.url.includes('mcp-servers/') ||
        request.url.includes('channels%2F') ||
        request.url.includes('channels/')
    );
    if (leaked) {
      throw new Error(`connector lifecycle leaked catalog ref into ExtensionName: ${leaked.url}`);
    }
  }

  async function expectDeepLinkSetup(path, expectedLifecycleSuffix, expectedTitle, expectedCopy) {
    await page.goto(`http://127.0.0.1:${port}${path}`, {
      waitUntil: 'domcontentloaded'
    });
    await page.getByText(expectedTitle, { exact: true }).waitFor({ timeout: 20_000 });
    if (expectedCopy) {
      await page.getByText(expectedCopy).waitFor({ timeout: 20_000 });
    }
    await page.locator('input[type="password"]').waitFor({ timeout: 20_000 });
    const lifecycleRequest = connectorRequests.find((request) =>
      request.url.endsWith(expectedLifecycleSuffix)
    );
    if (!lifecycleRequest) {
      throw new Error(
        `missing lifecycle request for ${expectedLifecycleSuffix}:\n${JSON.stringify(connectorRequests, null, 2)}`
      );
    }
    await assertNoCatalogRefLifecycle();
    await page.keyboard.press('Escape');
    await page.locator('input[type="password"]').waitFor({ state: 'detached', timeout: 20_000 });
  }

  await expectDeepLinkSetup(
    '/extensions/installed?focus=tools%2Fgmail&setup=1',
    '/api/webchat/v2/extensions/gmail/setup',
    'Connect Gmail',
    /manual Product Auth token setup for Gmail/
  );
  await expectDeepLinkSetup(
    '/extensions/installed?focus=tools%2Fgoogle_calendar&setup=1',
    '/api/webchat/v2/extensions/google-calendar/setup',
    'Connect Google Calendar',
    /manual Product Auth token setup for Calendar/
  );
  await expectDeepLinkSetup(
    '/extensions/mcp?focus=mcp-servers%2Fnotion&setup=1',
    '/api/webchat/v2/extensions/notion/setup',
    'Connect Notion',
    /Paste a Notion integration token/
  );

  const beforeSlackRequestCount = connectorRequests.length;
  await page.goto(`http://127.0.0.1:${port}/extensions/channels?focus=channels%2Fslack&setup=1`, {
    waitUntil: 'domcontentloaded'
  });
  await page.getByText('Slack', { exact: true }).waitFor({ timeout: 20_000 });
  await page
    .getByText(/Slack is blocked:/)
    .first()
    .waitFor({ timeout: 20_000 });
  const slackLifecycleRequest = connectorRequests.find(
    (request, index) =>
      index >= beforeSlackRequestCount &&
      request.url.endsWith('/api/webchat/v2/extensions/slack/setup')
  );
  if (slackLifecycleRequest) {
    throw new Error(`unsupported Slack deep link called lifecycle: ${slackLifecycleRequest.url}`);
  }

  await page.goto(`http://127.0.0.1:${port}/extensions/installed`, {
    waitUntil: 'domcontentloaded'
  });
  await page.getByText('Gmail', { exact: true }).waitFor({ timeout: 20_000 });
  const preSetupText = await page.locator('body').innerText();
  if (preSetupText.includes('Gmail\nactive') || preSetupText.includes('Gmail\nACTIVE')) {
    throw new Error(
      `static connector UI claimed account readiness from package lifecycle only:\n${preSetupText}`
    );
  }
  await page.getByText('auth needed', { exact: true }).first().waitFor({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Connect token' }).first().click();
  await page.locator('input[type="password"]').fill('ya29.smoke-token');
  await page.locator('input[type="text"]').fill('Smoke Google');
  await page.getByRole('button', { name: 'Save token' }).click();
  await page.locator('input[type="password"]').waitFor({
    state: 'detached',
    timeout: 20_000
  });
  await page.getByText('runtime blocked', { exact: true }).waitFor({ timeout: 20_000 });
  await page
    .getByText(
      'Backend can store this credential, but this connector runtime is not wired in this build yet.',
      {
        exact: true
      }
    )
    .waitFor({ timeout: 20_000 });
  const postSetupText = await page.locator('body').innerText();
  if (postSetupText.includes('Gmail connected') || postSetupText.includes('ready')) {
    throw new Error(
      `static connector UI claimed backend readiness from local credential state:\n${postSetupText}`
    );
  }
  const activateButtonsAfterBlockedConfigure = await page
    .getByRole('button', { name: 'Activate' })
    .count();
  if (activateButtonsAfterBlockedConfigure > 0) {
    throw new Error(
      `static connector UI exposed Activate after backend returned runtime blocker:\n${postSetupText}`
    );
  }

  const setupRequest = connectorRequests.find((request) =>
    request.url.endsWith('/api/reborn/product-auth/manual-token/setup')
  );
  const secretRequest = connectorRequests.find((request) =>
    request.url.endsWith('/api/reborn/product-auth/manual-token/secret-submit')
  );
  const lifecycleRequest = connectorRequests.find(
    (request) =>
      request.url.endsWith('/api/webchat/v2/extensions/gmail/setup') &&
      request.body?.action === 'configure'
  );
  const unsupportedLifecycleRequest = connectorRequests.find(
    (request) =>
      request.url.includes('/api/webchat/v2/extensions/') && request.body?.action === 'submit'
  );
  if (unsupportedLifecycleRequest) {
    throw new Error(
      `connector lifecycle used unsupported submit action: ${JSON.stringify(unsupportedLifecycleRequest)}`
    );
  }
  if (!setupRequest || !secretRequest || !lifecycleRequest) {
    throw new Error(
      `connector setup route sequence incomplete:\n${JSON.stringify(connectorRequests, null, 2)}`
    );
  }
  if (
    setupRequest.body.provider !== 'google' ||
    setupRequest.body.account_label !== 'Smoke Google'
  ) {
    throw new Error(
      `connector setup sent wrong Product Auth body: ${JSON.stringify(setupRequest.body)}`
    );
  }
  if (
    secretRequest.body.interaction_id !== 'interaction-smoke' ||
    secretRequest.body.invocation_id !== 'invocation-smoke' ||
    secretRequest.body.token !== 'ya29.smoke-token'
  ) {
    throw new Error(
      `connector secret-submit body was wrong: ${JSON.stringify(secretRequest.body)}`
    );
  }
  if (lifecycleRequest.body.action !== 'configure') {
    throw new Error(
      `connector lifecycle used unsupported action: ${JSON.stringify(lifecycleRequest.body)}`
    );
  }
  if (lifecycleRequest.body.payload?.credential_ref !== 'credential-google-smoke') {
    throw new Error(
      `connector lifecycle missed credential ref: ${JSON.stringify(lifecycleRequest.body)}`
    );
  }
  await assertNoCatalogRefLifecycle();
  if (!connectorRequests.every((request) => request.authorization === 'Bearer local-token')) {
    throw new Error(
      `connector requests missed local sidecar bearer:\n${JSON.stringify(connectorRequests, null, 2)}`
    );
  }
  if (errors.length) {
    throw new Error(`browser console errors:\n${errors.join('\n')}`);
  }
  await browser.close();
  console.log('PASS webui static desktop bootstrap smoke');
} catch (err) {
  console.error(serverOutput);
  throw err;
} finally {
  server.kill();
}
