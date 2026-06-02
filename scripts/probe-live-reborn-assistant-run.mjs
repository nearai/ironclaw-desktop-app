#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const artifactDir = path.join(repoRoot, 'output/live-work-product-probe');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const artifactPath = path.join(artifactDir, `reborn-live-assistant-run-probe-${timestamp}.json`);
const defaultTokenPath = path.join(
  os.homedir(),
  'Library/Application Support/com.openclaw.ironclaw-desktop/tokens/local-gateway-token.token',
);

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

function timelineMessages(body) {
  return Array.isArray(body?.messages)
    ? body.messages
    : Array.isArray(body?.timeline)
      ? body.timeline
      : Array.isArray(body?.events)
        ? body.events
        : [];
}

function messageKind(message) {
  return String(message?.kind || message?.role || message?.message?.role || '').toLowerCase();
}

function messageContent(message) {
  return String(message?.content || message?.message?.content || message?.text || '');
}

function summarizeTimeline(body) {
  return timelineMessages(body).map((message) => ({
    message_id: message.message_id || message.id || null,
    kind: message.kind || message.role || null,
    status: message.status || null,
    turn_run_id: message.turn_run_id || null,
    content_preview: messageContent(message).slice(0, 600),
  }));
}

async function main() {
  const origin = process.env.IRONCLAW_LIVE_PROBE_ORIGIN || 'http://127.0.0.1:3000';
  const tokenPath = process.env.IRONCLAW_LIVE_PROBE_TOKEN_FILE || defaultTokenPath;
  const expectAssistant = process.env.IRONCLAW_EXPECT_ASSISTANT === '1';
  const token = (await readFile(tokenPath, 'utf8')).trim();
  if (!token) throw new Error(`empty token file: ${tokenPath}`);
  await mkdir(artifactDir, { recursive: true });

  const evidence = {
    generated_at: new Date().toISOString(),
    origin,
    token_path: tokenPath,
    bearer_token: '[REDACTED]',
    expected_assistant: expectAssistant,
    probes: [],
  };

  async function request(label, method, pathname, body = undefined) {
    const response = await fetch(`${origin}${pathname}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const responseBody = await parseJsonResponse(response);
    const record = {
      label,
      method,
      path: pathname,
      request: sanitize(body),
      status: response.status,
      ok: response.ok,
      response: sanitize(responseBody),
    };
    evidence.probes.push(record);
    return { response, body: responseBody, record };
  }

  const health = await request('health', 'GET', '/api/health');
  if (!health.response.ok) throw new Error(`health failed: ${health.response.status}`);

  const requestedThreadId = randomUUID();
  const thread = await request('create thread', 'POST', '/api/webchat/v2/threads', {
    client_action_id: `codex-live-assistant-thread-${timestamp}`,
    requested_thread_id: requestedThreadId,
  });
  if (!thread.response.ok) throw new Error(`create thread failed: ${thread.response.status}`);
  const threadId = thread.body?.thread_id || thread.body?.thread?.thread_id || requestedThreadId;
  evidence.thread_id = threadId;

  const csvText = 'item,value\nalpha,12\nbeta,34\n';
  const attachment = {
    name: 'codex-live-assistant-run.csv',
    mime_type: 'text/csv',
    data_base64: Buffer.from(csvText, 'utf8').toString('base64'),
  };
  const expectedMarker = 'IRONCLAW_ASSISTANT_RUN_OK alpha=12 beta=34';
  const prompt =
    `Read the attached CSV and reply with exactly: ${expectedMarker}. ` +
    'Do not use connectors, external tools, email, Slack, Notion, or Calendar.';

  const send = await request(
    'send message requiring assistant marker',
    'POST',
    `/api/webchat/v2/threads/${encodeURIComponent(threadId)}/messages`,
    {
      client_action_id: `codex-live-assistant-message-${timestamp}`,
      content: prompt,
      attachments: [attachment],
    },
  );
  evidence.sent_prompt = prompt;
  evidence.expected_marker = expectedMarker;
  evidence.sent_attachment = sanitize(attachment);
  const runId = send.body?.run_id || send.body?.run?.run_id || null;
  evidence.run_id = runId;

  let lastRunState = null;
  let lastTimeline = null;
  for (let attempt = 1; attempt <= 24; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    if (runId) {
      const run = await request(
        `poll run state ${attempt}`,
        'GET',
        `/api/webchat/v2/threads/${encodeURIComponent(threadId)}/runs/${encodeURIComponent(runId)}`,
      );
      lastRunState = run.body;
    }
    const timeline = await request(
      `poll timeline ${attempt}`,
      'GET',
      `/api/webchat/v2/threads/${encodeURIComponent(threadId)}/timeline?limit=50`,
    );
    lastTimeline = timeline.body;
    const messages = timelineMessages(lastTimeline);
    const assistantMessages = messages.filter((message) => {
      const kind = messageKind(message);
      return kind === 'assistant' || kind === 'assistant_message';
    });
    const assistantMarkerObserved = assistantMessages.some((message) =>
      messageContent(message).includes(expectedMarker),
    );
    const runStatus = String(lastRunState?.status || '').toLowerCase();
    evidence.poll_summary = {
      attempt,
      run_status: lastRunState?.status || null,
      failure_category: lastRunState?.failure?.category || null,
      timeline_message_count: messages.length,
      assistant_message_count: assistantMessages.length,
      assistant_marker_observed: assistantMarkerObserved,
      attachment_extracted_text_observed: JSON.stringify(sanitize(lastTimeline)).includes('alpha,12'),
    };
    if (assistantMarkerObserved || ['failed', 'cancelled', 'recovery_required'].includes(runStatus)) {
      break;
    }
  }

  const messages = timelineMessages(lastTimeline);
  const assistantMessages = messages.filter((message) => {
    const kind = messageKind(message);
    return kind === 'assistant' || kind === 'assistant_message';
  });
  const assistantMarkerObserved = assistantMessages.some((message) =>
    messageContent(message).includes(expectedMarker),
  );
  const attachmentExtractedTextObserved = JSON.stringify(sanitize(lastTimeline)).includes('alpha,12');
  evidence.summary = {
    thread_id: threadId,
    run_id: runId,
    send_status: send.record.status,
    send_ok: send.record.ok,
    send_outcome: send.body?.outcome || null,
    run_status: lastRunState?.status || null,
    failure_category: lastRunState?.failure?.category || null,
    assistant_message_count: assistantMessages.length,
    assistant_marker_observed: assistantMarkerObserved,
    attachment_extracted_text_observed: attachmentExtractedTextObserved,
    timeline: summarizeTimeline(lastTimeline),
    status:
      assistantMarkerObserved && attachmentExtractedTextObserved
        ? 'GREEN_assistant_marker_observed'
        : 'RED_no_assistant_work_product',
  };

  await writeFile(artifactPath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`live assistant run probe artifact: ${artifactPath}`);
  console.log(JSON.stringify(evidence.summary, null, 2));

  if (!send.record.ok) {
    throw new Error(`send message failed: ${send.record.status}`);
  }
  if (!attachmentExtractedTextObserved) {
    throw new Error('attachment extracted text was not observed in timeline');
  }
  if (expectAssistant && !assistantMarkerObserved) {
    throw new Error(
      `assistant marker was not observed; run_status=${lastRunState?.status || 'unknown'} failure=${
        lastRunState?.failure?.category || 'none'
      }`,
    );
  }
}

main().catch((err) => {
  console.error(err.stack || err.message || String(err));
  process.exitCode = 1;
});
