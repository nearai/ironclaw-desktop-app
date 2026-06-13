import { expect, test, type Page, type Route } from '@playwright/test';
import http from 'node:http';
import type { Socket } from 'node:net';

const gatewayStatus = {
  engine_v2_enabled: true,
  restart_enabled: false,
  total_connections: 0,
  llm_backend: 'nearai',
  llm_model: 'auto',
  model_execution_verified: true,
  model_readiness: 'ready',
  model_execution_readiness: 'ready'
};

const llmProviders = {
  providers: [
    {
      id: 'nearai',
      name: 'NEAR AI Cloud',
      description: 'Model access through NEAR AI Cloud.',
      adapter: 'nearai',
      default_model: 'auto',
      builtin: true,
      api_key_required: false,
      accepts_api_key: true,
      base_url_required: false,
      api_key_set: true
    }
  ],
  active: {
    provider_id: 'nearai',
    model: 'auto'
  }
};

async function installStaticInteractionMocks(page: Page) {
  await page.route(/\/(api|auth)\//, async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    if (path === '/api/gateway/status') {
      return json(route, gatewayStatus);
    }
    if (path === '/api/webchat/v2/llm/providers') {
      return json(route, llmProviders);
    }
    if (path === '/api/webchat/v2/llm/list-models' && method === 'POST') {
      return json(route, {
        ok: true,
        models: [
          'auto',
          'z-ai/glm-4.5',
          'gpt-oss-120b',
          'anthropic/claude-sonnet-4.5',
          'openrouter/chatgpt-4o'
        ]
      });
    }
    if (path === '/api/webchat/v2/llm/active' && method === 'POST') {
      return json(route, { ok: true, active: llmProviders.active });
    }
    if (path === '/api/webchat/v2/threads' && method === 'GET') {
      return json(route, {
        threads: [
          {
            id: 'thread-keyboard-proof',
            thread_id: 'thread-keyboard-proof',
            title: 'Keyboard proof thread',
            updated_at: '2026-06-13T12:00:00.000Z'
          }
        ],
        next_cursor: null
      });
    }
    if (path === '/api/webchat/v2/automations' && method === 'GET') {
      return json(route, { automations: [], next_cursor: null });
    }
    if (path === '/api/webchat/v2/extensions/registry') {
      return json(route, { entries: [] });
    }
    if (path === '/api/webchat/v2/extensions') {
      return json(route, { extensions: [] });
    }
    if (path === '/api/webchat/v2/channels/connectable') {
      return json(route, { channels: [] });
    }
    if (path === '/auth/providers') {
      return json(route, { providers: [] });
    }

    return json(route, { ok: true });
  });
}

async function json(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(body)
  });
}

async function activeElementSummary(page: Page) {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element) return '';
    return [
      element.getAttribute('aria-label'),
      element.getAttribute('placeholder'),
      element.getAttribute('title'),
      element.textContent
    ]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  });
}

test('static keyboard: composer reaches model, add sheet, and send controls in order', async ({
  page
}) => {
  await installStaticInteractionMocks(page);
  await page.goto('/v2/chat?token=static-keyboard-token');
  await expect(
    page.getByRole('heading', { name: 'What should IronClaw handle next?' })
  ).toBeVisible();

  const composer = page.getByPlaceholder('Ask IronClaw anything.');
  await composer.fill('Draft a services agreement from my attachment');
  await composer.focus();

  await page.keyboard.press('Tab');
  await expect.poll(() => activeElementSummary(page)).toContain('Chat model settings');

  await page.keyboard.press('Tab');
  await expect.poll(() => activeElementSummary(page)).toContain('Add to message');

  await page.keyboard.press('Enter');
  const addSheet = page.getByRole('dialog', { name: 'Add to message' });
  await expect(addSheet).toBeVisible();
  await expect(addSheet.getByText('Attach files')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(addSheet).toHaveCount(0);

  await page.keyboard.press('Tab');
  await expect.poll(() => activeElementSummary(page)).toContain('Send message');
});

test('static keyboard: model selector opens, closes, and keeps setup reachable', async ({
  page
}) => {
  await installStaticInteractionMocks(page);
  await page.goto('/v2/chat?token=static-keyboard-token');
  await expect(page.getByRole('button', { name: 'Chat model settings' })).toBeVisible();

  await page.getByRole('button', { name: 'Chat model settings' }).focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Chat model settings' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Model source')).toBeVisible();
  await expect(dialog.locator('div').filter({ hasText: /^Active$/ })).toHaveCount(1);
  await expect(dialog.getByText('Available models')).toBeVisible();
  await expect(dialog.getByText('GLM 4.5')).toBeVisible();
  await expect(dialog.getByText('NEAR premium reasoning', { exact: true })).toHaveCount(1);
  await expect(dialog.getByText(/z-ai\/glm|anthropic|claude|openrouter|chatgpt/i)).toHaveCount(0);
  await expect(dialog.getByPlaceholder('Enter a NEAR AI model id')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Use a model ID' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Use a model ID' }).click();
  await expect(dialog.getByPlaceholder('Enter a NEAR AI model id')).toBeVisible();
  await expect(dialog.getByText('NEAR AI model ID')).toBeVisible();
  await expect(
    dialog.getByRole('link', { name: 'Manage NEAR AI Cloud in Settings' })
  ).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await page.getByRole('button', { name: 'Chat model settings' }).press('Enter');
  await page.getByRole('link', { name: 'Manage NEAR AI Cloud in Settings' }).press('Enter');
  await expect(page).toHaveURL(/\/v2\/settings\/inference/);
  await expect(page.getByRole('heading', { name: 'NEAR AI Cloud' })).toBeVisible();
});

