import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// The readiness model is pure and references only local module state, so we can
// evaluate the source with imports stripped and exercise it directly — mirrors
// the channels-tab harness. Rendering is not exercised here; the design-contract
// test guards the token surface.
function readinessExportsForTest() {
  const source = readFileSync(new URL('./extension-card.js', import.meta.url), 'utf8');
  const lines = [];
  let skippingImport = false;
  for (const line of source.split('\n')) {
    if (!skippingImport && line.startsWith('import ')) {
      skippingImport = !line.trimEnd().endsWith(';');
      continue;
    }
    if (skippingImport) {
      skippingImport = !line.trimEnd().endsWith(';');
      continue;
    }
    lines.push(line.replace(/^export function /, 'function '));
  }
  return `${lines.join('\n')}\nglobalThis.__testExports = { extensionState, extensionReadiness, groupByReadiness };`;
}

function loadReadiness() {
  const context = { globalThis: {} };
  vm.runInNewContext(readinessExportsForTest(), context);
  return context.globalThis.__testExports;
}

test('extensionReadiness puts failed/setup/pairing states in the Needs you group', () => {
  const { extensionReadiness } = loadReadiness();

  const failed = extensionReadiness({ onboarding_state: 'failed', activation_error: 'boom' });
  assert.equal(failed.needsYou, true);
  assert.equal(failed.tone, 'danger');
  assert.equal(failed.statusLabel, 'Failed');
  // A live activation error is the truest blocker line.
  assert.equal(failed.blocker, 'boom');

  const setup = extensionReadiness({ onboarding_state: 'setup_required' });
  assert.equal(setup.needsYou, true);
  assert.equal(setup.tone, 'warning');
  assert.ok(setup.blocker.length > 0, 'a needs-you row must name the next action');

  const pairing = extensionReadiness({ onboarding_state: 'pairing_required' });
  assert.equal(pairing.needsYou, true);
  assert.equal(pairing.tone, 'warning');
});

test('extensionReadiness keeps active/idle connectors quiet with no blocker', () => {
  const { extensionReadiness } = loadReadiness();

  const active = extensionReadiness({ active: true });
  assert.equal(active.needsYou, false);
  assert.equal(active.tone, 'success');
  assert.equal(active.statusLabel, 'Active');
  assert.equal(active.blocker, '');

  const idle = extensionReadiness({ onboarding_state: 'installed' });
  assert.equal(idle.needsYou, false);
  assert.equal(idle.tone, 'muted');
  assert.equal(idle.blocker, '', 'a healthy row never carries a blocker line');
});

test('groupByReadiness splits Needs you above healthy and preserves input order', () => {
  const { groupByReadiness } = loadReadiness();

  const list = [
    { display_name: 'Gmail', active: true },
    { display_name: 'Notion', onboarding_state: 'setup_required' },
    { display_name: 'Slack', onboarding_state: 'failed' },
    { display_name: 'Drive', onboarding_state: 'installed' }
  ];

  const { needsYou, healthy } = groupByReadiness(list);
  assert.equal(needsYou.map((e) => e.display_name).join(','), 'Notion,Slack');
  assert.equal(healthy.map((e) => e.display_name).join(','), 'Gmail,Drive');
});
