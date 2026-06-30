import assert from 'node:assert/strict';
import test from 'node:test';

import { ReviewGrid, reviewCell, cellReasoning } from './workbench-review-grid.js';
import { REVIEW_COLUMNS } from '../lib/workbench-review-columns.js';

const DOCS = [
  { id: 'd1', title: 'Acme NDA.pdf' },
  { id: 'd2', title: 'Northwind MSA.docx' }
];

test('ReviewGrid renders nothing without columns or documents (honest empty)', () => {
  assert.equal(ReviewGrid({ columns: REVIEW_COLUMNS, documents: [] }), null);
  assert.equal(ReviewGrid({ columns: [], documents: DOCS }), null);
  assert.equal(ReviewGrid({}), null);
});

test('ReviewGrid returns a vnode when given columns + documents', () => {
  const node = ReviewGrid({ columns: REVIEW_COLUMNS, documents: DOCS, cells: {} });
  assert.ok(node && typeof node === 'object', 'returns a preact vnode for a populated grid');
});

test('reviewCell resolves a cell by document + column, null when absent', () => {
  const cells = { d1: { term: { summary: '2 years', flag: 'green', status: 'done' } } };
  assert.equal(reviewCell(cells, 'd1', 'term').summary, '2 years');
  assert.equal(reviewCell(cells, 'd1', 'parties'), null);
  assert.equal(reviewCell(cells, 'd2', 'term'), null);
  assert.equal(reviewCell(undefined, 'd1', 'term'), null);
});

test('cellReasoning returns the trimmed reasoning, or empty string when there is none', () => {
  assert.equal(cellReasoning({ reasoning: '  Named in the recitals  ' }), 'Named in the recitals');
  assert.equal(cellReasoning({ reasoning: '' }), '');
  assert.equal(cellReasoning({ summary: 'x' }), ''); // no reasoning key
  assert.equal(cellReasoning({ reasoning: 123 }), ''); // non-string is not evidence
  assert.equal(cellReasoning(null), '');
  assert.equal(cellReasoning(undefined), '');
});
