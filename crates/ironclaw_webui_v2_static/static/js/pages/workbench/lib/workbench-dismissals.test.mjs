import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DISMISS_REASONS,
  clearSenderDismissals,
  dismissalSignalsBySender,
  isDismissed,
  learnedIgnoreSenders,
  learnedSenderSummary,
  restoreRow
} from './workbench-dismissals.js';

test('clearSenderDismissals degrades safely without storage and never throws', () => {
  assert.doesNotThrow(() => clearSenderDismissals('noisy@vendor.com'));
  assert.deepEqual(clearSenderDismissals(''), {});
  assert.deepEqual(clearSenderDismissals(null), {});
});

test('learnedIgnoreSenders auto-files a sender filed >=2x for sender-level reasons', () => {
  const dismissals = {
    a1: { reason: 'Just context', sender: 'noisy@vendor.com', ts: 1 },
    a2: { reason: 'Not relevant', sender: 'Noisy@vendor.com', ts: 2 }, // case-insensitive, 2nd
    b1: { reason: 'Already handled', sender: 'real@client.com', ts: 3 }, // per-item, not sender-level
    b2: { reason: 'Already handled', sender: 'real@client.com', ts: 4 }, // still per-item -> NOT learned
    c1: { reason: 'Not for me', sender: 'once@x.com', ts: 5 } // only 1x -> not yet learned
  };
  const learned = learnedIgnoreSenders(dismissals);
  assert.ok(learned instanceof Set);
  assert.equal(learned.has('noisy@vendor.com'), true, '2 sender-level dismissals -> learned');
  assert.equal(
    learned.has('real@client.com'),
    false,
    '"Already handled" is per-item, never learned'
  );
  assert.equal(learned.has('once@x.com'), false, 'a single dismissal is below the threshold');
});

test('learnedIgnoreSenders respects minCount + tolerates garbage', () => {
  const dismissals = { a: { reason: 'Just context', sender: 's@x.com', ts: 1 } };
  assert.equal(learnedIgnoreSenders(dismissals, { minCount: 1 }).has('s@x.com'), true);
  assert.equal(learnedIgnoreSenders(null).size, 0);
  assert.equal(learnedIgnoreSenders({}).size, 0);
});

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

test('dismissalSignalsBySender aggregates counts + distinct reasons (the learn loop)', () => {
  const dismissals = {
    a1: { reason: 'Just context', sender: 'gemini-notes@google.com', ts: 1 },
    a2: { reason: 'Just context', sender: 'Gemini-Notes@google.com', ts: 2 },
    a3: { reason: 'Not relevant', sender: 'gemini-notes@google.com', ts: 3 },
    b1: { reason: 'Already handled', sender: 'dana@northwind.com', ts: 4 },
    junk: { reason: '', sender: '', ts: 5 }
  };
  const signals = dismissalSignalsBySender(dismissals);
  assert.equal(signals['gemini-notes@google.com'].count, 3, 'case-insensitive sender grouping');
  assert.deepEqual(signals['gemini-notes@google.com'].reasons, ['Just context', 'Not relevant']);
  assert.equal(signals['dana@northwind.com'].count, 1);
  assert.ok(!('' in signals), 'sender-less dismissals are ignored');
});

test('learnedSenderSummary surfaces ONLY auto-muted senders, with count + reasons, busiest first', () => {
  const dismissals = {
    a1: { reason: 'Not relevant', sender: 'noisy@bot.com', ts: 1 },
    a2: { reason: 'Just context', sender: 'noisy@bot.com', ts: 2 },
    a3: { reason: 'Not for me', sender: 'noisy@bot.com', ts: 3 },
    b1: { reason: 'Not relevant', sender: 'weekly@news.com', ts: 4 },
    b2: { reason: 'Not relevant', sender: 'weekly@news.com', ts: 5 },
    // below threshold (only 1 sender-level dismissal) — must NOT appear
    c1: { reason: 'Not relevant', sender: 'once@x.com', ts: 6 },
    // 'Already handled' is NOT a sender-level reason — must NOT count toward learning
    d1: { reason: 'Already handled', sender: 'real@person.com', ts: 7 },
    d2: { reason: 'Already handled', sender: 'real@person.com', ts: 8 }
  };
  const summary = learnedSenderSummary(dismissals);
  assert.deepEqual(
    summary.map((s) => s.sender),
    ['noisy@bot.com', 'weekly@news.com'],
    'only senders past the threshold, busiest first; once@ and real@ excluded'
  );
  assert.equal(summary[0].count, 3);
  assert.deepEqual(summary[0].reasons, ['Not relevant', 'Just context', 'Not for me']);
  assert.equal(summary[1].count, 2);
});

test('learnedSenderSummary is empty until the threshold is crossed (honest empty)', () => {
  assert.deepEqual(learnedSenderSummary({}), []);
  assert.deepEqual(
    learnedSenderSummary({ a: { reason: 'Not relevant', sender: 'x@y.com', ts: 1 } }),
    [],
    'a single dismissal has not learned anything yet'
  );
});

test('learnedSenderSummary: a restored sender drops out (Restore undoes the learning)', () => {
  const dismissals = {
    a1: { reason: 'Not relevant', sender: 'noisy@bot.com', ts: 1 },
    a2: { reason: 'Not relevant', sender: 'noisy@bot.com', ts: 2 }
  };
  assert.equal(learnedSenderSummary(dismissals).length, 1);
  // simulate clearSenderDismissals having dropped that sender's rows
  assert.deepEqual(learnedSenderSummary({}), []);
});
