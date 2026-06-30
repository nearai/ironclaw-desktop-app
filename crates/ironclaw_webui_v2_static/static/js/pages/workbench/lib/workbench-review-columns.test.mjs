import assert from 'node:assert/strict';
import test from 'node:test';

import { REVIEW_COLUMNS, REVIEW_FLAGS, reviewColumnById } from './workbench-review-columns.js';

test('REVIEW_COLUMNS is the 5 built-in NDA columns with stable ids', () => {
  assert.equal(REVIEW_COLUMNS.length, 5);
  assert.deepEqual(
    REVIEW_COLUMNS.map((c) => c.id),
    ['parties', 'governing-law', 'term', 'termination', 'change-of-control']
  );
});

test('every column carries a label, a type, and a non-trivial extraction prompt', () => {
  for (const column of REVIEW_COLUMNS) {
    assert.ok(column.label && column.label.length > 0, `${column.id} has a label`);
    assert.ok(column.type, `${column.id} has a type`);
    assert.ok(
      typeof column.prompt === 'string' && column.prompt.length > 24,
      `${column.id} has a real extraction prompt`
    );
  }
});

test('REVIEW_FLAGS are the four risk levels', () => {
  assert.deepEqual([...REVIEW_FLAGS], ['green', 'yellow', 'red', 'grey']);
});

test('reviewColumnById resolves a known id and returns null otherwise', () => {
  assert.equal(reviewColumnById('term')?.label, 'Term');
  assert.equal(reviewColumnById('nope'), null);
  assert.equal(reviewColumnById(''), null);
});
