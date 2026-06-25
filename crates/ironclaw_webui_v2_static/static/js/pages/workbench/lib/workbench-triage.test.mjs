import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CENTER_FILTERS,
  centerFilterHasContent,
  triageStatusFilterFor,
  workbenchTriageCounts
} from './workbench-triage.js';

const groups = (over = {}) => [
  { id: 'needs-approval', rows: over.approval || [], total: over.approvalTotal },
  { id: 'blocked', rows: over.blocked || [], total: over.blockedTotal },
  { id: 'receipts', rows: over.receipts || [], total: over.receiptsTotal }
];
const row = (id) => ({ id });

test('CENTER_FILTERS are All/Decisions/Replies/Blocked in order', () => {
  assert.deepEqual(
    CENTER_FILTERS.map((f) => f.id),
    ['all', 'decisions', 'replies', 'blocked']
  );
});

test("'all' always has content; non-'all' filters never report content from nothing", () => {
  assert.equal(centerFilterHasContent('all', {}), true);
  assert.equal(centerFilterHasContent('decisions', {}), false);
  assert.equal(centerFilterHasContent('replies', {}), false);
  assert.equal(centerFilterHasContent('blocked', {}), false);
});

test('REGRESSION: a read-only inbox does NOT report Replies content (would be a blank center)', () => {
  // triage inbox keeps READ messages, but WorkbenchDecisions renders only unread.
  const decisionMessages = [
    { id: 'm1', unread: false },
    { id: 'm2', unread: false }
  ];
  assert.equal(
    centerFilterHasContent('replies', { gmailReady: true, decisionMessages }),
    false,
    'all-read inbox => Replies has no content => show the note, not a blank center'
  );
  assert.equal(
    centerFilterHasContent('replies', {
      gmailReady: true,
      decisionMessages: [{ id: 'm3', unread: true }]
    }),
    true,
    'one unread => Replies has content'
  );
});

test('REGRESSION: inactive Slack blockers do NOT report Blocked content (would be a blank center)', () => {
  // rows are loaded eagerly but WorkbenchSlackBlockers renders only when active.
  assert.equal(
    centerFilterHasContent('blocked', { slackBlockersActive: false, slackBlockerRows: 5 }),
    false,
    'inactive search with rows => Blocked has no rendered content => show the note'
  );
  assert.equal(
    centerFilterHasContent('blocked', { slackBlockersActive: true, slackBlockerRows: 5 }),
    true,
    'active search with rows => Blocked has content'
  );
  assert.equal(
    centerFilterHasContent('blocked', { groups: groups({ blocked: [row('b1')] }) }),
    true,
    'a blocked triage group always counts'
  );
});

test('workbenchTriageCounts sums unread decisions + approvals + blocked; Slack only when active', () => {
  const base = {
    gmailReady: true,
    decisionMessages: [
      { id: 'm1', unread: true },
      { id: 'm2', unread: false }
    ],
    groups: groups({ approvalTotal: 2, blockedTotal: 1, receiptsTotal: 9 })
  };
  const inactive = workbenchTriageCounts({
    ...base,
    slackBlockersActive: false,
    slackBlockerRows: 4
  });
  assert.equal(
    inactive.needYou,
    1 + 2 + 1,
    'unread(1)+approval(2)+blocked(1), no Slack while inactive'
  );
  assert.equal(inactive.handled, 9);
  const active = workbenchTriageCounts({ ...base, slackBlockersActive: true, slackBlockerRows: 4 });
  assert.equal(
    active.needYou,
    1 + 2 + 1 + 4,
    'active Slack blockers join the count (agree with the pill)'
  );
});

test('Slack awaiting items report Replies content even with no unread Gmail', () => {
  // The deep Slack read surfaces threads awaiting your reply on the default home;
  // the Replies pill must count them so it never shows a blank center.
  assert.equal(
    centerFilterHasContent('replies', {
      gmailReady: true,
      decisionMessages: [],
      slackAwaitingRows: 2
    }),
    true,
    'Slack awaiting with no unread Gmail => Replies has content'
  );
  assert.equal(
    centerFilterHasContent('replies', { gmailReady: false, slackAwaitingRows: 0 }),
    false,
    'no Gmail, no Slack => Replies empty'
  );
});

test('workbenchTriageCounts includes Slack awaiting in needYou', () => {
  const counts = workbenchTriageCounts({
    gmailReady: true,
    decisionMessages: [{ id: 'm1', unread: true }],
    groups: groups({ approvalTotal: 1 }),
    slackAwaitingRows: 3
  });
  assert.equal(counts.needYou, 1 + 1 + 3, 'unread(1)+approval(1)+slackAwaiting(3)');
});

test('triageStatusFilterFor maps pills to triage status groups', () => {
  assert.deepEqual(triageStatusFilterFor('decisions'), ['needs-approval']);
  assert.deepEqual(triageStatusFilterFor('blocked'), ['blocked']);
  assert.equal(triageStatusFilterFor('all'), null);
  assert.equal(triageStatusFilterFor('replies'), null);
});
