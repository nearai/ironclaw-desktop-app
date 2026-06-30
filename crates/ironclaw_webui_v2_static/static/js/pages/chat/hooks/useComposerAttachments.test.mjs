import assert from 'node:assert/strict';
import test from 'node:test';

import { fitsRawBudget, rawSizeOf, sumRawSize } from './useComposerAttachments.js';

const MAX_RAW_TOTAL_SIZE = 10 * 1024 * 1024;

test('rawSizeOf prefers payloadSize, falls back to size, tolerates nullish', () => {
  assert.equal(rawSizeOf({ payloadSize: 100, size: 999 }), 100);
  assert.equal(rawSizeOf({ size: 42 }), 42);
  assert.equal(rawSizeOf({}), 0);
  assert.equal(rawSizeOf(null), 0);
});

test('sumRawSize totals the raw payload across mixed attachment/image items', () => {
  assert.equal(sumRawSize([{ payloadSize: 1000 }, { size: 2000 }, {}]), 3000);
  assert.equal(sumRawSize([]), 0);
  assert.equal(sumRawSize(null), 0);
});

test('fitsRawBudget admits up to the cap and rejects the overflow byte', () => {
  assert.equal(fitsRawBudget(0, MAX_RAW_TOTAL_SIZE), true);
  assert.equal(fitsRawBudget(0, MAX_RAW_TOTAL_SIZE + 1), false);
  assert.equal(fitsRawBudget(MAX_RAW_TOTAL_SIZE, 1), false);
  assert.equal(fitsRawBudget(MAX_RAW_TOTAL_SIZE - 1, 1), true);
});

// Row 70: concurrent addFiles batches must decide admission against a single
// live running total (reservation), not a per-batch snapshot. Two batches that
// each read the same stale snapshot would both admit and overflow the cap. This
// drives the same reservation discipline addFiles uses (fitsRawBudget against a
// shared, synchronously-bumped total) and asserts the admitted bytes never
// exceed the cap regardless of interleaving.
test('shared running total keeps interleaved batches within the raw cap', () => {
  const fiveMb = 5 * 1024 * 1024;
  // Three 5 MB files across two "concurrent" batches: only two can fit in 10 MB.
  const batchA = [{ size: fiveMb, name: 'a' }];
  const batchB = [
    { size: fiveMb, name: 'b' },
    { size: fiveMb, name: 'c' }
  ];

  const ref = { current: 0 };
  const admitted = [];
  const admit = (file) => {
    if (!fitsRawBudget(ref.current, file.size)) return false;
    ref.current += file.size; // reserve synchronously, before any await would yield
    admitted.push(file.name);
    return true;
  };

  // Interleave the batches the way two overlapping async addFiles calls would.
  admit(batchA[0]);
  admit(batchB[0]);
  admit(batchB[1]); // must be rejected — budget already reserved

  assert.deepEqual(admitted, ['a', 'b']);
  assert.ok(ref.current <= MAX_RAW_TOTAL_SIZE, 'reserved total never exceeds the cap');

  // Contrast: a stale-snapshot decision (each batch reading total=0) would admit
  // all three and overflow — the bug this fix closes.
  const staleAdmitted = [batchA[0], ...batchB].filter((file) => fitsRawBudget(0, file.size));
  assert.equal(staleAdmitted.length, 3);
  assert.ok(sumRawSize(staleAdmitted) > MAX_RAW_TOTAL_SIZE);
});

// Releasing a reservation (failed read / removed chip) returns budget so a later
// file fits — mirrors the rawTotalRef bookkeeping in addFiles/remove*/clear.
test('releasing a reservation frees budget for a later file', () => {
  const fiveMb = 5 * 1024 * 1024;
  const ref = { current: 0 };
  ref.current += fiveMb;
  ref.current += fiveMb;
  assert.equal(fitsRawBudget(ref.current, 1), false);
  ref.current -= fiveMb; // a read failed / chip removed
  assert.equal(fitsRawBudget(ref.current, fiveMb), true);
});
