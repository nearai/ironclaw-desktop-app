#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildDurableAttachmentBlock } from '../crates/ironclaw_webui_v2_static/static/js/pages/chat/lib/history-messages.js';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const bundledSidecar = path.join(
  repoRoot,
  'src-tauri/target/release/bundle/macos/IronClaw.app/Contents/MacOS/ironclaw-reborn'
);
const releaseSidecar = path.join(repoRoot, 'src-tauri/target/release/ironclaw-reborn');
const artifactDir = path.join(repoRoot, 'output/live-work-product-probe');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const artifactPath = path.join(artifactDir, `reborn-live-chat-attachment-probe-${timestamp}.json`);
const defaultTokenPath = path.join(
  os.homedir(),
  'Library/Application Support/com.openclaw.ironclaw-desktop/tokens/local-gateway-token.token'
);

async function fileExists(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch (_) {
    return false;
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
    server.on('error', reject);
  });
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (/token|secret|authorization|data_base64/i.test(key)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = sanitize(child);
    }
  }
  return result;
}

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    return { text };
  }
}

function summarizeMessages(body) {
  const rawMessages = Array.isArray(body?.messages)
    ? body.messages
    : Array.isArray(body?.timeline)
      ? body.timeline
      : Array.isArray(body?.events)
        ? body.events
        : [];
  return rawMessages.map((message) => sanitize(message)).slice(0, 20);
}

function scenarioAttachment({ name, mime_type, content }) {
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  return {
    name,
    mime_type,
    data_base64: bytes.toString('base64'),
    byte_length: bytes.byteLength,
    base64_sha256: createHash('sha256').update(bytes.toString('base64')).digest('hex')
  };
}

