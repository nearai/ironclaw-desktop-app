import { buildReviewPrompt } from './workbench-review-extract.js';
import { REVIEW_COLUMNS } from './workbench-review-columns.js';
import { normalizeGoogleDocContent } from './workbench-drive.js';

// The real per-document extractor for runReview's `extractDoc`: read the document body, then run
// ONE tool-free chat turn over the fenced/tokened prompt and return the raw model text (runReview
// parses it with the hardened parseReviewCells). Deps are INJECTED (connectorRead + the chat-API
// turn helpers) so this is unit-testable without the network; slice 3b-ii wires the real ones.

function readThreadId(thread) {
  if (!thread || typeof thread !== 'object') return '';
  return String(thread.thread_id || thread?.thread?.thread_id || thread.id || '');
}

function latestAssistantText(timelineData) {
  const data = timelineData && typeof timelineData === 'object' ? timelineData : {};
  const msgs = Array.isArray(data.messages)
    ? data.messages
    : Array.isArray(data.timeline)
      ? data.timeline
      : Array.isArray(data)
        ? data
        : [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i] || {};
    const kind = String(m.kind || m.role || '');
    if (kind === 'assistant' || /final[_-]?reply|assistant/i.test(kind)) {
      const t = String(m.content || m.text || '').trim();
      if (t) return t;
    }
  }
  return '';
}

// Join a normalized Google Doc's blocks into plain text for the prompt. '' when there is no
// readable text (e.g. a non-Doc / empty doc) — the extractor turns that into an honest error.
export function googleDocText(normalized) {
  const blocks = normalized && Array.isArray(normalized.blocks) ? normalized.blocks : [];
  return blocks
    .map((b) => (b && b.text ? String(b.text) : ''))
    .filter(Boolean)
    .join('\n')
    .trim();
}

// One tool-free chat turn: create a thread, send the prompt, poll the timeline until the
// assistant replies, return its text WITH a trailing newline (parseReviewCells treats a
// non-newline-terminated final line as truncated). Throws on no-thread / timeout so the caller
// marks the document 'error'. Deps: { createThread, sendMessage, fetchTimeline, sleep?, timezone?, maxTries? }.
export async function runReviewChatTurn(prompt, deps = {}) {
  const { createThread, sendMessage, fetchTimeline, timezone, maxTries = 20 } = deps;
  if (!createThread || !sendMessage || !fetchTimeline) throw new Error('chat turn unavailable');
  const sleep =
    typeof deps.sleep === 'function' ? deps.sleep : (ms) => new Promise((r) => setTimeout(r, ms));
  const thread = await createThread({});
  const threadId = readThreadId(thread);
  if (!threadId) throw new Error('could not open a thread');
  await sendMessage({ threadId, content: prompt, timezone });
  for (let i = 0; i < maxTries; i++) {
    await sleep(2000);
    const text = latestAssistantText(await fetchTimeline({ threadId, limit: 20 }));
    if (text) return text.endsWith('\n') ? text : text + '\n';
  }
  throw new Error('extraction timed out');
}

// extractDoc(doc, token) for runReview. `connectorRead` reads the Google Doc body; `runTurn(prompt)`
// runs the chat turn and returns raw model text. Throws "couldn't read" when the document has no
// extractable text (non-Doc / empty), which runReview surfaces as an honest error cell.
export function makeReviewExtractor({ connectorRead, runTurn, columns = REVIEW_COLUMNS } = {}) {
  return async function extractDoc(doc, token) {
    if (typeof connectorRead !== 'function' || typeof runTurn !== 'function') {
      throw new Error('extractor unavailable');
    }
    const result = await connectorRead({
      toolkit: 'googledocs',
      tool: 'GOOGLEDOCS_GET_DOCUMENT_BY_ID',
      arguments: { id: doc.id }
    });
    const text = googleDocText(normalizeGoogleDocContent(result));
    if (!text) throw new Error("couldn't read");
    return runTurn(buildReviewPrompt(text, columns, { token }));
  };
}
