// Deterministic Workbench briefing.
//
// Some chief-of-staff intents ("what needs me today?", "catch me up") can be
// answered instantly and faithfully from data the Workbench has ALREADY read
// through the connector route — the unread inbox, the upcoming calendar, Slack
// blocker search rows, and the active-work rail. For those we synthesize a real
// briefing in the browser with NO model/agent round-trip, so the answer is
// immediate, deterministic, and does not depend on the LLM runtime being
// reachable. Anything open-ended still goes to the Chat runtime as before. These
// helpers are pure and side-effect free.

import { unreadInboxCount } from './workbench-connectors.js';

// Free-text intents the briefing can satisfy from connector data alone. These
// match BOTH the short phrasings a user types ("catch me up") AND the verbose
// fills the Workbench chips inject ("Tell me what needs my attention today…",
// "Summarize what changed since I was last here…"), so clicking the executive
// chips lands on the instant briefing when connectors are live.
const BRIEFING_PATTERNS = [
  /\bwhat\s+needs?\s+(me|my\s+attention)\b/i,
  /\bcatch\s+me\s+up\b/i,
  /\bbrief\s+me\b/i,
  /\b(daily|morning)\s+brief(ing)?\b/i,
  /\bwhat'?s?\s+(on|up|going\s+on|happening)\b/i,
  /\bwhat\s+should\s+i\s+(do|focus|know|prioriti[sz]e)\b/i,
  /\bsummar(?:y|ize|ise)\s+(my\s+(day|morning|inbox|calendar)|what\s+changed)\b/i,
  /\bwhat\s+changed\s+since\s+i\s+(was\s+last|last)\b/i
];

// True when the free text is a briefing/catch-up request the Workbench can
// answer deterministically from already-loaded connector data.
export function isBriefingIntent(text) {
  const value = String(text || '').trim();
  if (!value) return false;
  return BRIEFING_PATTERNS.some((pattern) => pattern.test(value));
}

// Rail groups that represent work genuinely waiting on the user. "needs-reply"
// is intentionally excluded here because unread mail is already surfaced as the
// "replies waiting" section straight from the inbox read.
const ATTENTION_GROUP_IDS = new Set(['needs-approval', 'blocked']);

function timeGreeting(now) {
  const hour = now instanceof Date && !Number.isNaN(now.getTime()) ? now.getHours() : 9;
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// Join clauses into a human list: ["a"] -> "a"; ["a","b"] -> "a and b";
// ["a","b","c"] -> "a, b, and c".
function joinClauses(parts) {
  const items = parts.filter(Boolean);
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural || `${singular}s`}`;
}

function briefingHeadline(counts, now) {
  const greeting = timeGreeting(now);
  const needsYou = counts.replies + counts.attention + counts.github + counts.slack;
  const hasContext = counts.events + counts.drive + counts.notion;
  const sourceProblems = counts.sourceProblems || 0;
  // Honest "handled, not surfaced" reassurance: newsletters/bulk we filed out of
  // your attention so they never masquerade as work. Appended to every branch.
  const filedNote = counts.filed
    ? ` ${pluralize(counts.filed, 'newsletter')} filed — not surfaced.`
    : '';
  if (needsYou === 0 && hasContext === 0 && sourceProblems === 0) {
    return `${greeting}. You're all clear — nothing needs you right now.${filedNote}`;
  }
  const parts = [];
  if (counts.replies) parts.push(`${pluralize(counts.replies, 'reply', 'replies')} waiting`);
  if (counts.slack) parts.push(`${pluralize(counts.slack, 'Slack item')}`);
  if (counts.github) parts.push(`${pluralize(counts.github, 'GitHub item')}`);
  if (counts.attention) parts.push(`${pluralize(counts.attention, 'item')} to decide`);
  if (counts.events) parts.push(`${pluralize(counts.events, 'event')} on your calendar`);
  if (sourceProblems) parts.push(`${pluralize(sourceProblems, 'source')} could not be read`);
  if (!parts.length)
    return `${greeting}. Nothing needs you — here's your recent context.${filedNote}`;
  return `${greeting}. ${joinClauses(parts)}.${filedNote}`;
}