async function startHermeticSidecar() {
  const sidecar = (await fileExists(bundledSidecar)) ? bundledSidecar : releaseSidecar;
  if (!(await fileExists(sidecar))) {
    throw new Error(`No ironclaw-reborn binary found at ${bundledSidecar} or ${releaseSidecar}`);
  }

  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const token = `probe-${randomUUID()}`;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), 'ironclaw-live-attachment-probe-home-'));
  const inheritedEnv = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !/^(ANTHROPIC_|OPENAI_|OPENROUTER_|NEARAI_|LLM_)/.test(key)
    )
  );
  const child = spawn(sidecar, ['serve', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: repoRoot,
    env: {
      ...inheritedEnv,
      HOME: homeDir,
      XDG_CACHE_HOME: path.join(homeDir, '.cache'),
      XDG_CONFIG_HOME: path.join(homeDir, '.config'),
      XDG_DATA_HOME: path.join(homeDir, '.local/share'),
      IRONCLAW_REBORN_WEBUI_TOKEN: token,
      IRONCLAW_REBORN_WEBUI_USER_ID: 'codex-live-attachment-probe',
      RUST_LOG: process.env.RUST_LOG || 'warn'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const sidecarLog = [];
  child.stdout.on('data', (chunk) => sidecarLog.push(chunk.toString()));
  child.stderr.on('data', (chunk) => sidecarLog.push(chunk.toString()));

  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode != null) {
      throw new Error(`sidecar exited before health check: ${sidecarLog.join('').slice(-1000)}`);
    }
    try {
      const health = await fetch(`${origin}/api/webchat/v2/threads`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (health.ok) {
        return {
          origin,
          token,
          tokenPath: 'hermetic-env',
          binary: sidecar,
          tempHome: homeDir,
          async stop() {
            if (child.exitCode == null) {
              child.kill('SIGTERM');
              await Promise.race([
                new Promise((resolve) => child.once('exit', resolve)),
                delay(3000).then(() => child.kill('SIGKILL'))
              ]);
            }
            if (process.env.KEEP_LIVE_ATTACHMENT_PROBE_HOME !== '1') {
              await rm(homeDir, { recursive: true, force: true });
            }
          }
        };
      }
    } catch (_) {
      // Still booting.
    }
    await delay(250);
  }

  child.kill('SIGTERM');
  await rm(homeDir, { recursive: true, force: true }).catch(() => {});
  throw new Error(`sidecar did not become healthy: ${sidecarLog.join('').slice(-1000)}`);
}

async function main() {
  const useExistingGateway =
    process.env.IRONCLAW_LIVE_PROBE_USE_EXISTING === '1' ||
    Boolean(process.env.IRONCLAW_LIVE_PROBE_ORIGIN || process.env.IRONCLAW_LIVE_PROBE_TOKEN_FILE);
  const target = useExistingGateway
    ? {
        origin: process.env.IRONCLAW_LIVE_PROBE_ORIGIN || 'http://127.0.0.1:3000',
        tokenPath: process.env.IRONCLAW_LIVE_PROBE_TOKEN_FILE || defaultTokenPath,
        token: (
          await readFile(process.env.IRONCLAW_LIVE_PROBE_TOKEN_FILE || defaultTokenPath, 'utf8')
        ).trim(),
        binary: null,
        tempHome: null,
        stop: async () => {}
      }
    : await startHermeticSidecar();

  const { origin, token, tokenPath } = target;
  if (!token) throw new Error(`empty token file: ${tokenPath}`);
  await mkdir(artifactDir, { recursive: true });

  const evidence = {
    generated_at: new Date().toISOString(),
    origin,
    token_path: tokenPath,
    binary: target.binary,
    temp_home: target.tempHome,
    bearer_token: '[REDACTED]',
    probes: []
  };

  async function request(label, method, pathname, body = undefined) {
    const response = await fetch(`${origin}${pathname}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const responseBody = await parseJsonResponse(response);
    const record = {
      label,
      method,
      path: pathname,
      request: sanitize(body),
      status: response.status,
      ok: response.ok,
      response: sanitize(responseBody)
    };
    evidence.probes.push(record);
    return { response, body: responseBody, record };
  }

  try {
    const health = await request('health', 'GET', '/api/webchat/v2/threads');
    if (!health.response.ok) throw new Error(`health failed: ${health.response.status}`);

    const requestedThreadId = randomUUID();
    const threadClientActionId = `codex-live-thread-${timestamp}`;
    const thread = await request('create thread', 'POST', '/api/webchat/v2/threads', {
      client_action_id: threadClientActionId,
      requested_thread_id: requestedThreadId
    });
    if (!thread.response.ok) throw new Error(`create thread failed: ${thread.response.status}`);
    const threadId = thread.body?.thread_id || thread.body?.thread?.thread_id || requestedThreadId;
    evidence.thread_id = threadId;

    const scenarios = [
      scenarioAttachment({
        name: 'codex-scenario-1-ledger.csv',
        mime_type: 'text/csv',
        content: 'item,value\nalpha,12\nbeta,34\n'
      }),
      scenarioAttachment({
        name: 'codex-scenario-2-brief.md',
        mime_type: 'text/markdown',
        content: '# Launch brief\n\n- Owner: Work Product\n- Risk: attachment persistence\n'
      }),
      scenarioAttachment({
        name: 'codex-scenario-3-payload.json',
        mime_type: 'application/json',
        content: JSON.stringify({ customer: 'Northwind', amount: 4200, approved: false }, null, 2)
      }),
      scenarioAttachment({
        name: 'codex-scenario-4-report.html',
        mime_type: 'text/html',
        content: '<!doctype html><h1>Quarterly report</h1><p>Retention: 94%</p>'
      }),
      scenarioAttachment({
        name: 'codex-scenario-5-contract.pdf',
        mime_type: 'application/pdf',
        content: Buffer.from('%PDF-1.4\n% dummy contract payload for serialization probe\n%%EOF\n')
      })
    ];
    const attachments = scenarios.map(({ name, mime_type, data_base64 }) => ({
      name,
      mime_type,
      data_base64
    }));
    const prompt =
      'Codex live route probe: confirm these five varied dummy attachments reached Reborn and survive thread reload. Do not send external messages or write to connectors.';
    const durableAttachmentBlock = buildDurableAttachmentBlock(
      scenarios.map(({ name, mime_type, data_base64, byte_length }) => ({
        name,
        mime_type,
        data_base64,
        size: byte_length
      })),
      { contentBytes: Buffer.byteLength(prompt, 'utf8') }
    );
    const content = `${prompt}${durableAttachmentBlock}`;
    const message = await request(
      'send message with varied attachments',
      'POST',
      `/api/webchat/v2/threads/${encodeURIComponent(threadId)}/messages`,
      {
        client_action_id: `codex-live-message-${timestamp}`,
        content,
        attachments
      }
    );
    evidence.sent_prompt = prompt;
    evidence.sent_durable_attachment_block = sanitize(durableAttachmentBlock);
    evidence.sent_attachments = scenarios.map(
      ({ name, mime_type, byte_length, base64_sha256 }) => ({
        name,
        mime_type,
        byte_length,
        base64_sha256
      })
    );

    // Give the gateway a short window to persist timeline/messages. This is not
    // waiting for model quality; it is checking that the user's submitted payload
    // is visible again through Reborn route reads.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const messages = await request(
      'fetch messages after send',
      'GET',
      `/api/webchat/v2/threads/${encodeURIComponent(threadId)}/messages?limit=50`
    );
    const timeline = await request(
      'fetch timeline after send',
      'GET',
      `/api/webchat/v2/threads/${encodeURIComponent(threadId)}/timeline?limit=50`
    );

    const reloadedText = JSON.stringify(sanitize([messages.body, timeline.body]));
    const attachmentNamesObserved = scenarios
      .map((scenario) => scenario.name)
      .filter((name) => reloadedText.includes(name));
    evidence.summary = {
      thread_id: threadId,
      send_status: message.record.status,
      message_ok: message.record.ok,
      messages_status: messages.record.status,
      timeline_status: timeline.record.status,
      messages: summarizeMessages(messages.body),
      timeline: summarizeMessages(timeline.body),
      attachment_names_expected: scenarios.map((scenario) => scenario.name),
      attachment_names_observed: attachmentNamesObserved,
      all_attachment_names_observed: attachmentNamesObserved.length === scenarios.length,
      prompt_observed: reloadedText.includes(prompt)
    };

    await writeFile(artifactPath, `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(`live chat attachment probe artifact: ${artifactPath}`);
    console.log(JSON.stringify(evidence.summary, null, 2));

    if (!message.record.ok) {
      throw new Error(`send message failed: ${message.record.status}`);
    }
    if (!evidence.summary.prompt_observed) {
      throw new Error('sent prompt was not observed in messages or timeline reads');
    }
    if (!evidence.summary.all_attachment_names_observed) {
      throw new Error(
        `not all attachment names survived reload: ${JSON.stringify(evidence.summary.attachment_names_observed)}`
      );
    }
  } catch (err) {
    evidence.error = err instanceof Error ? err.message : String(err);
    await writeFile(artifactPath, `${JSON.stringify(evidence, null, 2)}\n`).catch(() => {});
    throw err;
  } finally {
    await target.stop();
  }
}

main().catch((err) => {
  console.error(err.stack || err.message || String(err));
  process.exitCode = 1;
});
