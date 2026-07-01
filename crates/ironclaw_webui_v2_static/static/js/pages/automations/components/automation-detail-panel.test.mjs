import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

async function source() {
  return readFile(path.join(dir, 'automation-detail-panel.js'), 'utf8');
}

// Strip comments so structural assertions match real markup, not explanatory prose.
function code(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// Ironwork rebuild: the four rounded-xl tinted MetaItem boxes become hairline
// key-value rows.
test('detail panel uses hairline meta rows, not rounded-xl metric boxes', async () => {
  const src = await source();
  assert.doesNotMatch(src, /function MetaItem/, 'the boxed MetaItem is gone');
  assert.match(src, /function MetaRow/, 'meta values render as hairline rows');
  assert.doesNotMatch(code(src), /rounded-xl/, 'no rounded-xl tinted boxes remain');
});

// A healthy success rate is quiet; only a real failure carries colour — no
// decorative green success card.
test('detail panel keeps a healthy success rate quiet (no green card)', async () => {
  const src = await source();
  assert.doesNotMatch(
    src,
    /has_failed_runs \? 'danger' : 'success'/,
    'success rate must not tint green when healthy'
  );
  assert.match(src, /has_failed_runs \? 'danger' : null/, 'only failures carry a tone');
});

// The mono automation id is demoted behind a copy affordance rather than sitting
// raw in the open.
test('detail panel demotes the automation id behind a copy affordance', async () => {
  const src = await source();
  assert.match(src, /function CopyableId/, 'the id renders through a copy control');
  assert.match(src, /clipboard\.writeText/, 'the affordance copies the id');
  assert.match(src, /label="Copy automation id"/, 'the copy control has an accessible name');
});