function normalizeSourceProblems(sourceProblems) {
  if (!Array.isArray(sourceProblems)) return [];
  const rows = [];
  const seen = new Set();
  for (const problem of sourceProblems) {
    if (!problem || typeof problem !== 'object') continue;
    const label = String(problem.label || '').trim();
    const id = String(problem.id || label)
      .trim()
      .toLowerCase();
    if (!label || seen.has(id)) continue;
    seen.add(id);
    rows.push({
      id,
      label,
      detail:
        String(problem.detail || '').trim() ||
        `Could not read ${label} right now. Try again or reconnect if this keeps happening.`
    });
  }
  return rows;
}

// Build a real briefing from connector data already in hand, spanning every
// connected tool. Honest contract: every row comes from a connector read or the
// active-work rail — nothing is fabricated, and empty inputs degrade to an
// honest "all clear" headline. The returned shape is render-ready:
//   { headline, generatedAt, counts, sources:[...],
//     replies:[inboxRow], events:[calendarRow], attention:[railRow],
//     slack:[slackRow], github:[ghRow], drive:[driveRow], notion:[notionRow] }
export function buildBriefing({
  inboxMessages = [],
  calendarEvents = [],
  railGroups = [],
  slackBlockers = [],
  githubNotifications = [],
  driveFiles = [],
  notionPages = [],
  sourceProblems = [],
  gmailReady = false,
  calendarReady = false,
  slackReady = false,
  githubReady = false,
  driveReady = false,
  notionReady = false,
  now = new Date()
} = {}) {
  // Newsletters / list broadcasts / promotions never "need a reply" — suppress
  // bulk mail from the replies-waiting bucket entirely (matches the validated
  // profile engine). A bulk sender must never be surfaced as waiting on you.
  const rawInbox = Array.isArray(inboxMessages) ? inboxMessages : [];
  const filed = rawInbox.filter((message) => message?.isBulk).length;
  const inbox = rawInbox.filter((message) => !message?.isBulk);
  const unread = inbox.filter((message) => message?.unread);
  // Prefer unread; if everything is read, still show the most recent threads so
  // the briefing is never blank when the mailbox simply has no unread mail.
  const replies = (unread.length ? unread : inbox).slice(0, 5);

  const events = (Array.isArray(calendarEvents) ? calendarEvents : []).slice(0, 5);

  const attention = [];
  const seen = new Set();
  for (const group of Array.isArray(railGroups) ? railGroups : []) {
    if (!group || !ATTENTION_GROUP_IDS.has(group.id)) continue;
    for (const row of group.rows || []) {
      const key = row?.id || `${group.id}:${row?.title || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      attention.push({ ...row, groupId: group.id, groupLabel: group.label });
    }
  }

  const github = (Array.isArray(githubNotifications) ? githubNotifications : []).slice(0, 5);
  const slack = (Array.isArray(slackBlockers) ? slackBlockers : []).slice(0, 5);
  const drive = (Array.isArray(driveFiles) ? driveFiles : []).slice(0, 5);
  const notion = (Array.isArray(notionPages) ? notionPages : []).slice(0, 5);
  const sourceProblemRows = normalizeSourceProblems(sourceProblems);

  // counts.replies is the genuine "waiting on you" number (unread only); the
  // `replies` array may still carry recent read threads for display so the
  // briefing is never visually blank, but the headline never claims read mail
  // is "waiting".
  const counts = {
    replies: unread.length,
    events: events.length,
    attention: attention.length,
    slack: slack.length,
    github: github.length,
    drive: drive.length,
    notion: notion.length,
    sourceProblems: sourceProblemRows.length,
    filed
  };

  // Which connectors this briefing actually drew on — shown as honest provenance.
  const sources = [];
  if (gmailReady) sources.push({ id: 'gmail', label: 'Gmail', count: counts.replies });
  if (calendarReady) sources.push({ id: 'calendar', label: 'Calendar', count: counts.events });
  if (slackReady) sources.push({ id: 'slack', label: 'Slack', count: counts.slack });
  if (githubReady) sources.push({ id: 'github', label: 'GitHub', count: counts.github });
  if (driveReady) sources.push({ id: 'drive', label: 'Drive', count: counts.drive });
  if (notionReady) sources.push({ id: 'notion', label: 'Notion', count: counts.notion });

  return {
    headline: briefingHeadline(counts, now),
    generatedAt:
      now instanceof Date && !Number.isNaN(now.getTime())
        ? now.toISOString()
        : new Date(0).toISOString(),
    counts,
    sources,
    replies,
    events,
    attention,
    slack,
    github,
    drive,
    notion,
    sourceProblems: sourceProblemRows
  };
}
