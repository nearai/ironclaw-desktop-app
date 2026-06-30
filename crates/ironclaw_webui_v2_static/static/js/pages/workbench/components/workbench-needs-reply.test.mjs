import assert from 'node:assert/strict';
import test from 'node:test';

import { needsReplyCount, WorkbenchNeedsReply } from './workbench-needs-reply.js';

test('needsReplyCount sums owed emails + Slack awaiting', () => {
  assert.equal(needsReplyCount({ decisionMessages: [{}, {}], slackAwaiting: [{}] }), 3);
  assert.equal(needsReplyCount({ decisionMessages: [], slackAwaiting: [] }), 0);
  assert.equal(needsReplyCount({}), 0);
  assert.equal(needsReplyCount({ slackAwaiting: [{}, {}] }), 2);
  assert.equal(needsReplyCount({ decisionMessages: [{}, {}, {}] }), 3);
});

test('WorkbenchNeedsReply renders nothing when nothing is owed (honest empty)', () => {
  assert.equal(WorkbenchNeedsReply({ decisionMessages: [], slackAwaiting: [] }), null);
  assert.equal(WorkbenchNeedsReply({}), null);
});

test('WorkbenchNeedsReply returns a vnode when work is owed (built block for the consolidation)', () => {
  const node = WorkbenchNeedsReply({
    decisionMessages: [{ id: 'e1', subject: 'Sign the NDA?' }],
    slackAwaiting: [{ id: 's1', who: 'Carla', text: 'thoughts on the term sheet?' }]
  });
  assert.ok(
    node && typeof node === 'object',
    'returns a preact vnode, not null, when work is owed'
  );
});