test('static keyboard: command palette navigates without exposing hidden surfaces', async ({
  page
}) => {
  await installStaticInteractionMocks(page);
  await page.goto('/v2/chat?token=static-keyboard-token');
  await page.keyboard.press('Control+K');

  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await expect(palette).toBeVisible();
  await expect(palette.getByText('Go to Chat')).toBeVisible();
  await expect(palette.getByText('Go to Connections')).toBeVisible();
  await expect(palette.getByText('Go to Settings')).toBeVisible();

  for (const hidden of ['Automations', 'Projects', 'Missions', 'Jobs', 'Routines', 'Admin']) {
    await expect(palette.getByText(hidden, { exact: false })).toHaveCount(0);
  }

  await page.getByPlaceholder(/Type a command or search/).fill('connections');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/v2\/extensions/);
  await expect(page.getByRole('heading', { name: 'No apps connected yet' })).toBeVisible();
});

test('static keyboard: connections and setup pages expose primary actions to tab focus', async ({
  page
}) => {
  await installStaticInteractionMocks(page);
  await page.goto('/v2/extensions?token=static-keyboard-token');
  await expect(page.getByRole('heading', { name: 'No apps connected yet' })).toBeVisible();

  await page.getByRole('link', { name: 'Browse apps' }).focus();
  await expect.poll(() => activeElementSummary(page)).toContain('Browse apps');
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/v2\/extensions\/registry/);
  await expect(page.getByRole('heading', { name: 'Gmail' })).toBeVisible();

  await page.goto('/v2/settings/inference?token=static-keyboard-token');
  await expect(page.getByRole('heading', { name: 'NEAR AI Cloud' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Model' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Model' }).focus();
  await expect.poll(() => activeElementSummary(page)).toContain('Model');
});

for (const scenario of [
  { label: 'approve', shortcut: 'Control+Enter', focusButton: 'Approve', resolution: 'approved' },
  { label: 'deny', shortcut: 'Escape', focusButton: 'Deny', resolution: 'denied' }
]) {
  test(`static keyboard: approval gate ${scenario.label} shortcut resolves through Reborn`, async ({
    page
  }) => {
    const gateway = await startGateGateway();
    try {
      await installGateTauriShim(page, gateway.origin, gateway.port);
      await page.goto('/v2/chat/thread-gate');
      await page.locator('textarea').first().waitFor({ timeout: 20_000 });

      const prompt = `Please ${scenario.label} this gated services agreement action.`;
      const composer = page.locator('textarea').first();
      await composer.fill(prompt);
      await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled();
      await page.getByRole('button', { name: 'Send message' }).click();

      await expect(page.getByRole('group', { name: 'Approval required' })).toBeVisible();
      await expect(page.getByText('send_email', { exact: true })).toBeVisible();
      await expect(page.getByText('"recipient": "legal-review@example.com"')).toBeVisible();

      await page.getByRole('button', { name: scenario.focusButton }).focus();
      await page.keyboard.press(scenario.shortcut);

      await expect.poll(() => gateway.state.resolveRequests.length, { timeout: 20_000 }).toBe(1);
      expect(gateway.state.messageRequest?.content).toBe(prompt);
      expect(gateway.state.resolveRequests[0]).toMatchObject({
        authorization: 'Bearer gate-keyboard-token',
        body: { resolution: scenario.resolution }
      });
      expect(gateway.state.resolveRequests[0].url).toContain(
        '/threads/thread-gate/runs/run-gate/gates/gate-send-email/resolve'
      );
    } finally {
      await gateway.close();
    }
  });
}

