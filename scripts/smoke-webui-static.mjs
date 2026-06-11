import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';

const port = Number(process.env.WEBUI_STATIC_SMOKE_PORT || '17620');
const gatewayOrigin = process.env.WEBUI_STATIC_SMOKE_GATEWAY_ORIGIN || 'http://127.0.0.1:17621';
const appBasePath = '/v2';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dummyAttachmentScenario(name, mimeType, content, options = {}) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  return {
    name,
    mimeType,
    buffer,
    base64: buffer.toString('base64'),
    size: buffer.byteLength,
    // When set, the composer's client-side extractor must transform this
    // payload into inline text containing the marker (mime becomes
    // text/plain). Unset scenarios must pass through byte-identical.
    expectExtractedText: options.expectExtractedText || null
  };
}

// A structurally valid single-page PDF (correct xref offsets) that pdf.js can
// parse — proves the composer's real extraction path in the rendered run.
function buildMinimalPdfBuffer(text) {
  const escaped = text.replace(/[\\()]/g, (ch) => `\\${ch}`);
  const stream = `BT /F1 18 Tf 72 720 Td (${escaped}) Tj ET`;
  const objects = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>',
    `<</Length ${stream.length}>>\nstream\n${stream}\nendstream`,
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>'
  ];
  let body = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefStart = body.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const objectOffset of offsets) {
    xref += `${String(objectOffset).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(body + xref + trailer, 'latin1');
}

function attachmentTranscriptBlock(scenarios) {
  // Mirrors what the real backend echoes back since the embed change: chip
  // metadata plus a length-prefixed fenced text section per attachment. The
  // reload render must parse chips out of this and strip every fenced body
  // (including manifest-look-alike lines inside it) from the transcript.
  return [
    '<attachments ic="1">',
    ...scenarios.flatMap((scenario, index) => {
      const embedded = `INVOICE 7741 Preserve indemnity clause from ${scenario.name}\nfilename: decoy.pdf\nAttachment 99:\n---`;
      return [
        `Attachment ${index + 1}:`,
        `filename: ${scenario.name}`,
        `mime_type: ${scenario.mimeType}`,
        `size: ${scenario.size}`,
        'extraction_status: extracted_text',
        `extracted_text_chars: ${embedded.length}`,
        'extracted_text:',
        '---',
        embedded,
        '---'
      ];
    }),
    '</attachments>'
  ].join('\n');
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

async function startProxyProbeGateway() {
  const origin = new URL(gatewayOrigin);
  const server = createServer((req, res) => {
    const path = new URL(req.url || '/', gatewayOrigin).pathname;
    if (path.endsWith('/events')) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      });
      res.write(': ok\n\n');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, providers: [] }));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(Number(origin.port), origin.hostname, resolve);
  });
  return server;
}

async function assertProxySurvivesAbortedSse() {
  const controller = new AbortController();
  const response = await fetch(
    `http://127.0.0.1:${port}/api/webchat/v2/threads/proxy-abort/events?token=smoke`,
    {
      headers: { Accept: 'text/event-stream' },
      signal: controller.signal
    }
  );
  if (!response.ok || !response.body) {
    throw new Error(`SSE proxy probe failed to open: ${response.status}`);
  }
  const reader = response.body.getReader();
  await reader.read();
  controller.abort();
  await reader.cancel().catch(() => {});
  await wait(250);
  const health = await fetch(`http://127.0.0.1:${port}/auth/providers`);
  if (!health.ok) {
    throw new Error(`static server died after aborted SSE proxy: ${health.status}`);
  }
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

let proxyProbeGateway = null;

