import assert from 'node:assert/strict';
import test from 'node:test';

import { cooldownExpired } from './useChat.js';

// Row 71: the 250ms rate-limit cooldown interval must stop after the cooldown
// elapses (a single 429 otherwise leaks the interval and its re-renders
// forever). The effect clears cooldownUntil when cooldownExpired() is true,
// which re-runs the effect with a falsy value so its cleanup clears the timer.

test('cooldownExpired is false while the cooldown is still in the future', () => {
  const now = 1_000_000;
  assert.equal(cooldownExpired(now, now + 250), false);
  assert.equal(cooldownExpired(now, now + 1), false);
});

test('cooldownExpired is true once now reaches or passes cooldownUntil', () => {
  const now = 1_000_000;
  assert.equal(cooldownExpired(now, now), true);
  assert.equal(cooldownExpired(now, now - 1), true);
});

test('cooldownExpired is false when there is no active cooldown (0/falsy)', () => {
  // The effect early-returns on a falsy cooldownUntil, but the tick must never
  // treat "no cooldown" as expired and thrash setCooldownUntil(0) on render.
  assert.equal(cooldownExpired(1_000_000, 0), false);
  assert.equal(cooldownExpired(0, 0), false);
});

// Simulate the interval ticking across the cooldown boundary: it should flip to
// expired exactly once the wall clock reaches cooldownUntil, which is the signal
// the effect uses to clear state and let cleanup stop the interval.
test('interval ticks flip to expired at the cooldown boundary', () => {
  const cooldownUntil = 5_000;
  const ticks = [4_500, 4_750, 5_000, 5_250];
  const results = ticks.map((tick) => cooldownExpired(tick, cooldownUntil));
  assert.deepEqual(results, [false, false, true, true]);
});
