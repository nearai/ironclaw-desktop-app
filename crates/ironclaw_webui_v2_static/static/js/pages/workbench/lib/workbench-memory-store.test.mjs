import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MEMORY_SCOPES,
  readMemoryPrefs,
  saveMemoryPref,
  removeMemoryPref
} from './workbench-memory-store.js';

// In-memory localStorage stand-in (node has no localStorage).
function mockStore(initial) {
  const m = new Map();
  if (initial != null) m.set('workbench:memory-prefs', JSON.stringify(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    _raw: () => m.get('workbench:memory-prefs')
  };
}

test('readMemoryPrefs returns [] for empty / malformed / non-array storage', () => {
  assert.deepEqual(readMemoryPrefs(mockStore()), []);
  assert.deepEqual(readMemoryPrefs(null), []);
  const bad = { getItem: () => '{not json', setItem: () => {} };
  assert.deepEqual(readMemoryPrefs(bad), []);
  const notArray = { getItem: () => JSON.stringify({ a: 1 }), setItem: () => {} };
  assert.deepEqual(readMemoryPrefs(notArray), []);
});

test('saveMemoryPref persists a preference and readMemoryPrefs reads it back', () => {
  const store = mockStore();
  const out = saveMemoryPref(
    {
      text: 'Show sources before external drafts leave',
      scope: 'Workspace',
      id: 'p1',
      savedAt: '2026-06-24T00:00:00Z'
    },
    store
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].text, 'Show sources before external drafts leave');
  assert.equal(out[0].scope, 'Workspace');
  assert.equal(out[0].id, 'p1');
  // survives a fresh read (it was actually written to the store)
  const reread = readMemoryPrefs(store);
  assert.equal(reread.length, 1);
  assert.equal(reread[0].id, 'p1');
});

test('saveMemoryPref ignores empty text (no-op) and trims/clips/validates', () => {
  const store = mockStore();
  assert.deepEqual(saveMemoryPref({ text: '   ' }, store), []);
  assert.deepEqual(saveMemoryPref({}, store), []);
  const out = saveMemoryPref({ text: '  net 60   please  ', scope: 'bogus', id: 'p2' }, store);
  assert.equal(out[0].text, 'net 60 please', 'whitespace collapsed + trimmed');
  assert.equal(out[0].scope, 'Personal', 'invalid scope coerced to Personal');
  assert.ok(MEMORY_SCOPES.includes(out[0].scope));
});

test('saveMemoryPref prepends newest-first', () => {
  const store = mockStore();
  saveMemoryPref({ text: 'first', id: 'a' }, store);
  const out = saveMemoryPref({ text: 'second', id: 'b' }, store);
  assert.deepEqual(
    out.map((p) => p.id),
    ['b', 'a'],
    'newest first'
  );
});

test('removeMemoryPref deletes by id', () => {
  const store = mockStore([
    { id: 'x', text: 'keep me', scope: 'Personal', savedAt: '' },
    { id: 'y', text: 'drop me', scope: 'Personal', savedAt: '' }
  ]);
  const out = removeMemoryPref('y', store);
  assert.deepEqual(
    out.map((p) => p.id),
    ['x']
  );
  assert.equal(readMemoryPrefs(store).length, 1, 'removal persisted');
});
