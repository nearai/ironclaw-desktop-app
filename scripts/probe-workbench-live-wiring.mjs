#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  connectorFamilyReadiness,
  normalizeCalendarEvents,
  normalizeInboxMessages
} from '../crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-connectors.js';
import { normalizeDriveFiles } from '../crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-drive.js';
import { normalizeGithubNotifications } from '../crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-github.js';
import { normalizeNotionPages } from '../crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-notion.js';
import {
  buildWorkbenchChatDraft,
  buildWorkbenchLiveSourcePacket,
  buildWorkbenchLiveSourceStatus
} from '../crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-plan.js';
import { normalizeSlackBlockers } from '../crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-slack.js';

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
const skipConnectorReads = args.has('--skip-connector-reads');
const skipChatHandoff = args.has('--skip-chat-handoff');
const probeDirectConnectorChat =
  args.has('--probe-direct-connector-chat') || args.has('--require-direct-connector-chat');
const requireDirectConnectorChat = args.has('--require-direct-connector-chat');
const keepProbeHome = args.has('--keep-probe-home');
const llmBackend = flagValue('--llm-backend') || process.env.IRONCLAW_PROBE_LLM_BACKEND || 'nearai';
const chatMaxAttempts = positiveInt(
  flagValue('--chat-max-attempts') || process.env.IRONCLAW_PROBE_CHAT_MAX_ATTEMPTS,
  String(llmBackend).toLowerCase() === 'openrouter' ? 40 : 18
);
const chatPollMs = positiveInt(
  flagValue('--chat-poll-ms') || process.env.IRONCLAW_PROBE_CHAT_POLL_MS,
  2500
);

const repoRoot = process.cwd();
const binary = path.join(repoRoot, 'src-tauri/binaries/ironclaw-reborn-aarch64-apple-darwin');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = `/tmp/ironclaw-workbench-live-wiring-${stamp}`;

const SLACK_BLOCKER_QUERY = '(blocked OR blocker OR stuck OR urgent OR asap OR waiting)';
const EXPECTED_CONNECTOR_TOOLKITS = Object.freeze([
  'github',
  'gmail',
  'googlecalendar',
  'googledrive',
  'notion',
  'slack'
]);
const EXPECTED_WORKBENCH_SOURCE_FAMILIES = Object.freeze([
  'gmail',
  'calendar',
  'drive',
  'notion',
  'slack',
  'github'
]);

function flagValue(name) {
  const prefix = `${name}=`;
  const value = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length).trim() : '';
}

function positiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function openRouterModel() {
  return (
    process.env.IRONCLAW_PROBE_OPENROUTER_MODEL ||
    process.env.OPENROUTER_MODEL ||
    'deepseek/deepseek-chat-v3-0324'
  );
}

function tomlString(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}

function llmBackendEnv(backend) {
  const normalized = String(backend || 'nearai').toLowerCase();
  if (normalized === 'openrouter') {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) {
      throw new Error('--llm-backend=openrouter requires OPENROUTER_API_KEY in the environment');
    }
    return {
      LLM_BACKEND: 'openrouter',
      OPENROUTER_API_KEY: key,
      OPENROUTER_MODEL: openRouterModel()
    };
  }
  if (normalized === 'nearai') {
    return {
      LLM_BACKEND: 'nearai',
      NEARAI_MODEL: process.env.NEARAI_MODEL || 'auto'
    };
  }
  throw new Error(`unsupported --llm-backend=${backend}; expected nearai or openrouter`);
}

async function prepareProbeRebornHome(backend) {
  const normalized = String(backend || 'nearai').toLowerCase();
  if (normalized !== 'openrouter') {
    return {
      env: {},
      report: { mode: 'user-default', kept: false },
      cleanup: async () => {}
    };
  }

  const home = process.env.HOME || os.homedir();
  const sourceRebornHome = path.join(home, '.ironclaw', 'reborn');
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'ironclaw-workbench-reborn-'));
  const tempRebornHome = path.join(tempRoot, 'reborn');
  const model = openRouterModel();
  await cp(sourceRebornHome, tempRebornHome, { recursive: true, force: true });
  await rm(path.join(tempRebornHome, 'config.toml.lock'), { force: true });
  await rm(path.join(tempRebornHome, 'providers.json.lock'), { force: true });
  await writeFile(
    path.join(tempRebornHome, 'config.toml'),
    `[llm]\n\n[llm.default]\nprovider_id = "openrouter"\nmodel = "${tomlString(
      model
    )}"\napi_key_env = "OPENROUTER_API_KEY"\n`
  );

  return {
    env: { IRONCLAW_REBORN_HOME: tempRebornHome },
    report: {
      mode: 'ephemeral-reborn-copy',
      source: '~/.ironclaw/reborn',
      requested_provider_id: 'openrouter',
      requested_model: model,
      kept: keepProbeHome,
      reborn_home: keepProbeHome ? tempRebornHome : '[temporary]'
    },
    cleanup: async () => {
      if (!keepProbeHome) {
        await rm(tempRoot, { recursive: true, force: true });
      }
    }
  };
}

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
    active: Boolean(provider?.active),
    active_model: provider?.active_model || '',
    builtin: Boolean(provider?.builtin),
    api_key_required: Boolean(provider?.api_key_required),
    accepts_api_key: Boolean(provider?.accepts_api_key),
    api_key_set: Boolean(provider?.api_key_set),
    can_list_models: Boolean(provider?.can_list_models)
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

