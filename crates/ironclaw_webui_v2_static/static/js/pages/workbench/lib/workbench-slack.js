// Deterministic "Find Slack blockers".
//
// Unlike the briefing (synthesized from already-cached inbox/calendar), this is
// an on-demand read: clicking the chip runs a single read-only Slack message
// search (SLACK_SEARCH_MESSAGES — the SEARCH segment passes the read-only route
// guard) for blocker-shaped language, sorted by recency, and renders the real
// matches with a deep link to each Slack thread. No agent, no model round-trip.
// Honest framing: these are messages that MENTION blocker terms — surfaced for
// the user to judge — not an LLM's verdict on what is "truly" blocked.

// The Slack search query. Space means AND in Slack search, so blocker synonyms
// are OR'd; quoted phrases are avoided (they returned zero matches in testing).
// Kept to five OR-terms: a six-term variant ("…OR unanswered") consistently
// returned zero through Composio's SLACK_SEARCH_MESSAGES, while this five-term
// form reliably returns matches.
export const SLACK_BLOCKER_QUERY = 'blocked OR blocker OR stuck OR waiting OR unblock';

// Leading boundary only, so the stem matches block/blocked/blocker/blockers/
// blocking and unblock/unblocked alike.
const BLOCKER_INTENT = /\b(block|stuck|unblock)/i;

// True when the free text is a "blockers in Slack" request. Matches both the
// short label ("Find Slack blockers") and the verbose chip fill ("Check
// available Slack context for blockers or unanswered decisions…").
export function isSlackBlockerIntent(text) {
  const value = String(text || '').trim();
  if (!value) return false;
  if (!/\bslack\b/i.test(value)) return false;
  return BLOCKER_INTENT.test(value) || /\bunanswered\b/i.test(value);
}

