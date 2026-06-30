import assert from 'node:assert/strict';
import test from 'node:test';

import {
  tokenize,
  diffWords,
  splitClauses,
  redlineClauses,
  resolvedText,
  buildRedlineHtml,
  clauseDegraded,
  MAX_DIFF_TOKENS
} from './workbench-redline.js';

// The two reconstruction invariants every diff must satisfy:
//   equal+delete segments rejoin to the original; equal+insert segments rejoin to the revised.
const beforeOf = (segs) =>
  segs
    .filter((s) => s.op === 'equal' || s.op === 'delete')
    .map((s) => s.text)
    .join('');
const afterOf = (segs) =>
  segs
    .filter((s) => s.op === 'equal' || s.op === 'insert')
    .map((s) => s.text)
    .join('');

function assertReconstructs(a, b) {
  const segs = diffWords(a, b);
  assert.equal(beforeOf(segs), a, `equal+delete must reconstruct the original for "${a}"→"${b}"`);
  assert.equal(afterOf(segs), b, `equal+insert must reconstruct the revised for "${a}"→"${b}"`);
  return segs;
}

test('tokenize keeps whitespace as its own tokens (exact reconstruction)', () => {
  assert.deepEqual(tokenize('a  b\nc'), ['a', '  ', 'b', '\n', 'c']);
  assert.deepEqual(tokenize(''), []);
  assert.deepEqual(tokenize(null), []);
});

test('diffWords: no change → all equal', () => {
  const segs = assertReconstructs('The term is two years.', 'The term is two years.');
  assert.equal(segs.length, 1);
  assert.equal(segs[0].op, 'equal');
});

test('diffWords: pure insertion', () => {
  const segs = assertReconstructs(
    'Governed by Delaware law.',
    'Governed by the laws of Delaware law.'
  );
  assert.ok(segs.some((s) => s.op === 'insert'));
  assert.ok(!segs.some((s) => s.op === 'delete'));
});

test('diffWords: pure deletion (clean word boundaries, no punctuation re-attachment)', () => {
  const segs = assertReconstructs(
    'the receiving party shall promptly return all materials',
    'the receiving party shall return all materials'
  );
  assert.ok(segs.some((s) => s.op === 'delete' && s.text.includes('promptly')));
  assert.ok(!segs.some((s) => s.op === 'insert'), 'removing whole words is a pure deletion');
});

test('diffWords: a replacement is a delete + insert around the unchanged words', () => {
  const segs = assertReconstructs('The cap is $1,000,000.', 'The cap is $2,000,000.');
  assert.ok(segs.some((s) => s.op === 'delete' && s.text.includes('1,000,000')));
  assert.ok(segs.some((s) => s.op === 'insert' && s.text.includes('2,000,000')));
  // the unchanged head is preserved as a single equal run (adjacent same-op merged)
  assert.equal(segs[0].op, 'equal');
});

test('diffWords: empty sides and whitespace-only reconstruct exactly', () => {
  assert.deepEqual(diffWords('', ''), []);
  assert.deepEqual(diffWords('', 'hello'), [{ op: 'insert', text: 'hello' }]);
  assert.deepEqual(diffWords('hello', ''), [{ op: 'delete', text: 'hello' }]);
  assertReconstructs('keep this', 'keep   this'); // whitespace change is itself a diff
});

test('diffWords: adjacent same-op runs are merged into one segment', () => {
  const segs = diffWords('a b c d', 'a x y d');
  // no two consecutive segments share an op
  for (let i = 1; i < segs.length; i++) {
    assert.notEqual(segs[i].op, segs[i - 1].op, 'consecutive segments differ in op');
  }
});

test('splitClauses splits on blank/newlines, trims, drops empties', () => {
  assert.deepEqual(splitClauses('1. Parties\n\n2. Term\n   \n3. Law'), [
    '1. Parties',
    '2. Term',
    '3. Law'
  ]);
  assert.deepEqual(splitClauses(''), []);
  assert.deepEqual(splitClauses('   \n  '), []);
});

