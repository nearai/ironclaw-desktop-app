import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DOMAIN_TRIGGERS,
  resolveDomain,
  radarScopeForTitle,
  normalizeChannelAllowlist
} from './workbench-radar.js';

test('resolveDomain maps titles to domains, tolerant of substrings + case', () => {
  assert.equal(resolveDomain('Chief Legal Officer'), 'legal');
  assert.equal(resolveDomain('VP, Legal & Governance'), 'legal');
  assert.equal(resolveDomain('general counsel'), 'legal');
  assert.equal(resolveDomain('CFO'), 'finance');
  assert.equal(resolveDomain('Head of Engineering'), 'engineering');
  assert.equal(resolveDomain('Chief People Officer'), 'people');
});

test('resolveDomain fails safe to null on an unknown/blank title (radar off)', () => {
  assert.equal(resolveDomain('Marketing Lead'), null);
  assert.equal(resolveDomain(''), null);
  assert.equal(resolveDomain(null), null);
  assert.equal(resolveDomain(undefined), null);
});

test('radarScopeForTitle returns the domain + its trigger vocabulary', () => {
  const scope = radarScopeForTitle('Chief Legal Officer');
  assert.equal(scope.domain, 'legal');
  assert.ok(scope.triggers.includes('custody'), 'legal triggers include custody');
  assert.ok(scope.triggers.includes('securities'));
  assert.deepEqual(scope.triggers, DOMAIN_TRIGGERS.legal);
  // unknown title -> off + empty (never borrows another role's vocabulary)
  assert.deepEqual(radarScopeForTitle('Marketing Lead'), { domain: null, triggers: [] });
});

test('normalizeChannelAllowlist strips #, lowercases, dedupes, drops blanks', () => {
  assert.deepEqual(
    normalizeChannelAllowlist([
      '#x-intents',
      'X-Intents',
      ' #kyc_status ',
      '',
      null,
      '#wallet_status'
    ]),
    ['x-intents', 'kyc_status', 'wallet_status']
  );
  assert.deepEqual(normalizeChannelAllowlist(null), []);
  assert.deepEqual(normalizeChannelAllowlist('not-an-array'), []);
});
