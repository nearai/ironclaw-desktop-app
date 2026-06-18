import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const logsPagePath = path.join(testDir, 'logs-page.js');

const rawStatusColorPattern =
  /\b(?:text|bg|border)-(?:red|yellow|amber|orange|emerald|green|lime)-\d/g;

test('logs route uses semantic status tokens instead of raw Tailwind colors', async () => {
  const source = await readFile(logsPagePath, 'utf8');
  const violations = [...source.matchAll(rawStatusColorPattern)].map((match) => match[0]);

  assert.deepEqual(violations, []);
  assert.match(source, /--v2-warning-text/);
  assert.match(source, /--v2-danger-text/);
  assert.match(source, /--v2-warning-soft/);
  assert.match(source, /--v2-danger-soft/);
});

test('logs empty state is dignified and offers a real next action (DT-5)', async () => {
  const source = await readFile(logsPagePath, 'utf8');

  // The empty body must be a structured EmptyPanel (title + description), not a
  // bare line of muted text floating in a void.
  assert.match(source, /EmptyPanel/);
  assert.match(source, /title=\$\{t\('nav\.logs'\)\}/);
  assert.match(source, /const emptyDescription = isUnsupported \? t\('logs\.unsupported'\) : t\('logs\.empty'\);/);
  assert.match(source, /description=\$\{emptyDescription\}/);

  // It must not dead-end: a primary Chat CTA routes to where work actually lives.
  assert.match(source, /as=\$\{Link\}\s+to="\/chat"\s+variant="primary"/);
  assert.match(source, /\$\{t\('nav\.chat'\)\}/);
});

test('logs stream controls are backed by live operator logs (no fake readiness)', async () => {
  const source = await readFile(logsPagePath, 'utf8');
  const hookSource = await readFile(path.join(testDir, 'hooks', 'useLogs.js'), 'utf8');

  // Pause/Resume, Clear, and Auto-scroll now act on the Reborn operator logs
  // endpoint. The old desktop contract hid them while logs were a TODO stub;
  // keeping that guard would hide a real Reborn feature.
  assert.match(hookSource, /queryOperatorLogs\(\{/);
  assert.match(hookSource, /setInterval\(loadLogs,\s*POLL_INTERVAL_MS\)/);
  assert.doesNotMatch(hookSource, /status:\s*'todo'/);

  const pauseIndex = source.indexOf("t('logs.pause')");
  const clearIndex = source.indexOf("t('logs.clear')");
  const autoScrollIndex = source.indexOf("t('logs.autoScroll')");
  assert.ok(pauseIndex > -1 && clearIndex > -1 && autoScrollIndex > -1);
});

test('logs toolbar controls meet the 44px mobile tap-target floor', async () => {
  const source = await readFile(logsPagePath, 'utf8');

  // The named level-filter select and target-filter input always render, so they
  // must satisfy the >=44px tap-target floor (h-11) the sibling surfaces adopted.
  assert.match(source, /className="v2-select h-11/);
  assert.match(source, /type="text"[\s\S]*?className="h-11/);

  // No toolbar control regresses to the old 32px (h-8) height.
  assert.doesNotMatch(source, /className="v2-select h-8/);
});
