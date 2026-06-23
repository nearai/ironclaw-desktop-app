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
  // Long / multi-line bodies are status reports, not a direct ask for help.
  const lineCount = raw.split(/\r?\n/).filter((line) => line.trim()).length;
  if (lineCount >= 3) return false;
  if (text.length > 280) return false;
  // Report-style titles even when they fit on a line: "… QA Update:", "Weekly
  // Status", "What's Working", "Sprint recap", etc.
  const reportTitle =
    /\b(qa|status|standup|stand-?up|weekly|daily|monthly|sprint|release|bug\s*bash)\b[^.\n]{0,30}\b(update|report|summary|recap|notes?|digest)\b/i.test(
      text
    ) ||
    /^[^.\n]{0,60}\b(update|report|summary|recap|digest)\s*:/i.test(text) ||
    /\bwhat'?s\s+(working|new|next|shipped|done)\b/i.test(text);
  if (reportTitle) return false;
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

// Merge per-channel histories into the two briefing arrays, newest-first, capped.
// Resolves the author id to a display name and synthesizes a reply link per item.
export function buildSlackSignals(
  histories,
  { selfUserId, domain, userMap = {}, awaitingLimit = 6, weighInLimit = 6 } = {}
) {
  const awaiting = [];
  const weighIn = [];
  for (const rows of histories || []) {
    for (const row of rows || []) {
      const kind = classifySlackRow(row, { selfUserId });
      if (!kind) continue;
      const item = {
        id: row.id,
        channel: row.channel,
        channelId: row.channelId,
        whoId: row.who,
        who: userMap[row.who] || row.who,
        text: row.text,
        when: row.when,
        ts: row.ts,
        replyHref: slackArchiveLink(domain, row.channelId, row.thread_ts || row.ts)
      };
      (kind === 'awaiting' ? awaiting : weighIn).push(item);
    }
  }
  const byRecency = (a, b) => Number(b.ts || 0) - Number(a.ts || 0);
  awaiting.sort(byRecency);
  weighIn.sort(byRecency);
  return { awaiting: awaiting.slice(0, awaitingLimit), weighIn: weighIn.slice(0, weighInLimit) };
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
    userMap: buildSlackUserMap(usersResult)
  });
  return { ...signals, selfResolved: true };
}
