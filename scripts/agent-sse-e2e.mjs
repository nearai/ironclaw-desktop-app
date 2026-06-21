#!/usr/bin/env node
// REAL end-to-end agent tool turn over SSE — the way the desktop app runs it.
// REST timeline polling is blind to the live `gate` / `final_reply` frames, so
// this consumes the SSE stream (GET /threads/{id}/events), submits a tool
// prompt, APPROVES the approval gate if one is raised (POST .../gates/{ref}/
// resolve), and captures the final assistant reply. Proves:
//   agent invokes tool -> approval gate -> approve -> tool runs -> final reply.
//
//   COMPOSIO_API_KEY=ak_... node scripts/agent-sse-e2e.mjs
//
// NEAR AI token from Keychain; throwaway HOME; valid model (TEST_MODEL).
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = `${REPO}/src-tauri/binaries/ironclaw-reborn-aarch64-apple-darwin`;
const PORT = Number(process.env.PORT || 4955);
const TOKEN = 'agent-sse-e2e';
const ORIGIN = `http://127.0.0.1:${PORT}`;
const B = '/api/webchat/v2';
const HOME = '/tmp/agent-sse-e2e-home';
const COMPOSIO = process.env.COMPOSIO_API_KEY;
const MODEL = process.env.TEST_MODEL || 'z-ai/glm-5.2';
const PROMPT =
  process.env.TURN_PROMPT ||
  'Use your Gmail tool to fetch my single most recent inbox email, then tell me its sender and subject.';

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
let runId = null;
let gateResolved = false;
let finalReply = '';
const events = [];
const fail = (msg) => {
  console.log('FAIL:', msg, '\n', logs.slice(-1200));
  try {
    child.kill('SIGKILL');
  } catch {}
  process.exit(1);
};

