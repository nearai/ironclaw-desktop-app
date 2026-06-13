import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const settingsRoot = path.resolve(testDir, '..');
const staticJsRoot = path.resolve(settingsRoot, '..', '..');

const settingsStatusFiles = [
  path.join(settingsRoot, 'settings-page.js'),
  path.join(settingsRoot, 'components', 'provider-login-status.js'),
  path.join(settingsRoot, 'components', 'provider-dialog.js'),
  path.join(settingsRoot, 'components', 'restart-banner.js'),
  path.join(settingsRoot, 'components', 'skills-tab.js')
];

const rawStatusColorPattern =
  /\b(?:text|bg|border|hover:text|hover:bg|hover:border)-(?:red|yellow|amber|orange|emerald|green|lime)-\d/g;

test('settings status states use semantic desktop tokens', async () => {
  const violations = [];

  for (const file of settingsStatusFiles) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(rawStatusColorPattern)) {
      violations.push(`${path.relative(staticJsRoot, file)} contains ${match[0]}`);
    }
  }

  assert.deepEqual(violations, []);
});
