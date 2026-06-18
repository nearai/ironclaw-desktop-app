// Unit tests for the per-conversation composer draft store.
//
// Run with Node's built-in test runner:
//   node --test crates/ironclaw_webui_v2_static/static/js/pages/chat/lib/draft-store.test.js

import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { setAuthScope } from '../../../lib/auth-scope.js';
import {
  NEW_DRAFT_KEY,
  clearAllDrafts,
  clearDraft,
  clearStagedAttachments,
  getDraft,
  getStagedAttachments,
  setDraft,
  setStagedAttachments
} from './draft-store.js';

function installStorage() {
  const map = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      get length() {
        return map.size;
      },
      key: (i) => [...map.keys()][i] ?? null
    }
  };
  return map;
}

beforeEach(() => {
  installStorage();
  setAuthScope(null);
});

test('drafts are isolated per authenticated user across a session switch', () => {
  setAuthScope({ tenant_id: 't1', user_id: 'user-A' });
  setDraft(NEW_DRAFT_KEY, "user A's secret draft");

  setAuthScope({ tenant_id: 't1', user_id: 'user-B' });
  assert.equal(getDraft(NEW_DRAFT_KEY), '');
  setDraft(NEW_DRAFT_KEY, "user B's draft");

  setAuthScope({ tenant_id: 't1', user_id: 'user-A' });
  assert.equal(getDraft(NEW_DRAFT_KEY), "user A's secret draft");
});

test('getDraft returns an empty string when nothing is stored', () => {
  assert.equal(getDraft('thread-1'), '');
});

test('setDraft round-trips a draft for a thread key', () => {
  setDraft('thread-1', 'half-written message');
  assert.equal(getDraft('thread-1'), 'half-written message');
});

test('drafts are scoped per key and do not leak across conversations', () => {
  setDraft('thread-1', 'draft A');
  setDraft('thread-2', 'draft B');
  assert.equal(getDraft('thread-1'), 'draft A');
  assert.equal(getDraft('thread-2'), 'draft B');
});

test('the new-conversation slot is addressable via NEW_DRAFT_KEY', () => {
  setDraft(NEW_DRAFT_KEY, 'unsent + New draft');
  assert.equal(getDraft(NEW_DRAFT_KEY), 'unsent + New draft');
});

test('a falsy key falls back to the new-conversation slot', () => {
  setDraft(undefined, 'fallback draft');
  assert.equal(getDraft(undefined), 'fallback draft');
  assert.equal(getDraft(NEW_DRAFT_KEY), 'fallback draft');
});

test('setDraft with empty text clears the slot', () => {
  setDraft('thread-1', 'something');
  setDraft('thread-1', '');
  assert.equal(getDraft('thread-1'), '');
});

test('clearDraft removes a stored draft', () => {
  setDraft('thread-1', 'to be sent');
  clearDraft('thread-1');
  assert.equal(getDraft('thread-1'), '');
});

test('staged attachments are scoped in memory', () => {
  setStagedAttachments('thread-1', { images: [{ id: 'img' }], attachments: [] });
  assert.deepEqual(getStagedAttachments('thread-1'), { images: [{ id: 'img' }], attachments: [] });
  clearStagedAttachments('thread-1');
  assert.deepEqual(getStagedAttachments('thread-1'), []);
});

test('clearAllDrafts removes every draft but leaves unrelated keys', () => {
  setDraft('thread-1', 'a');
  setDraft(NEW_DRAFT_KEY, 'b');
  setStagedAttachments('thread-1', [{ id: 'file' }]);
  globalThis.window.localStorage.setItem('ironclaw:unrelated', 'keep');
  clearAllDrafts();
  assert.equal(getDraft('thread-1'), '');
  assert.equal(getDraft(NEW_DRAFT_KEY), '');
  assert.deepEqual(getStagedAttachments('thread-1'), []);
  assert.equal(globalThis.window.localStorage.getItem('ironclaw:unrelated'), 'keep');
});

test('storage failures are swallowed', () => {
  globalThis.window = {
    localStorage: {
      getItem: () => {
        throw new Error('quota / private mode');
      },
      setItem: () => {
        throw new Error('quota / private mode');
      },
      removeItem: () => {
        throw new Error('quota / private mode');
      }
    }
  };
  assert.doesNotThrow(() => setDraft('thread-1', 'x'));
  assert.equal(getDraft('thread-1'), '');
  assert.doesNotThrow(() => clearDraft('thread-1'));
});
