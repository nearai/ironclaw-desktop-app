import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const pagePath = path.join(testDir, 'work-page.js');

async function source() {
  return readFile(pagePath, 'utf8');
}

// accent-discipline-2: a saved work product is generated agent work, so its
// glyphs carry the agent's hand (gold), never the user-action accent (blue).
// The empty-state file glyph previously used --v2-accent-text (blue) while the
// saved-work file-artifact glyph already used gold; the two must match.

test('work-page empty-state file glyph uses gold attribution, not the blue accent', async () => {
  const src = await source();
  // The empty-state glyph must be on gold tokens like the saved-work glyph.
  assert.match(
    src,
    /place-items-center rounded-\[14px\] border border-\[color-mix\(in_srgb,var\(--v2-gold\)_34%,var\(--v2-panel-border\)\)\] bg-\[var\(--v2-gold-soft\)\] text-\[var\(--v2-gold-text\)\]/,
    'empty-state file glyph should use gold tokens (agent attribution)'
  );
  // It must not regress to the user-action blue accent text token.
  assert.doesNotMatch(
    src,
    /place-items-center[^>]*text-\[var\(--v2-accent-text\)\]/,
    'empty-state file glyph must not use the blue accent-text token'
  );
});

test('work-page saved-work file-artifact glyph stays gold', async () => {
  const src = await source();
  // Guard the reference treatment the empty state is matched against.
  assert.match(
    src,
    /text-\[var\(--v2-gold-text\)\]/,
    'saved-work file-artifact glyph keeps gold attribution'
  );
});

// The saved-work store holds up to 500 items; the sidebar list must keep every
// one reachable via a filter + a "Show all" expander, never a hard cap.
test('work-page keeps saved items past the first page reachable (filter + show-all, no hard cap)', async () => {
  const src = await source();

  // The list must render the paged/filtered slice, not a hard items.slice(0, 30).
  assert.doesNotMatch(src, /items\.slice\(0,\s*30\)/, 'the hard 30-item cap must be gone');
  assert.match(src, /\$\{visibleItems\.map\(/);

  // A title filter feeds the visible list.
  assert.match(src, /const filteredItems =/);
  assert.match(src, /setWorkFilter\(/);

  // An expander reveals the rest when more are filtered-in than shown.
  assert.match(src, /const hiddenItemCount =/);
  assert.match(src, /setShowAllWork\(true\)/);
  assert.match(src, /Show all \$\{filteredItems\.length\}/);
});

// Ironwork rebuild: the export bank is de-boxed to one Copy + one Save original +
// a single "Export" overflow (Popover menu), never the seven-identical-button wall.
test('work-page collapses the export bank to Copy + Save original + one Export overflow', async () => {
  const src = await source();

  // The overflow lives in the shared Popover primitive, opened by an "Export" button.
  assert.match(src, /import \{ Popover \}/, 'export overflow uses the shared Popover primitive');
  assert.match(src, /aria-haspopup="menu"/, 'the Export trigger is a real menu button');
  assert.match(src, /role="menuitem"/, 'each format is a menu item, not a top-level button');

  // The five format writers are still reachable — behavior preserved, chrome collapsed.
  for (const label of ['Markdown', 'DOCX', 'PDF', 'HTML', 'JSON']) {
    assert.ok(src.includes(`'${label}'`), `${label} export still wired`);
  }

  // Copy and Save original remain first-class controls beside the overflow.
  assert.match(src, /'Copy'/);
  assert.match(src, /'Save original'/);
});

// Ironwork rebuild: "What IronClaw did" is the trust centerpiece — a structured,
// clay-edge-marked section above the body, not a plain bordered list. Clay
// (--v2-gold) is reserved for agent provenance, so the receipts carry the left edge.
test('work-page promotes receipts to a clay-edge-marked centerpiece', async () => {
  const src = await source();
  assert.match(src, /function WorkReceipts/, 'receipts render through a dedicated component');
  // The dedicated WorkReceipts section carries the clay (gold) provenance edge and
  // the receipts test id (order of className vs data-testid is not significant).
  assert.match(src, /border-l-2 border-l-\[var\(--v2-gold\)\]/);
  assert.match(src, /data-testid="dossier-receipts"/);
});

// Ironwork rebuild: the document body is framed by whitespace, not wrapped in a
// --v2-canvas card box — the reader is the focal content, not a nested panel.
test('work-page lifts the document body out of the canvas card box', async () => {
  const src = await source();
  assert.doesNotMatch(
    src,
    /data-testid="saved-work-artifact"[^`]*bg-\[var\(--v2-canvas\)\]/,
    'the reader body must not sit inside a --v2-canvas card box'
  );
});

// Ironwork rebuild: the empty state and the dead-deep-link notice render one shared
// component so their copy and treatment never drift apart.
test('work-page renders one shared saved-work notice for empty + not-found', async () => {
  const src = await source();
  assert.match(src, /function SavedWorkNotice/, 'a single notice component backs both states');
  assert.match(src, /testId="saved-work-not-found"/);
  assert.match(src, /testId="saved-work-empty"/);
});
