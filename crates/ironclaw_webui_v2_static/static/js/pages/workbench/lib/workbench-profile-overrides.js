// User corrections to the learned behaviour profile — the "You" surface is
// observed AND correctable. A correction pins a sender to a tier (VIP / Respond /
// FYI / Ignore), overriding what the engine inferred. Stored locally to the
// browser (per-device for now; a gateway-memory sync is a later step). Read-only
// to the outside world — nothing is sent.

const STORAGE_KEY = 'workbench:tier-overrides';
export const TIER_OPTIONS = ['vip', 'respond', 'fyi', 'ignore'];
const TIER_RANK = { vip: 3, respond: 2, fyi: 1, ignore: 0 };

function storage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch (_) {
    return null;
  }
}

// { email(lowercased): tier } — defensive: malformed storage degrades to {}.
export function readTierOverrides() {
  const store = storage();
  if (!store) return {};
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out = {};
    for (const [email, tier] of Object.entries(parsed)) {
      const key = String(email || '').toLowerCase();
      if (key && TIER_OPTIONS.includes(tier)) out[key] = tier;
    }
    return out;
  } catch (_) {
    return {};
  }
}

function writeTierOverrides(overrides) {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(overrides || {}));
  } catch (_) {
    /* private mode / quota — non-fatal, corrections just don't persist */
  }
}

// Set or clear (tier === null) one correction; returns the next overrides map.
export function setTierOverride(email, tier) {
  const key = String(email || '').toLowerCase();
  const next = { ...readTierOverrides() };
  if (!key) return next;
  if (tier === null || tier === undefined) delete next[key];
  else if (TIER_OPTIONS.includes(tier)) next[key] = tier;
  writeTierOverrides(next);
  return next;
}

// Apply corrections to a computed people[] (pure): override tier, flag the row as
// `overridden`, and re-rank so corrections move the person immediately. Returns a
// new array; never mutates the input.
export function applyTierOverrides(people, overrides = {}) {
  const list = Array.isArray(people) ? people : [];
  const raw = overrides && typeof overrides === 'object' ? overrides : {};
  // Normalize keys to lowercased emails so a correction matches regardless of case.
  const map = {};
  for (const [email, tier] of Object.entries(raw)) map[String(email || '').toLowerCase()] = tier;
  const next = list.map((person) => {
    const override = person && map[String(person.email || '').toLowerCase()];
    if (override && override !== person.tier) {
      return { ...person, tier: override, overridden: true };
    }
    return person.overridden ? { ...person, overridden: false } : person;
  });
  next.sort(
    (a, b) =>
      (TIER_RANK[b.tier] || 0) - (TIER_RANK[a.tier] || 0) ||
      (b.replyRate || 0) - (a.replyRate || 0) ||
      (b.received || 0) - (a.received || 0)
  );
  return next;
}

// Recount tiers after corrections, for the stats strip.
export function recountTiers(people) {
  const counts = { senders: 0, vip: 0, respond: 0, fyi: 0, ignore: 0, bulk: 0 };
  for (const person of Array.isArray(people) ? people : []) {
    counts.senders += 1;
    if (person && counts[person.tier] != null) counts[person.tier] += 1;
    if (person && person.bulk) counts.bulk += 1;
  }
  return counts;
}
