const WORK_ITEMS_KEY = 'ironclaw-work-items';
const MAX_WORK_ITEMS = 500;

export function saveAssistantResponseToWork({
  title,
  content,
  threadId = currentThreadId(),
  threadLabel = 'Chat thread',
  storage = defaultStorage(),
  now = new Date().toISOString(),
  idFactory = defaultIdFactory
} = {}) {
  const body = String(content || '').trim();
  if (!body || !storage) return null;

  const safeTitle = safeText(title, 'Assistant response').slice(0, 80);
  const workId = idFactory('work');
  const artifactId = idFactory('artifact');
  const linkedThread = safeText(threadId, '');
  const item = {
    id: workId,
    title: safeTitle,
    objective: 'Saved work product from chat.',
    domain: 'general',
    runbookIds: ['general'],
    status: 'active',
    created_at: now,
    updated_at: now,
    links: linkedThread
      ? [
          {
            kind: 'thread',
            ref: linkedThread,
            label: safeText(threadLabel, 'Chat thread')
          }
        ]
      : [],
    dossier: [],
    approvalBoundaries: [],
    artifacts: [
      {
        id: artifactId,
        type: 'document',
        title: safeTitle,
        status: 'ready',
        provenance: linkedThread ? [`thread:${linkedThread}`] : ['chat'],
        content: body,
        content_format: 'markdown'
      }
    ],
    watches: [],
    receipts: [],
    openApprovals: [],
    followUps: [],
    nextAction: 'Review saved work product.'
  };

  const existing = readWorkItems(storage);
  storage.setItem(WORK_ITEMS_KEY, JSON.stringify([item, ...existing].slice(0, MAX_WORK_ITEMS)));
  return {
    item,
    artifact: item.artifacts[0],
    href: workArtifactHref(workId, artifactId)
  };
}

export function openSavedWorkProduct(saved, location = globalThis.window?.location) {
  if (!saved?.href || !location) return false;
  if (typeof location.assign === 'function') {
    location.assign(saved.href);
  } else {
    location.href = saved.href;
  }
  return true;
}

export function currentThreadId(location = globalThis.window?.location) {
  if (!location) return '';
  try {
    const url = new URL(location.href || '/', 'http://ironclaw.local');
    const threadParam = url.searchParams.get('thread');
    if (threadParam?.trim()) return threadParam.trim();

    const parts = url.pathname.split('/').filter(Boolean);
    const chatIndex = parts.lastIndexOf('chat');
    if (chatIndex !== -1 && parts[chatIndex + 1]) {
      return decodeURIComponent(parts[chatIndex + 1]);
    }
  } catch {
    // Best effort only. Missing thread links should not block saving.
  }
  return '';
}

export function workArtifactHref(workId, artifactId) {
  const params = new URLSearchParams({
    item: String(workId || ''),
    artifact: String(artifactId || '')
  });
  return `/work?${params.toString()}`;
}

function readWorkItems(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(WORK_ITEMS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object') : [];
  } catch {
    return [];
  }
}

function safeText(value, fallback) {
  const text = String(value || '').trim();
  return text || fallback;
}

function defaultStorage() {
  try {
    return globalThis.window?.localStorage || globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function defaultIdFactory(prefix) {
  const unique =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${unique}`;
}
