// Briefing synthesis — turns the deterministic briefing (already read + filtered
// from the connectors) into the rich, chief-of-staff briefing the daily-briefing
// skill produces: a summary count, "Needs you" items with a why-it's-on-you
// context line + a ready suggested reply, a "Worth weighing in" radar (decisions
// forming in your domain you were NOT tagged on), "This week", and "Best times".
//
// THE WEDGE SIDESTEP: the synthesis turn does NO tool calls. The connector reads
// already happened deterministically (buildBriefing); we hand that clean data to
// the model and it only WRITES the briefing JSON. A tool-free generative turn is
// the short kind that completes (~17s) — it does not hit the long multi-tool
// convergence wedge. On any failure/timeout the caller falls back to the
// deterministic briefing, so the home is never blank and never fabricated.
//
// Newsletter suppression, answered-thread gating, and tier ranking are INHERITED:
// the input is buildBriefing's output, which already applied all of that. This
// module never re-reads raw mail, so a bulk sender can never leak back in.

import { resolveDomain, radarScopeForTitle, normalizeChannelAllowlist } from './workbench-radar.js';

// Cap how much context we quote per item so the prompt stays small and the turn
// stays short. Pure.
function clip(value, max) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function senderName(message) {
  const raw = String(
    (message && (message.sender || message.fromName || message.fromEmail)) || ''
  ).trim();
  // "Dana Lee <dana@x>" -> "Dana Lee"; bare email -> the email.
  const m = raw.match(/^(.*?)\s*<[^>]+>$/);
  return (m ? m[1] : raw).trim();
}

