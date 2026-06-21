import assert from 'node:assert/strict';
import test from 'node:test';

import {
  approvalsFeedReadSupported,
  fetchApprovalsFeed,
  normalizeApprovalsFeed
} from './approvals-feed-api.js';

test('normalizeApprovalsFeed maps future approvals payloads into rail-ready rows', () => {
  const approvals = normalizeApprovalsFeed({
    approvals: [
      {
        approval_id: 'approval-northwind',
        headline: 'Approve counter to Northwind',
        summary: 'External email with net 45 terms is waiting.',
        tool_name: 'GMAIL_CREATE_EMAIL_DRAFT',
        thread_id: 'thread-northwind',
        updated_at: '2026-06-21T06:45:00.000Z'
      },
      null,
      { title: '' }
    ]
  });

  assert.equal(approvals.length, 1);
  assert.deepEqual(approvals[0], {
    id: 'approval-northwind',
    title: 'Approve counter to Northwind',
    badge: 'Needs approval',
    detail: 'External email with net 45 terms is waiting.',
    icon: 'mail',
    href: '/chat/thread-northwind',
    timestamp: '2026-06-21T06:45:00.000Z',
    threadId: 'thread-northwind',
    destination: ''
  });
});

test('normalizeApprovalsFeed accepts pending_gates and destination fallback detail', () => {
  const approvals = normalizeApprovalsFeed({
    pending_gates: [
      {
        gate_id: 'gate-slack-1',
        action_label: 'Post Slack response',
        provider: 'slack',
        channel: '#finance',
        chat_path: '/chat/thread-slack'
      }
    ]
  });

  assert.equal(approvals.length, 1);
  assert.equal(approvals[0].id, 'gate-slack-1');
  assert.equal(approvals[0].title, 'Post Slack response');
  assert.equal(approvals[0].detail, 'Prepared action to #finance is held for review.');
  assert.equal(approvals[0].icon, 'chat');
  assert.equal(approvals[0].href, '/chat/thread-slack');
});

test('fetchApprovalsFeed targets the future v2 approvals endpoint', async () => {
  const calls = [];
  const signal = new AbortController().signal;
  const approvals = await fetchApprovalsFeed({
    signal,
    fetcher: async (path, options) => {
      calls.push({ path, options });
      return { items: [{ id: 'approval-1', title: 'Approve send' }] };
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/webchat/v2/approvals');
  assert.equal(calls[0].options.signal, signal);
  assert.equal(approvals[0].id, 'approval-1');
});

test('approvalsFeedReadSupported is explicit and quiet by default', () => {
  assert.equal(approvalsFeedReadSupported(null), false);
  assert.equal(approvalsFeedReadSupported({ capabilities: { approvals_read: true } }), true);
  assert.equal(
    approvalsFeedReadSupported({ capabilities: { approval_feed_read: 'enabled' } }),
    true
  );
  assert.equal(
    approvalsFeedReadSupported({ capabilities: { pending_gates_read: 'available' } }),
    true
  );
  assert.equal(approvalsFeedReadSupported({ features: { approvals_read: 'true' } }), true);
  assert.equal(approvalsFeedReadSupported({ approvals: { read: true } }), true);
  assert.equal(approvalsFeedReadSupported({ capabilities: { approvals_read: false } }), false);
});
