// Saved work — a real, local "library" of work products you've kept (e.g. a brief
// you exported). Persisted to the browser (localStorage), like memory/dismissals;
// nothing is sent. This is the CLIENT-side saved work, complementary to (and
// independent of) the server-backed Work history. Pure + defensive: malformed
// storage degrades to []. The `store` arg is injectable for tests.

const STORAGE_KEY = 'workbench:library-items';
const CAP = 100;

function defaultStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch (_) {
    return null;
  }
}

// [{ id, title, kind, savedAt }] newest-first. [] on any malformed/empty payload.
export function readLibraryItems(store = defaultStorage()) {
  if (!store) return [];
  try {
    const raw = store.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((it) => it && typeof it === 'object' && String(it.title || '').trim())
      .map((it) => ({
        id: String(it.id || ''),
        title: String(it.title || ''),
        kind: String(it.kind || 'Work'),
        savedAt: String(it.savedAt || '')
      }));
  } catch (_) {
    return [];
  }
}

// Save a work item (prepended, newest-first, capped). Empty title is a no-op.
// `id`/`savedAt` injectable so tests stay deterministic; production stamps them.
export function saveLibraryItem({ title, kind, id, savedAt } = {}, store = defaultStorage()) {
  const name = String(title || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!name || !store) return readLibraryItems(store);
  const items = readLibraryItems(store);
  const item = {
    id: id || `lib-${Date.now()}-${items.length}`,
    title: name.slice(0, 200),
    kind: String(kind || 'Work'),
    savedAt: savedAt || new Date().toISOString()
  };
  const next = [item, ...items].slice(0, CAP);
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (_) {
    // non-fatal
  }
  return next;
}

export function removeLibraryItem(id, store = defaultStorage()) {
  if (!store) return readLibraryItems(store);
  const next = readLibraryItems(store).filter((it) => it.id !== String(id));
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (_) {
    // non-fatal
  }
  return next;
}
