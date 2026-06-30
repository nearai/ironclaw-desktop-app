import { appBasePath, appScopedPath } from '../../../lib/app-path.js';
import { V2_BASE, apiFetch } from '../../../lib/api.js';
import {
  generatedFileKindLabel,
  normalizeGeneratedFileArtifact
} from './generated-file-artifacts.js';

export const WORK_ITEMS_KEY = 'ironclaw-work-items';
const MAX_WORK_ITEMS = 500;
const MAX_RECEIPTS = 20;
const SAVED_WORK_LOCAL_SOURCE = Object.freeze({
  source: 'local-browser',
  status: 'local-only',
  label: 'This desktop',
  statusLabel: 'On this device',
  detail: 'Briefings and documents you export are kept here, on this device. Nothing is sent.'
});
const SAVED_WORK_UNAVAILABLE_SOURCE = Object.freeze({
  source: 'local-browser',
  status: 'unavailable',
  label: 'Storage unavailable',
  statusLabel: 'Unavailable',
  detail: 'Saved Work storage is not available in this browser.'
});
const SAVED_WORK_CORRUPT_SOURCE = Object.freeze({
  source: 'local-browser',
  status: 'corrupt',
  label: 'Storage unreadable',
  statusLabel: 'Needs recovery',
  detail: 'Saved Work storage could not be read in this browser.'
});
const SAVED_WORK_SERVER_SOURCE = Object.freeze({
  source: 'server',
  status: 'synced',
  label: 'Server Work',
  statusLabel: 'Server-backed',
  detail: 'Showing saved Work from the IronClaw backend.'
});
const SAVED_WORK_MIXED_SOURCE = Object.freeze({
  source: 'server-plus-local',
  status: 'synced-plus-local',
  label: 'Server + this desktop',
  statusLabel: 'Server + this desktop',
  detail: 'Showing backend Work plus artifacts saved only on this desktop profile.'
});

// Derive a saved item's dossier provenance from the thread's rendered messages:
// the original ask (first user turn) and the receipts of what the agent actually
// did (the tool-activity rows). Pure + honest — only real transcript data, never
// invented. Approvals/follow-ups stay empty until the gateway exposes them.
export function dossierFromMessages(messages = []) {
  const list = Array.isArray(messages) ? messages : [];
  const firstUser = list.find(
    (message) => message && message.role === 'user' && String(message.content || '').trim()
  );
  const ask = firstUser ? String(firstUser.content).trim().slice(0, 2000) : '';
  const receipts = list
    .filter(
      (message) =>
        message && message.role === 'tool_activity' && (message.toolName || message.toolStatus)
    )
    .slice(0, MAX_RECEIPTS)
    .map((message) => ({
      label: String(message.toolName || 'tool').slice(0, 80),
      status: String(message.toolStatus || '').slice(0, 40),
      detail: String(message.toolResultPreview || message.toolDetail || '')
        .trim()
        .slice(0, 280)
    }));
  return { ask, receipts };
}

export function saveAssistantResponseToWork({
  title,
  content,
  messages = [],
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
  const { ask, receipts } = dossierFromMessages(messages);
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
    dossier: ask ? [{ kind: 'ask', label: 'The ask', text: ask }] : [],
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
    receipts,
    openApprovals: [],
    followUps: [],
    nextAction: 'Review saved work product.'
  };

  const existing = readSavedWorkItems(storage);
  const persisted = persistWorkItems(storage, [item, ...existing]);
  if (persisted?.error) return persisted;
  return {
    item,
    artifact: item.artifacts[0],
    href: workArtifactHref(workId, artifactId)
  };
}

