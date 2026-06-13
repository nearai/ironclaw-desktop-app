import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const jsRoot = path.resolve(testDir, '..');
const staticRoot = path.resolve(jsRoot, '..');

const scannedRoots = [jsRoot, path.join(staticRoot, 'styles')];

const forbiddenTokens = [
  'animate-pulse',
  'animate-bounce',
  '@keyframes pulse',
  '@keyframes bounce',
  'v2-skeleton-shimmer'
];

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'vendor') return [];
        return collectFiles(fullPath);
      }
      if (!/\.(js|css)$/.test(entry.name)) return [];
      if (entry.name.endsWith('.test.mjs')) return [];
      return [fullPath];
    })
  );
  return files.flat();
}

test('static UI avoids cheap perpetual pulse and bounce utilities', async () => {
  const files = (await Promise.all(scannedRoots.map((root) => collectFiles(root)))).flat();
  const violations = [];

  for (const file of files) {
    const contents = await readFile(file, 'utf8');
    for (const token of forbiddenTokens) {
      if (contents.includes(token)) {
        violations.push(`${path.relative(staticRoot, file)} contains ${token}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test('static skeleton primitive remains non-animated', async () => {
  const appCss = await readFile(path.join(staticRoot, 'styles', 'app.css'), 'utf8');
  const skeletonRule = appCss.match(/\.v2-skeleton\s*\{(?<body>[^}]*)\}/s);

  assert.ok(skeletonRule?.groups?.body, 'expected a .v2-skeleton rule in app.css');
  const animationDeclarations = [...skeletonRule.groups.body.matchAll(/animation:\s*([^;]+);/g)].map(
    (match) => match[1].trim()
  );
  assert.deepEqual(animationDeclarations, ['none']);
});
