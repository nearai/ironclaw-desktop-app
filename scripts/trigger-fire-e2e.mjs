#!/usr/bin/env node
// Phase 5 — verify a scheduled trigger actually FIRES through the staged binary
// (IronClaw-native poller, no Hermes). The agent creates a recurring trigger via
// builtin.trigger_create; the trigger poller (IRONCLAW_TRIGGER_POLLER_ENABLED=1)
// fires it; we detect the fire via GET /automations last_run_at.
//
//   COMPOSIO_API_KEY=ak_... node scripts/trigger-fire-e2e.mjs
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = `${REPO}/src-tauri/binaries/ironclaw-reborn-aarch64-apple-darwin`;
const PORT = Number(process.env.PORT || 4933);
const TOKEN = 'trigfire';
const ORIGIN = `http://127.0.0.1:${PORT}`;
const B = '/api/webchat/v2';
const HOME = '/tmp/trigfire-home';
const MODEL = process.env.TEST_MODEL || 'z-ai/glm-5.2';
let NK = '';
try {
  NK = execSync(
    'security find-generic-password -s com.openclaw.ironclaw-desktop -a llm-nearai:default -w',
    { stdio: ['ignore', 'pipe', 'ignore'] }
  )
    .toString()
    .trim();
} catch {}
if (!NK) {
  console.error('No NEAR AI token in Keychain. Aborting.');
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
  LLM_BACKEND: 'nearai',
  NEARAI_MODEL: MODEL,
  IRONCLAW_TRIGGER_POLLER_ENABLED: '1', // the native poller — runs while serving
  IRONCLAW_REBORN_WEBUI_TOKEN: TOKEN,
  IRONCLAW_REBORN_WEBUI_USER_ID: 'owner',
  GATEWAY_AUTH_TOKEN: TOKEN,
  GATEWAY_HOST: '127.0.0.1',
  GATEWAY_PORT: String(PORT),
  GATEWAY_ENABLED: 'true',
  DATABASE_BACKEND: 'libsql',
  RUST_LOG: process.env.RUST_LOG || 'warn'
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
const autos = async () => {
  const r = await req('GET', `${B}/automations`);
  return r.j?.automations || r.j?.items || (Array.isArray(r.j) ? r.j : []);
};
const fail = (m) => {
  console.log('FAIL:', m, '\n', logs.slice(-1200));
  try {
    child.kill('SIGKILL');
  } catch {}
  process.exit(1);
};

(async () => {
  for (let i = 0; i < 240; i++) {
    if (child.exitCode != null) fail('sidecar exited');
    if ((await req('GET', `${B}/llm/providers`)).s === 200) break;
    await sleep(500);
  }
  // readiness should report the poller worker on
  const ready = logs.includes('trigger_poller: true');
  console.log('poller worker reported on boot:', ready);

  // 1) agent creates a recurring trigger via builtin.trigger_create
  const ct = await req('POST', `${B}/threads`, { client_action_id: 'tf-1' });
  const tid = ct.j?.thread?.thread_id || ct.j?.thread_id;
  if (!tid) fail('no thread');
  const createPrompt =
    "Use your trigger_create tool to create a scheduled trigger. Use exactly these arguments: " +
    'name="phase5-tick", cron="* * * * *", timezone="America/New_York", ' +
    'prompt="Reply with the single word TICK". Create it now, then confirm it is scheduled.';
  // Consume the SSE stream and APPROVE the trigger_create gate
  // (builtin.trigger_create is PermissionMode::Ask). Runs in the background.
  let runId = null;
  (async () => {
    const url = `${ORIGIN}${B}/threads/${encodeURIComponent(tid)}/events?token=${encodeURIComponent(TOKEN)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'text/event-stream' }
    });
    if (!res.ok || !res.body) return;
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        let ev = 'message';
        const data = [];
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) ev = line.slice(6).trim();
          else if (line.startsWith('data:')) data.push(line.slice(5).trim());
        }
        if (!data.length) continue;
        let frame;
        try {
          frame = JSON.parse(data.join('\n'));
        } catch {
          continue;
        }
        const type = frame.type || ev;
        runId = frame.ack?.run_id || frame.progress?.turn_run_id || runId;
        if (type === 'gate') {
          const p = frame.prompt || {};
          const rid = p.turn_run_id || runId;
          const ref = p.gate_ref;
          if (rid && ref) {
            const rr = await req(
              'POST',
              `${B}/threads/${tid}/runs/${encodeURIComponent(rid)}/gates/${encodeURIComponent(ref)}/resolve`,
              { client_action_id: 'tf-gate', resolution: 'approved', always: false }
            );
            console.log(`  ↳ approved trigger_create gate (${p.tool_name || p.headline || '?'}) -> ${rr.s}`);
          }
        }
      }
    }
  })().catch(() => {});

  // Give the SSE stream a moment to connect, THEN send the create message so we
  // don't miss the early gate frame.
  await sleep(1000);
  await req('POST', `${B}/threads/${tid}/messages`, {
    client_action_id: 'tf-2',
    content: createPrompt,
    timezone: 'America/New_York'
  });

  // 2) wait for the trigger to appear in /automations
  let created = null;
  for (let i = 0; i < 60; i++) {
    await sleep(2000);
    const list = await autos();
    created = (Array.isArray(list) ? list : []).find((a) =>
      String(a.name || '').includes('phase5-tick')
    );
    if (created) break;
  }
  if (!created) fail('trigger was not created via builtin.trigger_create (agent did not create it)');
  console.log(
    `trigger created: name=${created.name} state=${created.state} next_run_at=${created.next_run_at} last_run_at=${created.last_run_at || 'null'}`
  );

  // 3) wait for the poller to FIRE it (last_run_at becomes non-null)
  let fired = null;
  for (let i = 0; i < 90; i++) {
    await sleep(2000);
    const list = await autos();
    const cur = (Array.isArray(list) ? list : []).find((a) =>
      String(a.name || '').includes('phase5-tick')
    );
    if (cur && cur.last_run_at) {
      fired = cur;
      break;
    }
  }
  if (fired) {
    console.log(`PASS: trigger FIRED — last_run_at=${fired.last_run_at} state=${fired.state}`);
    console.log(`\n=== Phase 5 firing: PASS (native poller fired the agent-created trigger) ===`);
    try {
      child.kill('SIGKILL');
    } catch {}
    process.exit(0);
  }
  console.log('trigger created but no fire observed within ~3min. logs:\n' + logs.slice(-1000));
  try {
    child.kill('SIGKILL');
  } catch {}
  process.exit(2);
})();
