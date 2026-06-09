import {
  apiFetch,
  bootstrapDesktopSession,
  createThread,
  fetchTimeline,
  readStoredToken,
  sendMessage,
  storeToken,
  tauriInvoke
} from './api.js';
import {
  buildDocxBlob,
  buildHtmlBlob,
  buildJsonBlob,
  buildMarkdownBlob,
  buildPdfBlob
} from '../pages/chat/lib/work-product-export.js';

const STARTED_FLAG = '__IRONCLAW_PACKAGED_WEBVIEW_SMOKE_STARTED__';
const GATEWAY_ORIGIN_KEY = 'ironclaw:desktop-gateway-origin';

export async function maybeRunPackagedWebviewSmoke() {
  if (typeof window === 'undefined' || window[STARTED_FLAG]) return;

  let request;
  try {
    request = await tauriInvoke('packaged_smoke_request');
  } catch (_) {
    return;
  }
  if (!request?.enabled) return;

  window[STARTED_FLAG] = true;
  await smokeDiag(`enabled evidence_path=${request.evidence_path || ''}`);
  const report = {
    schema: 'ironclaw-packaged-webview-smoke.v1',
    started_at: new Date().toISOString(),
    status: 'running',
    checks: [],
    errors: [],
    evidence_path_requested: request.evidence_path || null
  };

  const check = (name, passed, detail = {}) => {
    report.checks.push({
      name,
      status: passed ? 'PASS' : 'FAIL',
      detail
    });
    if (!passed) {
      throw new Error(`${name} failed`);
    }
  };

  try {
    await smokeDiag('bootstrap session start');
    await bootstrapPackagedSession(report, check);
    await smokeDiag('bootstrap session passed');
    await smokeDiag('chat attachment route start');
    await proveChatAttachmentRoute(report, check);
    await smokeDiag('chat attachment route passed');
    await smokeDiag('export builders start');
    await proveExportBuilders(report, check);
    await smokeDiag('export builders passed');
    report.status = 'passed';
  } catch (err) {
    report.status = 'failed';
    report.errors.push(errorSummary(err));
    await smokeDiag(`failed ${errorSummary(err).message}`);
  } finally {
    report.completed_at = new Date().toISOString();
    report.pass_count = report.checks.filter((entry) => entry.status === 'PASS').length;
    report.fail_count = report.checks.filter((entry) => entry.status === 'FAIL').length;
    try {
      await smokeDiag('report write start');
      await tauriInvoke('packaged_smoke_report', { report });
      await smokeDiag('report write passed');
    } catch (err) {
      console.warn('[ironclaw] packaged WebView smoke report failed', err);
    }
  }
}

async function smokeDiag(message) {
  try {
    await tauriInvoke('diag_log', { msg: `[packaged-smoke] ${message}` });
  } catch (_) {
    // Diagnostics should never change smoke behavior.
  }
}

async function bootstrapPackagedSession(report, check) {
  await smokeDiag('bootstrapDesktopSession start');
  await retry('bootstrap desktop session', () => bootstrapDesktopSession(), {
    attempts: 8,
    delayMs: 500
  });
  await smokeDiag('bootstrapDesktopSession passed');

  const status = await retry(
    'sidecar status',
    async () => {
      const value = await tauriInvoke('sidecar_status');
      if (!value?.running || !value?.port) {
        throw new Error('sidecar is not running yet');
      }
      return value;
    },
    { attempts: 30, delayMs: 500 }
  );
  await smokeDiag(`sidecar status passed port=${status.port}`);
  const origin = `http://127.0.0.1:${status.port}`;
  localStorage.setItem(GATEWAY_ORIGIN_KEY, origin);
  report.gateway_origin = origin;
  report.sidecar_status = { running: Boolean(status.running), port: status.port };
  check('sidecar status exposes runtime port', true, report.sidecar_status);

  const token = await retry('local token', () => tauriInvoke('get_or_create_local_token'), {
    attempts: 8,
    delayMs: 300
  });
  await smokeDiag(`local token passed length=${String(token || '').length}`);
  storeToken(token);
  check('WebView stored local gateway bearer', Boolean(readStoredToken()), {
    token_length: String(token || '').length
  });

  const health = await retry(
    'gateway webchat readiness',
    () => apiFetch('/api/webchat/v2/threads'),
    {
      attempts: 30,
      delayMs: 500
    }
  );
  await smokeDiag(`gateway webchat readiness passed threads=${Array.isArray(health?.threads)}`);
  check('WebView Tauri HTTP reaches Reborn health', Array.isArray(health?.threads), {
    channel: 'webchat-v2',
    status: 'ok',
    thread_count: health.threads.length
  });
}

