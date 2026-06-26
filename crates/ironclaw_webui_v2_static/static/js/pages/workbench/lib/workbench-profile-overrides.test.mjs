import assert from 'node:assert/strict';
import test from 'node:test';

import { applyTierOverrides, recountTiers, TIER_OPTIONS } from './workbench-profile-overrides.js';

const PEOPLE = [
  { email: 'dana@northwind.com', tier: 'respond', replyRate: 1, received: 3 },
  { email: 'news@substack.com', tier: 'ignore', replyRate: 0, received: 5, bulk: true },
  { email: 'colleague@near.foundation', tier: 'fyi', replyRate: 0, received: 1 }
];

test('applyTierOverrides pins a sender to the corrected tier and flags it', () => {
  const next = applyTierOverrides(PEOPLE, { 'dana@northwind.com': 'vip' });
  const dana = next.find((p) => p.email === 'dana@northwind.com');
  assert.equal(dana.tier, 'vip', 'corrected to VIP');
  assert.equal(dana.overridden, true, 'flagged as overridden');
  assert.equal(next[0].email, 'dana@northwind.com', 'VIP re-ranks to the top');
});

test('applyTierOverrides can demote a newsletter the engine surfaced (or vice versa)', () => {
  const next = applyTierOverrides(PEOPLE, { 'colleague@near.foundation': 'ignore' });
  const colleague = next.find((p) => p.email === 'colleague@near.foundation');
  assert.equal(colleague.tier, 'ignore');
  assert.equal(colleague.overridden, true);
  // the unoverridden respond sender now ranks above the demoted one
  assert.ok(
    next.findIndex((p) => p.email === 'dana@northwind.com') <
      next.findIndex((p) => p.email === 'colleague@near.foundation')
  );
});

test('applyTierOverrides is pure (no input mutation) and matches by lowercased email', () => {
  const before = JSON.parse(JSON.stringify(PEOPLE));
  const next = applyTierOverrides(PEOPLE, { 'DANA@NORTHWIND.COM': 'vip' });
  assert.deepEqual(PEOPLE, before, 'input not mutated');
  assert.equal(
    next.find((p) => p.email === 'dana@northwind.com').tier,
    'vip',
    'case-insensitive match'
  );
});

test('applyTierOverrides degrades safely on empty/garbage', () => {
  assert.deepEqual(applyTierOverrides([], {}), []);
  assert.deepEqual(applyTierOverrides(null, null), []);
});

test('recountTiers reflects corrections', () => {
  const corrected = applyTierOverrides(PEOPLE, { 'dana@northwind.com': 'vip' });
  const counts = recountTiers(corrected);
  assert.equal(counts.vip, 1);
  assert.equal(counts.respond, 0, 'dana left respond');
  assert.equal(counts.senders, 3);
});

test('TIER_OPTIONS are the four behaviour tiers', () => {
  assert.deepEqual(TIER_OPTIONS, ['vip', 'respond', 'fyi', 'ignore']);
});