function firstArrayLength(value, depth = 0) {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== 'object' || depth > 4) return null;
  for (const candidate of Object.values(value)) {
    const count = firstArrayLength(candidate, depth + 1);
    if (count !== null) return count;
  }
  return null;
}

function connectorReadSummary(response) {
  return {
    status: response.status,
    successful: response.body?.successful ?? null,
    has_data: response.body?.data !== undefined && response.body?.data !== null,
    count: firstArrayLength(response.body?.data),
    error_present: Boolean(response.body?.error)
  };
}

function connectorReadRows(id, response) {
  switch (id) {
    case 'gmail':
      return normalizeInboxMessages(response.body, { limit: 4 });
    case 'calendar':
      return normalizeCalendarEvents(response.body, { limit: 4 });
    case 'drive':
      return normalizeDriveFiles(response.body, { limit: 4 });
    case 'notion':
      return normalizeNotionPages(response.body, { limit: 4 });
    case 'github':
      return normalizeGithubNotifications(response.body, { limit: 4 });
    case 'slack':
      return normalizeSlackBlockers(response.body, { limit: 4 });
    default:
      return [];
  }
}

function liveSourceDataFromRows(readRows = {}) {
  return {
    inboxMessages: readRows.gmail || [],
    calendarEvents: readRows.calendar || [],
    driveFiles: readRows.drive || [],
    notionPages: readRows.notion || [],
    githubNotifications: readRows.github || [],
    slackBlockers: readRows.slack || []
  };
}

function liveSourceDataCounts(liveSourceData = {}) {
  return Object.fromEntries(
    Object.entries(liveSourceData).map(([key, rows]) => [
      key,
      Array.isArray(rows) ? rows.length : 0
    ])
  );
}

function timelineMessages(body) {
  if (Array.isArray(body?.messages)) return body.messages;
  if (Array.isArray(body?.timeline)) return body.timeline;
  if (Array.isArray(body?.events)) return body.events;
  return [];
}

function messageKind(message) {
  return String(message?.kind || message?.role || message?.message?.role || '').toLowerCase();
}

function messageContent(message) {
  const candidates = [
    message?.content,
    message?.text,
    message?.message?.content,
    message?.message?.text,
    message?.payload?.content,
    message?.payload?.text
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string') return candidate;
  }
  return '';
}

function messageStatus(message) {
  return String(
    message?.status ||
      message?.run_status?.status ||
      message?.payload?.status ||
      message?.message?.status ||
      ''
  ).toLowerCase();
}

function messageFailureSummary(message) {
  return (
    message?.failure_summary ||
    message?.run_status?.failure_summary ||
    message?.payload?.failure_summary ||
    message?.message?.failure_summary ||
    ''
  );
}

const TERMINAL_RUN_STATUSES = new Set([
  'completed',
  'succeeded',
  'failed',
  'cancelled',
  'recovery_required'
]);
const FAILURE_RUN_STATUSES = new Set(['failed', 'cancelled', 'recovery_required']);

function timelineRunStatuses(body, messages) {
  const candidates = [];
  for (const key of ['items', 'events', 'timeline', 'messages']) {
    if (Array.isArray(body?.[key])) candidates.push(...body[key]);
  }
  candidates.push(...messages);
  return candidates
    .map((item) => item?.run_status || item)
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      run_id: item.run_id || item.turn_run_id || item.runId || null,
      status: messageStatus(item),
      failure_summary: messageFailureSummary(item),
      failure_category: item.failure_category || item.run_status?.failure_category || ''
    }))
    .filter((item) => item.status);
}

function runStateSummary(body) {
  if (!body || typeof body !== 'object') return null;
  const failure = body.failure && typeof body.failure === 'object' ? body.failure : {};
  return {
    run_id: body.run_id || body.turn_run_id || body.runId || null,
    status: String(body.status || '').toLowerCase(),
    failure_category: body.failure_category || failure.category || failure.kind || '',
    failure_summary:
      body.failure_summary || failure.safe_summary || failure.summary || failure.message || ''
  };
}

function collectRunStatusSummaries(value, summaries = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectRunStatusSummaries(item, summaries);
    return summaries;
  }
  if (!value || typeof value !== 'object') return summaries;
  if (value.run_status && typeof value.run_status === 'object') {
    const summary = runStateSummary(value.run_status);
    if (summary?.status) summaries.push(summary);
  }
  for (const child of Object.values(value)) {
    collectRunStatusSummaries(child, summaries);
  }
  return summaries;
}

function ssePayloadsFromBlock(block) {
  const data = block
    .split(/\r?\n/u)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s?/u, ''))
    .join('\n')
    .trim();
  if (!data || data === '[DONE]') return [];
  try {
    return [JSON.parse(data)];
  } catch {
    return [];
  }
}

function startRunStatusStream({ origin, token, threadId, onStatus }) {
  const controller = new AbortController();
  const state = {
    status: null,
    error: null,
    controller,
    promise: null
  };
  state.promise = (async () => {
    try {
      const response = await fetch(
        `${origin}/api/webchat/v2/threads/${encodeURIComponent(threadId)}/events?token=${encodeURIComponent(
          token
        )}`,
        { headers: { Accept: 'text/event-stream' }, signal: controller.signal }
      );
      state.status = response.status;
      if (!response.ok || !response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/u);
        buffer = blocks.pop() || '';
        for (const block of blocks) {
          for (const payload of ssePayloadsFromBlock(block)) {
            for (const summary of collectRunStatusSummaries(payload)) {
              onStatus(summary);
            }
          }
        }
        buffer = buffer.slice(-8000);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        state.error = err?.message || String(err);
      }
    }
  })();
  return state;
}

