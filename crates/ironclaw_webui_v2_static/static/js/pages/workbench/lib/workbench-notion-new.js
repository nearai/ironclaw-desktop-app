// "New in Notion" detection — proactively surface pages created/edited recently that the
// user has NOT yet reviewed (e.g. a new Project Passport), so the home flags new things
// instead of the user digging. Pure selection (selectNewNotionPages) + a localStorage
// seen-map keep it honest: it only shows what is genuinely new since the user last looked.

import { isDismissed } from './workbench-dismissals.js';

const SEEN_KEY = 'workbench:notion-seen:v1';
const DEFAULT_WINDOW_DAYS = 7;
const DEFAULT_LIMIT = 4;
// When a page's created and last-edited times are within this gap, it reads as a fresh
// creation ("Created") rather than an edit of an older page ("Updated").
const CREATED_GAP_MS = 5 * 60 * 1000;

function parseMs(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : 0;
}

// Namespaced dismissal key for a Notion page. The `notion:` prefix fences these from the
// email/slack dismissals that share the store, so a dismissed page never collides with a
// dismissed message and never feeds mail-sender learning.
export function notionDismissKey(pageId) {
  return `notion:${String(pageId || '')}`;
}

// Drop pages the user dismissed (reversibly — the dismissal lives in the shared store) from
// the band, so a dismissed "New in Notion" item stays gone across refetches. Pure.
export function filterDismissedNotionPages(pages, dismissals) {
  const rows = Array.isArray(pages) ? pages : [];
  return rows.filter((page) => !isDismissed(dismissals, notionDismissKey(page && page.id)));
}

// Pure: given the notion pages (from normalizeNotionPages), the seen-map
// ({ id: lastSeenEditedMs }), and the current time, return the genuinely new/updated
// pages (recent + unseen), newest first, capped. Each row is tagged isNew (created vs
// updated). When nowMs is 0 the recency window is skipped (test convenience).
export function selectNewNotionPages(
  pages,
  seen = {},
  { nowMs = 0, windowDays = DEFAULT_WINDOW_DAYS, limit = DEFAULT_LIMIT } = {}
) {
  const now = Number.isFinite(nowMs) && nowMs > 0 ? nowMs : 0;
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const seenMap = seen && typeof seen === 'object' ? seen : {};
  const out = [];
  for (const page of Array.isArray(pages) ? pages : []) {
    if (!page || !page.id) continue;
    const editedMs = parseMs(page.lastEditedTime);
    if (!editedMs) continue;
    if (now && now - editedMs > windowMs) continue; // outside the recency window
    if (Number(seenMap[page.id] || 0) >= editedMs) continue; // already reviewed at this revision
    const createdMs = parseMs(page.createdTime);
    const isNew = createdMs > 0 && Math.abs(editedMs - createdMs) <= CREATED_GAP_MS;
    out.push({ ...page, editedMs, createdMs, isNew });
  }
  out.sort((a, b) => b.editedMs - a.editedMs);
  return out.slice(0, Math.max(0, limit));
}

// Build the seen-map to persist once the user has reviewed the given pages. Keeps the
// max edited-ms per id so a later edit re-surfaces the page (a real change) but a re-render
// does not.
export function notionSeenAfterViewing(pages, seen = {}) {
  const next = { ...(seen && typeof seen === 'object' ? seen : {}) };
  for (const page of Array.isArray(pages) ? pages : []) {
    if (!page || !page.id) continue;
    const editedMs = parseMs(page.lastEditedTime);
    if (editedMs) next[page.id] = Math.max(Number(next[page.id] || 0), editedMs);
  }
  return next;
}

// Build a 1-line gist from a page's flattened content blocks (from
// normalizeNotionPageContent): the first couple of non-empty, non-divider blocks joined
// and truncated. Pure so it is testable; honest-empty ('') when there is no readable body.
export function notionGist(blocks, { maxChars = 160, maxBlocks = 2 } = {}) {
  const parts = [];
  for (const block of Array.isArray(blocks) ? blocks : []) {
    if (!block || block.kind === 'divider') continue;
    const text = String(block.text || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) continue;
    parts.push(text);
    if (parts.length >= maxBlocks || parts.join(' — ').length >= maxChars) break;
  }
  const gist = parts.join(' — ').trim();
  return gist.length > maxChars ? `${gist.slice(0, maxChars - 1).trimEnd()}…` : gist;
}

export function readNotionSeen() {
  try {
    const raw = globalThis.localStorage?.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

export function writeNotionSeen(seen) {
  try {
    globalThis.localStorage?.setItem(SEEN_KEY, JSON.stringify(seen || {}));
  } catch (_) {
    /* localStorage unavailable (headless/SSR) — degrade silently */
  }
}
