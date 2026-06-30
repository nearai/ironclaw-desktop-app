import assert from 'node:assert/strict';
import test from 'node:test';

import { readLibraryItems, saveLibraryItem, removeLibraryItem } from './workbench-library-store.js';

// In-memory localStorage stand-in (node has no localStorage).
function mockStore(initial) {
  const m = new Map();
  if (initial != null) m.set('workbench:library-items', JSON.stringify(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v))
  };
}

test('readLibraryItems returns [] for empty / malformed / non-array storage', () => {
  assert.deepEqual(readLibraryItems(mockStore()), []);
  assert.deepEqual(readLibraryItems(null), []);
  const bad = { getItem: () => '{not json', setItem: () => {} };
  assert.deepEqual(readLibraryItems(bad), []);
  const notArray = { getItem: () => JSON.stringify({ a: 1 }), setItem: () => {} };
  assert.deepEqual(readLibraryItems(notArray), []);
});

test('saveLibraryItem persists an item and readLibraryItems reads it back', () => {
  const store = mockStore();
  const out = saveLibraryItem(
    { title: 'Daily briefing', kind: 'Briefing', id: 'l1', savedAt: '2026-06-24T00:00:00Z' },
    store
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].title, 'Daily briefing');
  assert.equal(out[0].kind, 'Briefing');
  assert.equal(out[0].id, 'l1');
  const reread = readLibraryItems(store);
  assert.equal(reread.length, 1);
  assert.equal(reread[0].id, 'l1');
});

test('saveLibraryItem ignores empty title (no-op) and trims/defaults kind', () => {
  const store = mockStore();
  assert.deepEqual(saveLibraryItem({ title: '   ' }, store), []);
  assert.deepEqual(saveLibraryItem({}, store), []);
  const out = saveLibraryItem({ title: '  board   packet  ', id: 'l2' }, store);
  assert.equal(out[0].title, 'board packet', 'whitespace collapsed + trimmed');
  assert.equal(out[0].kind, 'Work', 'kind defaults to Work');
});

test('saveLibraryItem prepends newest-first', () => {
  const store = mockStore();
  saveLibraryItem({ title: 'first', id: 'a' }, store);
  const out = saveLibraryItem({ title: 'second', id: 'b' }, store);
  assert.deepEqual(
    out.map((it) => it.id),
    ['b', 'a']
  );
});

test('removeLibraryItem deletes by id', () => {
  const store = mockStore([
    { id: 'x', title: 'keep me', kind: 'Work', savedAt: '' },
    { id: 'y', title: 'drop me', kind: 'Work', savedAt: '' }
  ]);
  const out = removeLibraryItem('y', store);
  assert.deepEqual(
    out.map((it) => it.id),
    ['x']
  );
  assert.equal(readLibraryItems(store).length, 1, 'removal persisted');
});
