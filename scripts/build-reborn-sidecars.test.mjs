import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const scriptPath = path.resolve('scripts/build-reborn-sidecars.sh');

test('reborn sidecar build default includes Slack host beta feature', async () => {
  const script = await readFile(scriptPath, 'utf8');

  assert.match(
    script,
    /IRONCLAW_REBORN_FEATURES:-webui-v2-beta,slack-v2-host-beta/,
    'release sidecar builds must include Slack support by default'
  );
});