try {
  await waitForServer();
  proxyProbeGateway = await startProxyProbeGateway();
  await assertProxySurvivesAbortedSse();
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
  let gmailSetupSubmitted = false;
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
  let llmProvidersPayload = {
    providers: [
      {
        id: 'nearai',
        name: 'NEAR.AI',
        description: 'IronClaw Cloud model routing through NEAR AI.',
        adapter: 'nearai',
        default_model: 'auto',
        builtin: true,
        api_key_required: false,
        accepts_api_key: true,
        api_key_set: false
      },
      {
        id: 'openrouter',
        name: 'OpenRouter',
        description: 'Diagnostic fixture that must stay hidden in Desktop.',
        adapter: 'open_ai_completions',
        base_url: 'https://openrouter.ai/api/v1',
        default_model: 'z-ai/glm-4.5',
        builtin: true,
        api_key_required: true,
        api_key_set: false
      }
    ],
    active: null
  };
  const smokeAttachmentScenarios = [
    dummyAttachmentScenario(
      'services-template.pdf',
      'application/pdf',
      '%PDF-1.4\nstatic smoke services agreement template\n%%EOF\n'
    ),
    dummyAttachmentScenario(
      'redline-instructions.md',
      'text/markdown',
      '# Redline instructions\n\n- Preserve indemnity clause\n- Flag payment terms\n'
    ),
    dummyAttachmentScenario(
      'invoice-payload.json',
      'application/json',
      JSON.stringify({ invoice: 'INV-4242', amount: 1200, currency: 'USD' }, null, 2)
    ),
    dummyAttachmentScenario(
      'scope-summary.html',
      'text/html',
      '<!doctype html><h1>Scope Summary</h1><p>Export-ready HTML source.</p>'
    ),
    dummyAttachmentScenario(
      'acme-invoice.pdf',
      'application/pdf',
      buildMinimalPdfBuffer('INVOICE 7741 TOTAL 432.50 VENDOR ACME'),
      { expectExtractedText: 'INVOICE 7741' }
    )
  ];
  // A corrupt OOXML package (zip magic, no central directory) must be
  // REJECTED with an honest notice and never shipped as an unreadable blob —
  // the extraction hardening's contract.
  const corruptDocxScenario = dummyAttachmentScenario(
    'board-minutes.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    Buffer.from('PK\u0003\u0004dummy docx package bytes for static smoke', 'binary')
  );
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
              content: [
                'Draft a services agreement from this attachment.',
                '',
                attachmentTranscriptBlock(smokeAttachmentScenarios)
              ].join('\n'),
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
    if (webchatPath === '/api/webchat/v2/extensions/registry') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ entries: [] })
      });
      return;
    }
    if (webchatPath === '/api/webchat/v2/llm/providers') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(llmProvidersPayload)
      });
      return;
    }
    if (webchatPath === '/api/webchat/v2/channels/connectable') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          channels: [
            {
              channel: 'slack',
              display_name: 'Slack',
              command_aliases: ['slack']
            }
          ]
        })
      });
      return;
    }
    if (webchatPath === '/api/webchat/v2/extensions') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          extensions: [
            {
              display_name: 'Gmail',
              kind: 'wasm_tool',
              version: '0.2.0',
              active: false,
              needs_setup: true,
              has_auth: true,
              onboarding_state: gmailSetupSubmitted ? 'failed' : 'auth_required',
              activation_error: gmailSetupSubmitted
                ? 'Backend can store this credential, but this connector runtime is not wired in this build yet.'
                : undefined,
              description: 'Read and draft Gmail messages.',
              package_ref: { kind: 'extension', id: 'gmail' },
              tools: []
            },
            {
              display_name: 'Google Calendar',
              kind: 'wasm_tool',
              version: '0.2.0',
              active: false,
              needs_setup: true,
              has_auth: true,
              onboarding_state: 'auth_required',
              description: 'Inspect and draft calendar changes.',
              package_ref: { kind: 'extension', id: 'google-calendar' },
              tools: []
            },
            {
              display_name: 'Notion',
              kind: 'mcp_server',
              version: '0.2.0',
              active: false,
              needs_setup: true,
              has_auth: true,
              onboarding_state: 'auth_required',
              description: 'Connect Notion workspace context.',
              package_ref: { kind: 'extension', id: 'notion' },
              tools: []
            },
            {
              display_name: 'Slack',
              kind: 'wasm_channel',
              version: '0.2.0',
              active: false,
              needs_setup: true,
              has_auth: true,
              onboarding_state: 'pairing_required',
              description: 'Pair Slack as a workspace channel.',
              onboarding: {
                credential_instructions:
                  'Slack is blocked: channel pairing is not wired in this smoke backend.'
              },
              package_ref: { kind: 'extension', id: 'slack' },
              tools: []
            }
          ]
        })
      });
      return;
    }
    if (route.request().url().includes('/extensions/')) {
      const method = route.request().method();
      const extensionName =
        new URL(route.request().url()).pathname.match(/\/extensions\/([^/]+)\/setup$/)?.[1] ||
        'unknown';
      const body = method === 'GET' ? null : route.request().postDataJSON();
      connectorRequests.push({
        url: route.request().url(),
        method,
        body,
        authorization: route.request().headers().authorization || ''
      });
      if (method === 'GET' && route.request().url().endsWith('/setup')) {
        const setupCopy = {
          gmail: {
            prompt: 'Google OAuth token',
            instructions: 'Use the Product Auth token returned by Google sign-in for Gmail.'
          },
          'google-calendar': {
            prompt: 'Google Calendar OAuth token',
            instructions: 'Use the Product Auth token returned by Google sign-in for Calendar.'
          },
          notion: {
            prompt: 'Notion integration token',
            instructions: 'Paste a Notion integration token.'
          }
        }[extensionName] || {
          prompt: `${extensionName} token`,
          instructions: `Paste the ${extensionName} token.`
        };
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            secrets: [
              {
                name: 'token',
                prompt: setupCopy.prompt,
                optional: false,
                provided: false,
                setup: { kind: 'manual_token', provider: extensionName }
              }
            ],
            fields: [
              {
                name: 'account_label',
                prompt: 'Account label',
                optional: true,
                placeholder: `${extensionName} account`
              }
            ],
            onboarding: {
              credential_instructions: setupCopy.instructions,
              credential_next_step:
                'Save the token; this smoke keeps the runtime blocked so the UI cannot claim a live connector.'
            }
          })
        });
        return;
      }
      if (body?.action === 'submit') {
        if (extensionName === 'gmail') gmailSetupSubmitted = true;
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
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

  await page.goto(`http://127.0.0.1:${port}${appBasePath}/`, {
    waitUntil: 'domcontentloaded'
  });
  try {
    await page.waitForFunction(
      () => {
        const text = document.body?.innerText || '';
        return (
          text.includes('Welcome to IronClaw') ||
          text.includes('New') ||
          text.includes('Chat') ||
          text.includes('Extensions')
        );
      },
      null,
      { timeout: 20_000 }
    );
  } catch (err) {
    await mkdir('output/playwright', { recursive: true });
    await page
      .screenshot({
        path: 'output/playwright/static-bootstrap-failure.png',
        fullPage: true
      })
      .catch(() => {});
    const visibleBody = await page
      .locator('body')
      .innerText()
      .catch(() => '<body unavailable>');
    throw new Error(
      `static app did not bootstrap; errors=${JSON.stringify(errors)}; body=${JSON.stringify(visibleBody)}`,
      { cause: err }
    );
  }
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

  await page.goto(`http://127.0.0.1:${port}${appBasePath}/chat`, {
    waitUntil: 'domcontentloaded'
  });
  await page.getByText('Welcome to IronClaw', { exact: true }).waitFor({ timeout: 20_000 });
  const firstRunUrl = new URL(page.url());
  if (!firstRunUrl.pathname.endsWith('/welcome')) {
    throw new Error(`static first-run gate did not redirect chat to welcome: ${page.url()}`);
  }

  llmProvidersPayload = {
    ...llmProvidersPayload,
    active: {
      provider_id: 'nearai',
      model: 'auto'
    }
  };

  await page.goto(`http://127.0.0.1:${port}${appBasePath}/chat`, {
    waitUntil: 'domcontentloaded'
  });
  const modelControl = page.getByLabel('Chat model settings').first();
  await modelControl.waitFor({ timeout: 20_000 });
  const modelControlText = await modelControl.innerText();
  if (!modelControlText.includes('NEAR.AI · auto')) {
    throw new Error(
      `static chat model control did not show default NEAR.AI model:\n${modelControlText}`
    );
  }
  // Readiness moved off the chip into the tooltip — keep it honest there.
  const modelControlTitle = await modelControl.getAttribute('title');
  if (!modelControlTitle || !modelControlTitle.length) {
    throw new Error('model chip lost its readiness tooltip');
  }
  // The model control is a popover trigger now: opening it must render the
  // model panel with a working manage link into inference settings.
  await modelControl.click();
  const manageLink = page.getByText('Manage NEAR AI Cloud in Settings', { exact: true });
  await manageLink.waitFor({ timeout: 10_000 });
  const modelPopoverBody = await page.locator('body').innerText();
  if (modelPopoverBody.includes('OpenRouter') || modelPopoverBody.includes('deepseek/')) {
    throw new Error(`static model popover exposed hidden provider:\n${modelPopoverBody}`);
  }
  const manageHref = await manageLink.getAttribute('href');
  if (manageHref !== `${appBasePath}/settings/inference`) {
    throw new Error(`model popover manage link did not target inference settings: ${manageHref}`);
  }
  await page.keyboard.press('Escape');
  const initialChatBody = await page.locator('body').innerText();
  if (modelControlText.includes('OpenRouter') || modelControlText.includes('deepseek/')) {
    throw new Error(
      `static chat model control exposed unconfigured provider:\n${modelControlText}`
    );
  }
  if (initialChatBody.includes('OpenRouter') || initialChatBody.includes('deepseek/')) {
    throw new Error(`static chat exposed unconfigured provider:\n${initialChatBody}`);
  }
  const verifiedComposer = page.locator('textarea').first();
  await verifiedComposer.waitFor({ timeout: 20_000 });
  await page.locator('input[type="file"]').setInputFiles(
    [...smokeAttachmentScenarios, corruptDocxScenario].map((scenario) => ({
      name: scenario.name,
      mimeType: scenario.mimeType,
      buffer: scenario.buffer
    }))
  );
  for (const scenario of smokeAttachmentScenarios) {
    await page.getByText(scenario.name, { exact: true }).waitFor({ timeout: 20_000 });
  }
  // The corrupt docx surfaces an honest rejection notice instead of a chip
  // that pretends it will be readable.
  await page
    .getByText('could not be opened — the file looks corrupted or incomplete', { exact: false })
    .waitFor({ timeout: 20_000 });
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
  // Content leads with the prompt, then carries a base64-free durable
  // attachment manifest so the Reborn timeline preserves chips on reload.
  const postedContent = String(chatPost.content || '');
  if (!postedContent.startsWith(promptText) || postedContent.includes('data_base64')) {
    throw new Error(`static chat posted attachment data in content: ${JSON.stringify(chatPost)}`);
  }
  if (!postedContent.includes('<attachments ic="1">')) {
    throw new Error(
      `static chat did not append a durable attachment manifest: ${JSON.stringify(chatPost)}`
    );
  }
  for (const scenario of smokeAttachmentScenarios) {
    if (!postedContent.includes(`filename: ${scenario.name}`)) {
      throw new Error(`static chat manifest missing ${scenario.name}: ${JSON.stringify(chatPost)}`);
    }
  }
  if (
    chatPost.attachments.some(
      (attachment) =>
        attachment.filename === corruptDocxScenario.name ||
        attachment.name === corruptDocxScenario.name
    )
  ) {
    throw new Error('corrupt docx was shipped instead of rejected');
  }
  if (
    !Array.isArray(chatPost.attachments) ||
    chatPost.attachments.length !== smokeAttachmentScenarios.length
  ) {
    throw new Error(`static chat did not send JSON attachments: ${JSON.stringify(chatPost)}`);
  }
  for (const scenario of smokeAttachmentScenarios) {
    const postedAttachment = chatPost.attachments.find(
      (attachment) => attachment.filename === scenario.name || attachment.name === scenario.name
    );
    if (!postedAttachment) {
      throw new Error(
        `static chat did not post attachment ${scenario.name}: ${JSON.stringify(chatPost)}`
      );
    }
    if (scenario.expectExtractedText) {
      // The composer's client-side extractor must have replaced the binary
      // payload with inline text the sidecar can feed the model.
      const decoded = Buffer.from(postedAttachment.base64 || '', 'base64').toString('utf8');
      if (
        postedAttachment.mime_type !== 'text/plain' ||
        !decoded.includes(scenario.expectExtractedText)
      ) {
        throw new Error(
          `static chat did not extract text from ${scenario.name}: mime=${postedAttachment.mime_type} decoded=${decoded.slice(0, 120)}`
        );
      }
    } else if (
      postedAttachment.mime_type !== scenario.mimeType ||
      postedAttachment.base64 !== scenario.base64
    ) {
      throw new Error(
        `static chat posted wrong attachment payload for ${scenario.name}: ${JSON.stringify(chatPost)}`
      );
    }
  }
  // The durable block must also EMBED text content — the bundled sidecar
  // never feeds attachment bytes to the model, so message content is the
  // only channel the model can actually read a document through.
  if (!postedContent.includes('extraction_status: extracted_text')) {
    throw new Error(
      `static chat did not embed extracted text sections in content: ${postedContent.slice(0, 400)}`
    );
  }
  const expectedEmbeds = [
    'INVOICE 7741', // extracted from acme-invoice.pdf client-side
    'Preserve indemnity clause', // text/markdown raw payload
    'INV-4242' // application/json raw payload
  ];
  for (const embed of expectedEmbeds) {
    if (!postedContent.includes(embed)) {
      throw new Error(`static chat content missing embedded document text: ${embed}`);
    }
  }
  const visibleChatBody = await page.locator('body').innerText();
  for (const scenario of smokeAttachmentScenarios) {
    if (!visibleChatBody.includes(scenario.name)) {
      throw new Error(`static chat reload did not render attachment metadata: ${scenario.name}`);
    }
  }
  // Embedded document text is for the model, never for the transcript —
  // parseDurableAttachmentBlock must strip it from the rendered bubble.
  for (const embed of [
    'INVOICE 7741',
    'Preserve indemnity clause',
    'extraction_status:',
    'decoy.pdf'
  ]) {
    if (visibleChatBody.includes(embed)) {
      throw new Error(`embedded attachment text leaked into the visible transcript: ${embed}`);
    }
  }

  // Chip click opens the document preview with the captured embedded text;
  // Escape closes it and the text leaves the transcript again.
  const previewChip = page.locator('button[aria-label^="Preview "]').first();
  await previewChip.click();
  const previewText = page.locator('[data-testid="attachment-preview-text"]');
  await previewText.waitFor({ state: 'visible', timeout: 5000 });
  const previewContent = await previewText.innerText();
  if (!previewContent.includes('INVOICE 7741')) {
    throw new Error(
      `attachment preview did not show the embedded text: ${previewContent.slice(0, 120)}`
    );
  }
  await page.keyboard.press('Escape');
  await page
    .locator('[data-testid="attachment-preview-text"]')
    .waitFor({ state: 'detached', timeout: 5000 });
  const bodyAfterPreview = await page.locator('body').innerText();
  if (bodyAfterPreview.includes('INVOICE 7741')) {
    throw new Error('preview text remained in the transcript after closing the modal');
  }
  await mkdir('output/playwright', { recursive: true });
  await page.screenshot({
    path: 'output/playwright/static-work-product-attachment-chat.png',
    fullPage: true
  });

  await page.goto(`http://127.0.0.1:${port}${appBasePath}/chat/thread-fail`, {
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
  try {
    await page
      .getByText(/run failed|driver unavailable|recovery_required/i)
      .first()
      .waitFor({
        timeout: 30_000
      });
  } catch (err) {
    await mkdir('output/playwright', { recursive: true });
    await page
      .screenshot({
        path: 'output/playwright/static-run-state-failure-missing.png',
        fullPage: true
      })
      .catch(() => {});
    const visibleBody = await page
      .locator('body')
      .innerText()
      .catch(() => '<body unavailable>');
    throw new Error(
      `failed-run UI did not surface run-state failure; requests=${JSON.stringify({
        failedRunMessageRequests,
        failedRunTimelineRequests,
        failedRunStateRequests
      })}; errors=${JSON.stringify(errors)}; body=${JSON.stringify(visibleBody)}`,
      { cause: err }
    );
  }
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
    await page.goto(`http://127.0.0.1:${port}${appBasePath}${path}`, {
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
    await page.getByLabel('Close setup').click();
    await page.locator('input[type="password"]').waitFor({ state: 'detached', timeout: 20_000 });
  }

  await expectDeepLinkSetup(
    '/extensions/installed?focus=tools%2Fgmail&setup=1',
    '/api/webchat/v2/extensions/gmail/setup',
    'Configure Gmail',
    /Product Auth token returned by Google sign-in for Gmail/
  );
  await expectDeepLinkSetup(
    '/extensions/installed?focus=tools%2Fgoogle_calendar&setup=1',
    '/api/webchat/v2/extensions/google-calendar/setup',
    'Configure Google Calendar',
    /Product Auth token returned by Google sign-in for Calendar/
  );
  await expectDeepLinkSetup(
    '/extensions/mcp?focus=mcp-servers%2Fnotion&setup=1',
    '/api/webchat/v2/extensions/notion/setup',
    'Configure Notion',
    /Paste a Notion integration token/
  );

  const beforeSlackRequestCount = connectorRequests.length;
  await page.goto(
    `http://127.0.0.1:${port}${appBasePath}/extensions/channels?focus=channels%2Fslack&setup=1`,
    {
      waitUntil: 'domcontentloaded'
    }
  );
  await page.getByText('Slack', { exact: true }).first().waitFor({ timeout: 20_000 });
  await page.getByText('Configure Slack', { exact: true }).waitFor({ timeout: 20_000 });
  const slackLifecycleRequest = connectorRequests.find(
    (request, index) =>
      index >= beforeSlackRequestCount &&
      request.url.endsWith('/api/webchat/v2/extensions/slack/setup')
  );
  if (!slackLifecycleRequest) {
    throw new Error(
      `Slack deep link did not call bare lifecycle setup: ${JSON.stringify(connectorRequests, null, 2)}`
    );
  }
  await assertNoCatalogRefLifecycle();
  await page.getByLabel('Close setup').click();
  await page.locator('input[type="password"]').waitFor({ state: 'detached', timeout: 20_000 });

  await page.goto(`http://127.0.0.1:${port}${appBasePath}/extensions/installed`, {
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
  await page.getByRole('button', { name: 'Configure' }).first().click();
  await page.getByText('Configure Gmail', { exact: true }).waitFor({ timeout: 20_000 });
  await page.locator('input[type="password"]').fill('ya29.smoke-token');
  await page.locator('input[type="text"]').fill('Smoke Google');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.locator('input[type="password"]').waitFor({
    state: 'detached',
    timeout: 20_000
  });
  await page.getByText('failed', { exact: true }).first().waitFor({ timeout: 20_000 });
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

  const gmailSubmitRequest = connectorRequests.find(
    (request) =>
      request.url.endsWith('/api/webchat/v2/extensions/gmail/setup') &&
      request.body?.action === 'submit'
  );
  if (!gmailSubmitRequest) {
    throw new Error(
      `connector setup submit request missing:\n${JSON.stringify(connectorRequests, null, 2)}`
    );
  }
  if (
    gmailSubmitRequest.body.payload?.secrets?.token !== 'ya29.smoke-token' ||
    gmailSubmitRequest.body.payload?.fields?.account_label !== 'Smoke Google'
  ) {
    throw new Error(
      `connector setup submit body was wrong: ${JSON.stringify(gmailSubmitRequest.body)}`
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
  proxyProbeGateway?.close();
  server.kill();
}