async function startGateGateway() {
  const clients = new Set<http.ServerResponse>();
  const sockets = new Set<Socket>();
  const state: {
    messageRequest: null | { content?: string };
    resolveRequests: Array<{ url: string; body: unknown; authorization: string }>;
  } = {
    messageRequest: null,
    resolveRequests: []
  };
  let gateSent = false;
  let origin = '';

  function writeSse(res: http.ServerResponse, event: string, payload: unknown, id: string) {
    res.write(`id: ${id}\n`);
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }

  function sendGate() {
    if (gateSent) return;
    gateSent = true;
    for (const client of clients) {
      writeSse(
        client,
        'accepted',
        {
          type: 'accepted',
          ack: { run_id: 'run-gate', thread_id: 'thread-gate', status: 'accepted' }
        },
        '1'
      );
      writeSse(
        client,
        'gate',
        {
          type: 'gate',
          prompt: {
            request_id: 'request-send-email',
            turn_run_id: 'run-gate',
            gate_ref: 'gate-send-email',
            headline: 'Approve sending an email',
            body: 'Send the generated services agreement to the legal review inbox.',
            tool_name: 'send_email',
            description: 'Send the generated services agreement to the legal review inbox.',
            parameters: {
              recipient: 'legal-review@example.com',
              subject: 'Draft services agreement',
              attachment_name: 'services-agreement.docx'
            },
            allow_always: true
          }
        },
        '2'
      );
    }
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', origin || 'http://127.0.0.1');
    if (req.method === 'OPTIONS') {
      send(res, 204, '');
      return;
    }
    if (url.pathname === '/api/gateway/status') {
      sendJson(res, 200, gatewayStatus);
      return;
    }
    if (url.pathname === '/api/webchat/v2/llm/providers') {
      sendJson(res, 200, llmProviders);
      return;
    }
    if (url.pathname === '/api/webchat/v2/threads' && req.method === 'GET') {
      sendJson(res, 200, {
        threads: [{ thread_id: 'thread-gate', id: 'thread-gate', title: 'Gate thread' }],
        next_cursor: null
      });
      return;
    }
    if (url.pathname === '/api/webchat/v2/threads/thread-gate/timeline') {
      sendJson(res, 200, { messages: [], summary_artifacts: [], next_cursor: null });
      return;
    }
    if (url.pathname === '/api/webchat/v2/channels/connectable') {
      sendJson(res, 200, { channels: [] });
      return;
    }
    if (url.pathname === '/auth/providers') {
      sendJson(res, 200, { providers: [] });
      return;
    }
    if (url.pathname === '/api/webchat/v2/threads/thread-gate/events') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization,content-type,accept',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Content-Type': 'text/event-stream'
      });
      res.write(': connected\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      if (state.messageRequest) setTimeout(sendGate, 0);
      return;
    }
    if (url.pathname === '/api/webchat/v2/threads/thread-gate/messages' && req.method === 'POST') {
      state.messageRequest = (await readJson(req)) as { content?: string };
      sendJson(res, 200, { thread_id: 'thread-gate', run_id: 'run-gate', status: 'queued' });
      setTimeout(sendGate, 20);
      return;
    }
    if (
      url.pathname ===
        '/api/webchat/v2/threads/thread-gate/runs/run-gate/gates/gate-send-email/resolve' &&
      req.method === 'POST'
    ) {
      state.resolveRequests.push({
        url: `${origin}${url.pathname}`,
        body: await readJson(req),
        authorization: String(req.headers.authorization || '')
      });
      sendJson(res, 200, { status: 'resolved', continuation: { type: 'turn_gate_resume' } });
      return;
    }

    sendJson(res, 404, { error: `unhandled ${req.method} ${url.pathname}` });
  });

  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  const port = await new Promise<number>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(typeof address === 'object' && address ? address.port : 0);
    });
  });
  origin = `http://127.0.0.1:${port}`;

  return {
    origin,
    port,
    state,
    close: () =>
      new Promise<void>((resolve) => {
        for (const client of clients) client.end();
        for (const socket of sockets) socket.destroy();
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        server.close(finish);
        setTimeout(finish, 1_000).unref?.();
      })
  };
}

