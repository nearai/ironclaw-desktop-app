#!/usr/bin/env node
// Phase 4 — write-gate distinction on a SENDS-ENABLED throwaway instance.
// With IRONCLAW_WORKBENCH_SEND_ENABLED=1, allowlisted cross-tool SEND slugs are
// permitted by the gateway and REACH Composio (we send EMPTY args, so Composio
// rejects the payload and NOTHING is actually delivered — proving the gate let
// it through, not that anything sent). DELETE/unlisted slugs stay Forbidden at
// the gateway and never reach Composio. Drafts are always allowed.
//
//   COMPOSIO_API_KEY=ak_... node scripts/write-gate-distinction.mjs
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = `${REPO}/src-tauri/binaries/ironclaw-reborn-aarch64-apple-darwin`;
const PORT = Number(process.env.PORT || 4922);
const TOKEN = 'wgd';
const ORIGIN = `http://127.0.0.1:${PORT}`;
const B = '/api/webchat/v2';
const HOME = '/tmp/wgd-home';
const COMPOSIO = process.env.COMPOSIO_API_KEY;
if (!COMPOSIO) {
  console.error('Set COMPOSIO_API_KEY. Aborting.');
  process.exit(1);
}
let NK = '';
try {
  NK = execSync(
    'security find-generic-password -s com.openclaw.ironclaw-desktop -a llm-nearai:default -w',
    { stdio: ['ignore', 'pipe', 'ignore'] }
  )
    .toString()
    .trim();
} catch {}
try {
  fs.rmSync(HOME, { recursive: true, force: true });
} catch {}
fs.mkdirSync(HOME, { recursive: true });

const env = {
  ...process.env,
  HOME,
  NEARAI_API_KEY: NK,
  LLM_BACKEND: 'nearai',
  NEARAI_MODEL: 'zai-org/GLM-5.1-FP8',
  IRONCLAW_WORKBENCH_SEND_ENABLED: '1', // sends-ON throwaway instance
  IRONCLAW_REBORN_WEBUI_TOKEN: TOKEN,
  IRONCLAW_REBORN_WEBUI_USER_ID: 'owner',
  GATEWAY_AUTH_TOKEN: TOKEN,
  GATEWAY_HOST: '127.0.0.1',
  GATEWAY_PORT: String(PORT),
  GATEWAY_ENABLED: 'true',
  DATABASE_BACKEND: 'libsql',
  RUST_LOG: 'warn'
};
const child = spawn(BIN, ['serve', '--host', '127.0.0.1', '--port', String(PORT)], {
  cwd: REPO,
  env,
  stdio: ['ignore', 'pipe', 'pipe']
});
let logs = '';
child.stdout.on('data', (c) => (logs += c));
child.stderr.on('data', (c) => (logs += c));
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const req = async (m, p, b) => {
  try {
    const r = await fetch(ORIGIN + p, {
      method: m,
      headers: H,
      body: b ? JSON.stringify(b) : undefined
    });
    const t = await r.text();
    let j;
    try {
      j = JSON.parse(t);
    } catch {
      j = t;
    }
    return { s: r.status, j };
  } catch (e) {
    return { s: 'ERR', j: String(e.message) };
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const mark = (name, ok, detail) => {
  results.push({ ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail || ''}`);
};
const write = (toolkit, tool, args = {}) =>
  req('POST', `${B}/connectors/write`, { toolkit, tool, arguments: args });
// "Reached Composio" = the gateway permitted it and forwarded; the response is a
// Composio-shaped result (successful flag + a Composio error about the payload),
// NOT a gateway invalid_request/forbidden rejection.
const reachedComposio = (r) => {
  const err = String(r.j?.error || '').toLowerCase();
  const gatewayBlocked = err.includes('invalid_request') || err.includes('forbidden') || err.includes('not permitted') || err.includes('not allowed');
  return r.j?.successful === true || (typeof r.j?.successful === 'boolean' && !gatewayBlocked);
};

(async () => {
  for (let i = 0; i < 240; i++) {
    if (child.exitCode != null) {
      console.log('sidecar exited\n', logs.slice(-1000));
      process.exit(1);
    }
    if ((await req('GET', `${B}/llm/providers`)).s === 200) break;
    await sleep(500);
  }
  await req('POST', `${B}/extensions/composio/setup`, {
    action: 'configure',
    payload: { secrets: { composio_api_key: COMPOSIO }, fields: {} }
  });

  // Draft — always allowed (creates a reviewable draft; delivers nothing).
  const draft = await write('gmail', 'GMAIL_CREATE_EMAIL_DRAFT', {
    recipient_email: 'self-test@example.com',
    subject: 'wgd draft',
    body: 'safe to delete'
  });
  mark('DRAFT allowed (always)', draft.j?.successful === true, `s=${draft.s}`);

  // Cross-tool SEND slugs (empty args -> reach Composio, Composio rejects empty
  // payload, nothing delivered). Each must be PERMITTED by the gateway (reach
  // Composio), not gateway-forbidden.
  const sends = [
    ['gmail', 'GMAIL_SEND_EMAIL'],
    ['slack', 'SLACK_CHAT_POST_MESSAGE'],
    ['googlecalendar', 'GOOGLECALENDAR_CREATE_EVENT'],
    ['notion', 'NOTION_CREATE_NOTION_PAGE']
  ];
  for (const [toolkit, tool] of sends) {
    const r = await write(toolkit, tool, {});
    mark(
      `SEND ${tool} reaches Composio (flag on)`,
      reachedComposio(r),
      `successful=${r.j?.successful} err=${String(r.j?.error || '').slice(0, 50)}`
    );
  }

  // DELETE / unlisted -> Forbidden at the gateway even with sends ON (never
  // reaches Composio).
  const forbidden = [
    ['gmail', 'GMAIL_DELETE_MESSAGE'],
    ['googlecalendar', 'GOOGLECALENDAR_DELETE_EVENT']
  ];
  for (const [toolkit, tool] of forbidden) {
    const r = await write(toolkit, tool, {});
    mark(
      `DELETE ${tool} Forbidden (even sends on)`,
      r.j?.successful !== true && !reachedComposio(r),
      `successful=${r.j?.successful} err=${String(r.j?.error || '').slice(0, 50)}`
    );
  }

  const ok = results.filter((r) => r.ok).length;
  console.log(`\n=== ${ok}/${results.length} write-gate distinction checks passed ===`);
  try {
    child.kill('SIGKILL');
  } catch {}
  process.exit(ok === results.length ? 0 : 2);
})();