async function stopRunStatusStream(stream) {
  if (!stream) return;
  stream.controller.abort();
  await stream.promise;
}

function applyRunStatusToHandoff(handoff, summary) {
  if (!summary?.status) return;
  if (summary.run_id && handoff.run_id && summary.run_id !== handoff.run_id) return;
  if (!handoff.sse_run_status_sequence.includes(summary.status)) {
    handoff.sse_run_status_sequence.push(summary.status);
  }
  if (!TERMINAL_RUN_STATUSES.has(summary.status)) return;
  handoff.timeline_terminal_status = summary.status;
  handoff.timeline_terminal_failed = FAILURE_RUN_STATUSES.has(summary.status);
  handoff.timeline_failure_category = summary.failure_category || null;
  handoff.timeline_failure_summary = summary.failure_summary || null;
}

function applyRunStatusToDirectConnectorProbe(probe, summary) {
  if (!summary?.status) return;
  if (summary.run_id && probe.run_id && summary.run_id !== probe.run_id) return;
  if (!probe.sse_run_status_sequence.includes(summary.status)) {
    probe.sse_run_status_sequence.push(summary.status);
  }
  if (!TERMINAL_RUN_STATUSES.has(summary.status)) return;
  probe.timeline_terminal_status = summary.status;
  probe.timeline_terminal_failed = FAILURE_RUN_STATUSES.has(summary.status);
  probe.timeline_failure_category = summary.failure_category || null;
  probe.timeline_failure_summary = summary.failure_summary || null;
}

function redactText(value, token) {
  return String(value || '')
    .replaceAll(token, '[redacted-token]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer [redacted]')
    .replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, '[jwt-redacted]');
}

function directConnectorDiagnosticPrompt() {
  return [
    'Read-only diagnostic.',
    'If the Chat runtime exposes connector tools, use a read-only Gmail inbox connector tool to fetch at most one inbox item.',
    'Do not send, draft, delete, post, schedule, or mutate anything.',
    'Do not quote any email subject, sender, body, identifier, or private content.',
    'Reply only with: DIRECT_CONNECTOR_PROBE_DONE tool_used=yes|no reason=<short generic reason>.'
  ].join(' ');
}

function toolSignalSummary(value) {
  if (!value || typeof value !== 'object') return null;
  const kind = String(value.kind || value.role || value.type || '').toLowerCase();
  const payload = value.payload && typeof value.payload === 'object' ? value.payload : {};
  const message = value.message && typeof value.message === 'object' ? value.message : {};
  const capabilityId =
    value.capability_id ||
    value.capabilityId ||
    payload.capability_id ||
    payload.capabilityId ||
    message.capability_id ||
    message.capabilityId ||
    '';
  const toolName =
    value.tool_name ||
    value.toolName ||
    value.tool ||
    payload.tool_name ||
    payload.toolName ||
    payload.tool ||
    message.tool_name ||
    message.toolName ||
    message.tool ||
    '';
  const invocationId =
    value.invocation_id ||
    value.invocationId ||
    payload.invocation_id ||
    payload.invocationId ||
    message.invocation_id ||
    message.invocationId ||
    '';
  const status = messageStatus(value) || messageStatus(payload) || messageStatus(message);
  if (!kind.includes('tool') && !capabilityId && !toolName && !invocationId) return null;
  return {
    kind,
    status,
    capability_id: String(capabilityId || ''),
    tool_name: String(toolName || '')
  };
}

function collectToolActivitySignals(value, signals = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectToolActivitySignals(item, signals);
    return signals;
  }
  if (!value || typeof value !== 'object') return signals;
  const summary = toolSignalSummary(value);
  if (summary) signals.push(summary);
  for (const child of Object.values(value)) {
    collectToolActivitySignals(child, signals);
  }
  return signals;
}

function isConnectorToolSignal(signal) {
  const text = `${signal?.kind || ''} ${signal?.capability_id || ''} ${signal?.tool_name || ''}`;
  return /connector|composio|gmail|googlecalendar|googledrive|notion|slack|github/i.test(text);
}

function connectorReadProbes() {
  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  return [
    {
      id: 'gmail',
      toolkit: 'gmail',
      tool: 'GMAIL_FETCH_EMAILS',
      arguments: { max_results: 3, query: 'in:inbox' }
    },
    {
      id: 'calendar',
      toolkit: 'googlecalendar',
      tool: 'GOOGLECALENDAR_EVENTS_LIST',
      arguments: {
        calendarId: 'primary',
        maxResults: 3,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime'
      }
    },
    {
      id: 'drive',
      toolkit: 'googledrive',
      tool: 'GOOGLEDRIVE_LIST_FILES',
      arguments: {
        page_size: 3,
        order_by: 'modifiedTime desc',
        fields: 'files(id,name,mimeType,modifiedTime,webViewLink,iconLink)'
      }
    },
    {
      id: 'notion',
      toolkit: 'notion',
      tool: 'NOTION_SEARCH_NOTION_PAGE',
      arguments: { query: '', page_size: 3 }
    },
    {
      id: 'github',
      toolkit: 'github',
      tool: 'GITHUB_LIST_NOTIFICATIONS_FOR_THE_AUTHENTICATED_USER',
      arguments: { per_page: 3, all: false }
    },
    {
      id: 'slack',
      toolkit: 'slack',
      tool: 'SLACK_SEARCH_MESSAGES',
      arguments: { query: SLACK_BLOCKER_QUERY, count: 3, sort: 'timestamp' }
    }
  ];
}

