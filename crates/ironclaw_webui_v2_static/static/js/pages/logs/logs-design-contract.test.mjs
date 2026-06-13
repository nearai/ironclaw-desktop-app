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
