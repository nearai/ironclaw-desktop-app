// Suggested-reply engine — drafts a reply to a surfaced message in the user's
// voice via a SHORT agent turn (proven to complete live in ~17s, not blocked by
// the long-turn wedge). The result pre-fills the gated Draft-reply modal so the
// user reviews/edits/creates a draft — nothing is ever sent. On any failure or
// timeout this returns '' and the modal stays empty (honest: never fabricate).
//
// The pure helpers (prompt builder, reply extraction) are unit-tested; the
// orchestrator takes injected deps so it is testable without a live gateway.

// Saved Memory prefs, turned into a directive for the reply turn so what the user saved on the
// Memory surface actually shapes the drafts it writes (tone + content), not just the briefing.
// Draft framing (apply-to-this-reply), distinct from the briefing's surfacing framing. Accepts
// pref objects ({ text }) or strings; bounded so it can't bloat the short turn. Pure; '' when
// empty. Self-contained (no heavy import into the draft path). Nothing is ever auto-sent — the
// draft is reviewed in the gated modal — so this guides wording, it does not take an action.
const REPLY_MEMORY_MAX_ITEMS = 6;
const REPLY_MEMORY_TEXT_MAX = 200;
export function replyMemoryBlock(memory) {
  const items = (Array.isArray(memory) ? memory : [])
    .map((m) => (typeof m === 'string' ? m : m && m.text))
    .map((t) =>
      String(t || '')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean)
    .slice(0, REPLY_MEMORY_MAX_ITEMS)
    .map((t) =>
      t.length > REPLY_MEMORY_TEXT_MAX ? `${t.slice(0, REPLY_MEMORY_TEXT_MAX - 1)}…` : t
    );
  if (!items.length) return '';
  return `MY SAVED PREFERENCES (apply the ones relevant to this reply; ignore any that do not fit):\n${items.map((t) => `- ${t}`).join('\n')}`;
}

// Build the turn prompt from a surfaced message. Caps the quoted body so the turn
// stays short. Pure.
export function buildSuggestedReplyPrompt({ sender, subject, body, channel, voice, memory } = {}) {
  const v = String(voice || 'clear, direct, first person, lightly informal').trim();
  const ctx = [];
  if (sender) ctx.push(`From: ${String(sender).trim()}`);
  if (channel) ctx.push(`Channel: #${String(channel).replace(/^#+/, '').trim()}`);
  if (subject) ctx.push(`Subject: ${String(subject).trim()}`);
  const text = String(body || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200);
  if (text) ctx.push(`Message: ${text}`);
  // A short style descriptor goes inline; a multi-line directive (learned voice samples)
  // gets its own labeled block so the bulleted examples don't sit inside a parenthetical.
  const multiline = v.includes('\n');
  const lines = [
    multiline
      ? `You are drafting a reply on my behalf. Write a concise reply in my voice.`
      : `You are drafting a reply on my behalf. Write a concise reply in my voice (${v}).`,
    `Reply directly to the message. No greeting line or signature unless natural. Output ONLY the reply text — no preamble, no surrounding quotes, no labels.`
  ];
  if (multiline) lines.push('', `MY VOICE:`, v);
  const memBlock = replyMemoryBlock(memory);
  if (memBlock) lines.push('', memBlock);
  lines.push('', ctx.join('\n'));
  return lines.join('\n');
}

// Strip the wrappers a model sometimes adds around the reply (code fences, a
// "Here's a reply:" preamble, surrounding quotes). Pure.
export function cleanReplyText(raw) {
  let t = String(raw || '').trim();
  t = t
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  t = t.replace(/^(here(?:'s| is)\b[^:\n]*:|reply:|draft:|suggested reply:)\s*/i, '').trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith('“') && t.endsWith('”')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

// Pull the latest assistant / final_reply text from a timeline payload. Skips the
// user's own prompt message. Pure; '' when there's no assistant text yet.
export function extractReplyText(timelineData) {
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
    if (kind === 'assistant' || kind === 'final_reply' || /final[_-]?reply|assistant/i.test(kind)) {
      const t = String(m.content || m.text || '').trim();
      if (t) return cleanReplyText(t);
    }
  }
  return '';
}

function readThreadId(thread) {
  if (!thread || typeof thread !== 'object') return '';
  return String(thread.thread_id || thread?.thread?.thread_id || thread.id || '');
}

// Orchestrate a short reply-draft turn: create a thread, send the prompt, poll the
// timeline until the assistant replies (or we time out). Returns the reply text,
// or '' on any failure/timeout. `deps` = { createThread, sendMessage, fetchTimeline,
// sleep?, timezone?, maxTries? } — injected so this is testable without a gateway.
export async function generateSuggestedReply({ message, voice, memory, deps } = {}) {
  const d = deps || {};
  if (!d.createThread || !d.sendMessage || !d.fetchTimeline) return '';
  const prompt = buildSuggestedReplyPrompt({
    sender: message?.sender || message?.fromEmail,
    subject: message?.subject,
    body: message?.preview || message?.snippet || message?.body || message?.messageText,
    channel: message?.channel,
    voice,
    memory
  });
  const sleep = d.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const maxTries = Number.isFinite(d.maxTries) ? d.maxTries : 20;
  try {
    const thread = await d.createThread({});
    const threadId = readThreadId(thread);
    if (!threadId) return '';
    await d.sendMessage({ threadId, content: prompt, timezone: d.timezone });
    for (let i = 0; i < maxTries; i++) {
      await sleep(2000);
      const tl = await d.fetchTimeline({ threadId, limit: 20 });
      const reply = extractReplyText(tl);
      if (reply) return reply;
    }
    return '';
  } catch (_) {
    return '';
  }
}
