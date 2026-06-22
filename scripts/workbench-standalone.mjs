#!/usr/bin/env node
// Run the IronClaw Workbench as a STANDALONE WEB APP — broken out of the Tauri
// desktop app. Boots the gateway sidecar (the staged binary the desktop app
// ships) and serves the v2 webui pointed at it over plain HTTP. No Tauri shell,
// no native fetch bridge.
//
//   COMPOSIO_API_KEY=ak_... node scripts/workbench-standalone.mjs
//
// Then open http://127.0.0.1:17641/ and, once, in the devtools console:
//   sessionStorage.setItem('ironclaw_token', '<WEBUI_TOKEN printed below>')
// and reload. (A future iteration will mint/inject this automatically.)
//
// NEAR AI token is read from the macOS Keychain (the desktop app's own entry).
// Connectors are wired via the same Composio setup route the live suite uses.
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = `${REPO}/src-tauri/binaries/ironclaw-reborn-aarch64-apple-darwin`;
const GW_PORT = Number(process.env.GW_PORT || 17640);
const WEB_PORT = Number(process.env.WEB_PORT || 17641);
const TOKEN = process.env.WEBUI_TOKEN || 'workbench-standalone';
const HOME_DIR = process.env.WB_HOME || '/tmp/wb-standalone-home';
const ORIGIN = `http://127.0.0.1:${GW_PORT}`;
const B = '/api/webchat/v2';
const COMPOSIO = process.env.COMPOSIO_API_KEY;

if (!COMPOSIO) {
  console.error('Set COMPOSIO_API_KEY (1Password vault DevKeys). Aborting.');
  process.exit(1);
}
let NK = '';
try {
  NK = execSync(
    'security find-generic-password -s com.openclaw.ironclaw-desktop -a llm-nearai:default -w',
    { stdio: ['ignore', 'pipe', 'ignore'] }
  ).toString().trim();
} catch {}
if (!NK) {
  console.error('No NEAR AI token in Keychain (com.openclaw.ironclaw-desktop / llm-nearai:default). Aborting.');
  process.exit(1);
}

// Fresh home so we never lock the real ~/.ironclaw libSQL db while the real
// desktop app might be open. Connectors are re-wired via the Composio route.
try { fs.rmSync(HOME_DIR, { recursive: true, force: true }); } catch {}
fs.mkdirSync(HOME_DIR, { recursive: true });

const gwEnv = {
  ...process.env,
  HOME: HOME_DIR,
  NEARAI_API_KEY: NK,
  IRONCLAW_REBORN_WEBUI_TOKEN: TOKEN,
  IRONCLAW_REBORN_WEBUI_USER_ID: 'owner',
  GATEWAY_AUTH_TOKEN: TOKEN,
  GATEWAY_HOST: '127.0.0.1',
  GATEWAY_PORT: String(GW_PORT),
  GATEWAY_ENABLED: 'true',
  DATABASE_BACKEND: 'libsql',
  LLM_BACKEND: 'nearai',
  NEARAI_MODEL: process.env.NEARAI_MODEL || 'z-ai/glm-5.2',
  IRONCLAW_AGENT_CONNECTORS_ENABLED: '1',
  IRONCLAW_TRIGGER_POLLER_ENABLED: '1',
  RUST_LOG: 'warn',
};

console.log(`[wb] booting gateway: ${BIN} serve --host 127.0.0.1 --port ${GW_PORT}`);
const gw = spawn(BIN, ['serve', '--host', '127.0.0.1', '--port', String(GW_PORT)], {
  cwd: REPO, env: gwEnv, stdio: ['ignore', 'pipe', 'pipe'],
});
let gwLogs = '';
gw.stdout.on('data', (c) => (gwLogs += c));
gw.stderr.on('data', (c) => (gwLogs += c));

const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const req = async (m, p, b) => {
  try {
    const r = await fetch(ORIGIN + p, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined });
    const t = await r.text();
    let j; try { j = JSON.parse(t); } catch { j = t; }
    return { s: r.status, j };
  } catch (e) { return { s: 'ERR', j: String(e.message) }; }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let web = null;
function shutdown() {
  try { web && web.kill('SIGTERM'); } catch {}
  try { gw.kill('SIGTERM'); } catch {}
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

(async () => {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if ((await req('GET', `${B}/llm/providers`)).s === 200) { ready = true; break; }
    await sleep(500);
  }
  if (!ready) {
    console.error('[wb] gateway never became ready\n', gwLogs.slice(-1500));
    shutdown();
    return;
  }
  console.log('[wb] gateway ready (/llm/providers 200)');

  const cfg = await req('POST', `${B}/extensions/composio/setup`, {
    action: 'configure',
    payload: { secrets: { composio_api_key: COMPOSIO }, fields: {} },
  });
  console.log(`[wb] composio configure -> ${cfg.s}`);
  const conn = await req('GET', `${B}/connectors/connected`);
  const accounts = Array.isArray(conn.j?.accounts) ? conn.j.accounts.map((a) => a.toolkit || a.slug || a.app || a).join(',') : JSON.stringify(conn.j).slice(0, 200);
  console.log(`[wb] connectors/connected -> ${conn.s}  [${accounts}]`);

  web = spawn(process.execPath, [path.join(REPO, 'scripts', 'serve-webui-static.mjs')], {
    cwd: REPO,
    env: { ...process.env, IRONCLAW_GATEWAY_ORIGIN: ORIGIN, PORT: String(WEB_PORT), IRONCLAW_DEV_INJECT_TOKEN: TOKEN },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  web.stdout.on('data', (c) => process.stdout.write(`[web] ${c}`));
  web.stderr.on('data', (c) => process.stderr.write(`[web] ${c}`));

  console.log('\n================ STANDALONE WORKBENCH READY ================');
  console.log(`  Open this (one-click auth — token is consumed + stripped from the URL):`);
  console.log(`    http://127.0.0.1:${WEB_PORT}/workbench#token=${TOKEN}`);
  console.log(`  Gateway : ${ORIGIN}`);
  console.log(`  Note    : a plain reload (no #token) returns to onboarding on this`);
  console.log(`            fresh home — reopen the link above. Persisted auth is a`);
  console.log(`            follow-up (see the break-out plan).`);
  console.log('============================================================\n');
})();
