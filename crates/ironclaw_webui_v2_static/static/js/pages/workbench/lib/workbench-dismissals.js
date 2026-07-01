// User dismissals — "X this out, and here's why." When the user dismisses a
// surfaced item (a decision card, a rail row) with a reason, it is filed away and
// stops being surfaced, and the reason is recorded so the behaviour profile can
// learn from it (e.g. repeated "Just context" dismissals of a sender → file that
// sender by default). Stored locally to the browser, like tier-overrides
// ([[workbench-profile-overrides]]); read-only to the outside world — nothing is
// sent. Pure + defensive: malformed storage degrades to {}.

const STORAGE_KEY = 'workbench:dismissed-rows';

// The quick-pick reasons shown on the dismiss control. "Other" lets the user type
// a free-text reason. Ordered most-common-first.
export const DISMISS_REASONS = ['Just context', 'Already handled', 'Not relevant', 'Not for me'];

function storage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch (_) {
    return null;
  }
}

// { key: { reason, sender, ts } } where key is a stable row id (messageId/id).
export function readDismissals() {
  const store = storage();
  if (!store) return {};
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out = {};
    for (const [key, value] of Object.entries(parsed)) {
      const k = String(key || '').trim();
      if (!k || !value || typeof value !== 'object') continue;
      out[k] = {
        reason: String(value.reason || ''),
        sender: String(value.sender || ''),
        ts: Number.isFinite(value.ts) ? value.ts : 0
      };
    }
    return out;
  } catch (_) {
    return {};
  }
}

function writeDismissals(map) {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(map || {}));
  } catch (_) {
    /* private mode / quota — non-fatal, the dismissal just doesn't persist */
  }
}

// File a row away with a reason; returns the next dismissals map. `ts` is
// injectable for tests; defaults to now in the browser.
export function dismissRow(key, { reason = '', sender = '', ts } = {}) {
  const k = String(key || '').trim();
  const next = { ...readDismissals() };
  if (!k) return next;
  let stamp = ts;
  if (!Number.isFinite(stamp)) {
    try {
      stamp = Date.now();
    } catch (_) {
      stamp = 0;
    }
  }
  next[k] = { reason: String(reason || ''), sender: String(sender || ''), ts: stamp };
  writeDismissals(next);
  return next;
}

// Undo a dismissal; returns the next map.
export function restoreRow(key) {
  const k = String(key || '').trim();
  const next = { ...readDismissals() };
  if (k in next) delete next[k];
  writeDismissals(next);
  return next;
}

// True when `key` has been dismissed. Tolerates a missing/garbage map.
export function isDismissed(dismissals, key) {
  const map = dismissals && typeof dismissals === 'object' ? dismissals : {};
  const k = String(key || '').trim();
  return Boolean(k && map[k]);
}
