#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const bundledSidecar = path.join(
  repoRoot,
  'src-tauri/target/release/bundle/macos/IronClaw.app/Contents/MacOS/ironclaw-reborn',
);
const releaseSidecar = path.join(repoRoot, 'src-tauri/target/release/ironclaw-reborn');
const artifactDir = path.join(repoRoot, 'output/live-connector-probe');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const artifactPath = path.join(artifactDir, `reborn-live-connector-probe-${timestamp}.json`);

async function fileExists(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch (_) {
    return false;
  }
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
    server.on('error', reject);
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (/token|secret|authorization/i.test(key)) {
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

function summarizeResponse(body) {
  const sanitized = sanitize(body);
  if (!sanitized || typeof sanitized !== 'object') return sanitized;
  const allowedKeys = [
    'interaction_id',
    'invocation_id',
    'provider',
    'label',
    'credential_ref',
    'status',
    'phase',
    'activation_status',
    'account_ready',
    'credential_ready',
    'readiness',
    'blockers',
    'error',
    'message',
    'reason',
  ];
  return Object.fromEntries(
    Object.entries(sanitized).filter(([key]) => allowedKeys.includes(key)),
  );
}

async function main() {
  const sidecar = (await fileExists(bundledSidecar)) ? bundledSidecar : releaseSidecar;
  if (!(await fileExists(sidecar))) {
    throw new Error(`No ironclaw-reborn binary found at ${bundledSidecar} or ${releaseSidecar}`);
  }

  await mkdir(artifactDir, { recursive: true });
  const homeDir = await mkdtemp(path.join(os.tmpdir(), 'ironclaw-live-connector-probe-home-'));
  const token = `probe-${randomUUID()}`;
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const sidecarLog = [];
  const evidence = {
    generated_at: new Date().toISOString(),
    binary: sidecar,
    origin,
    temp_home: homeDir,
    bearer_token: '[REDACTED]',
    probes: [],
    catalog_ref_rule: {
      expected:
        'Lifecycle route paths must use canonical bare names; slash-prefixed catalog refs remain request payload metadata only.',
      lifecycle_paths_allowed: ['gmail', 'google-calendar', 'notion', 'slack'],
      slash_prefixed_refs_must_not_be_path_names: [
        'tools/gmail',
        'tools/google_calendar',
        'mcp-servers/notion',
        'channels/slack',
        'tools/slack_tool',
      ],
    },
  };

  const child = spawn(sidecar, ['serve', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      HOME: homeDir,
      XDG_CACHE_HOME: path.join(homeDir, '.cache'),
      XDG_CONFIG_HOME: path.join(homeDir, '.config'),
      XDG_DATA_HOME: path.join(homeDir, '.local/share'),
      IRONCLAW_REBORN_WEBUI_TOKEN: token,
      IRONCLAW_REBORN_WEBUI_USER_ID: 'codex-live-connector-probe',
      RUST_LOG: process.env.RUST_LOG || 'warn',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => sidecarLog.push(chunk.toString()));
  child.stderr.on('data', (chunk) => sidecarLog.push(chunk.toString()));

  async function stopSidecar() {
    if (child.exitCode == null) {
      child.kill('SIGTERM');
      await Promise.race([
        new Promise((resolve) => child.once('exit', resolve)),
        delay(3000).then(() => child.kill('SIGKILL')),
      ]);
    }
  }

  async function request(label, method, pathname, body = undefined, { auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) headers.Authorization = `Bearer ${token}`;
    const requestBody = body === undefined ? undefined : JSON.stringify(body);
    const response = await fetch(`${origin}${pathname}`, {
      method,
      headers,
      body: requestBody,
    });
    const responseBody = await parseJsonResponse(response);
    const record = {
      label,
      method,
      path: pathname,
      request: sanitize(body),
      status: response.status,
      ok: response.ok,
      response: summarizeResponse(responseBody),
    };
    evidence.probes.push(record);
    return { response, body: responseBody, record };
  }

  try {
    let healthy = false;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (child.exitCode != null) {
        throw new Error(`sidecar exited early with code ${child.exitCode}`);
      }
      try {
        const response = await fetch(`${origin}/api/health`);
        if (response.ok) {
          healthy = true;
          evidence.health = { status: response.status, ok: true };
          break;
        }
      } catch (_) {
        // Server is still booting.
      }
      await delay(250);
    }
    if (!healthy) throw new Error('sidecar did not become healthy');

    await request('unauthenticated extensions begin is rejected', 'POST', '/api/webchat/v2/extensions/gmail/setup', {
      action: 'begin',
      payload: { catalog_ref: 'tools/gmail' },
    }, { auth: false });

    await request('slash-prefixed catalog ref path is rejected', 'POST', '/api/webchat/v2/extensions/tools%2Fgmail/setup', {
      action: 'begin',
      payload: { catalog_ref: 'tools/gmail' },
    });

    const connectors = [
      {
        name: 'gmail',
        provider: 'google',
        accountLabel: 'Smoke Google',
        catalogRef: 'tools/gmail',
        dummyToken: 'ya29.smoke-google-live-probe',
      },
      {
        name: 'google-calendar',
        provider: 'google',
        accountLabel: 'Smoke Google Calendar',
        catalogRef: 'tools/google_calendar',
        dummyToken: 'ya29.smoke-calendar-live-probe',
      },
      {
        name: 'notion',
        provider: 'notion',
        accountLabel: 'Smoke Notion',
        catalogRef: 'mcp-servers/notion',
        dummyToken: 'secret_notion_live_probe',
      },
    ];

    for (const connector of connectors) {
      await request(`${connector.name} lifecycle begin`, 'POST', `/api/webchat/v2/extensions/${connector.name}/setup`, {
        action: 'begin',
        payload: { catalog_ref: connector.catalogRef },
      });

      const setup = await request(`${connector.name} product auth setup`, 'POST', '/api/reborn/product-auth/manual-token/setup', {
        provider: connector.provider,
        account_label: connector.accountLabel,
      });

      const interactionId = setup.body?.interaction_id;
      const invocationId = setup.body?.invocation_id;
      const secret = interactionId && invocationId
        ? await request(`${connector.name} product auth secret-submit`, 'POST', '/api/reborn/product-auth/manual-token/secret-submit', {
          interaction_id: interactionId,
          invocation_id: invocationId,
          token: connector.dummyToken,
        })
        : null;

      const credentialRef = secret?.body?.credential_ref || `credential-${connector.name}-probe`;
      await request(`${connector.name} lifecycle configure`, 'POST', `/api/webchat/v2/extensions/${connector.name}/setup`, {
        action: 'configure',
        payload: {
          catalog_ref: connector.catalogRef,
          provider: connector.provider,
          account_label: connector.accountLabel,
          credential_ref: credentialRef,
        },
      });

      await request(`${connector.name} lifecycle activate`, 'POST', `/api/webchat/v2/extensions/${connector.name}/setup`, {
        action: 'activate',
        payload: { catalog_ref: connector.catalogRef },
      });
    }

    await request('slack blocked lifecycle truth', 'POST', '/api/webchat/v2/extensions/slack/setup', {
      action: 'begin',
      payload: { catalog_ref: 'channels/slack' },
    });
  } finally {
    await stopSidecar();
    evidence.sidecar_exit_code = child.exitCode;
    evidence.sidecar_exit_signal = child.signalCode;
    evidence.sidecar_log_tail = sidecarLog.join('').split('\n').slice(-30);
    const expectedSecurityRejections = evidence.probes.filter((probe) =>
      (probe.label.includes('unauthenticated') && probe.status === 401) ||
      (probe.label.includes('slash-prefixed') && probe.status === 400)
    );
    const runtimeBlockedConfigures = evidence.probes.filter((probe) =>
      probe.label.includes('lifecycle configure') &&
      probe.response?.phase === 'unsupported_or_legacy'
    );
    const activationRejections = evidence.probes.filter((probe) =>
      probe.label.includes('lifecycle activate') &&
      probe.status === 400
    );
    const slackBlocked = evidence.probes.some((probe) =>
      probe.label.includes('slack') &&
      probe.response?.phase === 'unsupported_or_legacy'
    );
    evidence.summary = {
      total: evidence.probes.length,
      ok: evidence.probes.filter((probe) => probe.ok).length,
      expected_security_rejections: expectedSecurityRejections.length,
      runtime_blocked_configures: runtimeBlockedConfigures.length,
      activation_rejections: activationRejections.length,
      slack_blocked: slackBlocked,
      failed_or_blocked: evidence.probes.filter((probe) => !probe.ok).length,
      failed_or_blocked_labels: evidence.probes.filter((probe) => !probe.ok).map((probe) => ({
        label: probe.label,
        status: probe.status,
        response: probe.response,
      })),
    };
    await writeFile(artifactPath, `${JSON.stringify(evidence, null, 2)}\n`);
    if (process.env.KEEP_LIVE_CONNECTOR_PROBE_HOME !== '1') {
      await rm(homeDir, { recursive: true, force: true });
    }
  }

  console.log(`live connector probe artifact: ${artifactPath}`);
  console.log(
    JSON.stringify(
      {
        health: evidence.health,
        summary: evidence.summary,
      },
      null,
      2,
    ),
  );

  const unexpected = evidence.probes.filter((probe) => {
    if (probe.label.includes('unauthenticated') || probe.label.includes('slash-prefixed')) {
      return probe.ok;
    }
    return false;
  });
  if (unexpected.length) {
    throw new Error(`Live connector probe found unexpected permissive routing: ${JSON.stringify(unexpected)}`);
  }
}

main().catch((err) => {
  console.error(err.stack || err.message || String(err));
  process.exitCode = 1;
});
