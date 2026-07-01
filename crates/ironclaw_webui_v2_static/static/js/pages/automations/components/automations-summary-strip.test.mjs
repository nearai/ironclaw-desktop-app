import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

async function source() {
  return readFile(path.join(dir, 'automations-summary-strip.js'), 'utf8');
}

// Ironwork rebuild: the 5-up StatCard metric-box strip is killed. The summary is
// one honest mono headline (.v2-text-meta) so the table below is the focus.
test('summary strip is a single mono headline, not a StatCard metric-box grid', async () => {
  const src = await source();
  assert.doesNotMatch(src, /StatCard/, 'the StatCard metric-box opener is gone');
  assert.doesNotMatch(src, /grid[^"']*grid-cols-5/, 'the 5-up metric grid is gone');
  assert.match(src, /v2-text-meta/, 'the headline uses the mono meta type class');
});

// Failed jobs are the surface's single accent moment: the "needs review" clause is
// the only coloured token in the line, so a squint lands only on real failures.
test('summary strip colours only the failures clause (single accent moment)', async () => {
  const src = await source();
  assert.match(src, /failures > 0/, 'failures are gated on a real count');
  assert.match(
    src,
    /text-\[var\(--v2-danger-text\)\][\s\S]*?needs review|needs review[\s\S]*?text-\[var\(--v2-danger-text\)\]/,
    'the needs-review clause carries the only accent colour'
  );
  // No always-on green "zero failures" token — a healthy strip is quiet.
  assert.doesNotMatch(src, /positive-text|--v2-good/, 'no decorative healthy-state colour');
});
