/* Per-conversation composer draft store.
 *
 * Text drafts are localStorage-backed. Staged attachments are in-memory only:
 * they can survive SPA navigation between screens, but never a full reload,
 * which avoids pushing decoded file payloads into localStorage quotas.
 */

import { authScope, hasAuthScope } from '../../../lib/auth-scope.js';

export const NEW_DRAFT_KEY = '__new__';

const STORAGE_PREFIX = 'ironclaw:v2-draft:';

function storageKey(key) {
  if (!hasAuthScope()) return null;
  return `${STORAGE_PREFIX}${authScope()}:${key || NEW_DRAFT_KEY}`;
}

export function getDraft(key) {
  try {
    const id = storageKey(key);
    if (!id) return '';
    return window.localStorage.getItem(id) || '';
  } catch (_) {
    return '';
  }
}

export function setDraft(key, text) {
  try {
    const id = storageKey(key);
    if (!id) return;
    if (text) {
      window.localStorage.setItem(id, text);
    } else {
      window.localStorage.removeItem(id);
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
  const id = storageKey(key);
  return id ? stagedAttachments.get(id) || [] : [];
}

function hasStagedPayload(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (!value || typeof value !== 'object') return false;
  return Boolean(value.images?.length || value.attachments?.length);
}

export function setStagedAttachments(key, attachments) {
  const id = storageKey(key);
  if (!id) return;
  if (hasStagedPayload(attachments)) {
    stagedAttachments.set(id, attachments);
  } else {
    stagedAttachments.delete(id);
  }
}

export function clearStagedAttachments(key) {
  const id = storageKey(key);
  if (id) stagedAttachments.delete(id);
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
