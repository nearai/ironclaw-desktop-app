#!/usr/bin/env node
// Acceptance gate for a candidate ironclaw-reborn binary before we bundle it.
//
// Spawns the GIVEN binary (arg 1, or $CANDIDATE_SIDECAR) on a temp port with
// the same hermetic env the desktop uses, then checks every WebChat v2
// contract our static UI depends on — plus the specific risks in recent
// nearai/ironclaw mainline changes:
//   * #4623 CSRF/origin/CORS limits   -> our WebView requests must still pass
//   * #4624 sanitized error shapes     -> error envelope still { code, message }
//   * #4552/#4546 SSE projection path  -> run_status events still stream
//   * #5057 filesystem browser         -> /fs/mounts serves workspace+memory
//   * delivery defaults + Trace credits -> outbound/* and traces/credit serve
//   * operator logs query             -> /operator/logs serves scoped logs
//   * additive routes we want to gain  -> automations/runs, projects/*
//   * Slack admin-managed invariant    -> channels/slack/* serve if advertised
//
// Exit 0 = safe to swap. Non-zero = contract drift; do NOT swap.
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const candidate =
  process.argv[2] ||
  process.env.CANDIDATE_SIDECAR ||
  '/tmp/ironclaw-main-target/release/ironclaw-reborn';
const artifactDir = path.join(repoRoot, 'output/new-sidecar-acceptance');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
export const SLACK_ADMIN_MANAGED_CHECK_NAME =
  'Slack admin-managed capability is backed by allowed-channel and subject routes';
export const OUTBOUND_DELIVERY_CHECK_NAME =
  'Outbound delivery routes expose preferences and target shapes used by automations';

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function slackConnectStrategy(channel) {
  return channel?.strategy || channel?.action?.strategy || '';
}

export function evaluateSlackAdminManagedRoutes({ connectable, allowed, subjects } = {}) {
  const connectableChannels = Array.isArray(connectable?.body?.channels)
    ? connectable.body.channels
    : [];
  const advertised = connectableChannels.some(
    (channel) =>
      channel?.channel === 'slack' && slackConnectStrategy(channel) === 'admin_managed_channels'
  );
  const allowedServes = allowed?.res?.ok && Array.isArray(allowed?.body?.channels);
  const subjectsServes = subjects?.res?.ok && Array.isArray(subjects?.body?.subjects);
  return {
    name: SLACK_ADMIN_MANAGED_CHECK_NAME,
    pass: !advertised || (allowedServes && subjectsServes),
    detail: {
      advertised,
      allowed_status: allowed?.res?.status ?? null,
      subjects_status: subjects?.res?.status ?? null
    }
  };
}