export function saveGeneratedFileArtifactToWork({
  artifact,
  threadId = currentThreadId(),
  threadLabel = 'Chat thread',
  storage = defaultStorage(),
  now = new Date().toISOString(),
  idFactory = defaultIdFactory
} = {}) {
  const normalized = normalizeGeneratedFileArtifact(artifact);
  if (!normalized || !storage) return null;

  const safeTitle = safeText(normalized.title || normalized.filename, 'Generated file').slice(
    0,
    80
  );
  const workId = idFactory('work');
  const artifactId = idFactory('artifact');
  const linkedThread = safeText(threadId, '');
  const item = {
    id: workId,
    title: safeTitle,
    objective: `${generatedFileKindLabel(normalized)} generated in chat.`,
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
        type: 'file',
        title: safeTitle,
        filename: normalized.filename,
        mime_type: normalized.mime_type,
        size: normalized.size,
        size_label: normalized.size_label,
        status: 'ready',
        provenance: linkedThread ? [`thread:${linkedThread}`] : ['chat'],
        content: normalized.content || '',
        content_format: normalized.data_base64 ? 'base64' : normalized.content_format || 'text',
        data_base64: normalized.data_base64 || ''
      }
    ],
    watches: [],
    receipts: [],
    openApprovals: [],
    followUps: [],
    nextAction: 'Review saved file.'
  };

  const existing = readSavedWorkItems(storage);
  const persisted = persistWorkItems(storage, [item, ...existing]);
  if (persisted?.error) return persisted;
  return {
    item,
    artifact: item.artifacts[0],
    href: workArtifactHref(workId, artifactId)
  };
}

// Persist the bounded Work list. localStorage.setItem can throw
// QuotaExceededError when the artifact (e.g. a large base64 file) overflows the
// origin quota. Catch it and return {error:'quota'} so callers steer the user to
// disk-save instead of toasting a false success.
function persistWorkItems(storage, items) {
  try {
    storage.setItem(WORK_ITEMS_KEY, JSON.stringify(items.slice(0, MAX_WORK_ITEMS)));
    return null;
  } catch (err) {
    return { error: isQuotaError(err) ? 'quota' : 'storage' };
  }
}

function isQuotaError(err) {
  if (!err) return false;
  // Standard DOMException name, Firefox legacy name, and numeric codes (22 /
  // 1014). Some embedded WebViews only set the code.
  const name = err.name || '';
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    err.code === 22 ||
    err.code === 1014
  );
}

// Open a freshly saved work product. Prefer a client-side route change via
// React Router (the `navigate` callback) so we never tear down the SPA with a
// full document load. `location.assign` is kept only as a non-React fallback
// for callers outside the router (or when navigate is unavailable).
export function openSavedWorkProduct(saved, options = {}) {
  if (!saved?.href) return false;
  const { navigate, location = globalThis.window?.location } = options;
  if (typeof navigate === 'function') {
    // workArtifactHref bakes in the app base path (e.g. /v2/work?…). React
    // Router already applies that prefix via its basename, so strip it before
    // handing the path to navigate() — otherwise it doubles to /v2/v2/work and
    // misses the route. location.assign (the fallback) wants the full path.
    navigate(routerRelativeHref(saved.href));
    return true;
  }
  if (!location) return false;
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

// Strip the leading app base path (/v2) so a workArtifactHref can be handed to
// React Router's navigate(), which re-applies the basename itself.
function routerRelativeHref(href) {
  const base = appBasePath();
  const value = String(href || '');
  if (base && value.startsWith(`${base}/`)) {
    return value.slice(base.length) || '/';
  }
  return value;
}

export function workArtifactHref(workId, artifactId) {
  const params = new URLSearchParams({
    item: String(workId || ''),
    artifact: String(artifactId || '')
  });
  return appScopedPath(`/work?${params.toString()}`);
}

export function readSavedWorkItems(storage = defaultStorage()) {
  return readSavedWorkSnapshot(storage).items;
}

export function readSavedWorkSnapshot(storage = defaultStorage()) {
  if (!storage) {
    return savedWorkSnapshot([], SAVED_WORK_UNAVAILABLE_SOURCE);
  }
  try {
    const parsed = JSON.parse(storage.getItem(WORK_ITEMS_KEY) || '[]');
    const items = Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item === 'object')
      : [];
    return savedWorkSnapshot(items, SAVED_WORK_LOCAL_SOURCE);
  } catch {
    return savedWorkSnapshot([], SAVED_WORK_CORRUPT_SOURCE);
  }
}

