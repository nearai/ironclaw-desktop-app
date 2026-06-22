// Pure helpers for the connector-backed Workbench surfaces.
//
// These translate the read-only connector route payloads
// (`connectorsConnected()` / `connectorRead()` in `lib/api.js`) into the
// view-model the home surface renders. They are intentionally side-effect free
// and resilient: malformed or empty payloads degrade to honest empty results,
// never to fabricated rows. The sidecar holds the Composio credential; the key
// never reaches the browser.

// Toolkit slug (as reported by Composio `/connectors/connected`) -> the source
// family the Workbench surfaces. Only families with a real ACTIVE account are
// ever marked ready.
const TOOLKIT_FAMILY = Object.freeze({
  gmail: 'gmail',
  googlemail: 'gmail',
  googlecalendar: 'calendar',
  'google-calendar': 'calendar',
  googledrive: 'drive',
  'google-drive': 'drive',
  googledocs: 'drive',
  'google-docs': 'drive',
  googlesheets: 'drive',
  notion: 'notion',
  slack: 'slack',
  github: 'github'
});

// The families the Workbench shows a readiness chip for, in display order.
export const WORKBENCH_CONNECTOR_FAMILIES = Object.freeze([
  { id: 'gmail', label: 'Gmail', icon: 'mail' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'drive', label: 'Drive', icon: 'folder' },
  { id: 'notion', label: 'Notion', icon: 'file' },
  { id: 'slack', label: 'Slack', icon: 'chat' },
  { id: 'github', label: 'GitHub', icon: 'spark' }
]);

function asString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isActiveStatus(status) {
  return asString(status).toUpperCase() === 'ACTIVE';
}

// Normalize the `/connectors/connected` payload into a de-duplicated set of
// active toolkit slugs. Accepts `{ accounts: [...] }` or a bare array; ignores
// anything not explicitly ACTIVE.
export function normalizeConnectedAccounts(payload) {
  const accounts = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.accounts)
      ? payload.accounts
      : [];
  const activeToolkits = new Set();
  for (const account of accounts) {
    if (!account || typeof account !== 'object') continue;
    if (!isActiveStatus(account.status)) continue;
    const toolkit = asString(account.toolkit).toLowerCase();
    if (toolkit) activeToolkits.add(toolkit);
  }
  return activeToolkits;
}

// Build the per-family readiness chips. A family is "ready · via Composio" only
// when at least one ACTIVE account maps to it; otherwise it is omitted entirely
// (honest: we never show a family we cannot actually reach).
export function connectorFamilyReadiness(payload) {
  const activeToolkits = normalizeConnectedAccounts(payload);
  const readyFamilies = new Set();
  for (const toolkit of activeToolkits) {
    const family = TOOLKIT_FAMILY[toolkit];
    if (family) readyFamilies.add(family);
  }
  return WORKBENCH_CONNECTOR_FAMILIES.filter((family) => readyFamilies.has(family.id)).map(
    (family) => ({
      id: family.id,
      label: family.label,
      icon: family.icon,
      state: 'ready',
      statusLabel: 'Ready',
      via: 'Composio'
    })
  );
}

export function hasActiveToolkit(payload, family) {
  return connectorFamilyReadiness(payload).some((item) => item.id === family);
}

function decodeLabelIds(message) {
  const ids = Array.isArray(message?.labelIds) ? message.labelIds : [];
  return ids.map((id) => asString(id).toUpperCase());
}

function headerValue(message, name) {
  const headers = Array.isArray(message?.payload?.headers) ? message.payload.headers : [];
  const match = headers.find((h) => asString(h?.name).toLowerCase() === name.toLowerCase());
  return asString(match?.value);
}

// Mailing-list / automated local-parts that never expect a personal reply.
// Includes app-notification senders (Gemini, Calendar, Drive shares) that often
// reach the Primary tab without List-Unsubscribe / category labels.
const BULK_LOCALPARTS =
  /^(no[-_.]?reply|noreply|do[-_.]?not[-_.]?reply|newsletter|news|notifications?|updates?|mailer|mail|digest|alerts?|marketing|info|hello|invest|inquiry|pkginfo|donotreply|gemini-notes|calendar-notification|drive-shares|via-google)([+.-]|$)/i;