export function evaluateOutboundDeliveryRoutes({ preferences, targets } = {}) {
  const preferencesBody = preferences?.body;
  const finalReplyTarget = preferencesBody?.final_reply_target;
  const preferencesServes = preferences?.res?.ok && isRecord(preferencesBody);
  const hasFinalReplyTarget =
    preferencesServes &&
    Object.prototype.hasOwnProperty.call(preferencesBody, 'final_reply_target');
  const hasFinalReplyTargetStatus =
    preferencesServes &&
    Object.prototype.hasOwnProperty.call(preferencesBody, 'final_reply_target_status');
  const finalReplyTargetStatus = preferencesBody?.final_reply_target_status;
  const finalReplyTargetShape =
    (hasFinalReplyTarget && (finalReplyTarget === null || isRecord(finalReplyTarget))) ||
    (!hasFinalReplyTarget && finalReplyTargetStatus === 'none_configured');
  const finalReplyTargetStatusShape =
    hasFinalReplyTargetStatus &&
    typeof finalReplyTargetStatus === 'string' &&
    finalReplyTargetStatus.length > 0;
  const targetsServes = targets?.res?.ok && Array.isArray(targets?.body?.targets);
  return {
    name: OUTBOUND_DELIVERY_CHECK_NAME,
    pass:
      preferencesServes && finalReplyTargetShape && finalReplyTargetStatusShape && targetsServes,
    detail: {
      preferences_status: preferences?.res?.status ?? null,
      targets_status: targets?.res?.status ?? null,
      has_final_reply_target: Boolean(hasFinalReplyTarget),
      has_final_reply_target_status: Boolean(hasFinalReplyTargetStatus),
      final_reply_target_defaulted: Boolean(
        preferencesServes && !hasFinalReplyTarget && finalReplyTargetStatus === 'none_configured'
      ),
      targets_count: Array.isArray(targets?.body?.targets) ? targets.body.targets.length : null
    }
  };
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

// Mirror src-tauri/src/sidecar.rs: clear ambient provider vars, NEAR.AI block.
// Unauthenticated NEAR.AI mode deliberately leaves NEARAI_* endpoint vars unset:
// Reborn aborts if NEARAI_BASE_URL is present without a matching credential.
function hermeticEnv(extra) {
  const base = Object.fromEntries(
    Object.entries(process.env).filter(
      ([k]) => !/^(ANTHROPIC_|OPENAI_|OPENROUTER_|NEARAI_|LLM_)/.test(k)
    )
  );
  return {
    ...base,
    LLM_BACKEND: 'nearai',
    NEARAI_MODEL: 'auto',
    IRONCLAW_DESKTOP_NEARAI_AUTH_CONFIGURED: 'false',
    IRONCLAW_DESKTOP_MODEL_READINESS_REASON:
      'NEAR.AI Cloud is selected; execution readiness will be verified by the first WebChat run.',
    ...extra
  };
}

async function main() {
  await mkdir(artifactDir, { recursive: true });
  const home = await mkdtemp(path.join(os.tmpdir(), 'ironclaw-accept-'));
  const token = `accept-${randomUUID()}`;
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const checks = [];
  const log = [];
  const check = (name, pass, detail = {}) => {
    checks.push({ name, pass: Boolean(pass), detail });
  };

  const child = spawn(candidate, ['serve', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: repoRoot,
    env: hermeticEnv({
      HOME: home,
      IRONCLAW_REBORN_WEBUI_TOKEN: token,
      IRONCLAW_REBORN_WEBUI_USER_ID: 'owner',
      RUST_LOG: 'warn'
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (c) => log.push(c.toString()));
  child.stderr.on('data', (c) => log.push(c.toString()));

  const api = async (method, pathname, options = {}) => {
    const hasEnvelope =
      Object.prototype.hasOwnProperty.call(options, 'body') ||
      Object.prototype.hasOwnProperty.call(options, 'headers');
    const body = hasEnvelope ? options.body : method === 'GET' ? undefined : options;
    const headers = hasEnvelope ? options.headers : undefined;
    const res = await fetch(`${origin}${pathname}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...headers
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    let parsed = null;
    try {
      parsed = await res.json();
    } catch (_) {
      /* non-JSON */
    }
    return { res, body: parsed };
  };

  try {
    // Readiness.
    let healthy = false;
    for (let i = 0; i < 120; i += 1) {
      if (child.exitCode != null) throw new Error(`sidecar exited early code ${child.exitCode}`);
      try {
        const r = await fetch(`${origin}/api/webchat/v2/threads`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (r.ok) {
          healthy = true;
          break;
        }
      } catch (_) {
        /* booting */
      }
      await delay(500);
    }
    check('sidecar boots and serves authed /threads', healthy);
    if (!healthy) throw new Error('sidecar did not become healthy');

    // CORS / origin (#4623): the WebView sends requests that the desktop's
    // tauri http path delivers; the most representative is a bearer request
    // with NO browser Origin, and one with the tauri origin. Both must pass.
    const noOrigin = await api('GET', '/api/webchat/v2/threads');
    check('accepts bearer request with no Origin header', noOrigin.res.ok, {
      status: noOrigin.res.status
    });
    const tauriOrigin = await api('GET', '/api/webchat/v2/threads', {
      headers: { Origin: 'tauri://localhost' }
    });
    check('accepts request with tauri:// Origin', tauriOrigin.res.ok, {
      status: tauriOrigin.res.status
    });
    const localhostOrigin = await api('GET', '/api/webchat/v2/threads', {
      headers: { Origin: `http://localhost:${port}` }
    });
    check('accepts request with http://localhost Origin', localhostOrigin.res.ok, {
      status: localhostOrigin.res.status
    });

    // Auth failure (#4624): unauthorized must stay generic/sanitized. Upstream
    // currently allows an empty 401 body here; wrong-token route tests pin the
    // fixed string "Invalid or missing auth token". JSON envelopes are also OK
    // for older/newer handler layers as long as they do not leak secrets.
    const unauth = await fetch(`${origin}/api/webchat/v2/threads`);
    const unauthText = await unauth.text();
    let unauthBody = null;
    try {
      unauthBody = unauthText ? JSON.parse(unauthText) : null;
    } catch (_) {
      /* */
    }
    const sanitizedUnauthBody =
      unauthText === '' ||
      unauthText === 'Invalid or missing auth token' ||
      (unauthBody && typeof unauthBody.code === 'string');
    check(
      'unauthorized returns sanitized 401 without leaking auth details',
      unauth.status === 401 &&
        sanitizedUnauthBody &&
        !unauthText.includes(token) &&
        !unauthText.includes('owner'),
      { status: unauth.status, body: unauthBody, text: unauthText }
    );

    // Thread + message + attachment contract our UI uses.
    const requestedThreadId = randomUUID();
    const thread = await api('POST', '/api/webchat/v2/threads', {
      client_action_id: `accept-thread-${timestamp}`,
      requested_thread_id: requestedThreadId
    });
    const threadId = thread.body?.thread_id || thread.body?.thread?.thread_id || requestedThreadId;
    check('create thread returns a thread id', Boolean(threadId) && thread.res.ok, {
      status: thread.res.status
    });

    const sentinelBlock =
      '\n\n<attachments ic="1">\nAttachment 1:\nfilename: ledger.csv\nmime_type: text/plain\n' +
      'size: 30\nextraction_status: extracted_text\nextracted_text_chars: 26\nextracted_text:\n---\n' +
      'item,value\nalpha,12\nbeta,34\n---\n</attachments>';
    const prompt = 'Acceptance: confirm this send is accepted and echoed.';
    const send = await api(
      'POST',
      `/api/webchat/v2/threads/${encodeURIComponent(threadId)}/messages`,
      {
        client_action_id: `accept-msg-${timestamp}`,
        content: `${prompt}${sentinelBlock}`,
        attachments: [
          {
            name: 'ledger.csv',
            mime_type: 'text/plain',
            data_base64: Buffer.from('x').toString('base64')
          }
        ]
      }
    );
    check(
      'send message with sentinel-embedded attachment is accepted',
      send.res.ok && (send.body?.outcome === 'submitted' || Boolean(send.body?.run_id)),
      { status: send.res.status, outcome: send.body?.outcome || null }
    );

    await delay(1500);
    const timeline = await api(
      'GET',
      `/api/webchat/v2/threads/${encodeURIComponent(threadId)}/timeline?limit=50`
    );
    const tlText = JSON.stringify(timeline.body || {});
    check('timeline echoes the sent prompt (projection intact)', tlText.includes(prompt), {
      status: timeline.res.status
    });
    check('timeline preserves the embedded attachment block', tlText.includes('ledger.csv'));

    // SSE projection (#4552/#4546): the events stream must still emit
    // run_status transitions the UI consumes.
    let sseStatusSeen = false;
    const sseController = new AbortController();
    const ssePromise = (async () => {
      try {
        const res = await fetch(
          `${origin}/api/webchat/v2/threads/${encodeURIComponent(threadId)}/events?token=${encodeURIComponent(token)}`,
          { headers: { Accept: 'text/event-stream' }, signal: sseController.signal }
        );
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        const deadline = Date.now() + 20000;
        while (Date.now() < deadline) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          if (/"run_status"|"status":"(queued|running|failed|completed)"/.test(buf)) {
            sseStatusSeen = true;
            break;
          }
          buf = buf.slice(-4000);
        }
      } catch (_) {
        /* aborted */
      }
    })();
    await Promise.race([ssePromise, delay(22000)]);
    sseController.abort();
    await ssePromise.catch(() => {});
    check('SSE events stream emits run_status (UI lifecycle source)', sseStatusSeen);

    // Routes we already depend on must remain.
    const servedRoutes = {};
    for (const route of [
      'llm/providers',
      'automations',
      'extensions/registry',
      'channels/connectable',
      'outbound/preferences',
      'outbound/targets',
      'traces/credit',
      'operator/logs'
    ]) {
      const r = await api('GET', `/api/webchat/v2/${route}`);
      servedRoutes[route] = r;
      check(`existing route /${route} still serves`, r.res.ok, { status: r.res.status });
    }
    const outboundCheck = evaluateOutboundDeliveryRoutes({
      preferences: servedRoutes['outbound/preferences'],
      targets: servedRoutes['outbound/targets']
    });
    check(outboundCheck.name, outboundCheck.pass, outboundCheck.detail);

    const fsMounts = await api('GET', '/api/webchat/v2/fs/mounts');
    const mountIds = Array.isArray(fsMounts.body?.mounts)
      ? fsMounts.body.mounts.map((mount) => mount?.mount).filter(Boolean)
      : [];
    check(
      'workspace filesystem mounts route serves memory + workspace',
      fsMounts.res.ok && mountIds.includes('memory') && mountIds.includes('workspace'),
      { status: fsMounts.res.status, mounts: mountIds }
    );

    const projects = await api('GET', '/api/webchat/v2/projects?limit=5');
    check(
      'project list route serves an array',
      projects.res.ok && Array.isArray(projects.body?.projects),
      {
        status: projects.res.status,
        project_count: Array.isArray(projects.body?.projects) ? projects.body.projects.length : null
      }
    );

    const projectName = `Desktop acceptance ${timestamp}`;
    const createdProject = await api('POST', '/api/webchat/v2/projects', {
      name: projectName,
      description: 'Disposable project created by desktop sidecar acceptance.',
      metadata: { source: 'ironclaw-desktop-app acceptance probe' }
    });
    const projectId = createdProject.body?.project?.project_id || '';
    check(
      'project create route returns a project id',
      createdProject.res.ok && Boolean(projectId),
      {
        status: createdProject.res.status,
        project_id: projectId || null
      }
    );
    if (projectId) {
      const projectDetail = await api(
        'GET',
        `/api/webchat/v2/projects/${encodeURIComponent(projectId)}`
      );
      check(
        'project detail route returns created project',
        projectDetail.res.ok && projectDetail.body?.project?.project_id === projectId,
        {
          status: projectDetail.res.status,
          project_id: projectDetail.body?.project?.project_id || null
        }
      );
      const projectMembers = await api(
        'GET',
        `/api/webchat/v2/projects/${encodeURIComponent(projectId)}/members`
      );
      check(
        'project members route serves an array',
        projectMembers.res.ok && Array.isArray(projectMembers.body?.members),
        {
          status: projectMembers.res.status,
          member_count: Array.isArray(projectMembers.body?.members)
            ? projectMembers.body.members.length
            : null
        }
      );
    }

    const connectable = await api('GET', '/api/webchat/v2/channels/connectable');
    const slackAllowed = await api('GET', '/api/webchat/v2/channels/slack/allowed');
    const slackSubjects = await api('GET', '/api/webchat/v2/channels/slack/subjects');
    const slackCheck = evaluateSlackAdminManagedRoutes({
      connectable,
      allowed: slackAllowed,
      subjects: slackSubjects
    });
    check(slackCheck.name, slackCheck.pass, slackCheck.detail);

    // Additive routes we WANT to gain from main (informational — not gating).
    const gained = {};
    for (const route of ['automations/runs']) {
      const r = await api('GET', `/api/webchat/v2/${route}`);
      gained[route] = r.res.status;
    }
    gained['channels/slack/allowed'] = slackAllowed.res.status;
    gained['channels/slack/subjects'] = slackSubjects.res.status;

    const required = checks.filter((c) => !c.pass);
    const verdict = required.length === 0 ? 'PASS' : 'FAIL';
    const report = {
      generated_at: new Date().toISOString(),
      candidate,
      verdict,
      checks,
      gained_routes: gained,
      sidecar_log_tail: log.join('').split('\n').slice(-15)
    };
    await writeFile(
      path.join(artifactDir, `acceptance-${timestamp}.json`),
      `${JSON.stringify(report, null, 2)}\n`
    );
    console.log(`verdict: ${verdict}`);
    for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'} - ${c.name}`);
    console.log('gained routes (want 200):', JSON.stringify(gained));
    if (verdict !== 'PASS') process.exitCode = 1;
  } catch (err) {
    console.error(err.stack || err.message || String(err));
    console.error('log tail:', log.join('').split('\n').slice(-15).join('\n'));
    process.exitCode = 1;
  } finally {
    if (child.exitCode == null) {
      child.kill('SIGTERM');
      await Promise.race([
        new Promise((r) => child.once('exit', r)),
        delay(3000).then(() => child.kill('SIGKILL'))
      ]);
    }
    await rm(home, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
