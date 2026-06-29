import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  readThreadTitles,
  recordThreadTitle,
  threadDisplayTitle
} from './workbench-thread-titles.js';

function installLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
}

test('threadDisplayTitle: prefers local title, then gateway, then fallback', () => {
  assert.equal(
    threadDisplayTitle({ id: 't1', title: 'Workbench request' }, { t1: 'What is a SAFE note?' }),
    'What is a SAFE note?'
  );
  assert.equal(threadDisplayTitle({ id: 't2', title: 'Gateway Title' }, {}), 'Gateway Title');
  assert.equal(threadDisplayTitle({ id: 't3' }, {}), 'Untitled conversation');
  assert.equal(threadDisplayTitle({ id: 't4', title: '   ' }, {}), 'Untitled conversation');
});

test('recordThreadTitle + readThreadTitles round-trip (with localStorage)', () => {
  installLocalStorage();
  recordThreadTitle('t1', '  Draft the Q3 board memo  ');
  assert.equal(readThreadTitles().t1, 'Draft the Q3 board memo');
  recordThreadTitle('', 'no id');
  recordThreadTitle('t2', '   ');
  assert.equal(readThreadTitles().t2, undefined);
});

test('recordThreadTitle: truncates long titles to <=120 with an ellipsis', () => {
  installLocalStorage();
  recordThreadTitle('t1', 'x'.repeat(300));
  const t = readThreadTitles().t1;
  assert.ok(t.length <= 120);
  assert.ok(t.endsWith('…'));
});

test('readThreadTitles: honest-empty without localStorage', () => {
  delete globalThis.localStorage;
  assert.deepEqual(readThreadTitles(), {});
});
