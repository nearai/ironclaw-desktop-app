import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const scriptPath = path.resolve('scripts/check-release-readiness.sh');

async function withFixture(
  { packageVersion = '1.2.3', tauriVersion = '1.2.3', cargoVersion = '1.2.3' } = {},
  run
) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ironclaw-release-readiness-'));
  try {
    await mkdir(path.join(dir, 'src-tauri'), { recursive: true });
    await writeFile(
      path.join(dir, 'package.json'),
      `${JSON.stringify({ version: packageVersion }, null, 2)}\n`
    );
    await writeFile(
      path.join(dir, 'src-tauri/tauri.conf.json'),
      `${JSON.stringify({ version: tauriVersion }, null, 2)}\n`
    );
    await writeFile(
      path.join(dir, 'src-tauri/Cargo.toml'),
      `[package]\nname = "ironclaw-desktop"\nversion = "${cargoVersion}"\n`
    );
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function envFor(repoRoot, extras = {}) {
  const env = {
    ...process.env,
    IRONCLAW_RELEASE_REPO_ROOT: repoRoot,
    ...extras
  };
  if (extras.TAURI_SIGNING_PRIVATE_KEY === undefined) {
    delete env.TAURI_SIGNING_PRIVATE_KEY;
  }
  return env;
}

test('passes when signing key is present and all versions match', async () => {
  await withFixture({}, async (dir) => {
    const { stdout } = await execFileAsync('bash', [scriptPath, '--expected-version', '1.2.3'], {
      env: envFor(dir, { TAURI_SIGNING_PRIVATE_KEY: 'signed-test-key' })
    });

    assert.match(stdout, /versions aligned at 1\.2\.3/);
  });
});

test('fails when the updater signing key is absent', async () => {
  await withFixture({}, async (dir) => {
    await assert.rejects(
      execFileAsync('bash', [scriptPath], {
        env: envFor(dir, { TAURI_SIGNING_PRIVATE_KEY: undefined })
      }),
      /TAURI_SIGNING_PRIVATE_KEY is required/
    );
  });
});

test('fails when version files disagree', async () => {
  await withFixture({ cargoVersion: '1.2.4' }, async (dir) => {
    await assert.rejects(
      execFileAsync('bash', [scriptPath], {
        env: envFor(dir, { TAURI_SIGNING_PRIVATE_KEY: 'signed-test-key' })
      }),
      /version skew detected/
    );
  });
});

test('allows explicit local dry-run without a signing key', async () => {
  await withFixture({}, async (dir) => {
    const { stdout, stderr } = await execFileAsync(
      'bash',
      [scriptPath, '--allow-missing-signing-key'],
      {
        env: envFor(dir, { TAURI_SIGNING_PRIVATE_KEY: undefined })
      }
    );

    assert.match(stderr, /allowed only for a local dry-run/);
    assert.match(stdout, /versions aligned at 1\.2\.3/);
  });
});
