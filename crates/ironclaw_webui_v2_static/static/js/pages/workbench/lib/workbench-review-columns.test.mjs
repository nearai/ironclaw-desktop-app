import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REVIEW_COLUMNS,
  REVIEW_FLAGS,
  reviewColumnById,
  makeCustomColumn,
  effectiveColumns,
  CUSTOM_COLUMN_LABEL_MAX,
  CUSTOM_COLUMN_PROMPT_MAX
} from './workbench-review-columns.js';

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

test('makeCustomColumn builds a namespaced, trimmed, length-capped column', () => {
  const col = makeCustomColumn('  Indemnity cap  ', '  What is the indemnity cap?  ', 3);
  assert.equal(col.id, 'custom-3');
  assert.equal(col.label, 'Indemnity cap');
  assert.equal(col.prompt, 'What is the indemnity cap?');
  assert.equal(col.type, 'custom');
  assert.equal(col.custom, true);
  // id can never collide with a built-in id
  assert.ok(!REVIEW_COLUMNS.some((c) => c.id === col.id));
  // length caps
  const long = makeCustomColumn('x'.repeat(200), 'y'.repeat(500), 1);
  assert.equal(long.label.length, CUSTOM_COLUMN_LABEL_MAX);
  assert.equal(long.prompt.length, CUSTOM_COLUMN_PROMPT_MAX);
});

test('makeCustomColumn returns null when the label or prompt is blank', () => {
  assert.equal(makeCustomColumn('', 'p', 1), null);
  assert.equal(makeCustomColumn('label', '   ', 1), null);
  assert.equal(makeCustomColumn(null, null, 1), null);
  // bad seq falls back to 1 rather than producing a NaN id
  assert.equal(makeCustomColumn('L', 'P', 0).id, 'custom-1');
  assert.equal(makeCustomColumn('L', 'P', undefined).id, 'custom-1');
});

test('makeCustomColumn rejects non-string label/prompt rather than coercing them', () => {
  assert.equal(makeCustomColumn({ a: 1 }, 'p', 1), null); // would have been "[object Object]"
  assert.equal(makeCustomColumn(123, 'p', 1), null); // would have been "123"
  assert.equal(makeCustomColumn('L', { b: 2 }, 1), null);
  assert.equal(makeCustomColumn('L', 5, 1), null);
});

test('effectiveColumns appends valid custom columns after the built-ins, dropping junk + id collisions', () => {
  const c1 = makeCustomColumn('Cap', 'cap?', 1);
  const dupBuiltin = { id: 'parties', label: 'Fake', type: 'custom', prompt: 'p', custom: true };
  const dupCustom = { id: 'custom-1', label: 'Dup', type: 'custom', prompt: 'p', custom: true };
  const cols = effectiveColumns([c1, null, {}, dupBuiltin, dupCustom]);
  assert.equal(
    cols.length,
    REVIEW_COLUMNS.length + 1,
    'only the one valid, non-colliding custom column is added'
  );
  assert.deepEqual(
    cols.slice(0, REVIEW_COLUMNS.length).map((c) => c.id),
    REVIEW_COLUMNS.map((c) => c.id),
    'built-ins keep their order and indices'
  );
  assert.equal(cols[REVIEW_COLUMNS.length].id, 'custom-1');
  // ids are unique across the whole effective set (no index→column ambiguity)
  const ids = cols.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  // empty / non-array → just the built-ins
  assert.equal(effectiveColumns(undefined).length, REVIEW_COLUMNS.length);
  assert.equal(effectiveColumns([]).length, REVIEW_COLUMNS.length);
});
