import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

function readWorkspaceJson(pathFromStaticJs) {
  const url = new URL(`../../../../../${pathFromStaticJs}`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
}

const conf = readWorkspaceJson('src-tauri/tauri.conf.json');
const caps = readWorkspaceJson('src-tauri/capabilities/default.json');
const csp = conf.app.security.csp;

function directive(name) {
  const entry = csp
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `));
  return entry ? entry.slice(name.length).trim().split(/\s+/).filter(Boolean) : [];
}

function permission(identifier) {
  return caps.permissions.find(
    (entry) => entry && typeof entry === 'object' && entry.identifier === identifier
  );
}

test('static shipped UI owns the native security guard', () => {
  assert.equal(conf.build.frontendDist, '../crates/ironclaw_webui_v2_static/static');
  assert.ok(csp.includes("frame-src 'none'"));
  assert.ok(csp.includes("object-src 'none'"));
  assert.ok(csp.includes("base-uri 'self'"));
});

test('CSP rejects broad eval and insecure HTTP wildcards', () => {
  assert.ok(!csp.includes("'unsafe-eval'"));
  assert.ok(!csp.match(/(^|\s)http:\/\/\*(?=[:/\s;]|$)/));
  assert.deepEqual(directive('img-src'), [
    "'self'",
    'data:',
    'blob:',
    'tauri:',
    'http://127.0.0.1:*',
    'http://localhost:*',
    'https://*'
  ]);
  assert.deepEqual(directive('script-src'), [
    "'self'",
    "'unsafe-inline'",
    "'wasm-unsafe-eval'",
    'tauri:',
    'http://127.0.0.1:*',
    'http://localhost:*'
  ]);
});

test('Tauri capability manifest only allows loopback HTTP and HTTPS', () => {
  const http = permission('http:default');
  assert.ok(http, 'missing http:default permission');
  assert.deepEqual(
    http.allow.map((entry) => entry.url).sort(),
    ['http://127.0.0.1:*', 'http://localhost:*', 'https://**']
  );
});

test('shell execute/kill capability stays pinned to the IronClaw sidecars', () => {
  for (const identifier of ['shell:allow-execute', 'shell:allow-kill']) {
    const shell = permission(identifier);
    assert.ok(shell, `missing ${identifier}`);
    assert.deepEqual(shell.allow, [
      { name: 'binaries/ironclaw-reborn', sidecar: true, args: true },
      { name: 'binaries/ironclaw', sidecar: true, args: true }
    ]);
  }
});

test('shell open cannot launch arbitrary insecure HTTP URLs', () => {
  const open = permission('shell:allow-open');
  assert.ok(open, 'missing shell:allow-open');
  assert.deepEqual(
    open.allow.map((entry) => entry.url).sort(),
    ['http://127.0.0.1:*/', 'http://localhost:*/', 'https://**']
  );
});