// Parse a Slack `ts` ("1781276971.079319", epoch seconds with a fractional
// part) into a short human "when". Returns '' when unparseable.
function formatSlackWhen(ts) {
  const raw = String(ts || '').trim();
  if (!raw) return '';
  const seconds = Number.parseFloat(raw);
  if (!Number.isFinite(seconds)) return '';
  const parsed = new Date(seconds * 1000);
  if (Number.isNaN(parsed.getTime())) return '';
  try {
    const now = new Date();
    const sameDay =
      parsed.getFullYear() === now.getFullYear() &&
      parsed.getMonth() === now.getMonth() &&
      parsed.getDate() === now.getDate();
    if (sameDay)
      return parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (_) {
    return '';
  }
}

// Make a Slack message body readable: decode `<@U…>` mentions to "@someone",
// `<http…|label>` links to their label (or bare url), strip remaining angle
// wrappers, collapse whitespace, and truncate. Never returns raw markup.
function cleanSlackText(raw) {
  const text = String(raw || '');
  if (!text) return '';
  const cleaned = text
    .replace(/<@[A-Z0-9]+(\|[^>]+)?>/g, (_, label) => (label ? `@${label.slice(1)}` : '@someone'))
    .replace(/<#[A-Z0-9]+\|([^>]+)>/g, '#$1')
    .replace(/<(https?:\/\/[^>|]+)\|([^>]+)>/g, '$2')
    .replace(/<(https?:\/\/[^>]+)>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 180 ? `${cleaned.slice(0, 179)}…` : cleaned;
}

// Precision filter: the Slack search returns anything that MENTIONS a blocker
// word, which sweeps in status reports ("IronClaw QA Update: … What's Working …")
// that merely contain "blocked"/"waiting" inside a multi-line summary. A genuine
// blocker is terse and conversational; a broadcast/status report is long, multi-
// line, or report-titled. Drop the reports; keep the real asks. Operates on the
// RAW message text (before truncation) so line structure is intact. Pure.
export function textLooksLikeBlocker(rawText) {
  const raw = String(rawText || '');
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) return false;
  // Report-style titles are broadcasts, not a direct ask — drop regardless of length:
  // "… QA Update:", "Weekly Status", "What's Working", "Sprint recap", etc.
  const reportTitle =
    /\b(qa|status|standup|stand-?up|weekly|daily|monthly|sprint|release|bug\s*bash)\b[^.\n]{0,30}\b(update|report|summary|recap|notes?|digest)\b/i.test(
      text
    ) ||
    /^[^.\n]{0,60}\b(update|report|summary|recap|digest)\s*:/i.test(text) ||
    /\bwhat'?s\s+(working|new|next|shipped|done)\b/i.test(text);
  if (reportTitle) return false;
  // A direct ask (a question, "can you", "please", an @-mention) keeps a message even
  // when it spans several short lines — people routinely write real blockers that way.
  // Only LONG, multi-line, NON-ask broadcasts are dropped as status reports.
  const hasAsk = /\?|\bcan you\b|\bcould you\b|\bplease\b|<@[A-Z0-9]+>/i.test(text);
  if (hasAsk) return true;
  const lineCount = raw.split(/\r?\n/).filter((line) => line.trim()).length;
  if (lineCount >= 3) return false;
  if (text.length > 280) return false;
  return true;
}

// Normalize a SLACK_SEARCH_MESSAGES read into blocker rows:
// `{ id, who, channel, when, text, permalink }`. Honest contract: [] on any
// unsuccessful/empty/malformed payload; never fabricates a message; drops rows
// with no readable text and broadcast/status-report style matches (false
// positives — see textLooksLikeBlocker).
export function normalizeSlackBlockers(result, { limit = 8 } = {}) {
  if (!result || result.successful === false) return [];
  const data = result.data || result;
  const matches = data?.messages?.matches;
  if (!Array.isArray(matches)) return [];
  const rows = [];
  for (const match of matches) {
    if (!match || typeof match !== 'object') continue;
    if (!textLooksLikeBlocker(match.text)) continue;
    const text = cleanSlackText(match.text);
    if (!text) continue;
    const channel = match.channel || {};
    const channelName =
      typeof channel === 'object'
        ? String(channel.name || channel.id || '').trim()
        : String(channel || '').trim();
    const permalink =
      typeof match.permalink === 'string' && /^https?:\/\//i.test(match.permalink)
        ? match.permalink
        : '';
    const id = String(match.iid || match.ts || `${channelName}:${text.slice(0, 24)}`);
    rows.push({
      id,
      who: String(match.username || match.user || '').trim(),
      channel: channelName,
      when: formatSlackWhen(match.ts),
      text,
      permalink
    });
    if (rows.length >= limit) break;
  }
  return rows;
}

// ---- Deep Slack read: channels → history → awaiting-reply / decision-forming ----
//
// The briefing's Slack-FIRST sourcing. Unlike the blocker SEARCH above, this reads
// the user's actual channels (SLACK_LIST_ALL_CHANNELS), recent history per channel
// (SLACK_FETCH_CONVERSATION_HISTORY), the workspace identity (SLACK_LIST_ALL_USERS
// matched by email), and the team domain (SLACK_FETCH_TEAM_INFO, for deep links).
// All four are READ tools — verified live to pass the read-only route guard (HTTP
// 200, never a write). Classification runs off the history payload alone (reply_count
// / reply_users / thread_ts / raw @mention), so no per-thread fetch is needed. Honest
// contract throughout: [] / null on any unsuccessful/empty/malformed payload; never
// fabricates a message, a name, or a link.

// Composio sometimes wraps the Slack API result a second level deep under data.data.
// Return whichever level actually carries the expected Slack keys.
function slackData(result) {
  if (!result || result.successful === false) return null;
  const outer = result.data || result;
  if (outer && typeof outer === 'object' && outer.data && typeof outer.data === 'object') {
    const inner = outer.data;
    if (inner.members || inner.channels || inner.messages || inner.team) return inner;
  }
  return outer;
}

// Resolve the signed-in user inside the Slack workspace by matching their email
// against the member list. Returns { userId, userName } or null (caller degrades to
// the blocker list when identity is unknown — never guesses a user).
export function resolveSlackSelf(result, email) {
  const want = String(email || '')
    .trim()
    .toLowerCase();
  if (!want) return null;
  const data = slackData(result);
  const members = Array.isArray(data?.members) ? data.members : [];
  for (const member of members) {
    const mail = String(member?.profile?.email || '')
      .trim()
      .toLowerCase();
    if (mail && mail === want) {
      const profile = member.profile || {};
      return {
        userId: String(member.id || '').trim(),
        userName: String(profile.display_name || member.real_name || member.name || '').trim()
      };
    }
  }
  return null;
}

// id -> display name map from SLACK_LIST_ALL_USERS, so a U0… author renders as a
// human name. {} on any malformed payload.
export function buildSlackUserMap(result) {
  const data = slackData(result);
  const members = Array.isArray(data?.members) ? data.members : [];
  const map = {};
  for (const member of members) {
    const id = String(member?.id || '').trim();
    if (!id) continue;
    const profile = member.profile || {};
    const name = String(profile.display_name || member.real_name || member.name || '').trim();
    if (name) map[id] = name;
  }
  return map;
}

// Team subdomain from SLACK_FETCH_TEAM_INFO, used to synthesize message deep links.
// '' when absent/odd — callers then render copy-only rather than a broken link.
export function slackTeamDomain(result) {
  const data = slackData(result);
  const team = data?.team || data;
  const domain = team && typeof team === 'object' ? String(team.domain || '').trim() : '';
  return /^[a-z0-9-]+$/i.test(domain) ? domain : '';
}

// Member, non-archived channels from SLACK_LIST_ALL_CHANNELS, capped. [] on malformed.
export function normalizeSlackChannelList(result, { limit = 8 } = {}) {
  const data = slackData(result);
  const channels = Array.isArray(data?.channels) ? data.channels : [];
  const rows = [];
  for (const channel of channels) {
    if (!channel || typeof channel !== 'object') continue;
    if (channel.is_archived || !channel.is_member) continue;
    const id = String(channel.id || '').trim();
    if (!id) continue;
    rows.push({ id, name: String(channel.name || '').trim() });
    if (rows.length >= limit) break;
  }
  return rows;
}

// Deep link to a specific Slack message. '' when any part is missing — never
// fabricates a link (the briefing then offers copy-only).
export function slackArchiveLink(domain, channelId, ts) {
  const dom = String(domain || '').trim();
  const channel = String(channelId || '').trim();
  const stamp = String(ts || '').trim();
  if (!dom || !channel || !stamp) return '';
  return `https://${dom}.slack.com/archives/${channel}/p${stamp.replace('.', '')}`;
}

// Normalize one channel's SLACK_FETCH_CONVERSATION_HISTORY into rows. Keeps the RAW
// text (for the @mention check, which must see <@U…> before cleanSlackText rewrites
// it) alongside the display text. Skips system/join subtypes and empty bodies.
export function normalizeSlackHistory(result, { channelId = '', channelName = '' } = {}) {
  const data = slackData(result);
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  const rows = [];
  for (const message of messages) {
    if (!message || typeof message !== 'object') continue;
    if (message.subtype) continue;
    const raw = String(message.text || '');
    const text = cleanSlackText(raw);
    if (!text) continue;
    const ts = String(message.ts || '');
    rows.push({
      id: ts || `${channelId}:${text.slice(0, 24)}`,
      channelId: String(channelId),
      channel: String(channelName),
      who: String(message.user || '').trim(),
      raw,
      text,
      ts,
      when: formatSlackWhen(ts),
      thread_ts: String(message.thread_ts || ''),
      reply_count: Number(message.reply_count || 0),
      reply_users: Array.isArray(message.reply_users) ? message.reply_users.map(String) : []
    });
  }
  return rows;
}

// Classify a history row for the signed-in user. 'awaiting' | 'weighin' | null.
//  awaiting  — someone @-mentioned you and it is not your own message: you owe a reply.
//  weighin   — an active thread (>=2 replies) you neither started, were tagged in, nor
//              joined: a decision forming without you.
// Biased to safety: only positive evidence flags an item; everything else is null.
export function classifySlackRow(row, { selfUserId } = {}) {
  const self = String(selfUserId || '').trim();
  if (!self || !row) return null;
  const authoredBySelf = row.who === self;
  const mentionsSelf = String(row.raw || '').includes(`<@${self}>`);
  if (mentionsSelf && !authoredBySelf) return 'awaiting';
  const inThread = (row.reply_users || []).includes(self);
  if (!mentionsSelf && !authoredBySelf && !inThread && Number(row.reply_count || 0) >= 2) {
    return 'weighin';
  }
  return null;
}

// ---- Relevance ranking: FootprintGatedRelevance (FGR) ---------------------------
// The deep read used to flag ANY >=2-reply thread and sort BOTH buckets by recency
// only — so trivia outranked substance and channels the user doesn't care about
// surfaced as noise. FGR scores each candidate by how much it actually deserves the
// user's attention and DROPS low-relevance weigh-in noise, while @-mention items
// ("awaiting") are near-immune to dropping. score = (address) × (footprintPrior +
// vitality + earned-lexical-signals) × recency-DECAY (recency is a bounded multiplier,
// not the sort key). The footprint reuses the user's own daily-briefing reach model
// (you @them +3, they @you +3, they post +1) so relevance generalizes from behaviour
// with NO hardcoded interests. Constants are named + tunable (calibrated to worked
// examples — log per-item components on a real pull before trusting the cutoffs).
const REL = {
  people: 0.34, // footprintPrior weights (sum to 1)
  chan: 0.3,
  thread: 0.2,
  org: 0.16,
  vitality: 0.24, // thread-liveness weight in the body
  ask: 0.34, // lexical: an outward ask
  decision: 0.22,
  blocker: 0.2,
  deadline: 0.14,
  urgencyFamilyCap: 0.4, // decision+blocker+deadline can't exceed this
  targetNamed: 0.1, // an ask that names someone other than self
  targetBroadcast: 0.04,
  socialDampen: 0.4 // multiplier on un-addressed social/celebration chatter
};
const DROP_THRESHOLD = 0.34;
const VITALITY_FLOOR = 0.15;
const AWAIT_FLOOR = 0.55;
const DECAY_FLOOR = 0.5;
const DECAY_HALFLIFE_H = 24;

const MENTION_RE = /<@([UW][A-Z0-9]+)>/g;
const BROADCAST_RE = /<!(here|channel|everyone)>|@(here|channel|everyone)\b/i;
const ASK_RE =
  /\?\s*$|\b(can|could|would) (you|someone|anyone)\b|\b(pls|please (review|confirm|approve|send|check|look)|thoughts|wdyt|ptal|lmk|eta|need (you|your|someone) to)\b/i;
const DECISION_RE =
  /\b(approv\w+|sign[- ]?off|signoff|go ?\/? ?no[- ]?go|green ?light|final call|need a decision|your call|ok to (proceed|merge)|please confirm)\b/i;
const BLOCKER_RE =
  /\b(blocker|block(ed|ing)|can'?t proceed|stuck on|waiting (on you|for)|regression|outage|incident|sev[12]|p[01]\b|urgent|asap|critical)\b/i;
const DEADLINE_RE =
  /\b(eod|eow|cob|by (today|tomorrow|mon|tue|wed|thu|fri|tonight|noon)|deadline|due (today|tomorrow|by)|time[- ]sensitive)\b/i;
const SOCIAL_RE =
  /\b(congrat\w*|welcome|happy (birthday|friday)|kudos|shout[- ]?out|excited to|thrilled to|offsite|lunch|coffee|good morning|on (pto|vacation)|no updates|same as yesterday)\b|[🎉🥳🙌🎂]/u;

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);

// Length of the text once Slack markup + emoji + whitespace are stripped — used to
// drop reactions/emoji-only rows as hard noise.
function strippedLength(text) {
  return String(text || '')
    .replace(/<@[^>]+>/g, '')
    .replace(/<#[^>]+>/g, '')
    .replace(/<https?:[^>]+>/g, '')
    .replace(/:[a-z0-9_+-]+:/gi, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s+/g, '').length;
}

// Set of automated-author ids from SLACK_LIST_ALL_USERS, using Slack's real is_bot/
// is_app FLAGS (plus USLACKBOT) — NOT a name heuristic. This is what makes "is this a
// bot?" reliable: a human whose display name contains "app"/"workflow" is never
// misread as a bot (a prior name-regex did exactly that and silently dropped owed
// @-replies). {} payload -> a set with just USLACKBOT.
export function buildSlackBotIdSet(result) {
  const data = slackData(result);
  const members = Array.isArray(data?.members) ? data.members : [];
  const set = new Set(['USLACKBOT']);
  for (const member of members) {
    const id = String(member?.id || '').trim();
    if (id && (member.is_bot || member.is_app || member.is_workflow_bot)) set.add(id);
  }
  return set;
}

// Is the author a confirmed automated account? Flag-driven only (the bot-id set built
// from is_bot/is_app), so it never false-positives on a human's name.
export function isBotAuthor(whoId, botIds) {
  const id = String(whoId || '');
  if (!id) return false;
  if (id === 'USLACKBOT') return true;
  return botIds instanceof Set ? botIds.has(id) : false;
}

// id -> email domain map from SLACK_LIST_ALL_USERS, for the org-proximity signal.
// {} on a malformed payload; an address without a domain is simply omitted.
export function buildSlackEmailDomainMap(result) {
  const data = slackData(result);
  const members = Array.isArray(data?.members) ? data.members : [];
  const map = {};
  for (const member of members) {
    const id = String(member?.id || '').trim();
    const email = String(member?.profile?.email || '')
      .trim()
      .toLowerCase();
    if (id && email.includes('@')) map[id] = email.split('@')[1];
  }
  return map;
}

// PASS 1 — derive the per-user footprint from the already-fetched histories (no extra
// read, no LLM). channelAffinity = how much the user posts in each channel; peopleAff
// reuses the daily-briefing reach model; touchedThreads = threads the user posted in.
export function buildFootprint(histories, { selfUserId } = {}) {
  const self = String(selfUserId || '').trim();
  const chanCount = new Map();
  const peerScore = new Map();
  const touchedThreads = new Set();
  const bump = (m, k, n) => k && m.set(k, (m.get(k) || 0) + n);
  if (self) {
    for (const rows of histories || []) {
      for (const row of rows || []) {
        if (!row) continue;
        const who = String(row.who || '').trim();
        if (!who) continue;
        const mentions = [...String(row.raw || '').matchAll(MENTION_RE)].map((x) => x[1]);
        if (who === self) {
          bump(chanCount, String(row.channelId || ''), 1);
          if (row.thread_ts) touchedThreads.add(String(row.thread_ts));
          for (const t of mentions) if (t !== self) bump(peerScore, t, 3);
        } else {
          bump(peerScore, who, 1);
          if (mentions.includes(self)) bump(peerScore, who, 3);
        }
      }
    }
  }
  let maxChan = 1;
  let maxPeer = 1;
  for (const v of chanCount.values()) if (v > maxChan) maxChan = v;
  for (const v of peerScore.values()) if (v > maxPeer) maxPeer = v;
  return { chanCount, peerScore, touchedThreads, maxChan, maxPeer };
}

function recencyDecay(ts) {
  const sec = Number(ts);
  if (!Number.isFinite(sec) || sec <= 0) return DECAY_FLOOR;
  const ageH = Math.max(0, (Date.now() / 1000 - sec) / 3600);
  return DECAY_FLOOR + (1 - DECAY_FLOOR) * Math.exp(-ageH / DECAY_HALFLIFE_H);
}

// Score one classified row. ctx: { selfUserId, kind, footprint, userMap,
// emailDomainMap, userDomain }. Returns { score, drop, reason, ...components }. Pure.
export function scoreSlackRelevance(row, ctx = {}) {
  const { selfUserId, kind, footprint, botIds, emailDomainMap = {}, userDomain = '' } = ctx;
  const self = String(selfUserId || '').trim();
  const who = String(row.who || '').trim();
  const raw = String(row.raw || '');
  const text = String(row.text || '');
  const decay = recencyDecay(row.ts);

  // HARD-NOISE. The ONLY thing that can drop an AWAITING (@-mention) item is a
  // confirmed BOT author — never a text pattern. ("PR 22 ready for your review?",
  // "deploy is down, fix?" are real owed replies, not CI noise; system join/leave
  // rows are already filtered upstream by normalizeSlackHistory.) Weigh-in items
  // additionally drop reactions/emoji-only rows (no real discussion to weigh in on).
  if (isBotAuthor(who, botIds)) {
    return { score: 0, drop: true, reason: 'hard-noise', address: 0, decay };
  }
  if (kind === 'weighin' && strippedLength(text) < 3) {
    return { score: 0, drop: true, reason: 'hard-noise', address: 0, decay };
  }

  const replyUsers = Array.isArray(row.reply_users) ? row.reply_users : [];
  // graded direct-address class
  let address = 0;
  if (kind === 'awaiting') address = BROADCAST_RE.test(raw) ? 0.3 : 1;
  else if (replyUsers.includes(self)) address = 0.45; // weigh-in I'm already in

  // footprintPrior — the generalizing, behaviour-derived relevance core
  const fp = footprint || buildFootprint([], {});
  let peopleAff = 0;
  for (const id of [who, ...replyUsers]) {
    peopleAff = Math.max(peopleAff, (fp.peerScore.get(id) || 0) / fp.maxPeer);
  }
  const chanAff = (fp.chanCount.get(String(row.channelId || '')) || 0) / fp.maxChan;
  const threadTouch = row.thread_ts && fp.touchedThreads.has(String(row.thread_ts)) ? 1 : 0;
  const authorDomain = String(emailDomainMap[who] || '').toLowerCase();
  const orgProx =
    authorDomain && userDomain && authorDomain === String(userDomain).toLowerCase() ? 1 : 0;
  const prior = clamp01(
    REL.people * peopleAff + REL.chan * chanAff + REL.thread * threadTouch + REL.org * orgProx
  );

  // vitality — distinct PEOPLE dominate (raw reply_count was the old noise source)
  const haveReplyUsers = Array.isArray(row.reply_users);
  const distinct = new Set(replyUsers).size;
  const replyCount = Number(row.reply_count || 0);
  const vitality = haveReplyUsers
    ? 0.6 * clamp01(distinct / 4) + 0.4 * clamp01(replyCount / 6)
    : clamp01(replyCount / 6);

  // earned lexical signals (family-capped, bounded nudges)
  const hasAsk = ASK_RE.test(text);
  let urg = 0;
  if (DECISION_RE.test(text)) urg += REL.decision;
  if (BLOCKER_RE.test(text)) urg += REL.blocker;
  if (DEADLINE_RE.test(text)) urg += REL.deadline;
  urg = Math.min(urg, REL.urgencyFamilyCap);
  let earned = (hasAsk ? REL.ask : 0) + urg;
  if (hasAsk) {
    const others = [...raw.matchAll(MENTION_RE)].map((x) => x[1]).filter((id) => id !== self);
    earned += others.length ? REL.targetNamed : BROADCAST_RE.test(raw) ? REL.targetBroadcast : 0;
  }

  // body + social dampener. Fires only on un-addressed chatter with NO ask AND NO
  // urgency/decision/blocker signal — so "excited to report the sev1 outage" or
  // "congrats, but we're blocked on sign-off" is NOT mistaken for celebration noise.
  let body = prior + REL.vitality * vitality + earned;
  const isSocial = address === 0 && !hasAsk && urg === 0 && SOCIAL_RE.test(text);
  if (isSocial) body *= REL.socialDampen;

  // A genuine multi-person discussion (>=3 distinct repliers, not social chatter) is
  // worth surfacing even from someone outside the recent footprint window — otherwise
  // a busy thread among real colleagues you simply haven't posted in gets buried. Let
  // vitality carry it over the bar so it ranks sensibly, not just survives.
  const substantive = kind === 'weighin' && distinct >= 3 && !isSocial;

  let score = Math.min(1, (0.4 + 0.6 * address) * body * decay);
  if (kind === 'awaiting') {
    // an owed reply is never near the bottom, even from a stranger
    score = Math.max(score, AWAIT_FLOOR + 0.25 * ((decay - DECAY_FLOOR) / (1 - DECAY_FLOOR)));
  } else if (substantive) {
    score = Math.max(score, DROP_THRESHOLD + 0.2 * clamp01(vitality - VITALITY_FLOOR));
  }

  let drop = false;
  let reason = 'kept';
  if (kind === 'weighin') {
    if (haveReplyUsers && vitality < VITALITY_FLOOR) {
      drop = true;
      reason = 'low-vitality';
    } else if (substantive) {
      // kept: real multi-person discussion
    } else if (score < DROP_THRESHOLD) {
      drop = true;
      reason = 'below-threshold';
    } else if (prior === 0 && !hasAsk && urg === 0) {
      drop = true;
      reason = 'stranger-no-ask';
    }
  }
  return {
    score: Number(score.toFixed(4)),
    drop,
    reason,
    address,
    prior: Number(prior.toFixed(4)),
    vitality: Number(vitality.toFixed(4)),
    earned: Number(earned.toFixed(4)),
    isSocial,
    decay: Number(decay.toFixed(4))
  };
}

function toSlackItem(row, domain, userMap, score) {
  return {
    id: row.id,
    channel: row.channel,
    channelId: row.channelId,
    whoId: row.who,
    who: userMap[row.who] || row.who,
    text: row.text,
    when: row.when,
    ts: row.ts,
    // Reply IN the thread when there is one, else as a top-level message on the parent
    // ts. Carried through so a gated Slack reply lands in the right place, not the channel root.
    thread_ts: row.thread_ts || row.ts,
    score,
    replyHref: slackArchiveLink(domain, row.channelId, row.thread_ts || row.ts)
  };
}

// Merge per-channel histories into the two briefing arrays, RELEVANCE-ranked (not
// recency), dropping low-relevance weigh-in noise. Resolves the author id to a display
// name and synthesizes a reply link per item. Awaiting items only drop on hard noise;
// if every weigh-in item is filtered out, the single best survivor is kept so the
// section is never silently empty when there was real (if marginal) activity.
export function buildSlackSignals(
  histories,
  {
    selfUserId,
    domain,
    userMap = {},
    botIds,
    emailDomainMap = {},
    userDomain = '',
    awaitingLimit = 6,
    weighInLimit = 6
  } = {}
) {
  const footprint = buildFootprint(histories, { selfUserId });
  const awaitingRows = [];
  const weighInRows = [];
  for (const rows of histories || []) {
    for (const row of rows || []) {
      const kind = classifySlackRow(row, { selfUserId });
      if (kind === 'awaiting') awaitingRows.push(row);
      else if (kind === 'weighin') weighInRows.push(row);
    }
  }
  const ctxBase = { selfUserId, footprint, botIds, emailDomainMap, userDomain };
  const rank = (rows, kind, limit) => {
    const scored = rows.map((row) => ({
      row,
      rel: scoreSlackRelevance(row, { ...ctxBase, kind })
    }));
    let kept = scored.filter((s) => !s.rel.drop);
    if (kind === 'weighin' && kept.length === 0) {
      const best = scored
        .filter((s) => s.rel.reason !== 'hard-noise')
        .sort((a, b) => b.rel.score - a.rel.score)[0];
      if (best) kept = [best];
    }
    return kept
      .sort((a, b) => b.rel.score - a.rel.score || Number(b.row.ts || 0) - Number(a.row.ts || 0))
      .slice(0, limit)
      .map((s) => toSlackItem(s.row, domain, userMap, s.rel.score));
  };
  return {
    awaiting: rank(awaitingRows, 'awaiting', awaitingLimit),
    weighIn: rank(weighInRows, 'weighin', weighInLimit)
  };
}

// Orchestrate the deep read with an injected `read(tool, args) -> result | null`
// (the hook supplies a connectorRead-backed reader; tests supply a mock). Resolves
// identity FIRST and bails to the honest-empty degrade the instant the signed-in
// user cannot be matched — so a missing scope or wrong workspace never fabricates a
// classification. Returns { awaiting, weighIn, selfResolved }.
export async function fetchSlackDeep({ read, email, channelLimit = 8 } = {}) {
  const empty = { awaiting: [], weighIn: [], selfResolved: false };
  if (typeof read !== 'function') return empty;
  const [usersResult, channelsResult, teamResult] = await Promise.all([
    read('SLACK_LIST_ALL_USERS', { limit: 200 }),
    read('SLACK_LIST_ALL_CHANNELS', { limit: 200 }),
    read('SLACK_FETCH_TEAM_INFO', {})
  ]);
  const self = resolveSlackSelf(usersResult, email);
  if (!self || !self.userId) return empty;
  const channels = normalizeSlackChannelList(channelsResult, { limit: channelLimit });
  const histories = await Promise.all(
    channels.map((channel) =>
      Promise.resolve(
        read('SLACK_FETCH_CONVERSATION_HISTORY', { channel: channel.id, limit: 30 })
      ).then((result) =>
        normalizeSlackHistory(result, { channelId: channel.id, channelName: channel.name })
      )
    )
  );
  const signals = buildSlackSignals(histories, {
    selfUserId: self.userId,
    domain: slackTeamDomain(teamResult),
    userMap: buildSlackUserMap(usersResult),
    botIds: buildSlackBotIdSet(usersResult),
    emailDomainMap: buildSlackEmailDomainMap(usersResult),
    userDomain: String(email || '').split('@')[1] || ''
  });
  return { ...signals, selfResolved: true };
}