async function proveChatAttachmentRoute(report, check) {
  const requestedThreadId = crypto.randomUUID();
  const prompt =
    'Packaged WebView smoke: prove this chat send and CSV attachment reached Reborn. Do not contact external services.';
  const csv = 'item,value\npackaged-webview-smoke,1\n';
  const attachment = {
    name: 'packaged-webview-smoke.csv',
    mime_type: 'text/csv',
    data_base64: base64FromText(csv)
  };

  const thread = await retry(
    'create webchat thread',
    () =>
      createThread({
        requestedThreadId,
        clientActionId: `packaged-webview-thread-${Date.now()}`
      }),
    { attempts: 5, delayMs: 500 }
  );
  const threadId = thread?.thread_id || thread?.thread?.thread_id || requestedThreadId;
  report.thread_id = threadId;
  check('WebView created Reborn webchat thread', Boolean(threadId), {
    requested_thread_id: requestedThreadId,
    returned_thread_id: threadId
  });

  const sent = await sendMessage({
    threadId,
    content: prompt,
    attachments: [attachment],
    clientActionId: `packaged-webview-message-${Date.now()}`
  });
  report.send_response = sanitizeRouteResponse(sent);
  check(
    'WebView submitted chat message with attachment',
    sent?.outcome === 'submitted' && Boolean(sent?.run_id),
    {
      outcome: sent?.outcome || null,
      run_id: sent?.run_id || null
    }
  );

  const timeline = await retry(
    'timeline contains sent prompt and attachment',
    async () => {
      const value = await fetchTimeline({ threadId, limit: 50 });
      const text = JSON.stringify(value || {});
      if (!text.includes(prompt) || !text.includes('packaged-webview-smoke.csv')) {
        throw new Error('timeline does not contain submitted prompt and attachment');
      }
      return value;
    },
    { attempts: 12, delayMs: 750 }
  );
  const timelineText = JSON.stringify(timeline || {});
  check('Timeline reload preserves user prompt', timelineText.includes(prompt), {
    prompt_length: prompt.length
  });
  const extractedTextObserved = timelineText.includes('packaged-webview-smoke,1');
  const attachmentMetadataObserved = timelineText.includes('packaged-webview-smoke.csv');
  check('Timeline reload preserves attachment metadata', attachmentMetadataObserved, {
    attachment_name: 'packaged-webview-smoke.csv',
    extracted_text_observed: extractedTextObserved,
    payload_redacted_by_timeline: !extractedTextObserved
  });
}

async function proveExportBuilders(report, check) {
  const markdown = [
    '# Services Agreement Smoke Draft',
    '',
    'This is a packaged WebView export validation artifact.',
    '',
    '| Item | Value |',
    '| --- | --- |',
    '| Scope | Dummy services agreement update |',
    '| Attachment | packaged-webview-smoke.csv |'
  ].join('\n');

  const mdText = await buildMarkdownBlob(markdown).text();
  check(
    'Markdown export blob includes draft body',
    mdText.includes('Services Agreement Smoke Draft'),
    {
      bytes: byteLength(mdText)
    }
  );

  const htmlText = await buildHtmlBlob(markdown).text();
  const htmlHasDoctype = htmlText.toLowerCase().startsWith('<!doctype html>');
  check(
    'HTML export blob renders markdown body',
    htmlText.includes('Services Agreement Smoke Draft') && htmlHasDoctype,
    {
      bytes: byteLength(htmlText),
      has_doctype: htmlHasDoctype
    }
  );

  const jsonText = await buildJsonBlob({ role: 'assistant', content: markdown }).text();
  const parsedJson = JSON.parse(jsonText);
  check('JSON export blob parses and preserves content', parsedJson.content === markdown, {
    bytes: byteLength(jsonText),
    role: parsedJson.role
  });

  const pdfText = await buildPdfBlob(markdown).text();
  check(
    'PDF export blob has a parseable PDF envelope',
    pdfText.startsWith('%PDF-1.4') &&
      pdfText.includes('xref') &&
      pdfText.includes('trailer') &&
      pdfText.includes('%%EOF'),
    {
      bytes: byteLength(pdfText)
    }
  );

  const docxBytes = new Uint8Array(await buildDocxBlob(markdown).arrayBuffer());
  const docxAscii = asciiPreview(docxBytes);
  check(
    'DOCX export blob has ZIP package entries',
    startsWithPk(docxBytes) && docxAscii.includes('word/document.xml'),
    {
      bytes: docxBytes.byteLength,
      mime_hint: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }
  );
}

async function retry(label, fn, { attempts, delayMs }) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < attempts) await delay(delayMs);
    }
  }
  throw new Error(`${label}: ${lastError?.message || lastError || 'failed'}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function base64FromText(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function startsWithPk(bytes) {
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function asciiPreview(bytes) {
  let out = '';
  for (const byte of bytes.slice(0, 4096)) {
    if (byte >= 32 && byte <= 126) out += String.fromCharCode(byte);
  }
  return out;
}

function byteLength(text) {
  return new TextEncoder().encode(String(text || '')).byteLength;
}

function sanitizeRouteResponse(value) {
  if (!value || typeof value !== 'object') return value || null;
  return {
    outcome: value.outcome || null,
    thread_id: value.thread_id || value.thread?.thread_id || null,
    run_id: value.run_id || null,
    message_id: value.message_id || null,
    profile: value.profile || null
  };
}

function errorSummary(err) {
  return {
    message: err?.message || String(err),
    name: err?.name || 'Error',
    status: err?.status || null,
    body: err?.body ? String(err.body).slice(0, 500) : null
  };
}
