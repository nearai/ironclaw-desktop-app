#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const RELEVANT_EXTENSION_IDS = Object.freeze([
  'custom-mcp',
  'composio',
  'gmail',
  'google-calendar',
  'google-drive',
  'google-docs',
  'google-sheets',
  'google-slides',
  'notion',
  'github',
  'nearai',
  'web-access'
]);

const args = new Set(process.argv.slice(2));
const probeOauthStart = args.has('--probe-oauth-start');
const jsonOnly = args.has('--json');

const repoRoot = process.cwd();
const binary = path.join(repoRoot, 'src-tauri/binaries/ironclaw-reborn-aarch64-apple-darwin');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = `/tmp/ironclaw-workbench-live-wiring-${stamp}`;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

function setupSecretSummary(secret) {
  return {
    name: secret?.name || '',
    provider: secret?.provider || '',
    provided: Boolean(secret?.provided),
    kind: secret?.setup?.kind || 'manual_token',
    scopes_count: Array.isArray(secret?.setup?.scopes) ? secret.setup.scopes.length : 0
  };
}

function extensionSummary(extension) {
  return {
    id: extension?.package_ref?.id || extension?.id || '',
    display_name: extension?.display_name || extension?.name || '',
    kind: extension?.kind || '',
    active: Boolean(extension?.active),
    state:
      extension?.onboarding_state ||
      extension?.activation_status ||
      extension?.state ||
      (extension?.active ? 'active' : ''),
    needs_setup: Boolean(extension?.needs_setup),
    has_auth: Boolean(extension?.has_auth),
    authenticated: extension?.authenticated === true
  };
}

function registrySummary(entry) {
  return {
    id: entry?.package_ref?.id || entry?.id || '',
    display_name: entry?.display_name || entry?.name || '',
    kind: entry?.kind || '',
    installed: Boolean(entry?.installed)
  };
}

function providerSummary(provider) {
  return {
    id: provider?.id || '',
    name: provider?.name || '',
    adapter: provider?.adapter || '',
    default_model: provider?.default_model || '',
    builtin: Boolean(provider?.builtin),
    api_key_set: Boolean(provider?.api_key_set)
  };
}

function automationSummary(automation) {
  const recentRuns = Array.isArray(automation?.recent_runs) ? automation.recent_runs : [];
  return {
    id: automation?.automation_id || automation?.id || '',
    name: automation?.name || automation?.display_name || '',
    state: automation?.state || '',
    source_type: automation?.source?.type || '',
    next_run_at: automation?.next_run_at || null,
    recent_runs_count: recentRuns.length,
    latest_run_status: recentRuns[0]?.status || automation?.last_status || null
  };
}