test('redlineClauses: unchanged / modified / added / removed, with stable ids', () => {
  const orig = '1. Parties: Acme and Beta.\n2. Term: two years.\n3. Law: Delaware.';
  const rev = '1. Parties: Acme and Beta.\n2. Term: three years.\n4. Notices: by email.';
  const clauses = redlineClauses(orig, rev);
  assert.ok(
    clauses.every((c, idx) => c.id === `clause-${idx}`),
    'ids are sequential + stable'
  );

  const unchanged = clauses.find((c) => c.before.startsWith('1. Parties'));
  assert.equal(unchanged.kind, 'unchanged');
  assert.equal(unchanged.changed, false);

  const modified = clauses.find((c) => c.kind === 'modified');
  assert.ok(modified, 'the Term clause is a modification');
  assert.ok(modified.segments.some((s) => s.op === 'delete' && s.text.includes('two')));
  assert.ok(modified.segments.some((s) => s.op === 'insert' && s.text.includes('three')));
  // the modified clause still reconstructs both sides
  assert.equal(beforeOf(modified.segments), modified.before);
  assert.equal(afterOf(modified.segments), modified.after);
});

test('redlineClauses: a removed-only clause and an added-only clause are classified honestly', () => {
  const removed = redlineClauses('A.\nB.\nC.', 'A.\nC.');
  assert.deepEqual(
    removed.map((c) => c.kind),
    ['unchanged', 'removed', 'unchanged']
  );
  const added = redlineClauses('A.\nC.', 'A.\nB.\nC.');
  assert.deepEqual(
    added.map((c) => c.kind),
    ['unchanged', 'added', 'unchanged']
  );
});

test('redlineClauses: matches clauses by CONTENT, not position, when a clause is inserted mid-block', () => {
  // The common case: add one clause, tweak two existing ones. Each tweak must stay on its own
  // clause (a word-level modified diff), NOT be lost to remove+add by an index shift.
  const orig = 'Fee: one hundred dollars per month.\nNotice period is thirty days.';
  const rev =
    'Arbitration: disputes resolved by binding arbitration.\nFee: two hundred dollars per month.\nNotice period is sixty days.';
  const clauses = redlineClauses(orig, rev);
  const kinds = clauses.map((c) => c.kind).sort();
  assert.deepEqual(kinds, ['added', 'modified', 'modified'], 'two modifications + one addition');
  const fee = clauses.find((c) => c.before.startsWith('Fee:'));
  assert.equal(fee.kind, 'modified');
  assert.ok(fee.segments.some((s) => s.op === 'delete' && s.text.includes('one')));
  assert.ok(fee.segments.some((s) => s.op === 'insert' && s.text.includes('two')));
});

test('redlineClauses: reordered clauses keep each edit on the RIGHT clause (content match, not index)', () => {
  // Two clauses swap order AND each is edited. Index pairing would diff one INTO the other;
  // content matching must pair Confidentiality↔Confidentiality and Indemnification↔Indemnification.
  const orig =
    'Confidentiality: the receiving party shall hold information in strict confidence.\nIndemnification: the receiving party shall indemnify against third-party claims.';
  const rev =
    'Indemnification: the receiving party shall indemnify against all third-party claims.\nConfidentiality: the receiving party shall hold information in absolute confidence.';
  const clauses = redlineClauses(orig, rev);
  const conf = clauses.find((c) => c.before.startsWith('Confidentiality'));
  const indem = clauses.find((c) => c.before.startsWith('Indemnification'));
  assert.equal(conf.kind, 'modified');
  assert.ok(
    conf.after.startsWith('Confidentiality'),
    'Confidentiality paired with Confidentiality'
  );
  assert.ok(conf.segments.some((s) => s.op === 'delete' && s.text.includes('strict')));
  assert.ok(conf.segments.some((s) => s.op === 'insert' && s.text.includes('absolute')));
  assert.equal(indem.kind, 'modified');
  assert.ok(
    indem.after.startsWith('Indemnification'),
    'Indemnification paired with Indemnification'
  );
});

test('redlineClauses: identical documents are entirely unchanged', () => {
  const doc = '1. One.\n2. Two.\n3. Three.';
  const clauses = redlineClauses(doc, doc);
  assert.ok(clauses.every((c) => c.kind === 'unchanged' && c.changed === false));
  assert.equal(clauses.length, 3);
});

