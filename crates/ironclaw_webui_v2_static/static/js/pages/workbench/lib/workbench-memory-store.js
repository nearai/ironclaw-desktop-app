// User-controlled memory — the preferences the user tells the Workbench to remember
// ("show sources before external drafts leave"). Persisted LOCALLY to the browser
// (localStorage), like dismissals/tier-overrides; nothing is sent. A real writable
// store, so "Save preference" actually saves and survives reload. Pure + defensive:
// malformed storage degrades to []. The `store` arg is injectable for tests.

const STORAGE_KEY = 'workbench:memory-prefs';
const CAP = 50;

// Scopes a preference can apply to, most-common first.
export const MEMORY_SCOPES = ['Personal', 'Workspace', 'This project', 'This source'];

function defaultStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch (_) {
    return null;
  }
}

// [{ id, text, scope, savedAt }] newest-first. [] on any malformed/empty payload.
export function readMemoryPrefs(store = defaultStorage()) {
  if (!store) return [];
  try {
    const raw = store.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((p) => p && typeof p === 'object' && String(p.text || '').trim())
      .map((p) => ({
        id: String(p.id || ''),
        text: String(p.text || ''),
        scope: String(p.scope || 'Personal'),
        savedAt: String(p.savedAt || '')
      }));
  } catch (_) {
    return [];
  }
}

// Save a preference (prepended, newest-first, capped). Empty text is a no-op. `id`
// and `savedAt` are injectable so tests stay deterministic; production stamps them.
export function saveMemoryPref({ text, scope, id, savedAt } = {}, store = defaultStorage()) {
  const body = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!body || !store) return readMemoryPrefs(store);
  const prefs = readMemoryPrefs(store);
  const pref = {
    id: id || `mem-${Date.now()}-${prefs.length}`,
    text: body.slice(0, 400),
    scope: MEMORY_SCOPES.includes(String(scope)) ? String(scope) : 'Personal',
    savedAt: savedAt || new Date().toISOString()
  };
  const next = [pref, ...prefs].slice(0, CAP);
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (_) {
    // a failed write is non-fatal — the in-memory list is still returned
  }
  return next;
}

export function removeMemoryPref(id, store = defaultStorage()) {
  if (!store) return readMemoryPrefs(store);
  const next = readMemoryPrefs(store).filter((p) => p.id !== String(id));
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (_) {
    // non-fatal
  }
  return next;
}
