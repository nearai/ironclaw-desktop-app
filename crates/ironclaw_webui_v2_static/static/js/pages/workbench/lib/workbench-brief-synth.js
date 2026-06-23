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
  // Slack-FIRST "Needs you": threads where you were @-mentioned and owe a reply,
  // ahead of email replies. Both get a voice-matched suggested reply from the turn.
  const slackReplies = (Array.isArray(b.slackAwaiting) ? b.slackAwaiting : [])
    .slice(0, 4)
    .map((s) => ({
      id: String(s.id || ''),
      source: 'Slack',
      sender: String(s.who || senderName(s) || '').trim(),
      subject: '',
      snippet: clip(s.text || s.preview, 220),
      channel: String(s.channel || '').replace(/^#+/, ''),
      when: clip(s.when, 40),
      unread: true,
      important: false,
      replyHref: String(s.replyHref || s.permalink || s.link || '')
    }));
  const emailReplies = (Array.isArray(b.replies) ? b.replies : []).slice(0, 4).map((m) => ({
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
  const needsReply = [...slackReplies, ...emailReplies].slice(0, 6);

  // Pre-classified "decision forming, you weren't tagged" Slack threads — the radar
  // candidates the "Worth weighing in" turn (or its deterministic fallback) enriches.
  const weighInCandidates = (Array.isArray(b.slackWeighIn) ? b.slackWeighIn : [])
    .slice(0, 5)
    .map((s) => ({
      id: String(s.id || ''),
      channel: String(s.channel || '').replace(/^#+/, ''),
      sender: String(s.who || '').trim(),
      text: clip(s.text || s.preview, 220),
      link: String(s.replyHref || s.permalink || s.link || '')
    }));

  // Legacy blocker-search signals — kept as a supplementary radar source for users
  // whose deep Slack read is unavailable (identity unresolved / search-only grant).
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

  // 1-2 short real example replies in the user's own voice; the needsYou turn
  // few-shots off these so its suggested replies sound like the user, not the model.
  const voiceSample = (Array.isArray(profile.voiceSample) ? profile.voiceSample : [])
    .map((v) => clip(v, 400))
    .filter(Boolean)
    .slice(0, 2);

  return {
    profile: {
      name: String(profile.name || '').trim(),
      title,
      domain: scope.domain,
      channels,
      voiceSample
    },
    domainTriggers: scope.triggers,
    needsReply,
    weighInCandidates,
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
  const voiceSample = Array.isArray(bundle?.profile?.voiceSample) ? bundle.profile.voiceSample : [];
  const voiceLine = voiceSample.length
    ? `Match the style of these real examples of how I write replies: ${JSON.stringify(voiceSample)}.`
    : `Write the way I would dash off a quick, decisive Slack reply.`;
  return [
    briefHeader(bundle, profile),
    `Output ONLY one JSON object (no prose, no code fence): {needsYou:[{id,source:"Email"|"Slack",sender,badges:["Decision"|"FYI"|"time-sensitive"],context:"2-4 sentences naming the parties, the decision on the table, the current positions, and why it sits on ME specifically",suggestedReply:"a ready reply in MY voice, or empty string if no reply is owed",replyHref,bestWindow}]} — one per needsReply item; echo id+replyHref; never invent a sender or link.`,
    `The suggestedReply must be in MY voice: all-lowercase, first-person, decisive, a specific position not a hedge. ${voiceLine}`,
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
  const out = [];
  const seen = new Set();
  // Primary: the deep read's pre-classified "decision forming, you weren't tagged"
  // threads. These are already the right items — no trigger match needed.
  for (const c of Array.isArray(bundle.weighInCandidates) ? bundle.weighInCandidates : []) {
    const id = String(c.id || c.link || c.text || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const channel = String(c.channel || '').replace(/^#+/, '');
    out.push({
      id,
      title: clip(c.text, 200),
      channel,
      whyYours: `An active decision${channel ? ` in #${channel}` : ''} you weren't tagged on.`,
      myTake: '',
      confidence: null,
      link: String(c.link || '')
    });
    if (out.length >= 5) break;
  }
  if (out.length) return out;
  // Fallback (no deep read / identity unresolved): legacy blocker-search signals
  // that hit the domain's trigger vocabulary. Honest: omits a take rather than
  // fabricate one, and stays empty when the domain is unknown.
  const triggers = (Array.isArray(bundle.domainTriggers) ? bundle.domainTriggers : []).map((t) =>
    String(t).toLowerCase()
  );
  if (!triggers.length) return [];
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

// Turn B — "Worth weighing in". A SMALL tool-free turn that enriches the 2-5
// pre-filtered radar candidates with why-it's-mine + a pressure-test take + a
// confidence. Tiny CONTEXT (~1KB), so it converges in the poll window and runs in
// PARALLEL with the needsYou turn. On timeout the caller keeps the deterministic
// candidates (no take, no confidence) — never blocks, never fabricates. Pure.
export function buildWorthWeighingInPrompt(bundle, candidates, profile = {}) {
  const rows = (Array.isArray(candidates) ? candidates : []).map((c) => ({
    id: String(c.id || ''),
    title: clip(c.title || c.text, 200),
    channel: String(c.channel || '').replace(/^#+/, ''),
    link: String(c.link || '')
  }));
  return [
    briefHeader(bundle, profile),
    `These are active Slack decisions I was NOT tagged on. Output ONLY one JSON object (no prose, no code fence): {worthWeighingIn:[{id,title,channel,whyYours:"why this decision sits in MY domain and on me",take:"my pressure-test position — the risk to flag or the move to make, in my voice",confidence:0-100,link}]} — one per candidate; echo id+link; never invent an item.`,
    ``,
    `CONTEXT:`,
    JSON.stringify({ profile: bundle.profile, candidates: rows })
  ].join('\n');
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
      myTake: clip(it.myTake || it.take, 600),
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

  // Optional one-line meta-summary ("Pulled from … — left those out"). Carried
  // through when the model supplies one; the orchestrator derives one otherwise.
  const intro = clip(parsed.intro, 400);

  if (!needsYou.length && !worthWeighingIn.length && !thisWeek.length && !bestTimes.length) {
    return null;
  }
  return { summary, intro, needsYou, worthWeighingIn, thisWeek, bestTimes };
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

// Honest one-line provenance ("Pulled from Slack and Email."). Deterministic — lists
// only the sources that actually contributed; never fabricates "closed loops". Pure.
export function deriveIntro(bundle) {
  const sources = [];
  const seen = new Set();
  const add = (label) => {
    if (label && !seen.has(label)) {
      seen.add(label);
      sources.push(label);
    }
  };
  for (const r of Array.isArray(bundle.needsReply) ? bundle.needsReply : []) {
    add(r.source === 'Slack' ? 'Slack' : 'Email');
  }
  if ((Array.isArray(bundle.weighInCandidates) ? bundle.weighInCandidates : []).length)
    add('Slack');
  if ((Array.isArray(bundle.calendar) ? bundle.calendar : []).length) add('your calendar');
  if (!sources.length) return '';
  const joined =
    sources.length === 1
      ? sources[0]
      : `${sources.slice(0, -1).join(', ')} and ${sources[sources.length - 1]}`;
  return `Pulled from ${joined}.`;
}

// Orchestrate the briefing as TWO small tool-free turns run in PARALLEL plus
// deterministic derivation:
// - needsYou (the replies, voice-matched) — the heavy generative turn.
// - worthWeighingIn (the radar, enriched with why-it's-mine + a take + confidence)
//   over the 2-5 pre-filtered candidates — a SMALL turn that converges fast.
// Promise.allSettled (not all) means a slow/failed radar turn never blocks needsYou,
// and the radar falls back to the DETERMINISTIC candidates (no take/confidence) — so
// there is never a regression vs the prior single-turn behaviour. When `onPartial`
// is supplied, the needsYou half renders the moment turn A lands (deterministic
// radar), then the enriched radar upgrades it when turn B lands — progressive, so
// the home fills in ~one turn's time, not the sum. Returns the final merged brief,
// or null on total failure (caller keeps the deterministic briefing). `deps` =
// { createThread, sendMessage, fetchTimeline, sleep?, timezone?, maxTries? }.
export async function synthesizeBriefing({ briefing, profile, deps, onPartial } = {}) {
  const d = deps || {};
  if (!d.createThread || !d.sendMessage || !d.fetchTimeline) return null;
  const bundle = buildBriefSynthesisBundle(briefing, profile || {});
  // Nothing to synthesize from — let the caller show the deterministic briefing.
  if (!bundle.needsReply.length && !bundle.weighInCandidates.length && !bundle.calendar.length) {
    return null;
  }
  const sleep = d.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const maxTries = Number.isFinite(d.maxTries) ? d.maxTries : 24;
  const p = profile || {};
  const candidates = deriveWorthWeighingIn(bundle);
  const thisWeek = deriveThisWeek(bundle);
  const intro = deriveIntro(bundle);
  const assemble = (needsYou, worthWeighingIn) => ({
    summary: {
      awaitingReply: needsYou.length,
      flagged: worthWeighingIn.length,
      weeklySignals: thisWeek.length
    },
    intro,
    needsYou,
    worthWeighingIn,
    thisWeek,
    bestTimes: deriveBestTimes(needsYou)
  });
  try {
    // Launch both turns concurrently. Each catches its own failure to null so
    // allSettled below never lets one turn's error reject the other.
    const needsYouTurn = bundle.needsReply.length
      ? runSynthesisTurn(buildNeedsYouPrompt(bundle, p), d, sleep, maxTries).catch(() => null)
      : Promise.resolve(null);
    const radarTurn = candidates.length
      ? runSynthesisTurn(
          buildWorthWeighingInPrompt(bundle, candidates, p),
          d,
          sleep,
          maxTries
        ).catch(() => null)
      : Promise.resolve(null);

    // Progressive render: as soon as the needsYou turn lands, emit the brief with the
    // DETERMINISTIC radar so the home fills fast; the radar turn upgrades it after.
    if (typeof onPartial === 'function') {
      needsYouTurn
        .then((turn) => {
          const needsYou = (turn && turn.needsYou) || [];
          if (needsYou.length || candidates.length) onPartial(assemble(needsYou, candidates));
        })
        .catch(() => {});
    }

    const [aSettled, bSettled] = await Promise.allSettled([needsYouTurn, radarTurn]);
    const aTurn = aSettled.status === 'fulfilled' ? aSettled.value : null;
    const bTurn = bSettled.status === 'fulfilled' ? bSettled.value : null;
    const needsYou = (aTurn && aTurn.needsYou) || [];
    // Prefer the LLM-enriched radar; fall back to the deterministic candidates so a
    // non-converging turn B degrades silently (no take/confidence, but real items).
    const enrichedRadar =
      bTurn && Array.isArray(bTurn.worthWeighingIn) && bTurn.worthWeighingIn.length
        ? bTurn.worthWeighingIn
        : candidates;

    if (!needsYou.length && !enrichedRadar.length) {
      return null;
    }
    return assemble(needsYou, enrichedRadar);
  } catch (_) {
    return null;
  }
}

export { resolveDomain };