// True when a message is bulk/newsletter mail — list broadcasts, promotions,
// automated updates — i.e. it must NEVER be surfaced as "needs a reply". Same
// signals the validated profile engine uses (scripts/workbench-profile-engine.mjs):
// List-Unsubscribe / List-Id / Precedence:bulk|list / Gmail bulk categories /
// an automated sender local-part. Pure + side-effect free.
export function messageIsBulk(message) {
  if (!message || typeof message !== 'object') return false;
  if (headerValue(message, 'List-Unsubscribe')) return true;
  if (headerValue(message, 'List-Id')) return true;
  const precedence = headerValue(message, 'Precedence').toLowerCase();
  if (precedence === 'bulk' || precedence === 'list' || precedence === 'junk') return true;
  const labels = decodeLabelIds(message);
  if (
    labels.some((l) =>
      ['CATEGORY_PROMOTIONS', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS', 'CATEGORY_SOCIAL'].includes(l)
    )
  ) {
    return true;
  }
  const address = extractEmailAddress(
    asString(message?.sender) || asString(message?.from) || asString(message?.payload?.from)
  );
  const localPart = address.split('@')[0] || '';
  return BULK_LOCALPARTS.test(localPart);
}

// Parse a Gmail timestamp string (epoch-ms internalDate like "1718900000000", or
// an ISO/RFC date) into epoch milliseconds. Returns 0 when unparseable, so a
// missing/garbage timestamp never produces a false "you replied after" signal.
export function toEpochMs(value) {
  const raw = asString(value).trim();
  if (!raw) return 0;
  if (/^\d{10,}$/.test(raw)) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

// The reply-state primitive: from the user's own SENT rows, build threadId ->
// latest-sent-timestamp (ms). Used to suppress threads the user has already
// answered (they spoke last). Pure; tolerates missing threadId/timestamp.
export function answeredThreadIndex(sentRows) {
  const list = Array.isArray(sentRows) ? sentRows : [];
  const index = new Map();
  for (const row of list) {
    const threadId = asString(row?.threadId);
    if (!threadId) continue;
    const ts = toEpochMs(row?.timestamp);
    if (!ts) continue;
    const prev = index.get(threadId) || 0;
    if (ts > prev) index.set(threadId, ts);
  }
  return index;
}

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);

// Named urgency signals + weights (a deterministic 0..1 linear sum), ported from
// the daily-briefing skill's scorer. Used ONLY as a tiebreaker WITHIN a reply
// tier (VIP/Respond/Important/Unread) — it reorders same-tier mail so a "can you
// review by EOD?" floats above a casual "thanks!", but can never jump the
// categorical lane (a bad regex score can't push a stranger above a VIP).
const URGENCY_WEIGHTS = Object.freeze({
  ask: 0.3,
  deadline: 0.25,
  age: 0.2,
  proximity: 0.15,
  blocking: 0.1
});
const ASK_RE =
  /\?|\b(can|could|would|will)\s+you\b|\bplease\b|\blet me know\b|\byour (thoughts|input|feedback|take|review|sign[- ]?off)\b|\bwhat do you think\b/i;
const DEADLINE_RE =
  /\b(by\s+(eod|cob|end of (day|week)|tomorrow|today|mon|tue|wed|thu|fri|monday|tuesday|wednesday|thursday|friday)|deadline|asap|urgent|time[- ]sensitive|due\s|before\s+(eod|cob|tomorrow|the))\b/i;
const BLOCKING_RE =
  /\b(blocked|blocker|waiting on you|need(ed|s)? (it )?from you|need your|stuck|can'?t proceed|cannot proceed|holding up|gating)\b/i;

// Score one inbox message 0..1 by named urgency signals. `now` is injectable for
// tests. Pure; reads only the message's own subject/preview/timestamp/importance.
export function urgencyScore(message, { now = Date.now(), weights = URGENCY_WEIGHTS } = {}) {
  if (!message || typeof message !== 'object') return 0;
  const text = `${asString(message.subject)} ${readPreview(message)}`;
  const ask = ASK_RE.test(text) ? 1 : 0;
  const deadline = DEADLINE_RE.test(text) ? 1 : 0;
  const blocking = BLOCKING_RE.test(text) ? 1 : 0;
  const ts = toEpochMs(message.timestamp);
  // Older unread = more likely overdue; ramp linearly over 72h.
  const age = ts ? clamp01(Math.max(0, now - ts) / (72 * 3600000)) : 0;
  // Proximity is the sender's standing. Constant within a reply tier (so inert as
  // a same-tier tiebreak), included so the score is meaningful standalone too.
  const proximity = message.important ? 1 : 0.3;
  return (
    weights.ask * ask +
    weights.deadline * deadline +
    weights.age * age +
    weights.proximity * proximity +
    weights.blocking * blocking
  );
}

// The reply-state rule, shared by triage and the briefing: true when the user has
// already replied in this message's thread (a sent message dated after this
// inbound). Positive evidence only — returns false on a missing index/thread/ts,
// so an unverifiable thread is never falsely filed.
export function isAnsweredThread(message, sentThreadIndex) {
  if (!message) return false;
  const answered = sentThreadIndex instanceof Map ? sentThreadIndex : null;
  if (!answered || !answered.size) return false;
  const threadId = String(message.threadId || '');
  if (!threadId) return false;
  const sentTs = answered.get(threadId) || 0;
  const inboundTs = toEpochMs(message.timestamp);
  return Boolean(sentTs && inboundTs && sentTs > inboundTs);
}

// The single source of truth for which inbox mail is "triage-worthy" — i.e. may
// be surfaced on the Workbench (Needs-a-decision, Arrived, and the rail's
// Needs-a-reply). Drops bulk/newsletter/notes mail (messageIsBulk — e.g. the
// gemini-notes meeting summaries the user never replies to), senders the user
// corrected to "ignore", rows the user has dismissed, and — the reply-state gate
// — threads the user has ALREADY ANSWERED (a sent message in the thread dated
// after the inbound), so the surface is an open-loop queue, not an unread list.
// Bias-to-safety: a thread is dropped ONLY on positive evidence (a later sent
// timestamp); absent that evidence the item stays surfaced, since hiding a real
// open loop is worse than one extra row. Everything dropped is still in the
// mailbox — filed, not surfaced. Pure; mutates nothing.
export function selectTriageInbox(
  messages,
  { overrides = {}, dismissals = {}, learnedIgnore, sentThreadIndex } = {}
) {
  const list = Array.isArray(messages) ? messages : [];
  const norm = {};
  for (const [email, tier] of Object.entries(
    overrides && typeof overrides === 'object' ? overrides : {}
  )) {
    norm[String(email || '').toLowerCase()] = tier;
  }
  const dismissed = dismissals && typeof dismissals === 'object' ? dismissals : {};
  const learned = learnedIgnore instanceof Set ? learnedIgnore : new Set();
  const answered = sentThreadIndex instanceof Map ? sentThreadIndex : new Map();
  return list.filter((message) => {
    if (!message || message.isBulk) return false;
    const email = String(message.fromEmail || '').toLowerCase();
    const tier = norm[email];
    if (tier === 'ignore') return false;
    const key = String(message.messageId || message.id || '');
    if (key && dismissed[key]) return false;
    // Learned auto-file: a sender repeatedly dismissed as sender-level noise.
    // An explicit VIP/Respond/FYI correction (any non-ignore tier) overrides it.
    if (!tier && learned.has(email)) return false;
    // Reply-state gate: filed if you've already replied in-thread (a sent
    // message dated after this inbound). Positive evidence only.
    if (isAnsweredThread(message, answered)) return false;
    return true;
  });
}

// Best-effort extraction of a human sender name/address from the varied shapes
// Composio can return for GMAIL_FETCH_EMAILS.
function readSender(message) {
  const raw =
    asString(message?.sender) ||
    asString(message?.from) ||
    asString(message?.fromEmail) ||
    asString(message?.payload?.from);
  if (!raw) return '';
  // "Display Name <addr@host>" -> "Display Name"; bare address -> address.
  const match = raw.match(/^\s*"?([^"<]*?)"?\s*<[^>]+>\s*$/);
  if (match && match[1].trim()) return match[1].trim();
  return raw;
}

// Extract a bare email address from a raw "from"/"sender" header that may be
// "Display Name <addr@host>" or just "addr@host". Returns '' when no address is
// present, so a reply draft never invents a recipient.
export function extractEmailAddress(raw) {
  const value = asString(raw);
  if (!value) return '';
  const bracketed = value.match(/<\s*([^<>@\s]+@[^<>@\s]+)\s*>/);
  if (bracketed) return bracketed[1].trim();
  const bare = value.match(/[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+/);
  return bare ? bare[0].trim() : '';
}

// Decode a numeric HTML entity code point to its character, guarding against
// invalid/out-of-range values (which would throw); returns '' for those so the
// later invisible-character pass can drop padding code points cleanly.
function safeFromCodePoint(code) {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch (_) {
    return '';
  }
}

function isC0OrC1Control(char) {
  const code = char.charCodeAt(0);
  return (
    code <= 0x08 ||
    code === 0x0b ||
    code === 0x0c ||
    (code >= 0x0e && code <= 0x1f) ||
    (code >= 0x7f && code <= 0x9f)
  );
}

// Strip markup, decode the few common HTML entities, and collapse whitespace so
// a preview is a clean human line — never raw HTML or templating cruft. Returns
// '' when the text is still markup-shaped (so the card omits a junk preview
// rather than rendering `<html lang="en" …>` or `%title%`).
function cleanPreviewText(raw) {
  if (!raw) return '';
  const stripped = raw
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    // Decode numeric HTML entities (decimal + hex) — newsletters pad the preview
    // with `&#847;`/`&#8199;` zero-width joiners that would otherwise show raw.
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    // Strip zero-width / invisible / control characters so a preview never
    // renders as a run of empty boxes: soft hyphen (00AD), zero-width
    // space..RLM (200B-200F), LRE..RLO/LRM markers (202A-202E), word joiner
    // (2060), BOM (FEFF), combining grapheme joiner (034F), and C0/C1 control
    // ranges. NBSP and other Unicode spaces collapse to a normal space.
    .replace(/[\u00AD\u200B-\u200F\u202A-\u202E\u2060\uFEFF\u034F]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, ' ')
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Drop residual markup/templating leftovers (e.g. leading `<`, `{...}`,
  // `%token%`, or CSS-ish `prop:value;` runs) — these are not human previews.
  if (!stripped) return '';
  if (/^[<{[]/.test(stripped)) return '';
  if (/%[a-z_]+%/i.test(stripped)) return '';
  if (/\b[a-z-]+\s*:\s*[^;]+;/i.test(stripped) && stripped.length < 60) return '';
  return stripped;
}

function readPreview(message) {
  // Prefer the provider-cleaned snippet/preview; only fall back to the raw body
  // text after sanitizing it.
  const clean =
    cleanPreviewText(asString(message?.preview)) || cleanPreviewText(asString(message?.snippet));
  const text = clean || cleanPreviewText(asString(message?.messageText) || asString(message?.body));
  if (!text) return '';
  return text.length > 140 ? `${text.slice(0, 139)}…` : text;
}

// Normalize a GMAIL_FETCH_EMAILS read into inbox rows. Returns [] for any
// unsuccessful/empty/malformed payload so the UI can render an honest empty
// state quietly (no error log noise). Never fabricates a message.
export function normalizeInboxMessages(result, { limit = 6 } = {}) {
  if (!result || result.successful === false) return [];
  const data = result.data || result;
  const messages = Array.isArray(data?.messages)
    ? data.messages
    : Array.isArray(data?.emails)
      ? data.emails
      : Array.isArray(data)
        ? data
        : [];
  const rows = [];
  for (const message of messages) {
    if (!message || typeof message !== 'object') continue;
    const subject = asString(message.subject) || '(no subject)';
    const rawSender =
      asString(message?.sender) ||
      asString(message?.from) ||
      asString(message?.fromEmail) ||
      asString(message?.payload?.from);
    const sender = readSender(message) || 'Unknown sender';
    const labels = decodeLabelIds(message);
    const unread = labels.includes('UNREAD');
    const messageId = asString(message.messageId) || asString(message.id);
    const threadId = asString(message.threadId);
    const id = messageId || threadId || `${sender}:${subject}`;
    rows.push({
      id,
      // The real Gmail message + thread ids, surfaced so the UI can fetch the
      // full message (GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID) and link out to Gmail.
      // They are '' when Composio omits them; callers must guard before use.
      messageId,
      threadId,
      sender,
      fromEmail: extractEmailAddress(rawSender),
      subject,
      unread,
      isBulk: messageIsBulk(message),
      // Gmail's IMPORTANT marker — a behaviour signal (how you engage this sender)
      // the rail ranks "needs a reply" by, now meaningful since bulk is excluded.
      important: labels.includes('IMPORTANT'),
      preview: readPreview(message),
      timestamp: asString(message.messageTimestamp) || asString(message.internalDate) || ''
    });
    if (rows.length >= limit) break;
  }
  return rows;
}

function readEventTitle(event) {
  return (
    asString(event?.summary) ||
    asString(event?.title) ||
    asString(event?.subject) ||
    '(untitled event)'
  );
}

function readEventStart(event) {
  const start = event?.start;
  if (typeof start === 'string') return start.trim();
  return asString(start?.dateTime) || asString(start?.date) || asString(event?.startTime) || '';
}

// True when the start is a bare `YYYY-MM-DD` (Google's all-day shape) rather
// than a full timestamp. All-day events have no clock time to show.
function isAllDayStart(event) {
  const start = event?.start;
  if (start && typeof start === 'object') {
    return Boolean(asString(start.date)) && !asString(start.dateTime);
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(readEventStart(event));
}

// Render a calendar start into a short, human-readable "when". Falls back to the
// raw string if it cannot be parsed, and to '' if there is nothing to show — the
// card never fabricates a time it does not have.
function readEventWhen(event) {
  const raw = readEventStart(event);
  if (!raw) return '';
  const allDay = isAllDayStart(event);
  // A bare `YYYY-MM-DD` parses as UTC midnight; localizing it can roll back to
  // the previous calendar day. Parse it as a local date so an all-day event
  // shows on its own day in every timezone.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  try {
    const dateLabel = parsed.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
    if (allDay) return `${dateLabel} · all day`;
    const timeLabel = parsed.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit'
    });
    return `${dateLabel} · ${timeLabel}`;
  } catch (_) {
    return raw;
  }
}

function readEventEnd(event) {
  const end = event?.end;
  if (typeof end === 'string') return end.trim();
  return asString(end?.dateTime) || asString(end?.date) || asString(event?.endTime) || '';
}

function readEventLink(event) {
  const link = asString(event?.htmlLink) || asString(event?.hangoutLink) || asString(event?.link);
  return /^https?:\/\//i.test(link) ? link : '';
}

// Normalize a GOOGLECALENDAR_*_LIST/FIND read into upcoming-event rows:
// `{ id, title, when, link?, start, location }`. Same honesty contract as the
// inbox: [] on any failure or empty payload; never fabricates an event.
export function normalizeCalendarEvents(result, { limit = 6 } = {}) {
  if (!result || result.successful === false) return [];
  const data = result.data || result;
  const events = Array.isArray(data?.events)
    ? data.events
    : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data)
        ? data
        : [];
  const rows = [];
  for (const event of events) {
    if (!event || typeof event !== 'object') continue;
    const id = asString(event.id) || asString(event.eventId) || readEventTitle(event);
    const link = readEventLink(event);
    const row = {
      id,
      title: readEventTitle(event),
      when: readEventWhen(event),
      start: readEventStart(event),
      end: readEventEnd(event),
      location: asString(event.location)
    };
    if (link) row.link = link;
    rows.push(row);
    if (rows.length >= limit) break;
  }
  return rows;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
];

// Lay calendar rows (normalizeCalendarEvents output) out as a rolling week of day
// columns for the Calendar grid — today first, `days` columns total. Each event is
// placed in the column matching its start date; all-day vs timed is read from the
// event's own `when` label ("· all day" vs "· 11:30"), and timed events are sorted
// chronologically within the day. Today-onward by construction (events outside the
// window are dropped), so a stale "yesterday" header never appears. `now` is
// injectable for tests; date math + labels are local to the viewer's timezone.
export function buildWeekColumns(events, { now = Date.now(), days = 7 } = {}) {
  const list = Array.isArray(events) ? events : [];
  const startOfToday = (() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();
  const dayKey = (ms) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };
  const columns = [];
  const byKey = new Map();
  for (let i = 0; i < days; i++) {
    const d = new Date(startOfToday + i * 86400000);
    const col = {
      dateKey: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
      weekday: WEEKDAY_LABELS[d.getDay()],
      dayNum: d.getDate(),
      month: MONTH_LABELS[d.getMonth()],
      isToday: i === 0,
      isTomorrow: i === 1,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      allDay: [],
      timed: []
    };
    columns.push(col);
    byKey.set(col.dateKey, col);
  }
  for (const ev of list) {
    if (!ev || typeof ev !== 'object') continue;
    const ms = toEpochMs(ev.start);
    if (!ms) continue;
    const col = byKey.get(dayKey(ms));
    if (!col) continue; // outside the rolling window
    const when = asString(ev.when);
    const sep = when.indexOf('·');
    const timeLabel = (sep >= 0 ? when.slice(sep + 1) : '').trim();
    const isAllDay = !timeLabel || /all\s*day/i.test(timeLabel);
    const item = { ...ev, ms, timeLabel: isAllDay ? 'All day' : timeLabel, allDay: isAllDay };
    if (!isAllDay) {
      // Minutes-of-day for the time-grid layout. End defaults to +60m; a same-day
      // end uses its clock time; an end that rolls past midnight clamps to 1440.
      const startMin = minutesOfDay(ms);
      const endMs = toEpochMs(ev.end);
      let endMin = startMin + 60;
      if (endMs && endMs > ms) endMin = dayKey(endMs) === dayKey(ms) ? minutesOfDay(endMs) : 1440;
      if (endMin <= startMin) endMin = Math.min(1440, startMin + 30);
      item.startMin = startMin;
      item.endMin = endMin;
    }
    (isAllDay ? col.allDay : col.timed).push(item);
  }
  for (const col of columns) col.timed.sort((a, b) => a.ms - b.ms);
  return columns;
}

const minutesOfDay = (ms) => {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
};

// The visible vertical window for the time grid: the hour before the earliest
// event to the hour after the latest, snapped to whole hours and clamped to the
// day, with a sensible default (08:00–19:00) when there are no timed events. Pure.
export function weekTimeWindow(columns, { defaultStart = 480, defaultEnd = 1140 } = {}) {
  let min = Infinity;
  let max = -Infinity;
  for (const col of Array.isArray(columns) ? columns : []) {
    for (const ev of col?.timed || []) {
      if (Number.isFinite(ev.startMin)) min = Math.min(min, ev.startMin);
      if (Number.isFinite(ev.endMin)) max = Math.max(max, ev.endMin);
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return { startMin: defaultStart, endMin: defaultEnd };
  }
  let start = Math.max(0, Math.floor((min - 30) / 60) * 60);
  let end = Math.min(1440, Math.ceil((max + 30) / 60) * 60);
  if (end - start < 240) end = Math.min(1440, start + 240);
  return { startMin: start, endMin: end };
}

// Position timed events within one day column for the time grid. Events that
// overlap in time are split into side-by-side lanes (greedy, per overlap cluster),
// so a busy day reads as parallel columns rather than stacked blocks. Returns each
// event with topPct/heightPct (vertical position in the window) + leftPct/widthPct
// (its lane). Pure; `events` need startMin/endMin (from buildWeekColumns).
export function layoutDayColumn(events, winStart, winEnd) {
  const span = winEnd - winStart || 1;
  const list = (Array.isArray(events) ? events : [])
    .filter((e) => Number.isFinite(e.startMin) && Number.isFinite(e.endMin))
    .slice()
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const out = [];
  let i = 0;
  while (i < list.length) {
    // Extend a cluster while the next event starts before the cluster's max end.
    let clusterEnd = list[i].endMin;
    let j = i + 1;
    while (j < list.length && list[j].startMin < clusterEnd) {
      clusterEnd = Math.max(clusterEnd, list[j].endMin);
      j++;
    }
    const cluster = list.slice(i, j);
    const laneEnds = [];
    for (const ev of cluster) {
      let lane = laneEnds.findIndex((end) => end <= ev.startMin);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(ev.endMin);
      } else {
        laneEnds[lane] = ev.endMin;
      }
      ev.__lane = lane;
    }
    const laneCount = laneEnds.length || 1;
    for (const ev of cluster) {
      const s = Math.min(Math.max(ev.startMin, winStart), winEnd);
      const e = Math.min(Math.max(ev.endMin, s + 15), winEnd);
      out.push({
        ...ev,
        topPct: ((s - winStart) / span) * 100,
        heightPct: Math.max(((e - s) / span) * 100, 2.5),
        leftPct: (ev.__lane / laneCount) * 100,
        widthPct: (1 / laneCount) * 100,
        laneCount
      });
    }
    i = j;
  }
  return out;
}

export function unreadInboxCount(rows) {
  return (Array.isArray(rows) ? rows : []).filter((row) => row?.unread).length;
}

// Decode the common HTML entities and strip invisible/control padding from a
// run of text, WITHOUT collapsing line structure. Used by the reading panel so
// a multi-paragraph email stays readable rather than flattening to one line.
function decodeEntitiesAndInvisibles(raw) {
  return raw
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[­​-‏‪-‮⁠﻿͏]/g, '')
    .replace(/[\s\S]/g, (char) => (isC0OrC1Control(char) ? '' : char))
    .replace(/[  -   　]/g, ' ');
}

// Turn an email body (HTML or plain text) into readable, line-broken plain
// text for the reading panel. Strips style/script/markup, decodes entities,
// drops invisible padding, and collapses runs of blank lines — but preserves
// paragraph breaks so the body does not flatten into a single line. Returns ''
// for empty input so the caller can show an honest "no body" note.
export function cleanEmailBody(raw) {
  const text = asString(raw);
  if (!text) return '';
  const looksHtml = /<\/?[a-z][\s\S]*>/i.test(text);
  let working = text;
  if (looksHtml) {
    working = working
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<head[\s\S]*?<\/head>/gi, ' ')
      // Turn block-level boundaries into newlines before stripping tags so the
      // text keeps its paragraph structure.
      .replace(/<\/(p|div|tr|li|h[1-6]|blockquote)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ');
  }
  const decoded = decodeEntitiesAndInvisibles(working);
  return decoded
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Decode a Gmail message part body — base64url (Gmail uses -_ and may drop
// padding) → UTF-8 text. Returns '' on anything unexpected (never throws).
export function decodeBase64Part(data) {
  const raw = asString(data);
  if (!raw || typeof atob !== 'function') return '';
  try {
    const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(normalized);
    try {
      // atob yields a binary string; re-decode as UTF-8 so accented/emoji bytes
      // render correctly.
      return decodeURIComponent(
        Array.prototype.map
          .call(binary, (c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
          .join('')
      );
    } catch (_) {
      return binary;
    }
  } catch (_) {
    return '';
  }
}

// Pull the original text/html part out of a Gmail payload (the rich version with
// tables/images/layout), recursing through nested multiparts. '' when the
// message is plain-text only. This is the source for the native email render;
// the plain-text body stays as the fallback.
export function extractHtmlBody(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const mime = String(payload.mimeType || '').toLowerCase();
  if (mime === 'text/html' && payload.body && payload.body.data) {
    const decoded = decodeBase64Part(payload.body.data);
    if (decoded) return decoded;
  }
  const parts = Array.isArray(payload.parts) ? payload.parts : [];
  for (const part of parts) {
    const found = extractHtmlBody(part);
    if (found) return found;
  }
  return '';
}

// Normalize a GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID read into a full-message view
// model for the reading panel: `{ messageId, threadId, sender, to, subject,
// timestamp, body, htmlBody, ok, error }`. Honest contract: on an unsuccessful
// or malformed payload it returns `{ ok: false, error }` and never fabricates a
// body. `messageText` is already-decoded plain text (the fallback); `htmlBody`
// is the original HTML part for a faithful native render (sanitized at the view).
export function normalizeFullMessage(result) {
  if (!result || result.successful === false) {
    return {
      ok: false,
      error: asString(result?.error) || 'Could not load this message.',
      messageId: '',
      threadId: '',
      sender: '',
      to: '',
      subject: '',
      timestamp: '',
      body: ''
    };
  }
  const data = result.data || result;
  const body =
    cleanEmailBody(data?.messageText) ||
    cleanEmailBody(data?.body) ||
    cleanEmailBody(data?.payload?.body?.data) ||
    cleanEmailBody(data?.preview?.body);
  // The original HTML part, for a faithful native render. Falls back to '' for
  // plain-text-only mail, in which case the panel renders the cleaned `body`.
  const htmlBody = extractHtmlBody(data?.payload) || asString(data?.messageHtml);
  return {
    ok: true,
    error: '',
    messageId: asString(data?.messageId) || asString(data?.id),
    threadId: asString(data?.threadId),
    htmlBody,
    sender: readSender(data) || asString(data?.sender) || 'Unknown sender',
    // The original sender's bare email address, for pre-filling a reply draft's
    // recipient. '' when not extractable — the draft modal leaves it editable.
    fromEmail: extractEmailAddress(
      asString(data?.sender) ||
        asString(data?.from) ||
        asString(data?.fromEmail) ||
        asString(data?.payload?.from)
    ),
    to: asString(data?.to),
    subject: asString(data?.subject) || '(no subject)',
    timestamp: asString(data?.messageTimestamp) || asString(data?.internalDate) || '',
    body
  };
}

// Build a real Gmail deep link for a message or thread. Gmail's `#all/<id>`
// fragment opens the conversation in the user's primary mailbox; we prefer the
// thread id (opens the whole conversation) and fall back to the message id.
// Returns '' when there is no id to link to (so the UI omits a dead link).
export function gmailMessageHref({ threadId, messageId } = {}) {
  const id = asString(threadId) || asString(messageId);
  if (!id) return '';
  return `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(id)}`;
}

// Render an inbox timestamp into a short, human "when" for the decision-card
// meta line. Gmail returns either epoch milliseconds (`internalDate`) or an RFC
// 3339 string (`messageTimestamp`). Returns '' when there is nothing parseable —
// the card simply omits the meta line rather than showing a fabricated time.
export function formatInboxWhen(timestamp) {
  const raw = asString(timestamp);
  if (!raw) return '';
  let parsed;
  if (/^\d{10,}$/.test(raw)) {
    // Epoch: 13 digits = ms, 10 digits = seconds.
    parsed = new Date(raw.length >= 13 ? Number(raw) : Number(raw) * 1000);
  } else {
    parsed = new Date(raw);
  }
  if (Number.isNaN(parsed.getTime())) return '';
  try {
    const now = new Date();
    const sameDay =
      parsed.getFullYear() === now.getFullYear() &&
      parsed.getMonth() === now.getMonth() &&
      parsed.getDate() === now.getDate();
    if (sameDay) {
      return parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }
    return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (_) {
    return '';
  }
}
