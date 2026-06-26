import assert from 'node:assert/strict';
import test from 'node:test';

import { computeBehaviourProfile } from './workbench-profile.js';

// A small but representative slice: a VIP the user replies to fast, a newsletter
// they never reply to, and a contact they read but rarely answer.
const SENT = [
  { threadId: 't-dana', timestamp: '2026-06-21T09:30:00Z' }, // replied to Dana ~0.5h after her 09:00
  { threadId: 't-dana', timestamp: '2026-06-20T10:20:00Z' } // replied again
];
const INBOX = [
  {
    threadId: 't-dana',
    timestamp: '2026-06-21T09:00:00Z',
    email: 'dana@northwind.com',
    important: true
  },
  { threadId: 't-dana', timestamp: '2026-06-20T09:50:00Z', email: 'dana@northwind.com' },
  {
    threadId: 't-news',
    timestamp: '2026-06-21T06:00:00Z',
    email: 'news@substack.com',
    isBulk: true
  },
  {
    threadId: 't-news2',
    timestamp: '2026-06-20T06:00:00Z',
    email: 'news@substack.com',
    isBulk: true
  },
  { threadId: 't-fyi', timestamp: '2026-06-19T12:00:00Z', email: 'colleague@near.foundation' }
];

test('computeBehaviourProfile tiers senders by real reply behaviour', () => {
  const { people, counts } = computeBehaviourProfile({ sent: SENT, inbox: INBOX });
  const byEmail = Object.fromEntries(people.map((p) => [p.email, p]));
  assert.equal(byEmail['dana@northwind.com'].tier, 'vip', 'fast 100% replier → VIP');
  assert.equal(byEmail['dana@northwind.com'].replyRate, 1, '2 received / 2 replied');
  assert.ok(byEmail['dana@northwind.com'].medianLatencyHrs <= 1, 'sub-hour median latency');
  assert.equal(byEmail['news@substack.com'].tier, 'ignore', 'unreplied newsletter → ignore');
  assert.equal(byEmail['colleague@near.foundation'].tier, 'fyi', 'read-but-unreplied human → fyi');
  assert.equal(counts.vip, 1);
  assert.equal(counts.ignore, 1);
  assert.equal(counts.bulk, 1);
});

test('computeBehaviourProfile ranks VIP first, then by reply rate', () => {
  const { people } = computeBehaviourProfile({ sent: SENT, inbox: INBOX });
  assert.equal(people[0].email, 'dana@northwind.com', 'VIP floats to the top');
  assert.ok(people.findIndex((p) => p.tier === 'ignore') > 0, 'ignore sinks below human tiers');
});

test('computeBehaviourProfile surfaces evidence-backed patterns', () => {
  const { patterns } = computeBehaviourProfile({ sent: SENT, inbox: INBOX });
  assert.ok(
    patterns.some((p) => /reply fastest to dana@northwind.com/i.test(p)),
    'names the fastest VIP with its latency'
  );
  assert.ok(
    patterns.some((p) => /auto-filed/i.test(p)),
    'reports newsletters filed'
  );
});

test('computeBehaviourProfile degrades safely on empty input', () => {
  const profile = computeBehaviourProfile({});
  assert.deepEqual(profile.people, []);
  assert.equal(profile.counts.senders, 0);
  assert.deepEqual(profile.patterns, []);
});
