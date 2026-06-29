// Learned voice — the replies the user actually writes. The on-demand "Draft in my
// voice" turn (workbench-reply.js) few-shots off voice examples so a draft sounds like
// the user, not a generic assistant. Those examples were a hardcoded 2-line literal
// (WORKBENCH_PROFILE.voiceSample) that never reflected what the user really writes — so
// "when I write stuff it doesn't improve my stuff." This store captures the text the user
// commits (copies, posts, drafts) and surfaces it as the freshest voice samples, so the
// drafter learns from real writing. Stored locally to the browser, like dismissals +
// tier-overrides; read-only to the outside world — nothing is sent. Pure + defensive:
// malformed storage degrades to [].

const STORAGE_KEY = 'workbench:voice-samples';
// Keep a short, recent window — the prompt must stay small (the draft turn is a short
// ~17s turn) and recent edits should dominate stale ones.
const MAX_SAMPLES = 8;
const MAX_LEN = 600;
// Ignore trivial commits ("ok", "thanks") — they teach nothing about voice and would
// crowd out real replies in the recent window.
const MIN_LEN = 24;

function storage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch (_) {
    return null;
  }
}

function normalize(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LEN);
}

// The learned samples, most-recent first. Tolerates a missing/garbage store.
export function readVoiceSamples() {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out = [];
    for (const value of parsed) {
      const v = normalize(value);
      if (v) out.push(v);
      if (out.length >= MAX_SAMPLES) break;
    }
    return out;
  } catch (_) {
    return [];
  }
}

function writeVoiceSamples(samples) {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(samples.slice(0, MAX_SAMPLES)));
  } catch (_) {
    /* private mode / quota — non-fatal, the sample just doesn't persist */
  }
}

// Record one reply the user committed. Trims, length-bounds, drops trivial text and
// case-insensitive duplicates, and prepends so the newest sample leads. Returns the next
// array. Pure aside from the localStorage write.
export function recordVoiceSample(text) {
  const v = normalize(text);
  const current = readVoiceSamples();
  if (v.length < MIN_LEN) return current;
  const without = current.filter((s) => s.toLowerCase() !== v.toLowerCase());
  const next = [v, ...without].slice(0, MAX_SAMPLES);
  writeVoiceSamples(next);
  return next;
}

// Build the voice directive for the draft turn from the learned samples plus the
// configured fallback examples (learned lead). Returns undefined when there is nothing
// to anchor on, so buildSuggestedReplyPrompt keeps its generic default. `fallback` is the
// configured WORKBENCH_PROFILE.voiceSample (injectable for tests). Pure.
export function effectiveVoiceDirective(fallback = []) {
  const learned = readVoiceSamples();
  const fb = Array.isArray(fallback) ? fallback.map(normalize).filter(Boolean) : [];
  const seen = new Set();
  const samples = [];
  for (const s of [...learned, ...fb]) {
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    samples.push(s);
    if (samples.length >= 6) break;
  }
  if (!samples.length) return undefined;
  return [
    'first-person, lowercase, decisive — a specific position, not a hedge.',
    'Match the cadence and directness of these real examples of how I actually write:',
    ...samples.map((s) => `- ${s}`)
  ].join('\n');
}
