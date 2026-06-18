import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const apiPath = path.join(testDir, 'workspace-api.js');

async function source() {
  return readFile(apiPath, 'utf8');
}

test('workspace browser uses Reborn WebChat v2 filesystem routes, not old stubs', async () => {
  const src = await source();
  assert.match(src, /\/api\/webchat\/v2\/fs/);
  assert.match(src, /listFsMounts/);
  assert.match(src, /listWorkspace/);
  assert.match(src, /readWorkspaceFile/);
  assert.doesNotMatch(src, /TODO: requires v2 workspace endpoint/);
  assert.doesNotMatch(src, /writeWorkspaceFile/);
});

test('workspace browser stays read-only', async () => {
  const src = await source();
  assert.match(src, /There is intentionally no\s+\/\/ write\/save path/s);
  assert.doesNotMatch(src, /method:\s*['"]POST['"]/);
  assert.doesNotMatch(src, /method:\s*['"]PUT['"]/);
  assert.doesNotMatch(src, /method:\s*['"]DELETE['"]/);
});