test('resolvedText: accept-all yields the revised document, reject-all yields the original', () => {
  const orig = 'Term: two years.\nFee: one hundred.\nLaw: Delaware.';
  const rev = 'Term: three years.\nFee: one hundred.\nNotices: by email.';
  const clauses = redlineClauses(orig, rev);
  // accept-all == the revised clauses; reject-all == the original clauses (whitespace normalized
  // by splitClauses, which is the documented clause-segmentation contract).
  assert.equal(resolvedText(clauses, {}), splitClauses(rev).join('\n'));
  const rejectAll = Object.fromEntries(clauses.map((c) => [c.id, 'reject']));
  assert.equal(resolvedText(clauses, rejectAll), splitClauses(orig).join('\n'));
});

test('resolvedText: rejecting a modified clause keeps its original wording; accepting keeps the revision', () => {
  const orig = 'Term: two years.\nLaw: Delaware.';
  const rev = 'Term: three years.\nLaw: Delaware.';
  const clauses = redlineClauses(orig, rev);
  const termId = clauses.find((c) => c.kind === 'modified').id;
  assert.match(resolvedText(clauses, { [termId]: 'reject' }), /Term: two years\./);
  assert.match(resolvedText(clauses, { [termId]: 'accept' }), /Term: three years\./);
});

test('resolvedText: an added clause is kept on accept and dropped on reject; a removed clause is the reverse', () => {
  const added = redlineClauses('A.\nB.', 'A.\nNEW clause here.\nB.');
  const addId = added.find((c) => c.kind === 'added').id;
  assert.match(resolvedText(added, {}), /NEW clause here\./); // accepted by default → kept
  assert.doesNotMatch(resolvedText(added, { [addId]: 'reject' }), /NEW clause here\./); // dropped

  const removed = redlineClauses('A.\nGONE clause here.\nB.', 'A.\nB.');
  const remId = removed.find((c) => c.kind === 'removed').id;
  assert.doesNotMatch(resolvedText(removed, {}), /GONE clause here\./); // accept removal → dropped
  assert.match(resolvedText(removed, { [remId]: 'reject' }), /GONE clause here\./); // reject → kept
});

test('resolvedText: tolerant of junk input', () => {
  assert.equal(resolvedText(null, null), '');
  assert.equal(resolvedText([], {}), '');
  assert.equal(resolvedText([{ id: 'x', before: '', after: '' }], {}), '');
});

test('buildRedlineHtml renders insertions + deletions and a kind tag per clause', () => {
  const clauses = redlineClauses('Term: two years.', 'Term: three years.');
  const htmlOut = buildRedlineHtml(clauses, { title: 'NDA redline' });
  assert.match(htmlOut, /^<!doctype html>/);
  assert.match(htmlOut, /<title>NDA redline<\/title>/);
  assert.match(htmlOut, /<ins>three<\/ins>/);
  assert.match(htmlOut, /<del>two<\/del>/);
  assert.match(htmlOut, /class="k">modified/);
});

test('buildRedlineHtml escapes user document text — no markup injection into the downloaded file', () => {
  const clauses = redlineClauses('safe clause', 'evil <script>alert(1)</script> clause');
  const htmlOut = buildRedlineHtml(clauses);
  assert.doesNotMatch(htmlOut, /<script>alert/, 'a raw <script> from the document never survives');
  assert.match(htmlOut, /&lt;script&gt;/, 'the script text is escaped, not executed');
  // a malicious title is escaped too
  assert.match(buildRedlineHtml([], { title: '<img src=x onerror=1>' }), /&lt;img src=x/);
});

test('buildRedlineHtml is tolerant of empty/junk clauses', () => {
  assert.match(buildRedlineHtml([], {}), /<body><h1>Redline<\/h1>/);
  assert.match(buildRedlineHtml(null), /<!doctype html>/);
});

test('clauseDegraded flags only a modified clause too large for the exact word diff', () => {
  const big = `word ${'x '.repeat(MAX_DIFF_TOKENS)}`; // well over the token cap on its own
  const degraded = { kind: 'modified', before: big, after: `${big} more` };
  assert.equal(clauseDegraded(degraded), true);
  // a normal modification is not degraded
  assert.equal(
    clauseDegraded({ kind: 'modified', before: 'two years', after: 'three years' }),
    false
  );
  // non-modified clauses never count (they don't run the word diff)
  assert.equal(clauseDegraded({ kind: 'added', before: '', after: big }), false);
  assert.equal(clauseDegraded({ kind: 'removed', before: big, after: '' }), false);
  assert.equal(clauseDegraded(null), false);
});
