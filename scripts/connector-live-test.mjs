#!/usr/bin/env node
// Live end-to-end test against REAL Composio MCP connectors, through the EXACT
// staged sidecar the desktop app runs. Proves the app populates + works.
//
//   COMPOSIO_API_KEY=ak_... node scripts/connector-live-test.mjs        # reads + gate + agent
//   COMPOSIO_API_KEY=ak_... node scripts/connector-live-test.mjs --write # also create a real draft
//
// NEAR AI token is read from the macOS Keychain (the app's own entry). No
// secret is stored in this file. Boots a throwaway HOME, kills the sidecar.
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = `${REPO}/src-tauri/binaries/ironclaw-reborn-aarch64-apple-darwin`;
const PORT = Number(process.env.PORT || 4988);
const TOKEN = 'connector-live-test';
const ORIGIN = `http://127.0.0.1:${PORT}`;
const B = '/api/webchat/v2';
const HOME = '/tmp/connector-live-test-home';
const COMPOSIO = process.env.COMPOSIO_API_KEY;
const DO_WRITE = process.argv.includes('--write');

if (!COMPOSIO) {
  console.error('Set COMPOSIO_API_KEY (1Password vault DevKeys). Aborting.');
  process.exit(1);
}
let NK = '';
try {
  NK = execSync(
    'security find-generic-password -s com.openclaw.ironclaw-desktop -a llm-nearai:default -w',
    {
      stdio: ['ignore', 'pipe', 'ignore']
    }
  )
    .toString()
    .trim();
} catch {}
if (!NK) {
  console.error(
    'No NEAR AI token in Keychain (com.openclaw.ironclaw-desktop / llm-nearai:default). Aborting.'
  );
  process.exit(1);
}
try {
  fs.rmSync(HOME, { recursive: true, force: true });
} catch {}
fs.mkdirSync(HOME, { recursive: true });

const env = {
  ...process.env,
  HOME,
  NEARAI_API_KEY: NK,
  IRONCLAW_REBORN_WEBUI_TOKEN: TOKEN,
  IRONCLAW_REBORN_WEBUI_USER_ID: 'owner',
  GATEWAY_AUTH_TOKEN: TOKEN,
  GATEWAY_HOST: '127.0.0.1',
  GATEWAY_PORT: String(PORT),
  GATEWAY_ENABLED: 'true',
  DATABASE_BACKEND: 'libsql',
  LLM_BACKEND: 'nearai',
  NEARAI_MODEL: 'auto',
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

const now = new Date();
const READS = [
  ['gmail', 'GMAIL_FETCH_EMAILS', { max_results: 3, query: 'in:inbox' }],
  [
    'googlecalendar',
    'GOOGLECALENDAR_EVENTS_LIST',
    {
      calendarId: 'primary',
      maxResults: 3,
      timeMin: now.toISOString(),
      timeMax: new Date(now.getTime() + 30 * 864e5).toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    }
  ],
  [
    'googledrive',
    'GOOGLEDRIVE_LIST_FILES',
    { page_size: 3, order_by: 'modifiedTime desc', fields: 'files(id,name,mimeType,modifiedTime)' }
  ],
  ['notion', 'NOTION_SEARCH_NOTION_PAGE', { query: '', page_size: 3 }],
  ['github', 'GITHUB_LIST_NOTIFICATIONS_FOR_THE_AUTHENTICATED_USER', { per_page: 3, all: false }],
  ['slack', 'SLACK_SEARCH_MESSAGES', { query: 'the', count: 3, sort: 'timestamp' }]
];

(async () => {
  let up = false;
  for (let i = 0; i < 240; i++) {
    if (child.exitCode != null) {
      console.log('FAIL: sidecar exited', child.exitCode, '\n', logs.slice(-1500));
      process.exit(1);
    }
    if ((await req('GET', `${B}/llm/providers`)).s === 200) {
      up = true;
      break;
    }
    await sleep(500);
  }
  if (!up) {
    console.log('FAIL: /llm/providers never 200\n', logs.slice(-1500));
    try {
      child.kill('SIGKILL');
    } catch {}
    process.exit(1);
  }
  mark('boot: staged sidecar serves /llm', true);

  const cfg = await req('POST', `${B}/extensions/composio/setup`, {
    action: 'configure',
    payload: { secrets: { composio_api_key: COMPOSIO }, fields: {} }
  });
  mark('composio configure', cfg.s === 200, `(${cfg.s})`);
  const conn = await req('GET', `${B}/connectors/connected`);
  mark(
    'connectors/connected',
    conn.s === 200,
    `accounts=[${(conn.j?.accounts || []).map((a) => a.toolkit).join(',')}]`
  );

  for (const [toolkit, tool, args] of READS) {
    const r = await req('POST', `${B}/connectors/read`, { toolkit, tool, arguments: args });
    const ok = r.s === 200 && r.j?.successful === true;
    mark(
      `read ${toolkit}`,
      ok,
      ok ? 'live read OK' : `s=${r.s} err=${String(r.j?.error || '').slice(0, 60)}`
    );
  }

  const send = await req('POST', `${B}/connectors/write`, {
    toolkit: 'gmail',
    tool: 'GMAIL_SEND_EMAIL',
    arguments: { recipient_email: 'x@y.com', subject: 'x', body: 'x' }
  });
  mark(
    'write-gate: SEND rejected (flag off)',
    send.j?.successful !== true,
    String(send.j?.error || send.s).slice(0, 50)
  );
  const del = await req('POST', `${B}/connectors/write`, {
    toolkit: 'gmail',
    tool: 'GMAIL_DELETE_MESSAGE',
    arguments: {}
  });
  mark(
    'write-gate: DELETE forbidden',
    del.j?.successful !== true,
    String(del.j?.error || del.s).slice(0, 50)
  );
  if (DO_WRITE) {
    const draft = await req('POST', `${B}/connectors/write`, {
      toolkit: 'gmail',
      tool: 'GMAIL_CREATE_EMAIL_DRAFT',
      arguments: {
        recipient_email: 'self-test@example.com',
        subject: 'IronClaw connector test draft',
        body: 'Created by connector-live-test --write. Safe to delete.'
      }
    });
    mark(
      'write-gate: DRAFT allowed (real draft created)',
      draft.j?.successful === true,
      `s=${draft.s}`
    );
  }

  mark('approvals route', (await req('GET', `${B}/approvals`)).s === 200);

  const ct = await req('POST', `${B}/threads`, { client_action_id: 'live-1' });
  const threadId = ct.j?.thread?.thread_id || ct.j?.thread_id;
  let reply = false;
  if (threadId) {
    await req('POST', `${B}/threads/${threadId}/messages`, {
      client_action_id: 'live-2',
      content: 'Reply with exactly one word: pong',
      timezone: 'America/New_York'
    });
    for (let i = 0; i < 80; i++) {
      await sleep(1500);
      if (
        /pong/i.test(
          JSON.stringify((await req('GET', `${B}/threads/${threadId}/timeline?limit=40`)).j || '')
        ) &&
        i > 1
      ) {
        reply = true;
        break;
      }
    }
  }
  mark('live agent turn', reply, reply ? 'assistant replied' : 'no reply (~2min)');

  const ok = results.filter((r) => r.ok).length;
  console.log(`\n=== ${ok}/${results.length} checks passed ===`);
  try {
    child.kill('SIGKILL');
  } catch {}
  process.exit(ok === results.length ? 0 : 2);
})();
