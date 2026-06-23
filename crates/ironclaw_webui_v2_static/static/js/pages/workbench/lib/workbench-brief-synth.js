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

function briefHeader(bundle, profile = {}) {
  const name = String(profile.name || bundle?.profile?.name || '').trim();
  const title = String(profile.title || bundle?.profile?.title || '').trim();
  const who = [name, title].filter(Boolean).join(', ');
  return `You are ${who || 'the user'}'s chief of staff writing their morning briefing. Use ONLY the CONTEXT JSON — never invent a sender, link, or item.`;
}

// THE SPLIT (validated live): one turn that writes ALL five sections overruns the
// poll window for a realistic inbox (~3.8KB prompt, the heavy output is the
// several in-voice replies), while each HALF on its own converges (~30-38s). So
// synthesis runs two SMALL turns in parallel. Turn A — "Needs you": just the
// replies, context + a ready reply per item (the heavy generative part). Pure.
export function buildNeedsYouPrompt(bundle, profile = {}) {
  return [
    briefHeader(bundle, profile),
    `Output ONLY one JSON object (no prose, no code fence): {needsYou:[{id,source:"Email"|"Slack",sender,badges:["Decision"|"FYI"|"time-sensitive"],context:"1-2 sentences on what it is and why it sits on you",suggestedReply:"ready reply in my voice, lowercase-casual, or empty string if no reply is owed",replyHref,bestWindow}]} — one per needsReply item; echo id+replyHref.`,
    ``,
    `CONTEXT:`,
    JSON.stringify({ profile: bundle.profile, needsReply: bundle.needsReply })
  ].join('\n');
}

// Turn B — the radar + week + best-times. Small output (no long replies), runs in
// "Worth weighing in" is DERIVED DETERMINISTICALLY, not via an LLM turn — the
// radar LLM turn was too slow to converge (#7), and the surfacing logic is exactly
// what workbench-radar.js already encodes: scan my own channel's slack signals for
// a decision forming in my domain's trigger vocabulary. Honest: it surfaces the
// signal + WHY it's mine, and OMITS a "my take" rather than fabricate one without
// the model. Pure + instant. (A short per-item "take" turn could enrich it later.)
export function deriveWorthWeighingIn(bundle) {
  const triggers = (Array.isArray(bundle.domainTriggers) ? bundle.domainTriggers : []).map((t) =>
    String(t).toLowerCase()
  );
  if (!triggers.length) return [];
  const out = [];
  const seen = new Set();
  for (const s of Array.isArray(bundle.slackSignals) ? bundle.slackSignals : []) {
    const text = String(s.text || '').toLowerCase();
    const hit = triggers.find((t) => t && text.includes(t));
    if (!hit) continue;
    const id = String(s.id || s.link || s.text || '');
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      title: clip(s.text, 200),
      channel: String(s.channel || '').replace(/^#+/, ''),
      whyYours: `Touches ${hit} — in your domain${s.channel ? `, from #${String(s.channel).replace(/^#+/, '')}` : ''}.`,
      myTake: '',
      confidence: null,
      link: String(s.link || '')
    });
    if (out.length >= 5) break;
  }
  return out;
}

// "This week" — forward commitments from the calendar. Deterministic; the move is
// left to the user (no fabricated "your move" without the model). Pure.
export function deriveThisWeek(bundle) {
  return (Array.isArray(bundle.calendar) ? bundle.calendar : []).slice(0, 5).map((e) => ({
    id: String(e.id || e.title || ''),
    title: [e.title, e.when].filter(Boolean).join(' · '),
    yourMove: '',
    priority: 'med'
  }));
}

// "Best times" — when to reach the people who are awaiting a reply, taken from the
// per-item bestWindow the replies turn produced. Deterministic; deduped by person.
export function deriveBestTimes(needsYou) {
  const out = [];
  const seen = new Set();
  for (const it of Array.isArray(needsYou) ? needsYou : []) {
    const person = clip(it.sender, 120);
    const window = clip(it.bestWindow, 120);
    if (!person || !window || seen.has(person.toLowerCase())) continue;
    seen.add(person.toLowerCase());
    out.push({ person, window });
    if (out.length >= 5) break;
  }
  return out;
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

// One tool-free turn: create a thread, send the prompt, poll the timeline until
// the assistant replies, parse the JSON. Returns the parsed object or null.
async function runSynthesisTurn(prompt, d, sleep, maxTries) {
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
}

// Orchestrate the briefing as ONE fast LLM turn + deterministic derivation:
// - needsYou (the replies) is the single LLM turn — the heavy generative part,
//   which on its own converges in the poll window (~30s live).
// - worthWeighingIn / thisWeek / bestTimes are DERIVED deterministically (no LLM):
//   the radar LLM turn was too slow (#7), and the derivations are instant + honest.
// Returns the merged rich briefing, or null on total failure (caller falls back to
// the deterministic briefing). `deps` = { createThread, sendMessage, fetchTimeline,
// sleep?, timezone?, maxTries? }, injected for testability.
export async function synthesizeBriefing({ briefing, profile, deps } = {}) {
  const d = deps || {};
  if (!d.createThread || !d.sendMessage || !d.fetchTimeline) return null;
  const bundle = buildBriefSynthesisBundle(briefing, profile || {});
  // Nothing to synthesize from — let the caller show the deterministic briefing.
  if (!bundle.needsReply.length && !bundle.slackSignals.length && !bundle.calendar.length) {
    return null;
  }
  const sleep = d.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const maxTries = Number.isFinite(d.maxTries) ? d.maxTries : 24;
  const p = profile || {};
  try {
    const turn = bundle.needsReply.length
      ? await runSynthesisTurn(buildNeedsYouPrompt(bundle, p), d, sleep, maxTries).catch(() => null)
      : null;
    const needsYou = (turn && turn.needsYou) || [];
    const worthWeighingIn = deriveWorthWeighingIn(bundle);
    const thisWeek = deriveThisWeek(bundle);
    const bestTimes = deriveBestTimes(needsYou);
    // Show the rich brief only when it has SUBSTANTIVE content — the replies or the
    // radar. thisWeek/bestTimes alone (e.g. the LLM turn failed but the calendar has
    // events) would be a hollow brief; fall back to the deterministic briefing,
    // which still shows replies + events.
    if (!needsYou.length && !worthWeighingIn.length) {
      return null;
    }
    return {
      summary: {
        awaitingReply: needsYou.length,
        flagged: worthWeighingIn.length,
        weeklySignals: thisWeek.length
      },
      needsYou,
      worthWeighingIn,
      thisWeek,
      bestTimes
    };
  } catch (_) {
    return null;
  }
}

export { resolveDomain };