function send(
  res: http.ServerResponse,
  status: number,
  body: string,
  headers: Record<string, string> = {}
) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization,content-type,accept',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(body);
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  send(res, status, JSON.stringify(body), {
    'Content-Type': 'application/json; charset=utf-8'
  });
}

async function readJson(req: http.IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : null;
}

async function installGateTauriShim(page: Page, gatewayOrigin: string, gatewayPort: number) {
  await page.addInitScript(
    ({ gatewayOrigin, gatewayPort }) => {
      const state = {
        nextRid: 1,
        requests: new Map(),
        bodies: new Map()
      };

      window.localStorage.setItem('ironclaw:desktop-gateway-origin', gatewayOrigin);

      function pick(obj: Record<string, unknown> | null | undefined, key: string) {
        return obj && typeof obj === 'object' && key in obj ? obj[key] : undefined;
      }

      async function dispatch(command: string, args: Record<string, unknown> = {}) {
        switch (command) {
          case 'get_settings':
            return {
              activeProfileId: 'default',
              profiles: [
                {
                  id: 'default',
                  name: 'Default',
                  mode: 'local',
                  localBaseUrl: gatewayOrigin,
                  remoteBaseUrl: gatewayOrigin,
                  llmBackend: 'nearai',
                  llmProviderId: 'nearai',
                  llmModelId: 'auto',
                  apiVersion: 'v2'
                }
              ],
              onboardingComplete: true
            };
          case 'sidecar_status':
            return { running: true, port: gatewayPort };
          case 'get_token':
          case 'get_or_create_local_token':
            return 'gate-keyboard-token';
          case 'gateway_http_fetch': {
            const request = pick(args, 'request') as {
              url: string;
              method?: string;
              headers?: Iterable<readonly [string, string]>;
              data?: ArrayLike<number>;
            };
            const response = await window.fetch(request.url, {
              method: request.method || 'GET',
              headers: request.headers ? Object.fromEntries(request.headers) : undefined,
              body: request.data ? new Uint8Array(request.data) : undefined
            });
            return {
              status: response.status,
              status_text: response.statusText,
              url: response.url,
              headers: Array.from(response.headers.entries()),
              data: Array.from(new Uint8Array(await response.arrayBuffer()))
            };
          }
          case 'plugin:http|fetch': {
            const config = pick(args, 'clientConfig') as {
              url: string;
              method?: string;
              headers?: Iterable<readonly [string, string]>;
              data?: ArrayLike<number>;
            };
            const rid = state.nextRid++;
            state.requests.set(
              rid,
              window.fetch(config.url, {
                method: config.method || 'GET',
                headers: config.headers ? Object.fromEntries(config.headers) : undefined,
                body: config.data ? new Uint8Array(config.data) : undefined
              })
            );
            return rid;
          }
          case 'plugin:http|fetch_send': {
            const request = state.requests.get(pick(args, 'rid'));
            const response = await request;
            const responseRid = state.nextRid++;
            state.bodies.set(responseRid, response.body?.getReader() || null);
            return {
              status: response.status,
              statusText: response.statusText,
              url: response.url,
              headers: Array.from(response.headers.entries()),
              rid: responseRid
            };
          }
          case 'plugin:http|fetch_read_body': {
            const reader = state.bodies.get(pick(args, 'rid'));
            if (!reader) return [1];
            const { done, value } = await reader.read();
            if (done) return [1];
            const chunk = new Uint8Array(value.length + 1);
            chunk.set(value, 0);
            chunk[chunk.length - 1] = 0;
            return Array.from(chunk);
          }
          case 'plugin:http|fetch_cancel':
          case 'plugin:http|fetch_cancel_body':
            return null;
          default:
            throw new Error(`unhandled invoke ${command}`);
        }
      }

      (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
        invoke: (command: string, args: Record<string, unknown>) => dispatch(command, args),
        transformCallback: () => 0,
        metadata: { currentWindow: { label: 'main' }, windows: [] }
      };
    },
    { gatewayOrigin, gatewayPort }
  );
}
