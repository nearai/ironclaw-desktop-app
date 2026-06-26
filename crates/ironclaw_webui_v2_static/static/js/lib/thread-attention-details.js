import { React } from './html.js';

export const THREAD_ATTENTION_DETAILS_KEY = 'ironclaw:v2-thread-attention-details';

const subscribers = new Set();
const details = new Map();

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function titleCaseId(value) {
  return safeText(value)
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

export function normalizeThreadAttentionDetail(value) {
  if (!value || typeof value !== 'object') return null;
  const kind = safeText(value.kind, 'approval');
  const title = safeText(value.title || value.headline, 'Decision waiting');
  const detail = safeText(
    value.detail || value.body || value.description,
    kind === 'auth'
      ? 'A connected source needs sign-in before the run can continue.'
      : 'A prepared action is waiting for review before it can continue.'
  );
  return {
    kind,
    title,
    detail,
    badge: safeText(value.badge, kind === 'auth' ? 'Auth required' : 'Needs approval'),
    icon: safeText(value.icon, kind === 'auth' ? 'plug' : 'shield'),
    runId: safeText(value.runId || value.run_id),
    gateRef: safeText(value.gateRef || value.gate_ref),
    timestamp: safeText(value.timestamp || value.updated_at || value.created_at)
  };
}

export function threadAttentionDetailFromGate(gate, timestamp = new Date().toISOString()) {
  if (!gate) return null;
  const kind = safeText(gate.kind || gate.type);
  const headline = safeText(gate.headline || gate.title);
  const body = safeText(gate.body || gate.detail || gate.description);
  const runId = safeText(gate.runId || gate.run_id);
  const gateRef = safeText(gate.gateRef || gate.gate_ref || gate.id);
  const isAuth = kind === 'auth_required' || kind === 'auth';
  if (isAuth) {
    const provider = titleCaseId(gate.provider || gate.provider_id || gate.source);
    const account = safeText(gate.accountLabel || gate.account_label || gate.account);
    return normalizeThreadAttentionDetail({
      kind: 'auth',
      title: safeText(headline, provider ? `${provider} sign-in needed` : 'Source sign-in needed'),
      detail: safeText(
        body,
        account
          ? `${account} needs authorization before this run can continue.`
          : 'A connected source needs authorization before this run can continue.'
      ),
      badge: 'Auth required',
      icon: 'plug',
      runId,
      gateRef,
      timestamp
    });
  }

  const tool = titleCaseId(gate.toolName || gate.tool_name || gate.tool);
  return normalizeThreadAttentionDetail({
    kind: 'approval',
    title: safeText(headline, tool ? `${tool} needs approval` : 'Action needs approval'),
    detail: safeText(body, 'Review the exact action before anything leaves IronClaw.'),
    badge: 'Needs approval',
    icon: 'shield',
    runId,
    gateRef,
    timestamp
  });
}

function readPersisted() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(THREAD_ATTENTION_DETAILS_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) =>
        Array.isArray(entry) && typeof entry[0] === 'string'
          ? [entry[0], normalizeThreadAttentionDetail(entry[1])]
          : null
      )
      .filter((entry) => entry?.[1]);
  } catch (_) {
    return [];
  }
}

function writePersisted() {
  try {
    if (details.size === 0) {
      window.localStorage.removeItem(THREAD_ATTENTION_DETAILS_KEY);
      return;
    }
    window.localStorage.setItem(
      THREAD_ATTENTION_DETAILS_KEY,
      JSON.stringify(Array.from(details.entries()))
    );
  } catch (_) {
    // Best-effort browser memory; live Chat remains the source of truth.
  }
}

function snapshot() {
  return new Map(details);
}

function emit() {
  const snap = snapshot();
  for (const listener of subscribers) {
    try {
      listener(snap);
    } catch (_) {
      // A bad subscriber should not stop the app from recording attention detail.
    }
  }
}

for (const [id, detail] of readPersisted()) {
  details.set(id, detail);
}

export function setThreadAttentionDetail(threadId, detail) {
  const id = safeText(threadId);
  if (!id) return;
  const normalized = normalizeThreadAttentionDetail(detail);
  if (!normalized) {
    clearThreadAttentionDetail(id);
    return;
  }
  const previous = details.get(id);
  if (previous && JSON.stringify(previous) === JSON.stringify(normalized)) return;
  details.set(id, normalized);
  writePersisted();
  emit();
}

export function clearThreadAttentionDetail(threadId) {
  const id = safeText(threadId);
  if (!id || !details.delete(id)) return;
  writePersisted();
  emit();
}

export function getThreadAttentionDetails() {
  return snapshot();
}

export function subscribeThreadAttentionDetails(listener) {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

export function useThreadAttentionDetails() {
  const [map, setMap] = React.useState(getThreadAttentionDetails);
  React.useEffect(() => subscribeThreadAttentionDetails(setMap), []);
  return map;
}
