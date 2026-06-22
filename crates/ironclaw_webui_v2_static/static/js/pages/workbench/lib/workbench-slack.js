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
