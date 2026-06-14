import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const componentsDir = path.dirname(fileURLToPath(import.meta.url));
const hooksDir = path.resolve(componentsDir, '..', 'hooks');

// Settings sub-tabs reachable by deep-link (/v2/settings/<tab>) must not present
// actionable controls backed by permanent stubs. `settings-api.js` returns
// `{ todo: true }` for skills/tools reads and `{ success: false }` for their
// writes. Design Law: "No fake readiness — a surface may not imply a capability
// the gateway cannot prove." Mirrors the inference-tab and logs gates.

test('useSkills reports status:todo while the skills backend is a stub', async () => {
  const source = await readFile(path.join(hooksDir, 'useSkills.js'), 'utf8');

  assert.match(source, /const status = query\.data\?\.todo \? 'todo' : 'ready';/);
  assert.match(source, /\bstatus,/);
});

test('skills import form is gated behind a real backend (no fake readiness)', async () => {
  const source = await readFile(path.join(componentsDir, 'skills-tab.js'), 'utf8');

  // The install panel is built once, gated on a proven backend, then reused in
  // every render branch. It must never render unconditionally over the stub.
  assert.match(source, /const installPanel =\s*\n?\s*status !== 'todo'/);
  assert.match(source, /\? html`<\$\{SkillInstallPanel\}/);

  // No render branch may mount SkillInstallPanel directly; only `${installPanel}`
  // is allowed past the gated definition.
  const directMounts = [...source.matchAll(/<\$\{SkillInstallPanel\}/g)];
  assert.equal(
    directMounts.length,
    1,
    'SkillInstallPanel may only be referenced inside the gated installPanel definition'
  );
  assert.match(source, /\$\{installPanel\}/);

  // The dignified installed/empty states stay so the surface is not deleted.
  assert.match(source, /t\('skills\.noInstalled'\)/);
  assert.match(source, /t\('skills\.noInstalledDesc'\)/);
});

test('useTools reports status:todo and never flashes a fake saved state', async () => {
  const source = await readFile(path.join(hooksDir, 'useTools.js'), 'utf8');

  assert.match(source, /const status = query\.data\?\.todo \? 'todo' : 'ready';/);
  assert.match(source, /\bstatus,/);

  // The optimistic cache write + "saved" flash must only fire on a confirmed
  // write, never on the `{ success: false }` / `{ todo: true }` stub response.
  assert.match(source, /if \(data\?\.success === false \|\| data\?\.todo\) \{\s*\n?\s*return;/);
  const guardIndex = source.indexOf('data?.success === false');
  const savedIndex = source.indexOf('setSavedTools((prev) => ({ ...prev, [name]: true }))');
  assert.ok(
    guardIndex > -1 && savedIndex > -1 && guardIndex < savedIndex,
    'the success/todo guard must precede the saved-indicator write'
  );
});

test('tool permission selects are gated behind a real backend (no fake readiness)', async () => {
  const source = await readFile(path.join(componentsDir, 'tools-tab.js'), 'utf8');

  // The tab derives a capability flag from the hook status and passes it down.
  assert.match(source, /const canEdit = status !== 'todo';/);
  assert.match(source, /canEdit=\$\{canEdit\}/);

  // A row presents as read-only (a Badge) when locked OR when the gateway cannot
  // persist permission changes — never an editable select that silently no-ops.
  assert.match(source, /const isLocked = tool\.locked \|\| !canEdit;/);

  // The editable select still sits behind the isLocked branch (read-only Badge in
  // the truthy branch, select only in the falsy branch).
  const lockedTernaryIndex = source.indexOf('${isLocked');
  const selectIndex = source.indexOf('onChange=${(e) => onPermissionChange');
  assert.ok(
    lockedTernaryIndex > -1 && selectIndex > -1 && lockedTernaryIndex < selectIndex,
    'the permission select must remain gated behind the isLocked ternary'
  );
});
