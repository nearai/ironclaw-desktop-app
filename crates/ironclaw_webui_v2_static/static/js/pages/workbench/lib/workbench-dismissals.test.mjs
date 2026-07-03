import assert from 'node:assert/strict';
import test from 'node:test';

import { DISMISS_REASONS, isDismissed, restoreRow } from './workbench-dismissals.js';

// Note: dismissRow/readDismissals touch localStorage (absent under node --test),
// so they degrade to in-memory no-ops; the pure helpers below are what we assert.

test('DISMISS_REASONS offers the quick-pick reasons', () => {
  assert.deepEqual(DISMISS_REASONS, [
    'Just context',
    'Already handled',
    'Not relevant',
    'Not for me'
  ]);
});

test('isDismissed reports membership and tolerates garbage maps', () => {
  const map = { m1: { reason: 'Just context', sender: 'x@y.com', ts: 1 } };
  assert.equal(isDismissed(map, 'm1'), true);
  assert.equal(isDismissed(map, 'm2'), false);
  assert.equal(isDismissed(null, 'm1'), false);
  assert.equal(isDismissed(map, ''), false);
});

test('restoreRow is a no-op without storage and never throws', () => {
  assert.doesNotThrow(() => restoreRow('m1'));
  assert.deepEqual(restoreRow(''), {});
});