async function consumeSSE(threadId) {
  const url = `${ORIGIN}${B}/threads/${encodeURIComponent(threadId)}/events?token=${encodeURIComponent(TOKEN)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'text/event-stream' }
  });
  if (!res.ok || !res.body) {
    fail(`SSE open failed: ${res.status}`);
    return;
  }
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
      let evName = 'message';
      const dataLines = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) evName = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      }
      if (!dataLines.length) continue;
      let frame;
      try {
        frame = JSON.parse(dataLines.join('\n'));
      } catch {
        continue;
      }
      const type = frame.type || evName;
      events.push(type);
      // track run id from accepted / running frames
      runId = frame.ack?.run_id || frame.progress?.turn_run_id || runId;
      if (type === 'gate') {
        const p = frame.prompt || {};
        const rid = p.turn_run_id || runId;
        const ref = p.gate_ref;
        const toolName =
          p.tool_name || p.toolName || p.headline || p.title || Object.keys(p).join(',');
        console.log(`  ↳ GATE raised: tool=${toolName} ref=${ref} run=${rid}`);
        if (rid && ref) {
          const rr = await req(
            'POST',
            `${B}/threads/${threadId}/runs/${encodeURIComponent(rid)}/gates/${encodeURIComponent(ref)}/resolve`,
            { client_action_id: 'resolve-1', resolution: 'approved', always: false }
          );
          gateResolved = rr.s === 200;
          console.log(`  ↳ resolve(approved) -> ${rr.s}`);
        }
      } else if (type === 'capability_display_preview') {
        const pv = frame.preview || {};
        console.log(`  ↳ tool call: ${pv.title || pv.capability_id || '?'} status=${pv.status || '?'}`);
      } else if (type === 'capability_activity') {
        const a = frame.activity || {};
        const st = String(a.status || '?');
        // log only terminal states to keep it readable
        if (st === 'completed' || st === 'failed' || st === 'killed')
          console.log(
            `  ↳ tool ${st}: ${a.capability_id || a.title || '?'}${a.error_kind ? ' err=' + a.error_kind : ''}`
          );
      } else if (type === 'final_reply') {
        finalReply = String(frame.reply?.text || '').trim();
        console.log(`  ↳ FINAL REPLY (event): ${finalReply.slice(0, 200)}`);
        return;
      } else if (type === 'projection_snapshot' || type === 'projection_update') {
        // The assistant reply may land inside the projection state, not as a
        // separate final_reply event. Extract the latest finalized assistant msg.
        const items = frame.state?.items || [];
        for (const it of Array.isArray(items) ? items : []) {
          const k = String(it.kind || '').toLowerCase();
          if (
            (k === 'assistant' || k === 'assistant_message') &&
            String(it.content || '').trim() &&
            (it.status === 'finalized' || it.status === 'completed' || !it.status)
          ) {
            finalReply = String(it.content).trim();
          }
        }
        if (finalReply) {
          console.log(`  ↳ FINAL REPLY (projection): ${finalReply.slice(0, 200)}`);
          return;
        }
      } else if (type === 'failed') {
        console.log(`  ↳ run failed: ${JSON.stringify(frame.run_state || {}).slice(0, 200)}`);
        return;
      }
    }
  }
}

(async () => {
  for (let i = 0; i < 240; i++) {
    if (child.exitCode != null) fail('sidecar exited');
    if ((await req('GET', `${B}/llm/providers`)).s === 200) break;
    await sleep(500);
  }
  console.log('model:', MODEL);
  await req('POST', `${B}/extensions/composio/setup`, {
    action: 'configure',
    payload: { secrets: { composio_api_key: COMPOSIO }, fields: {} }
  });
  const ct = await req('POST', `${B}/threads`, { client_action_id: 'sse-1' });
  const threadId = ct.j?.thread?.thread_id || ct.j?.thread_id;
  if (!threadId) fail('no thread id');
  console.log('thread:', threadId);
  console.log('prompt:', PROMPT);
  // open SSE first, then send (so we don't miss early frames)
  const sse = consumeSSE(threadId);
  await sleep(800);
  await req('POST', `${B}/threads/${threadId}/messages`, {
    client_action_id: 'sse-2',
    content: PROMPT,
    timezone: 'America/New_York'
  });
  const timeout = new Promise((r) =>
    setTimeout(() => r('timeout'), Number(process.env.TURN_TIMEOUT_MS || 180000))
  );
  const winner = await Promise.race([sse.then(() => 'sse'), timeout]);
  console.log('\nframe sequence:', events.join(' -> ') || '(none)');
  console.log('gate raised:', events.includes('gate'), '| gate resolved:', gateResolved);
  console.log('final reply present:', !!finalReply);
  // Ground-truth dump: the persisted timeline (kinds + content snippets).
  const tl = await req('GET', `${B}/threads/${threadId}/timeline?limit=60`);
  const items = tl.j?.messages || tl.j?.items || [];
  console.log(`\n--- persisted timeline (${Array.isArray(items) ? items.length : 0} rows) ---`);
  let calledConnector = false;
  for (const it of Array.isArray(items) ? items : []) {
    const k = String(it.kind || '').toLowerCase();
    // For tool previews, parse the envelope to show input args + outcome — this
    // is how we tell a successful read from a wrong-args read the model retries.
    if (k === 'capability_display_preview') {
      let env;
      try {
        env = JSON.parse(it.content);
      } catch {}
      if (env && env.capability_id) {
        if (String(env.capability_id).includes('connected-sources')) calledConnector = true;
        const inp = JSON.stringify(env.input_summary || env.input || '').slice(0, 160);
        const out = String(env.output_preview || env.output_summary || env.error_kind || '')
          .replace(/\s+/g, ' ')
          .slice(0, 160);
        console.log(`  [tool ${env.capability_id}|${env.status}] in=${inp} out=${out}`);
        continue;
      }
    }
    const c = String(it.content || '').replace(/\s+/g, ' ').slice(0, 120);
    console.log(`  [${it.kind || '?'}|${it.status || ''}] ${c}`);
    if ((k === 'assistant' || k === 'assistant_message') && String(it.content || '').trim())
      finalReply = String(it.content).trim(); // ground truth: persisted finalized reply
  }
  console.log('\nagent called connected-sources.read directly:', calledConnector);
  console.log('assistant reply present (timeline):', !!finalReply);
  try {
    fs.writeFileSync('/tmp/sse-sidecar-full.log', logs);
  } catch {}
  if (!finalReply) {
    const hostErr = logs
      .split('\n')
      .filter((l) => /capability host error|HostUnavailable|safe_summary|BudgetExceeded|sandbox|wasm|ContextOverflow/i.test(l))
      .slice(-8)
      .join('\n');
    console.log('NOTE: no final reply. host-error lines:\n' + (hostErr || '(none)') + '\n(full log: /tmp/sse-sidecar-full.log)');
  }
  try {
    child.kill('SIGKILL');
  } catch {}
  // success = we got a final reply (gate-approved path or auto-run path)
  process.exit(finalReply ? 0 : 2);
})();
