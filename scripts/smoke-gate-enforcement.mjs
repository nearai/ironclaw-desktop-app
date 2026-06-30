import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const i18nDir = path.join(repoRoot, 'crates/ironclaw_webui_v2_static/static/js/i18n');

// The approval gate translates `approval.title` / `approval.approve` /
// `approval.deny` in every shipped pack (the other approval.* keys live in the
// i18n BASELINE_MISSING_KEYS allowlist and are intentionally English-only, so we
// never assert those across locales). We read the literal translated values
// straight out of each pack so the smoke can demand the localized copy render.
const APPROVAL_KEYS = ['approval.title', 'approval.approve', 'approval.deny'];
const SHIPPED_LOCALES = ['en', 'es', 'fr', 'de', 'pt-BR', 'ja', 'ar', 'hi', 'uk', 'zh-CN', 'ko'];

function extractKey(source, key) {
  const match = source.match(
    new RegExp(`'${key.replace('.', '\\.')}':\\s*'((?:[^'\\\\]|\\\\.)*)'`)
  );
  if (!match) return null;
  return match[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
}

async function loadLocalizedApprovalCopy() {
  const map = {};
  for (const locale of SHIPPED_LOCALES) {
    const source = await readFile(path.join(i18nDir, `${locale}.js`), 'utf8');
    const title = extractKey(source, 'approval.title');
    const approve = extractKey(source, 'approval.approve');
    const deny = extractKey(source, 'approval.deny');
    // The composer Send button aria-label is `chat.send`, which is also
    // translated per locale; capture it so the locale loop can find the button.
    const send = extractKey(source, 'chat.send');
    if (!title || !approve || !deny || !send) {
      throw new Error(`locale ${locale} is missing one of ${APPROVAL_KEYS.join(', ')}, chat.send`);
    }
    map[locale] = { title, approve, deny, send };
  }
  return map;
}

const localizedApprovalCopy = await loadLocalizedApprovalCopy();

const staticPort = Number(process.env.GATE_SMOKE_STATIC_PORT || '17632');
const gatewayPort = Number(process.env.GATE_SMOKE_GATEWAY_PORT || '17633');
const staticOrigin = `http://127.0.0.1:${staticPort}`;
const gatewayOrigin = `http://127.0.0.1:${gatewayPort}`;
const appBasePath = '/v2';
const gateScreenshotPath = 'output/playwright/static-gate-enforcement-gate.png';
const resolvedScreenshotPath = 'output/playwright/static-gate-enforcement-smoke.png';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('error', reject);
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error(`Invalid JSON request body: ${raw}`, { cause: err }));
      }
    });
  });
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization,content-type,accept',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload), {
    'Content-Type': 'application/json; charset=utf-8'
  });
}

