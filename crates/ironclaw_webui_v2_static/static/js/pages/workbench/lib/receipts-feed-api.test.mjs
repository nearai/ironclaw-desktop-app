import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fetchReceiptsFeed,
  normalizeReceiptsFeed,
  receiptsFeedReadSupported
} from './receipts-feed-api.js';

test('normalizeReceiptsFeed maps future receipts payloads into rail-ready rows', () => {
  const receipts = normalizeReceiptsFeed({
    receipts: [
      {
        receipt_id: 'receipt-northwind-draft',
        headline: 'Draft saved for Northwind',
        summary: 'Gmail draft created; nothing was sent.',
        status_label: 'Completed',
        tool_name: 'GMAIL_CREATE_EMAIL_DRAFT',
        thread_id: 'thread-northwind',
        completed_at: '2026-06-21T07:45:00.000Z'
      },
      null,
      { title: '' }
    ]
  });

  assert.equal(receipts.length, 1);
  assert.deepEqual(receipts[0], {
    id: 'receipt-northwind-draft',
    title: 'Draft saved for Northwind',
    badge: 'Completed',
    detail: 'Gmail draft created; nothing was sent.',
    icon: 'mail',
    href: '/chat/thread-northwind',
    timestamp: '2026-06-21T07:45:00.000Z',
    threadId: 'thread-northwind',
    destination: ''
  });
});

test('normalizeReceiptsFeed accepts audit payloads and destination fallback detail', () => {
  const receipts = normalizeReceiptsFeed({
    audit: [
      {
        audit_id: 'audit-slack-1',
        action_label: 'Slack reply posted',
        provider: 'slack',
        channel: '#finance',
        chat_path: '/chat/thread-slack',
        occurred_at: '2026-06-21T07:55:00.000Z'
      }
    ]
  });

  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].id, 'audit-slack-1');
  assert.equal(receipts[0].title, 'Slack reply posted');
  assert.equal(receipts[0].detail, 'Recorded completed work for #finance.');
  assert.equal(receipts[0].icon, 'chat');
  assert.equal(receipts[0].href, '/chat/thread-slack');
});

test('fetchReceiptsFeed targets the future v2 receipts endpoint', async () => {
  const calls = [];
  const signal = new AbortController().signal;
  const receipts = await fetchReceiptsFeed({
    signal,
    fetcher: async (path, options) => {
      calls.push({ path, options });
      return { items: [{ id: 'receipt-1', title: 'Receipt saved' }] };
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/webchat/v2/receipts');
  assert.equal(calls[0].options.signal, signal);
  assert.equal(receipts[0].id, 'receipt-1');
});

test('receiptsFeedReadSupported is explicit and quiet by default', () => {
  assert.equal(receiptsFeedReadSupported(null), false);
  assert.equal(receiptsFeedReadSupported({ capabilities: { receipts_read: true } }), true);
  assert.equal(receiptsFeedReadSupported({ capabilities: { receipt_feed_read: 'enabled' } }), true);
  assert.equal(receiptsFeedReadSupported({ capabilities: { audit_read: 'available' } }), true);
  assert.equal(receiptsFeedReadSupported({ features: { receipts_read: 'true' } }), true);
  assert.equal(receiptsFeedReadSupported({ receipts: { read: true } }), true);
  assert.equal(receiptsFeedReadSupported({ audit: { read: true } }), true);
  assert.equal(receiptsFeedReadSupported({ capabilities: { receipts_read: false } }), false);
});
