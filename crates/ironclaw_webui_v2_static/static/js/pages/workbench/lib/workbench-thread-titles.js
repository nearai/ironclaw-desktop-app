// Local titles for Workbench-started threads. The gateway derives a thread's title from its
// first message — which for a Workbench Ask is the verbose prompt scaffold ("Workbench
// request…"), so History rows would all look identical. We remember the clean brief the user
// actually typed, keyed by thread id, so History can show what each conversation was about.
// Client-side + localStorage; no gateway change.

const KEY = 'workbench:thread-titles:v1';
const MAX_ENTRIES = 200;
const MAX_TITLE_CHARS = 120;

export function readThreadTitles() {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

export function recordThreadTitle(threadId, title) {
  const id = String(threadId || '').trim();
  const clean = String(title || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!id || !clean) return;
  try {
    const map = readThreadTitles();
    map[id] =
      clean.length > MAX_TITLE_CHARS ? `${clean.slice(0, MAX_TITLE_CHARS - 1).trimEnd()}…` : clean;
    const ids = Object.keys(map);
    if (ids.length > MAX_ENTRIES) {
      for (const stale of ids.slice(0, ids.length - MAX_ENTRIES)) delete map[stale];
    }
    globalThis.localStorage?.setItem(KEY, JSON.stringify(map));
  } catch (_) {
    /* localStorage unavailable (headless/SSR) — degrade silently */
  }
}

// Best display title for a thread: the remembered clean brief, else the gateway title, else a
// fallback. Pure (takes the titles map) so it is testable without localStorage.
export function threadDisplayTitle(thread, titles = {}) {
  const id = String(thread?.id || '').trim();
  const local = id && titles && typeof titles === 'object' ? titles[id] : '';
  const gateway = thread && typeof thread.title === 'string' ? thread.title.trim() : '';
  return local || gateway || 'Untitled conversation';
}
