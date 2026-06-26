import assert from 'node:assert/strict';
import test from 'node:test';

import { briefSummaryLine } from './workbench-brief.js';

test('briefSummaryLine joins the present counts into the skill-style summary', () => {
  assert.equal(
    briefSummaryLine({ awaitingReply: 3, flagged: 3, weeklySignals: 2 }),
    '3 awaiting your reply · 3 flagged for you · 2 weekly signals'
  );
});

test('briefSummaryLine singularizes one weekly signal and omits zero buckets', () => {
  assert.equal(
    briefSummaryLine({ awaitingReply: 1, flagged: 0, weeklySignals: 1 }),
    '1 awaiting your reply · 1 weekly signal'
  );
  assert.equal(briefSummaryLine({ awaitingReply: 2 }), '2 awaiting your reply');
});

test('briefSummaryLine falls back to an honest all-clear when everything is zero', () => {
  assert.equal(briefSummaryLine({}), "You're all clear — nothing needs you right now.");
  assert.equal(
    briefSummaryLine({ awaitingReply: 0, flagged: 0, weeklySignals: 0 }),
    "You're all clear — nothing needs you right now."
  );
});