export async function fetchSavedWorkSnapshot({ fetcher = apiFetch, signal } = {}) {
  const response = await fetcher(`${V2_BASE}/work`, { signal });
  return normalizeSavedWorkSnapshotResponse(response);
}

export function normalizeSavedWorkSnapshotResponse(response) {
  const rawItems =
    arrayValue(response?.items) ||
    arrayValue(response?.work_items) ||
    arrayValue(response?.work) ||
    arrayValue(response?.data?.items) ||
    arrayValue(response);
  const items = rawItems.map(normalizeSavedWorkItem).filter(Boolean);
  return savedWorkSnapshot(items, SAVED_WORK_SERVER_SOURCE);
}

export function mergeSavedWorkSnapshots(serverSnapshot, localSnapshot) {
  if (!isServerSavedWorkSnapshot(serverSnapshot)) {
    return localSnapshot || savedWorkSnapshot([], SAVED_WORK_UNAVAILABLE_SOURCE);
  }
  const serverItems = arrayValue(serverSnapshot.items) || [];
  const localItems = arrayValue(localSnapshot?.items) || [];
  if (!localItems.length) return serverSnapshot;

  const seen = new Set(serverItems.map(savedWorkItemKey).filter(Boolean));
  const localOnly = localItems.filter((item) => {
    const key = savedWorkItemKey(item);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!localOnly.length) return serverSnapshot;
  return savedWorkSnapshot([...serverItems, ...localOnly], SAVED_WORK_MIXED_SOURCE);
}

export function savedWorkServerReadSupported(gatewayStatus) {
  const value =
    gatewayStatus?.capabilities?.saved_work_read ??
    gatewayStatus?.capabilities?.work_read ??
    gatewayStatus?.features?.saved_work_read ??
    gatewayStatus?.features?.work_read ??
    gatewayStatus?.work?.read ??
    gatewayStatus?.work?.saved_work_read;
  return value === true || value === 'true' || value === 'available' || value === 'enabled';
}

function savedWorkSnapshot(items, sourceInfo) {
  return {
    ...sourceInfo,
    items
  };
}

function arrayValue(value) {
  return Array.isArray(value) ? value : null;
}

function normalizeSavedWorkItem(item) {
  if (!item || typeof item !== 'object') return null;
  const id = safeText(item.id || item.work_id || item.item_id, '');
  if (!id) return null;
  return {
    ...item,
    id,
    title: safeText(item.title || item.name, 'Untitled work'),
    artifacts: arrayValue(item.artifacts)?.map(normalizeSavedArtifact).filter(Boolean) || [],
    links: arrayValue(item.links) || [],
    dossier: arrayValue(item.dossier) || [],
    receipts: arrayValue(item.receipts) || [],
    openApprovals: arrayValue(item.openApprovals || item.open_approvals) || [],
    watches: arrayValue(item.watches) || [],
    followUps: arrayValue(item.followUps || item.follow_ups) || []
  };
}

function normalizeSavedArtifact(artifact) {
  if (!artifact || typeof artifact !== 'object') return null;
  const id = safeText(artifact.id || artifact.artifact_id, '');
  if (!id) return null;
  return {
    ...artifact,
    id,
    title: safeText(artifact.title || artifact.name || artifact.filename, 'Saved artifact')
  };
}

function savedWorkItemKey(item) {
  return safeText(item?.id || item?.work_id || item?.item_id, '');
}

function isServerSavedWorkSnapshot(snapshot) {
  return snapshot?.source === 'server' && Array.isArray(snapshot.items);
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