function evaluateProbe(result) {
  const checks = [];
  const warnings = [];
  const check = (name, pass, detail = {}) => {
    checks.push({ name, pass: Boolean(pass), detail });
  };
  const warn = (name, detail = {}) => {
    warnings.push({ name, detail });
  };

  check('sidecar became healthy', result.healthy);
  check('LLM providers route serves', result.route_status.providers === 200, {
    status: result.route_status.providers ?? null
  });
  check(
    'active LLM provider is configured',
    Boolean(result.llm?.active?.provider_id && result.llm?.active_provider),
    {
      active: result.llm?.active || null,
      active_provider: result.llm?.active_provider || null
    }
  );
  if (result.llm?.active_provider?.can_list_models) {
    check(
      'LLM model catalog is live',
      result.llm?.models?.ok === true && result.llm.models.count > 0,
      {
        status: result.route_status.models ?? null,
        count: result.llm?.models?.count ?? null,
        message: result.llm?.models?.message || ''
      }
    );
  } else {
    warn('active LLM provider does not advertise model-list support', {
      active_provider: result.llm?.active_provider?.id || null
    });
  }
  for (const route of ['extensions', 'registry', 'channels', 'automations']) {
    check(`${route} route serves`, result.route_status[route] === 200, {
      status: result.route_status[route] ?? null
    });
  }

  if (result.connectors?.skipped) {
    warn('connector reads skipped by flag');
  } else {
    const hasComposioEnv = Boolean(process.env.COMPOSIO_API_KEY);
    if (hasComposioEnv) {
      check(
        'Composio setup accepts provided credential',
        result.connectors?.composio_configure?.status === 200 &&
          result.connectors?.composio_configure?.phase === 'active',
        result.connectors?.composio_configure || {}
      );
    } else {
      warn('COMPOSIO_API_KEY not present; connector-read checks are best-effort');
    }

    const connected = result.connectors?.connected;
    const connectedOk = connected?.status === 200 && connected.count > 0;
    if (hasComposioEnv || connectedOk) {
      check('connector accounts route returns live accounts', connectedOk, connected || {});
    }

    if (connectedOk) {
      const toolkits = new Set(connected.toolkits || []);
      const missingToolkits = EXPECTED_CONNECTOR_TOOLKITS.filter(
        (toolkit) => !toolkits.has(toolkit)
      );
      check('expected Workbench connector toolkits are available', missingToolkits.length === 0, {
        toolkits: connected.toolkits || [],
        missing: missingToolkits
      });

      const readyFamilies = new Set(
        (result.workbench?.connector_families || []).map((family) => family.id).filter(Boolean)
      );
      const missingFamilies = EXPECTED_WORKBENCH_SOURCE_FAMILIES.filter(
        (family) => !readyFamilies.has(family)
      );
      check(
        'Workbench source status reflects live connector families',
        missingFamilies.length === 0 &&
          /ready via Composio/.test(result.workbench?.live_source_status || ''),
        {
          families: [...readyFamilies],
          missing: missingFamilies,
          live_source_status: result.workbench?.live_source_status || ''
        }
      );

      for (const probe of connectorReadProbes()) {
        const summary = result.connectors?.reads?.[probe.id];
        check(
          `${probe.id} connector read succeeds`,
          summary?.status === 200 &&
            summary?.successful === true &&
            summary?.has_data === true &&
            summary?.error_present === false,
          summary || {}
        );
      }

      check(
        'connector read route rejects mutating send tools',
        result.connectors?.read_route_write_gate?.rejected === true,
        result.connectors?.read_route_write_gate || {}
      );

      check(
        'connector write route rejects send tools without send capability',
        result.connectors?.write_route_send_gate?.rejected === true,
        result.connectors?.write_route_send_gate || {}
      );
    }
  }

  const handoff = result.workbench?.chat_handoff;
  if (handoff?.skipped) {
    warn('Workbench Ask chat handoff skipped by flag');
  } else {
    check('Workbench Ask creates a real Chat thread', handoff?.thread_status === 200, {
      status: handoff?.thread_status ?? null,
      thread_id_returned: Boolean(handoff?.thread_id_returned)
    });
    check(
      'Workbench Ask message is accepted by the Chat runtime',
      handoff?.send_status === 200 && handoff?.send_accepted === true,
      {
        status: handoff?.send_status ?? null,
        outcome: handoff?.send_outcome || null,
        has_run_id: Boolean(handoff?.has_run_id)
      }
    );
    check(
      'Workbench Ask lands in the registered Chat timeline',
      handoff?.timeline_status === 200 && handoff?.timeline_has_workbench_request === true,
      {
        status: handoff?.timeline_status ?? null,
        attempts: handoff?.timeline_attempts ?? null,
        message_count: handoff?.timeline_message_count ?? null
      }
    );
    check(
      'Workbench Ask timeline preserves live source status',
      handoff?.timeline_has_live_source_status === true &&
        handoff?.observed_ready_family_count === handoff?.expected_ready_family_count,
      {
        expected_ready_family_count: handoff?.expected_ready_family_count ?? null,
        observed_ready_family_count: handoff?.observed_ready_family_count ?? null,
        live_source_status: result.workbench?.live_source_status || ''
      }
    );
    check(
      'Workbench Ask timeline preserves live connector rows packet',
      handoff?.expected_live_source_packet !== true ||
        handoff?.timeline_has_live_source_packet === true,
      {
        expected_packet: Boolean(handoff?.expected_live_source_packet),
        packet_seen: Boolean(handoff?.timeline_has_live_source_packet),
        row_counts:
          handoff?.live_source_data_counts || result.workbench?.live_source_data_counts || {}
      }
    );
    check(
      'Workbench Ask receives a terminal assistant result',
      handoff?.timeline_has_assistant_reply === true && handoff?.timeline_terminal_failed !== true,
      {
        attempts: handoff?.timeline_attempts ?? null,
        terminal_status: handoff?.timeline_terminal_status || null,
        failure_category: handoff?.timeline_failure_category || null,
        failure_summary: handoff?.timeline_failure_summary || null,
        assistant_reply_seen: Boolean(handoff?.timeline_has_assistant_reply)
      }
    );
  }

  const directConnector = result.workbench?.direct_connector_chat;
  if (directConnector && !directConnector.skipped) {
    check(
      'Direct Chat connector probe creates a real Chat thread',
      directConnector.thread_status === 200,
      {
        status: directConnector.thread_status ?? null,
        thread_id_returned: Boolean(directConnector.thread_id_returned)
      }
    );
    check(
      'Direct Chat connector probe message is accepted',
      directConnector.send_status === 200 && directConnector.send_accepted === true,
      {
        status: directConnector.send_status ?? null,
        outcome: directConnector.send_outcome || null,
        has_run_id: Boolean(directConnector.has_run_id)
      }
    );
    check(
      'Direct Chat connector probe receives an assistant result',
      directConnector.timeline_has_assistant_reply === true &&
        directConnector.timeline_terminal_failed !== true,
      {
        attempts: directConnector.timeline_attempts ?? null,
        terminal_status: directConnector.timeline_terminal_status || null,
        assistant_reply_seen: Boolean(directConnector.timeline_has_assistant_reply)
      }
    );
    check(
      'Direct Chat connector probe response follows the privacy marker',
      directConnector.assistant_marker_seen === true,
      {
        marker_seen: Boolean(directConnector.assistant_marker_seen),
        claimed_tool_used: Boolean(directConnector.assistant_claimed_tool_used),
        claimed_tool_not_used: Boolean(directConnector.assistant_claimed_tool_not_used)
      }
    );
    const directConnectorToolObserved =
      directConnector.tool_activity_seen === true ||
      directConnector.assistant_claimed_tool_used === true;
    const directConnectorDetail = {
      required: Boolean(directConnector.required),
      tool_activity_seen: Boolean(directConnector.tool_activity_seen),
      assistant_claimed_tool_used: Boolean(directConnector.assistant_claimed_tool_used),
      assistant_claimed_tool_not_used: Boolean(directConnector.assistant_claimed_tool_not_used),
      tool_signal_count: directConnector.tool_signal_count ?? null
    };
    if (directConnector.required) {
      check(
        'Direct Chat can invoke a read-only connector tool',
        directConnectorToolObserved,
        directConnectorDetail
      );
    } else if (!directConnectorToolObserved) {
      warn('Direct Chat connector tool invocation not observed', directConnectorDetail);
    }
  }

  const failed = checks.filter((entry) => !entry.pass);
  const verdict = failed.length > 0 ? 'FAIL' : warnings.length > 0 ? 'WARN' : 'PASS';
  return { verdict, checks, warnings };
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const port = await freePort();
  const token = `workbench-live-${randomUUID()}`;
  const origin = `http://127.0.0.1:${port}`;
  const log = [];
  const backendEnv = llmBackendEnv(llmBackend);
  const probeRebornHome = await prepareProbeRebornHome(llmBackend);
  const connectorReadRowsById = {};
  const child = spawn(binary, ['serve', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...backendEnv,
      ...probeRebornHome.env,
      IRONCLAW_REBORN_WEBUI_TOKEN: token,
      IRONCLAW_REBORN_WEBUI_USER_ID: 'owner',
      GATEWAY_AUTH_TOKEN: token,
      GATEWAY_HOST: '127.0.0.1',
      GATEWAY_PORT: String(port),
      DATABASE_BACKEND: 'libsql',
      GATEWAY_ENABLED: 'true',
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
    requested_llm_backend: llmBackend,
    probe_reborn_home: probeRebornHome.report,
    healthy: false,
    llm: null,
    extensions: [],
    registry: [],
    channels: null,
    automations: null,
    connectors: {
      skipped: skipConnectorReads,
      composio_configure: null,
      connected: null,
      reads: {},
      read_row_counts: {},
      read_route_write_gate: null,
      write_route_send_gate: null
    },
    workbench: {
      connector_families: [],
      live_source_status: '',
      live_source_data_counts: {},
      chat_handoff: {
        skipped: skipChatHandoff
      },
      direct_connector_chat: {
        skipped: !probeDirectConnectorChat,
        required: requireDirectConnectorChat
      }
    },
    verdict: 'PENDING',
    checks: [],
    warnings: [],
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
      active_provider: providerSummary(activeProvider),
      providers: providerList.map(providerSummary)
    };
    if (activeProvider?.can_list_models) {
      const models = await request('POST', '/api/webchat/v2/llm/list-models', {
        provider_id: activeProvider.id,
        adapter: activeProvider.adapter || activeProvider.id
      });
      result.route_status.models = models.status;
      result.llm.models = {
        ok: models.body?.ok === true,
        count: Array.isArray(models.body?.models) ? models.body.models.length : 0,
        sample: Array.isArray(models.body?.models) ? models.body.models.slice(0, 20) : [],
        message: models.body?.message || models.body?.error || ''
      };
    } else if (activeProvider) {
      result.llm.models = {
        ok: null,
        count: null,
        sample: [],
        message: 'active provider does not advertise model-list support'
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
      const setup = await request(
        'GET',
        `/api/webchat/v2/extensions/${encodeURIComponent(id)}/setup`
      );
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

    if (!skipConnectorReads) {
      if (process.env.COMPOSIO_API_KEY) {
        const configured = await request('POST', '/api/webchat/v2/extensions/composio/setup', {
          action: 'configure',
          payload: {
            secrets: {
              composio_api_key: process.env.COMPOSIO_API_KEY
            }
          }
        });
        result.connectors.composio_configure = {
          status: configured.status,
          phase: configured.body?.phase || null,
          configured_from_env: true
        };
      }

      const connected = await request('GET', '/api/webchat/v2/connectors/connected');
      result.route_status.connectors_connected = connected.status;
      const accounts = Array.isArray(connected.body?.accounts) ? connected.body.accounts : [];
      const toolkits = [
        ...new Set(
          accounts
            .map((account) => account?.toolkit || account?.provider || account?.type)
            .filter(Boolean)
        )
      ].sort();
      result.connectors.connected = {
        status: connected.status,
        count: accounts.length,
        toolkits
      };
      result.workbench.connector_families = connectorFamilyReadiness(connected.body).map(
        (family) => ({
          id: family.id,
          label: family.label,
          state: family.state,
          statusLabel: family.statusLabel,
          via: family.via
        })
      );
      result.workbench.live_source_status = buildWorkbenchLiveSourceStatus({
        connectorFamilies: result.workbench.connector_families
      });

      if (connected.ok && accounts.length > 0) {
        for (const probe of connectorReadProbes()) {
          const response = await request('POST', '/api/webchat/v2/connectors/read', {
            toolkit: probe.toolkit,
            tool: probe.tool,
            arguments: probe.arguments
          });
          result.connectors.reads[probe.id] = connectorReadSummary(response);
          connectorReadRowsById[probe.id] = connectorReadRows(probe.id, response);
          result.connectors.read_row_counts[probe.id] = connectorReadRowsById[probe.id].length;
        }

        const writeGate = await request('POST', '/api/webchat/v2/connectors/read', {
          toolkit: 'gmail',
          tool: 'GMAIL_SEND_EMAIL',
          arguments: {
            to: 'nobody@example.invalid',
            subject: 'blocked smoke',
            body: 'blocked'
          }
        });
        result.connectors.read_route_write_gate = {
          status: writeGate.status,
          rejected: writeGate.status >= 400 && writeGate.status < 500
        };

        const sendGate = await request('POST', '/api/webchat/v2/connectors/write', {
          toolkit: 'gmail',
          tool: 'GMAIL_SEND_EMAIL',
          arguments: {
            to: 'nobody@example.invalid',
            subject: 'blocked smoke',
            body: 'blocked'
          }
        });
        result.connectors.write_route_send_gate = {
          status: sendGate.status,
          rejected: sendGate.status >= 400 && sendGate.status < 500
        };
      }
    }

    if (!skipChatHandoff) {
      const readyFamilies = (result.workbench.connector_families || []).filter(
        (family) => family?.state === 'ready'
      );
      const liveSourceData = liveSourceDataFromRows(connectorReadRowsById);
      const liveSourcePacket = buildWorkbenchLiveSourcePacket(liveSourceData);
      result.workbench.live_source_data_counts = liveSourceDataCounts(liveSourceData);
      const activeModel =
        result.llm?.active?.model ||
        result.llm?.active?.model_id ||
        result.llm?.active?.default_model ||
        'auto';
      const liveSourceStatus =
        result.workbench.live_source_status ||
        buildWorkbenchLiveSourceStatus({
          connectorFamilies: result.workbench.connector_families
        });
      const handoffBrief =
        'Non-mutating Workbench live wiring probe. Confirm that this request reached the live Chat runtime. Do not read connectors, send, post, file, schedule, or change external systems.';
      const draft = buildWorkbenchChatDraft({
        brief: handoffBrief,
        modelId: activeModel,
        modelLabel: activeModel,
        effort: 'standard',
        sourceMode: 'manual',
        sourceIds: [],
        cadence: '',
        connectorFamilies: result.workbench.connector_families,
        liveSourceData
      });
      const requestedThreadId = `workbench-live-handoff-${randomUUID()}`;
      const thread = await request('POST', '/api/webchat/v2/threads', {
        client_action_id: `workbench-live-handoff-thread-${stamp}`,
        requested_thread_id: requestedThreadId
      });
      const threadId =
        thread.body?.thread_id || thread.body?.thread?.thread_id || requestedThreadId;
      const handoff = {
        skipped: false,
        thread_status: thread.status,
        thread_id_returned: Boolean(thread.body?.thread_id || thread.body?.thread?.thread_id),
        send_status: null,
        send_accepted: false,
        send_outcome: null,
        run_id: null,
        event_stream_status: null,
        event_stream_error: null,
        sse_run_status_sequence: [],
        has_run_id: false,
        timeline_status: null,
        timeline_attempts: 0,
        timeline_max_attempts: chatMaxAttempts,
        timeline_poll_ms: chatPollMs,
        timeline_message_count: 0,
        timeline_has_workbench_request: false,
        timeline_has_live_source_status: false,
        timeline_has_assistant_reply: false,
        timeline_terminal_status: null,
        timeline_terminal_failed: false,
        timeline_failure_category: null,
        timeline_failure_summary: null,
        expected_ready_family_count: readyFamilies.length,
        observed_ready_family_count: 0,
        observed_ready_families: [],
        expected_live_source_packet: Boolean(liveSourcePacket),
        timeline_has_live_source_packet: false,
        live_source_data_counts: result.workbench.live_source_data_counts,
        draft_preview: {
          has_workbench_request_header: draft.includes('Workbench request'),
          live_source_status: liveSourceStatus,
          has_live_source_packet: Boolean(liveSourcePacket)
        }
      };
      let runStatusStream = null;

      if (thread.ok) {
        runStatusStream = startRunStatusStream({
          origin,
          token,
          threadId,
          onStatus: (summary) => applyRunStatusToHandoff(handoff, summary)
        });
        const send = await request(
          'POST',
          `/api/webchat/v2/threads/${encodeURIComponent(threadId)}/messages`,
          {
            client_action_id: `workbench-live-handoff-message-${stamp}`,
            content: draft
          }
        );
        handoff.send_status = send.status;
        handoff.send_outcome = send.body?.outcome || null;
        handoff.run_id = send.body?.run_id || send.body?.run?.run_id || null;
        handoff.has_run_id = Boolean(handoff.run_id);
        handoff.send_accepted =
          send.ok &&
          (Boolean(send.body?.accepted_message_ref) ||
            Boolean(send.body?.message_id) ||
            Boolean(send.body?.turn_id) ||
            Boolean(send.body?.run_id) ||
            send.body?.outcome === 'submitted' ||
            send.body?.outcome === 'accepted');

        if (send.ok) {
          for (let attempt = 1; attempt <= chatMaxAttempts; attempt += 1) {
            await delay(chatPollMs);
            const timeline = await request(
              'GET',
              `/api/webchat/v2/threads/${encodeURIComponent(threadId)}/timeline?limit=20`
            );
            handoff.timeline_status = timeline.status;
            handoff.timeline_attempts = attempt;
            const messages = timelineMessages(timeline.body);
            handoff.timeline_message_count = messages.length;
            const userText = messages
              .filter((message) => {
                const kind = messageKind(message);
                return kind === 'user' || kind === 'user_message';
              })
              .map(messageContent)
              .join('\n');
            const assistantText = messages
              .filter((message) => {
                const kind = messageKind(message);
                return kind === 'assistant' || kind === 'assistant_message';
              })
              .map(messageContent)
              .join('\n');
            handoff.timeline_has_assistant_reply = assistantText.trim().length > 0;
            handoff.timeline_has_workbench_request =
              userText.includes('Workbench request') && userText.includes(handoffBrief);
            handoff.timeline_has_live_source_status =
              userText.includes('- Live source status:') && userText.includes(liveSourceStatus);
            handoff.timeline_has_live_source_packet =
              !liveSourcePacket ||
              (userText.includes('Live connector rows already loaded in Workbench:') &&
                userText.includes('Use this packet as current context.'));
            const terminalFromTimeline = timelineRunStatuses(timeline.body, messages).find((item) =>
              TERMINAL_RUN_STATUSES.has(item.status)
            );
            if (terminalFromTimeline && !handoff.timeline_terminal_status) {
              handoff.timeline_terminal_status = terminalFromTimeline.status;
              handoff.timeline_terminal_failed = FAILURE_RUN_STATUSES.has(
                terminalFromTimeline.status
              );
              handoff.timeline_failure_category = terminalFromTimeline.failure_category || null;
              handoff.timeline_failure_summary = terminalFromTimeline.failure_summary || null;
            }
            handoff.observed_ready_families = readyFamilies
              .map((family) => family.id)
              .filter((id) => {
                const label = readyFamilies.find((family) => family.id === id)?.label || id || '';
                return userText.includes(label);
              });
            handoff.observed_ready_family_count = handoff.observed_ready_families.length;
            if (
              handoff.timeline_has_workbench_request &&
              handoff.timeline_has_live_source_status &&
              handoff.timeline_has_live_source_packet &&
              (handoff.timeline_has_assistant_reply || handoff.timeline_terminal_status)
            ) {
              break;
            }
          }
        }
      }
      await stopRunStatusStream(runStatusStream);
      if (runStatusStream) {
        handoff.event_stream_status = runStatusStream.status;
        handoff.event_stream_error = runStatusStream.error;
      }
      result.workbench.chat_handoff = handoff;
    }

    if (probeDirectConnectorChat) {
      const requestedThreadId = `workbench-direct-connector-${randomUUID()}`;
      const thread = await request('POST', '/api/webchat/v2/threads', {
        client_action_id: `workbench-direct-connector-thread-${stamp}`,
        requested_thread_id: requestedThreadId
      });
      const threadId =
        thread.body?.thread_id || thread.body?.thread?.thread_id || requestedThreadId;
      const directConnector = {
        skipped: false,
        required: requireDirectConnectorChat,
        thread_status: thread.status,
        thread_id_returned: Boolean(thread.body?.thread_id || thread.body?.thread?.thread_id),
        send_status: null,
        send_accepted: false,
        send_outcome: null,
        run_id: null,
        event_stream_status: null,
        event_stream_error: null,
        sse_run_status_sequence: [],
        has_run_id: false,
        timeline_status: null,
        timeline_attempts: 0,
        timeline_max_attempts: chatMaxAttempts,
        timeline_poll_ms: chatPollMs,
        timeline_message_count: 0,
        timeline_has_assistant_reply: false,
        timeline_terminal_status: null,
        timeline_terminal_failed: false,
        timeline_failure_category: null,
        timeline_failure_summary: null,
        assistant_marker_seen: false,
        assistant_claimed_tool_used: false,
        assistant_claimed_tool_not_used: false,
        tool_activity_seen: false,
        tool_signal_count: 0,
        tool_signals: []
      };
      let runStatusStream = null;

      if (thread.ok) {
        runStatusStream = startRunStatusStream({
          origin,
          token,
          threadId,
          onStatus: (summary) => applyRunStatusToDirectConnectorProbe(directConnector, summary)
        });
        const send = await request(
          'POST',
          `/api/webchat/v2/threads/${encodeURIComponent(threadId)}/messages`,
          {
            client_action_id: `workbench-direct-connector-message-${stamp}`,
            content: directConnectorDiagnosticPrompt()
          }
        );
        directConnector.send_status = send.status;
        directConnector.send_outcome = send.body?.outcome || null;
        directConnector.run_id = send.body?.run_id || send.body?.run?.run_id || null;
        directConnector.has_run_id = Boolean(directConnector.run_id);
        directConnector.send_accepted =
          send.ok &&
          (Boolean(send.body?.accepted_message_ref) ||
            Boolean(send.body?.message_id) ||
            Boolean(send.body?.turn_id) ||
            Boolean(send.body?.run_id) ||
            send.body?.outcome === 'submitted' ||
            send.body?.outcome === 'accepted');

        if (send.ok) {
          for (let attempt = 1; attempt <= chatMaxAttempts; attempt += 1) {
            await delay(chatPollMs);
            const timeline = await request(
              'GET',
              `/api/webchat/v2/threads/${encodeURIComponent(threadId)}/timeline?limit=80`
            );
            directConnector.timeline_status = timeline.status;
            directConnector.timeline_attempts = attempt;
            const messages = timelineMessages(timeline.body);
            directConnector.timeline_message_count = messages.length;
            const assistantText = messages
              .filter((message) => {
                const kind = messageKind(message);
                return kind === 'assistant' || kind === 'assistant_message';
              })
              .map(messageContent)
              .join('\n');
            directConnector.timeline_has_assistant_reply = assistantText.trim().length > 0;
            directConnector.assistant_marker_seen =
              directConnector.assistant_marker_seen ||
              assistantText.includes('DIRECT_CONNECTOR_PROBE_DONE');
            directConnector.assistant_claimed_tool_used =
              directConnector.assistant_claimed_tool_used ||
              /tool_used\s*=\s*yes/i.test(assistantText);
            directConnector.assistant_claimed_tool_not_used =
              directConnector.assistant_claimed_tool_not_used ||
              /tool_used\s*=\s*no/i.test(assistantText);
            const signals = collectToolActivitySignals(timeline.body)
              .filter(isConnectorToolSignal)
              .slice(0, 20);
            directConnector.tool_signal_count = signals.length;
            directConnector.tool_signals = signals;
            directConnector.tool_activity_seen = signals.length > 0;
            const terminalFromTimeline = timelineRunStatuses(timeline.body, messages).find((item) =>
              TERMINAL_RUN_STATUSES.has(item.status)
            );
            if (terminalFromTimeline && !directConnector.timeline_terminal_status) {
              directConnector.timeline_terminal_status = terminalFromTimeline.status;
              directConnector.timeline_terminal_failed = FAILURE_RUN_STATUSES.has(
                terminalFromTimeline.status
              );
              directConnector.timeline_failure_category =
                terminalFromTimeline.failure_category || null;
              directConnector.timeline_failure_summary =
                terminalFromTimeline.failure_summary || null;
            }
            if (
              directConnector.timeline_has_assistant_reply ||
              directConnector.timeline_terminal_status
            ) {
              break;
            }
          }
        }
      }
      await stopRunStatusStream(runStatusStream);
      if (runStatusStream) {
        directConnector.event_stream_status = runStatusStream.status;
        directConnector.event_stream_error = runStatusStream.error;
      }
      result.workbench.direct_connector_chat = directConnector;
    }
  } finally {
    try {
      result.log_tail = log
        .join('')
        .split('\n')
        .filter(Boolean)
        .slice(-40)
        .map((line) => redactText(line, token));
      const evaluation = evaluateProbe(result);
      result.verdict = evaluation.verdict;
      result.checks = evaluation.checks;
      result.warnings = evaluation.warnings;
      await writeFile(path.join(outDir, 'probe.json'), JSON.stringify(result, null, 2));
    } finally {
      child.kill('SIGTERM');
      await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(1000)]);
      await probeRebornHome.cleanup();
    }
  }

  const output = JSON.stringify(result, null, 2);
  if (result.verdict === 'FAIL') {
    process.exitCode = 1;
  }
  if (jsonOnly) {
    console.log(output);
    return;
  }

  console.log(output);
  console.log(`\nWrote live Workbench wiring probe to ${path.join(outDir, 'probe.json')}`);
  console.log(`Workbench live wiring verdict: ${result.verdict}`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
