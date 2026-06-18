/* Per-conversation composer draft store.
 *
 * Text drafts are localStorage-backed. Staged attachments are in-memory only:
 * they can survive SPA navigation between screens, but never a full reload,
 * which avoids pushing decoded file payloads into localStorage quotas.
 */

import { authScope } from '../../../lib/auth-scope.js';

export const NEW_DRAFT_KEY = '__new__';

const STORAGE_PREFIX = 'ironclaw:v2-draft:';

function storageKey(key) {
  return `${STORAGE_PREFIX}${authScope()}:${key || NEW_DRAFT_KEY}`;
}

export function getDraft(key) {
  try {
    return window.localStorage.getItem(storageKey(key)) || '';
  } catch (_) {
    return '';
  }
}

export function setDraft(key, text) {
  try {
    if (text) {
      window.localStorage.setItem(storageKey(key), text);
    } else {
      window.localStorage.removeItem(storageKey(key));
    }
  } catch (_) {
    // Best-effort: never block the composer on storage failures.
  }
}

export function clearDraft(key) {
  setDraft(key, '');
}

const stagedAttachments = new Map();

export function getStagedAttachments(key) {
  return stagedAttachments.get(storageKey(key)) || [];
}

function hasStagedPayload(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (!value || typeof value !== 'object') return false;
  return Boolean(value.images?.length || value.attachments?.length);
}

export function setStagedAttachments(key, attachments) {
  const id = storageKey(key);
  if (hasStagedPayload(attachments)) {
    stagedAttachments.set(id, attachments);
  } else {
    stagedAttachments.delete(id);
  }
}

export function clearStagedAttachments(key) {
  stagedAttachments.delete(storageKey(key));
}

export function clearAllDrafts() {
  stagedAttachments.clear();
  try {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch (_) {
    // Best-effort.
  }
}