function writeSse(res, event, payload, id) {
  if (id) res.write(`id: ${id}\n`);
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function waitForStaticServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${staticOrigin}/index.html`);
      if (response.ok) return;
    } catch {
      // Keep waiting.
    }
    await wait(250);
  }
  throw new Error('static WebUI server did not start');
}

function createGateGateway() {
  const sseClients = new Set();
  const state = {
    messageRequest: null,
    resolveRequests: [],
    gateSent: false,
    resolved: false
  };

  function sendGate(client) {
    writeSse(
      client,
      'accepted',
      {
        type: 'accepted',
        ack: {
          run_id: 'run-gate',
          thread_id: 'thread-gate',
          status: 'accepted'
        }
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

  function sendContinuation(client) {
    writeSse(
      client,
      'final_reply',
      {
        type: 'final_reply',
        reply: {
          turn_run_id: 'run-gate',
          text: 'Gate resolved and run continued.',
          generated_at: '2026-06-11T18:00:00.000Z'
        }
      },
      '3'
    );
  }

  function broadcastGate() {
    if (state.gateSent) return;
    state.gateSent = true;
    for (const client of sseClients) sendGate(client);
  }

  function broadcastContinuation() {
    for (const client of sseClients) sendContinuation(client);
    setTimeout(() => {
      for (const client of sseClients) client.end();
      sseClients.clear();
    }, 50);
  }

  function reset() {
    for (const client of sseClients) {
      try {
        client.end();
      } catch {
        // Client already gone.
      }
    }
    sseClients.clear();
    state.messageRequest = null;
    state.resolveRequests = [];
    state.gateSent = false;
    state.resolved = false;
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', gatewayOrigin);

    if (req.method === 'OPTIONS') {
      send(res, 204, '');
      return;
    }

    try {
      if (url.pathname === '/api/gateway/status') {
        sendJson(res, 200, {
          engine_v2_enabled: true,
          restart_enabled: true,
          llm_backend: 'nearai',
          llm_model: 'auto',
          model_execution_verified: true,
          model_readiness: 'ready'
        });
        return;
      }

      if (url.pathname === '/api/webchat/v2/llm/providers') {
        sendJson(res, 200, {
          providers: [
            {
              id: 'nearai',
              name: 'NEAR.AI',
              adapter: 'nearai',
              default_model: 'auto',
              builtin: true,
              api_key_required: false,
              accepts_api_key: true,
              api_key_set: false
            }
          ],
          active: { provider_id: 'nearai', model: 'auto' }
        });
        return;
      }

      if (url.pathname === '/api/webchat/v2/channels/connectable') {
        sendJson(res, 200, { channels: [] });
        return;
      }

      if (url.pathname === '/api/webchat/v2/automations' && req.method === 'GET') {
        sendJson(res, 200, { automations: [], next_cursor: null });
        return;
      }

      if (url.pathname === '/auth/providers') {
        sendJson(res, 200, { providers: [] });
        return;
      }

      if (url.pathname === '/api/webchat/v2/threads' && req.method === 'GET') {
        sendJson(res, 200, {
          threads: [{ thread_id: 'thread-gate', title: 'Gate smoke thread' }],
          next_cursor: null
        });
        return;
      }

      if (url.pathname === '/api/webchat/v2/threads/thread-gate/timeline') {
        sendJson(res, 200, {
          messages: state.resolved
            ? [
                {
                  kind: 'user',
                  message_id: 'msg-user-gate',
                  content: state.messageRequest?.content || 'Run the gated send.',
                  sequence: 1,
                  created_at: '2026-06-11T18:00:00.000Z'
                },
                {
                  kind: 'assistant',
                  message_id: 'msg-assistant-gate',
                  content: 'Gate resolved and run continued.',
                  sequence: 2,
                  turn_run_id: 'run-gate',
                  created_at: '2026-06-11T18:00:01.000Z'
                }
              ]
            : [],
          summary_artifacts: [],
          next_cursor: null
        });
        return;
      }

      if (
        url.pathname === '/api/webchat/v2/threads/thread-gate/messages' &&
        req.method === 'POST'
      ) {
        state.messageRequest = await readBody(req);
        sendJson(res, 200, {
          thread_id: 'thread-gate',
          run_id: 'run-gate',
          status: 'queued'
        });
        setTimeout(broadcastGate, 20);
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
        sseClients.add(res);
        req.on('close', () => sseClients.delete(res));
        if (state.messageRequest && !state.gateSent) {
          setTimeout(broadcastGate, 0);
        } else if (state.resolved) {
          setTimeout(() => sendContinuation(res), 0);
        }
        return;
      }

      if (
        url.pathname ===
          '/api/webchat/v2/threads/thread-gate/runs/run-gate/gates/gate-send-email/resolve' &&
        req.method === 'POST'
      ) {
        const body = await readBody(req);
        state.resolveRequests.push({
          url: `${gatewayOrigin}${url.pathname}`,
          body,
          authorization: req.headers.authorization || ''
        });
        state.resolved = true;
        sendJson(res, 200, {
          status: 'resolved',
          continuation: { type: 'turn_gate_resume' }
        });
        setTimeout(broadcastContinuation, 20);
        return;
      }

      if (url.pathname === '/api/webchat/v2/threads/thread-gate/runs/run-gate') {
        sendJson(res, 200, {
          run_id: 'run-gate',
          status: state.resolved ? 'Succeeded' : 'Running',
          event_cursor: state.resolved ? 3 : 2
        });
        return;
      }

      sendJson(res, 404, { error: `unhandled route ${req.method} ${url.pathname}` });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
  });

  return { server, state, reset };
}

function installTauriShim(page) {
  return page.addInitScript(
    ({ gatewayOrigin, gatewayPort }) => {
      const state = {
        settings: {
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
        },
        nextRid: 1,
        requests: new Map(),
        bodies: new Map()
      };

      window.localStorage.setItem('ironclaw:desktop-gateway-origin', gatewayOrigin);
      window.sessionStorage.setItem('ironclaw_token', 'stale-token');

      function pick(obj, key) {
        return obj && typeof obj === 'object' && key in obj ? obj[key] : undefined;
      }

      async function dispatch(command, args) {
        switch (command) {
          case 'get_settings':
            return JSON.parse(JSON.stringify(state.settings));
          case 'sidecar_status':
            return { running: true, port: gatewayPort };
          case 'get_token':
            return 'gate-smoke-token';
          case 'get_or_create_local_token':
            return 'gate-smoke-token';
          case 'gateway_http_fetch': {
            const req = pick(args, 'request');
            if (!req?.url) throw new Error('missing gateway_http_fetch url');
            const response = await window.fetch(req.url, {
              method: req.method || 'GET',
              headers: req.headers ? Object.fromEntries(req.headers) : undefined,
              body: req.data ? new Uint8Array(req.data) : undefined
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
            const reader = response.body?.getReader();
            state.bodies.set(responseRid, { reader, done: false });
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
            const body = state.bodies.get(rid);
            if (!body || body.done || !body.reader) return [1];
            const { done, value } = await body.reader.read();
            if (done) {
              body.done = true;
              return [1];
            }
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

      window.__TAURI_INTERNALS__ = {
        invoke: (command, args) => dispatch(command, args),
        transformCallback: () => 0,
        metadata: { currentWindow: { label: 'main' }, windows: [] }
      };
    },
    { gatewayOrigin, gatewayPort }
  );
}

const gateway = createGateGateway();
await new Promise((resolve) => gateway.server.listen(gatewayPort, '127.0.0.1', resolve));

const staticServer = spawn('node', ['scripts/serve-webui-static.mjs'], {
  env: {
    ...process.env,
    PORT: String(staticPort),
    IRONCLAW_GATEWAY_ORIGIN: gatewayOrigin
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let staticOutput = '';
staticServer.stdout.on('data', (chunk) => {
  staticOutput += chunk.toString();
});
staticServer.stderr.on('data', (chunk) => {
  staticOutput += chunk.toString();
});

let browser = null;
try {
  await waitForStaticServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1320, height: 900 } });
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) {
      errors.push(`http ${response.status()}: ${response.url()}`);
    }
  });
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      errors.push(`${message.type()}: ${message.text()}`);
    }
  });
  await installTauriShim(page);

  await page.goto(`${staticOrigin}${appBasePath}/chat/thread-gate`, {
    waitUntil: 'domcontentloaded'
  });
  await page.locator('textarea').first().waitFor({ timeout: 20_000 });

  const promptText = 'Send the draft services agreement to legal review.';
  const composer = page.locator('textarea').first();
  await composer.click();
  await composer.pressSequentially(promptText);
  await page.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll('button[aria-label="Send message"]'));
    const button = buttons.at(-1);
    return button && !button.disabled;
  });
  await page.locator('button[aria-label="Send message"]').last().click();

  await page.getByRole('group', { name: 'Approval required' }).waitFor({ timeout: 20_000 });
  await page.getByText('send_email', { exact: true }).waitFor({ timeout: 20_000 });
  await page
    .getByText('Send the generated services agreement to the legal review inbox.', { exact: true })
    .waitFor({ timeout: 20_000 });
  await page.getByText('Touches', { exact: true }).waitFor({ timeout: 20_000 });
  await page.getByText('What leaves the machine', { exact: true }).waitFor({ timeout: 20_000 });
  // Raw parameter JSON is collapsed by default (Raw parameters <details>); expand
  // it so the full payload is still reachable for the assertion below.
  await page.getByText('Raw parameters', { exact: true }).click();
  await page.getByText('"recipient": "legal-review@example.com"').waitFor({ timeout: 20_000 });
  // The outbound cell must disclose every field that leaves: the email subject
  // is sent externally and previously never surfaced on the gate. It now renders
  // in the same outbound cell as the attachment, so neither is under-reported.
  await page
    .locator('dd', { hasText: 'services-agreement.docx' })
    .filter({ hasText: 'subject: Draft services agreement' })
    .waitFor({ timeout: 20_000 });
  await page
    .getByText('Always allow is unavailable for this kind of action. IronClaw must ask each time.')
    .waitFor({ timeout: 20_000 });
  await mkdir('output/playwright', { recursive: true });
  await page.screenshot({
    path: gateScreenshotPath,
    fullPage: true
  });

  await page.getByRole('button', { name: 'Approve' }).click();

  await page.getByText('Gate resolved and run continued.', { exact: true }).waitFor({
    timeout: 20_000
  });

  const post = gateway.state.messageRequest;
  if (!post || post.content !== promptText) {
    throw new Error(`gate smoke did not post the chat prompt: ${JSON.stringify(post)}`);
  }
  const resolveRequest = gateway.state.resolveRequests[0];
  if (!resolveRequest) {
    throw new Error('gate smoke did not call the gate resolve endpoint');
  }
  if (
    !resolveRequest.url.endsWith('/threads/thread-gate/runs/run-gate/gates/gate-send-email/resolve')
  ) {
    throw new Error(`wrong gate resolve URL: ${resolveRequest.url}`);
  }
  if (resolveRequest.authorization !== 'Bearer gate-smoke-token') {
    throw new Error(`gate resolve missing bearer auth: ${resolveRequest.authorization}`);
  }
  if (resolveRequest.body?.resolution !== 'approved' || resolveRequest.body?.always === true) {
    throw new Error(
      `gate resolve body lost one-shot approval: ${JSON.stringify(resolveRequest.body)}`
    );
  }

  await page.screenshot({
    path: resolvedScreenshotPath,
    fullPage: true
  });

  // Localized gate copy: the approval gate must render the user's language, not
  // fall back to English. Loop every shipped locale that actually translates the
  // approval keys we assert (`approval.title`/`approve`/`deny` are translated in
  // all 11 packs — the rest are in i18n BASELINE_MISSING_KEYS and intentionally
  // English-only, so we never assert those). For each locale we seed
  // `ironclaw_language`, reload, replay the gate, and require the translated
  // strings to render. A regression to the English fallback fails the smoke.
  const localeChecks = [];
  for (const [locale, expected] of Object.entries(localizedApprovalCopy)) {
    gateway.reset();
    await page.evaluate((lang) => {
      window.localStorage.setItem('ironclaw_language', lang);
    }, locale);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('textarea').first().waitFor({ timeout: 20_000 });

    const localeComposer = page.locator('textarea').first();
    await localeComposer.click();
    await localeComposer.pressSequentially(promptText);
    // The Send button aria-label (`chat.send`) is itself localized, so select it
    // by the locale's translated label rather than the English one.
    const sendSelector = `button[aria-label=${JSON.stringify(expected.send)}]`;
    await page.waitForFunction((selector) => {
      const buttons = Array.from(document.querySelectorAll(selector));
      const button = buttons.at(-1);
      return button && !button.disabled;
    }, sendSelector);
    await page.locator(sendSelector).last().click();

    // The gate's role="group" aria-label is approval.title; assert the localized
    // value renders instead of the English "Approval required".
    await page.getByRole('group', { name: expected.title }).waitFor({ timeout: 20_000 });
    if (expected.title !== 'Approval required') {
      const englishGate = await page.getByRole('group', { name: 'Approval required' }).count();
      if (englishGate > 0) {
        throw new Error(
          `gate rendered English "Approval required" while locale "${locale}" was active`
        );
      }
    }
    // Approve / Deny buttons must also be translated.
    await page.getByRole('button', { name: expected.approve, exact: true }).waitFor({
      timeout: 20_000
    });
    await page.getByRole('button', { name: expected.deny, exact: true }).waitFor({
      timeout: 20_000
    });

    localeChecks.push({ locale, title: expected.title });

    // Tear the gate down before the next locale so each iteration replays from a
    // clean run state.
    await page.getByRole('button', { name: expected.approve, exact: true }).click();
    await page.getByText('Gate resolved and run continued.', { exact: true }).waitFor({
      timeout: 20_000
    });
  }

  if (errors.length > 0) {
    throw new Error(`browser logged errors: ${JSON.stringify(errors)}`);
  }

  console.log(
    JSON.stringify(
      {
        status: 'passed',
        prompt_posted: Boolean(post),
        resolve_url: resolveRequest.url,
        resolve_body: resolveRequest.body,
        gate_screenshot: gateScreenshotPath,
        resolved_screenshot: resolvedScreenshotPath,
        localized_gate_checks: localeChecks
      },
      null,
      2
    )
  );
} catch (err) {
  await mkdir('output/playwright', { recursive: true }).catch(() => {});
  console.error(`FAIL gate enforcement smoke: ${err.message}`);
  console.error(staticOutput);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  staticServer.kill('SIGTERM');
  gateway.server.close();
}