// Build the compact context bundle the synthesis turn reasons over. Draws ONLY
// from the deterministic briefing (already connector-read + filtered) plus the
// user profile. Pure; never fabricates. The radar bundle is the user's own Slack
// rows scoped to their channel allowlist — the model decides which are
// "decisions forming" within the domain's trigger vocabulary.
export function buildBriefSynthesisBundle(briefing, profile = {}) {
  const b = briefing && typeof briefing === 'object' ? briefing : {};
  const title = String(profile.title || '').trim();
  const channels = normalizeChannelAllowlist(profile.channels);
  const scope = radarScopeForTitle(title);

  // Tight caps: the synthesis prompt's schema is fixed; the CONTEXT bundle is what
  // determines turn latency. A ~1KB bundle converges in ~20s live; a ~3KB bundle
  // overruns the poll window. So clip aggressively + cap counts — enough signal
  // for the model to write context + a reply, not the whole thread (tie-in #7).
  const needsReply = (Array.isArray(b.replies) ? b.replies : []).slice(0, 4).map((m) => ({
    id: String(m.id || m.messageId || m.threadId || ''),
    source: m.channel ? 'Slack' : 'Email',
    sender: senderName(m),
    subject: clip(m.subject, 110),
    snippet: clip(m.preview || m.snippet || m.messageText || m.body, 220),
    channel: m.channel ? String(m.channel).replace(/^#+/, '') : '',
    when: clip(m.when, 40),
    unread: Boolean(m.unread),
    important: Boolean(m.important),
    replyHref: String(m.replyHref || m.gmailHref || m.permalink || m.link || '')
  }));

  const slackSignals = (Array.isArray(b.slack) ? b.slack : []).slice(0, 4).map((s) => ({
    id: String(s.id || ''),
    channel: String(s.channel || '').replace(/^#+/, ''),
    sender: senderName(s),
    text: clip(s.text || s.title || s.preview, 220),
    link: String(s.link || s.permalink || '')
  }));

  const calendar = (Array.isArray(b.events) ? b.events : []).slice(0, 4).map((e) => ({
    id: String(e.id || ''),
    title: clip(e.title, 120),
    when: clip(e.when, 60),
    location: clip(e.location, 80)
  }));

  // Context the briefing actually reasons over: actionable work-status (approval
  // gates / blocked) only. The recent-ACTIVITY feeds (github/drive/notion) were
  // low-signal bulk the model mostly ignored — dropping them shrinks the prompt
  // (and the turn) without changing the briefing's sections.
  const context = {
    attention: (Array.isArray(b.attention) ? b.attention : []).slice(0, 4).map((a) => ({
      title: clip(a.title, 120),
      detail: clip(a.detail, 120),
      group: clip(a.groupLabel, 60)
    }))
  };

  return {
    profile: { name: String(profile.name || '').trim(), title, domain: scope.domain, channels },
    domainTriggers: scope.triggers,
    needsReply,
    slackSignals,
    calendar,
    context
  };
}

// The synthesis prompt. Strict honesty contract: only the provided data, echo ids
// + links, no fabricated senders/links, suggestedReply only when a reply is
// genuinely owed, the radar only from the user's own channels within the domain.
// Output is ONLY the JSON object. Pure.
export function buildBriefSynthesisPrompt(bundle, profile = {}) {
  const name = String(profile.name || bundle?.profile?.name || '').trim();
  const title = String(profile.title || bundle?.profile?.title || '').trim();
  const who = [name, title].filter(Boolean).join(', ');
  const domain = bundle?.profile?.domain || 'my role';
  // Terse schema on purpose: the prompt length (instructions + context) drives the
  // turn's latency, and a compact spec converges fast while still pinning the
  // exact keys (validated live — a ~1KB prompt returns clean JSON in ~20s).
  return [
    `You are ${who || 'the user'}'s chief of staff writing their morning briefing. Use ONLY the CONTEXT JSON — never invent a sender, link, or item.`,
    `Output ONLY one JSON object (no prose, no code fence) with these keys:`,
    `summary:{awaitingReply:int,flagged:int,weeklySignals:int}`,
    `needsYou:[{id,source:"Email"|"Slack",sender,badges:["Decision"|"FYI"|"time-sensitive"],context:"1-2 sentences on what it is and why it sits on you",suggestedReply:"ready reply in my voice, lowercase-casual, or empty string if no reply is owed",replyHref,bestWindow}] — one per needsReply item; echo id+replyHref.`,
    `worthWeighingIn:[{id,title,channel,whyYours,myTake:"a pressure-test, not advice",confidence:0-100,link}] — ONLY slackSignals in my channels where a decision is forming in my domain (${domain}) and I was NOT tagged; else [].`,
    `thisWeek:[{id,title,yourMove,priority:"high"|"med"}] from calendar+signals. bestTimes:[{person,window}] from the data only.`,
    `summary counts must equal the array lengths.`,
    ``,
    `CONTEXT:`,
    JSON.stringify(bundle)
  ].join('\n');
}

const VALID_PRIORITY = new Set(['high', 'med']);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clampConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// Extract + validate the briefing JSON from the model's reply. Tolerates a code
// fence or surrounding prose by grabbing the outermost {...}. Returns a
// render-ready object with every field normalized, or null when the text has no
// usable JSON (the caller then falls back to the deterministic briefing). Drops
// malformed items rather than fabricating — honesty over completeness.
export function parseBriefJson(raw) {
  const text = String(raw || '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let parsed;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch (_) {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const needsYou = asArray(parsed.needsYou)
    .filter((it) => it && (it.sender || it.context || it.suggestedReply))
    .map((it) => ({
      id: String(it.id || ''),
      source: it.source === 'Slack' ? 'Slack' : 'Email',
      sender: clip(it.sender, 160),
      badges: asArray(it.badges)
        .map((x) => clip(x, 24))
        .filter(Boolean),
      context: clip(it.context, 600),
      suggestedReply: clip(it.suggestedReply, 1200),
      replyHref: String(it.replyHref || ''),
      bestWindow: clip(it.bestWindow, 120)
    }));

  const worthWeighingIn = asArray(parsed.worthWeighingIn)
    .filter((it) => it && it.title)
    .map((it) => ({
      id: String(it.id || ''),
      title: clip(it.title, 240),
      channel: clip(it.channel, 80).replace(/^#+/, ''),
      whyYours: clip(it.whyYours, 600),
      myTake: clip(it.myTake, 600),
      confidence: clampConfidence(it.confidence),
      link: String(it.link || '')
    }));

  const thisWeek = asArray(parsed.thisWeek)
    .filter((it) => it && it.title)
    .map((it) => ({
      id: String(it.id || ''),
      title: clip(it.title, 240),
      yourMove: clip(it.yourMove, 400),
      priority: VALID_PRIORITY.has(it.priority) ? it.priority : 'med'
    }));

  const bestTimes = asArray(parsed.bestTimes)
    .filter((it) => it && it.person)
    .map((it) => ({ person: clip(it.person, 120), window: clip(it.window, 120) }));

  // Counts are derived from the arrays we actually kept — never trust the model's
  // self-reported counts over the validated content.
  const summary = {
    awaitingReply: needsYou.length,
    flagged: worthWeighingIn.length,
    weeklySignals: thisWeek.length
  };

  if (!needsYou.length && !worthWeighingIn.length && !thisWeek.length && !bestTimes.length) {
    return null;
  }
  return { summary, needsYou, worthWeighingIn, thisWeek, bestTimes };
}

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
    if (kind === 'assistant' || kind === 'final_reply' || /final[_-]?reply|assistant/i.test(kind)) {
      const t = String(m.content || m.text || '').trim();
      if (t) return t;
    }
  }
  return '';
}

// Orchestrate the synthesis: create a thread, send the (tool-free) synthesis
// prompt, poll the timeline until the assistant replies, parse the JSON. Returns
// the rich briefing object, or null on any failure/timeout (caller falls back to
// the deterministic briefing). `deps` = { createThread, sendMessage,
// fetchTimeline, sleep?, timezone?, maxTries? } — injected so this is testable
// without a live gateway.
export async function synthesizeBriefing({ briefing, profile, deps } = {}) {
  const d = deps || {};
  if (!d.createThread || !d.sendMessage || !d.fetchTimeline) return null;
  const bundle = buildBriefSynthesisBundle(briefing, profile || {});
  // Nothing to synthesize from — let the caller show the deterministic briefing.
  if (!bundle.needsReply.length && !bundle.slackSignals.length && !bundle.calendar.length) {
    return null;
  }
  const prompt = buildBriefSynthesisPrompt(bundle, profile || {});
  const sleep = d.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const maxTries = Number.isFinite(d.maxTries) ? d.maxTries : 24;
  try {
    const thread = await d.createThread({});
    const threadId = readThreadId(thread);
    if (!threadId) return null;
    await d.sendMessage({ threadId, content: prompt, timezone: d.timezone });
    for (let i = 0; i < maxTries; i++) {
      await sleep(2000);
      const tl = await d.fetchTimeline({ threadId, limit: 20 });
      const parsed = parseBriefJson(latestAssistantText(tl));
      if (parsed) return parsed;
    }
    return null;
  } catch (_) {
    return null;
  }
}

export { resolveDomain };