function redactText(value, token) {
  return String(value || '')
    .replaceAll(token, '[redacted-token]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer [redacted]')
    .replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, '[jwt-redacted]');
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const port = await freePort();
  const token = `workbench-live-${randomUUID()}`;
  const origin = `http://127.0.0.1:${port}`;
  const log = [];
  const child = spawn(binary, ['serve', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      IRONCLAW_REBORN_WEBUI_TOKEN: token,
      IRONCLAW_REBORN_WEBUI_USER_ID: 'owner',
      GATEWAY_AUTH_TOKEN: token,
      GATEWAY_HOST: '127.0.0.1',
      GATEWAY_PORT: String(port),
      DATABASE_BACKEND: 'libsql',
      GATEWAY_ENABLED: 'true',
      LLM_BACKEND: 'nearai',
      NEARAI_MODEL: 'auto',
      RUST_LOG: process.env.RUST_LOG || 'warn'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (chunk) => log.push(String(chunk)));
  child.stderr.on('data', (chunk) => log.push(String(chunk)));

  async function request(method, pathname, body) {
    const response = await fetch(`${origin}${pathname}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: body == null ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    return { status: response.status, ok: response.ok, body: parsed };
  }

  const result = {
    outDir,
    origin,
    probe_oauth_start: probeOauthStart,
    healthy: false,
    llm: null,
    extensions: [],
    registry: [],
    channels: null,
    automations: null,
    setup: {},
    route_status: {},
    log_tail: []
  };

  try {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (child.exitCode != null) {
        throw new Error(`ironclaw-reborn exited with code ${child.exitCode}`);
      }
      try {
        const probe = await request('GET', '/api/webchat/v2/llm/providers');
        if (probe.status === 200) {
          result.healthy = true;
          break;
        }
      } catch (_) {
        // Keep waiting while the sidecar binds.
      }
      await delay(250);
    }

    const providers = await request('GET', '/api/webchat/v2/llm/providers');
    result.route_status.providers = providers.status;
    const providerList = providers.body?.providers || [];
    const activeProvider =
      providerList.find((provider) => provider.id === providers.body?.active?.provider_id) ||
      providerList[0] ||
      null;
    result.llm = {
      active: providers.body?.active || null,
      providers: providerList.map(providerSummary)
    };
    if (activeProvider) {
      const models = await request('POST', '/api/webchat/v2/llm/list-models', {
        provider_id: activeProvider.id,
        adapter: activeProvider.adapter || activeProvider.id
      });
      result.route_status.models = models.status;
      result.llm.models = {
        ok: models.body?.ok === true,
        count: Array.isArray(models.body?.models) ? models.body.models.length : 0,
        sample: Array.isArray(models.body?.models) ? models.body.models.slice(0, 20) : []
      };
    }

    const extensions = await request('GET', '/api/webchat/v2/extensions');
    result.route_status.extensions = extensions.status;
    result.extensions = (extensions.body?.extensions || []).map(extensionSummary);

    const registry = await request('GET', '/api/webchat/v2/extensions/registry');
    result.route_status.registry = registry.status;
    result.registry = (registry.body?.entries || []).map(registrySummary);

    const channels = await request('GET', '/api/webchat/v2/channels/connectable');
    result.route_status.channels = channels.status;
    result.channels = {
      count: Array.isArray(channels.body?.channels) ? channels.body.channels.length : 0,
      sample: Array.isArray(channels.body?.channels) ? channels.body.channels.slice(0, 10) : []
    };

    const automations = await request('GET', '/api/webchat/v2/automations?limit=50&run_limit=5');
    result.route_status.automations = automations.status;
    result.automations = {
      count: Array.isArray(automations.body?.automations) ? automations.body.automations.length : 0,
      sample: Array.isArray(automations.body?.automations)
        ? automations.body.automations.slice(0, 10).map(automationSummary)
        : []
    };

    for (const id of RELEVANT_EXTENSION_IDS) {
      const setup = await request('GET', `/api/webchat/v2/extensions/${encodeURIComponent(id)}/setup`);
      const pendingOauth = (setup.body?.secrets || []).find(
        (secret) => secret?.setup?.kind === 'oauth' && !secret?.provided
      );
      result.setup[id] = {
        status: setup.status,
        phase: setup.body?.phase || null,
        secrets: (setup.body?.secrets || []).map(setupSecretSummary),
        oauth_start: pendingOauth ? 'not-probed' : 'not-needed'
      };

      if (!probeOauthStart || !pendingOauth) continue;
      const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
      const started = await request(
        'POST',
        `/api/webchat/v2/extensions/${encodeURIComponent(id)}/setup/oauth/start`,
        {
          provider: pendingOauth.provider,
          account_label: pendingOauth.setup?.account_label || `${pendingOauth.provider} credential`,
          scopes: pendingOauth.setup?.scopes || [],
          expires_at: expiresAt,
          invocation_id: pendingOauth.setup?.invocation_id
        }
      );
      result.setup[id].oauth_start = {
        status: started.status,
        ok: started.ok,
        has_authorization_url: Boolean(started.body?.authorization_url),
        authorization_host: started.body?.authorization_url
          ? new URL(started.body.authorization_url).host
          : null
      };
    }
  } finally {
    result.log_tail = log
      .join('')
      .split('\n')
      .filter(Boolean)
      .slice(-40)
      .map((line) => redactText(line, token));
    await writeFile(path.join(outDir, 'probe.json'), JSON.stringify(result, null, 2));
    child.kill('SIGTERM');
  }

  const output = JSON.stringify(result, null, 2);
  if (jsonOnly) {
    console.log(output);
    return;
  }

  console.log(output);
  console.log(`\nWrote live Workbench wiring probe to ${path.join(outDir, 'probe.json')}`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
