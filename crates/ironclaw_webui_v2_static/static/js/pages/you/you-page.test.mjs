import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

async function source() {
  return readFile(path.join(dir, 'you-page.js'), 'utf8');
}

// Strip line + block comments so structural assertions match real markup, not
// prose that happens to name an element (e.g. "replaces the native <select>").
function code(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// Ironwork rebuild: the orphan inline wb13-* CSS sheet is gone; the surface rides
// the shared --v2-* primitives instead of its own hand-rolled stylesheet.
test('you-page drops the orphan wb13-* CSS sheet', async () => {
  const src = await source();
  assert.doesNotMatch(src, /const YOU_STYLE =/, 'the inline stylesheet is removed');
  assert.doesNotMatch(src, /<style>/, 'no injected <style> block');
  assert.doesNotMatch(src, /className="wb13-/, 'no wb13-* class references remain');
});

// The native <select> tier control is replaced by the shared popover/menu primitive,
// while its accessible name ("Set tier for <email>") is preserved for tests + AT.
test('you-page replaces the native select with the shared popover menu', async () => {
  const src = await source();
  assert.doesNotMatch(code(src), /<select/, 'no native select element');
  assert.doesNotMatch(code(src), /<option/, 'no native option elements');
  assert.match(src, /import \{ Popover \}/, 'tier control uses the Popover primitive');
  assert.match(src, /role="menuitemradio"/, 'tiers are single-select menu items');
  assert.match(
    src,
    /aria-label=\$\{`Set tier for \$\{person\.email\}`\}/,
    'the accessible name is preserved on the control'
  );
});

// Tier chips ride the shared Badge primitive rather than a hand-rolled span.
test('you-page tier badges use the shared Badge primitive', async () => {
  const src = await source();
  assert.match(src, /import \{ Badge \}/);
  assert.match(src, /<\$\{Badge\} tone=\$\{meta\.tone\}/, 'TierBadge renders a shared Badge');
});

// The stat strip is the focal element: large tabular-nums figures over quiet mono
// labels, on a hairline strip — no metric boxes.
test('you-page stat strip uses focal tabular figures, not metric boxes', async () => {
  const src = await source();
  assert.match(src, /tabular-nums/, 'figures are tabular for aligned counts');
  assert.match(src, /border-y border-\[var\(--v2-panel-border\)\]/, 'hairline strip, not boxes');
  // The rationed Newsreader masthead is kept for the headline.
  assert.match(src, /v2-text-display/, 'headline keeps the display masthead');
});
