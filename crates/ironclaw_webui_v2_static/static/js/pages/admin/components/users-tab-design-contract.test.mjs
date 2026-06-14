import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const tabPath = path.join(testDir, 'users-tab.js');
const hookPath = path.join(testDir, '..', 'hooks', 'useAdminUsers.js');

// The admin user-management endpoints are permanent stubs: `admin-api.js`
// returns `{ todo: true }` for reads and `{ success: false }` for every write
// (create, suspend/activate, role change, token issuance). A deep-link to
// /admin/users must not render an Add-user form or per-row action buttons that
// POST into the void and silently no-op. Design Law: "No fake readiness — a
// surface may not imply a capability the gateway cannot prove."

test('useAdminUsers reports status:todo while the admin backend is a stub', async () => {
  const source = await readFile(hookPath, 'utf8');

  // The stub read carries `{ todo: true }`; the hook must surface it as status so
  // the tab can gate its write controls on a proven backend.
  assert.match(source, /const status = rawUsers\?\.todo \? 'todo' : 'ready';/);
  assert.match(source, /\bstatus,/);
});

test('admin users write controls are gated behind a real backend (no fake readiness)', async () => {
  const source = await readFile(tabPath, 'utf8');

  // The tab derives a single capability flag from the hook status.
  assert.match(source, /const canManage = status !== 'todo';/);

  // The Add-user form must be gated: it submits createUser, which the stub never
  // persists. It may not render over a permanent stub.
  const createFormIndex = source.indexOf('<${CreateUserForm}');
  assert.ok(createFormIndex > -1, 'CreateUserForm must still exist in source');
  const guardBeforeForm = source.lastIndexOf('${canManage', createFormIndex);
  assert.ok(
    guardBeforeForm > -1 && guardBeforeForm < createFormIndex,
    'CreateUserForm must sit inside a ${canManage && ...} guard'
  );

  // The freshly-issued-token banner depends on a token mutation that can never
  // succeed against the stub; it must also be gated.
  const tokenBannerIndex = source.indexOf('<${TokenBanner}');
  assert.ok(tokenBannerIndex > -1, 'TokenBanner must still exist in source');
  const guardBeforeToken = source.lastIndexOf('${canManage', tokenBannerIndex);
  assert.ok(
    guardBeforeToken > -1 && guardBeforeToken < tokenBannerIndex,
    'TokenBanner must sit inside a ${canManage && ...} guard'
  );

  // Per-row Suspend/Activate/Promote/Demote/Token actions are passed canManage
  // and only render their button cluster when management is real.
  assert.match(source, /canManage=\$\{canManage\}/);
  assert.match(source, /\$\{canManage &&\s*html`<div className="flex gap-1">/);
});

test('admin users roster still renders read-only when management is unavailable', async () => {
  const source = await readFile(tabPath, 'utf8');

  // Do not delete the surface: the roster, search, and filters must remain so the
  // page stays informative. The user name button (onSelect) is read navigation,
  // not a stubbed write, so it is never gated.
  assert.match(source, /onClick=\$\{\(\) => onSelect\(user\.id\)\}/);
  assert.match(source, /t\('admin\.users\.title'/);
  // The empty roster keeps its honest existing copy rather than a fake form.
  assert.match(source, /t\('admin\.users\.noMatch'\)/);
});
