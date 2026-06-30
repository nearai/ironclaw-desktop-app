import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fetchWorkbenchFeed,
  normalizeWorkbenchFeed,
  workbenchFeedReadSupported
} from './workbench-feed-api.js';

test('normalizeWorkbenchFeed maps general feed rows into rail-ready items', () => {
  const feed = normalizeWorkbenchFeed({
    feed: [
      {
        feed_id: 'feed-vendor-onboarding',
        group_id: 'needs_review',
        headline: 'Vendor onboarding packet changed',
        summary: 'Two new security exhibits were added overnight.',
        source: 'notion',
        thread_id: 'thread-vendor',
        updated_at: '2026-06-21T08:15:00.000Z'
      },
      null,
      { headline: 'No group' },
      { group_id: 'unknown', headline: 'Unknown group' },
      { group_id: 'needs_review' }
    ]
  });

  assert.equal(feed.length, 1);
  assert.deepEqual(feed[0], {
    id: 'feed-vendor-onboarding',
    groupId: 'needs-review',
    title: 'Vendor onboarding packet changed',
    badge: 'Ready to review',
    detail: 'Two new security exhibits were added overnight.',
    icon: 'file',
    href: '/chat/thread-vendor',
    timestamp: '2026-06-21T08:15:00.000Z',
    source: 'notion'
  });
});

test('normalizeWorkbenchFeed accepts pending and category aliases', () => {
  const feed = normalizeWorkbenchFeed({
    pending: [
      {
        item_id: 'feed-slack-blocked',
        category: 'blocked',
        title: 'Slack approval failed',
        provider: 'slack',
        detail: 'The prepared channel update could not be delivered.',
        href: '/workbench'
      },
      {
        item_id: 'feed-calendar',
        lane: 'calendar',
        title: 'Board sync',
        provider: 'google_calendar',
        due_at: '2026-06-21T15:00:00.000Z'
      }
    ]
  });

  assert.equal(feed.length, 2);
  assert.equal(feed[0].groupId, 'blocked');
  assert.equal(feed[0].icon, 'chat');
  assert.equal(feed[1].groupId, 'upcoming');
  assert.equal(feed[1].icon, 'calendar');
});

test('fetchWorkbenchFeed targets the future v2 workbench feed endpoint', async () => {
  const calls = [];
  const signal = new AbortController().signal;
  const feed = await fetchWorkbenchFeed({
    signal,
    fetcher: async (path, options) => {
      calls.push({ path, options });
      return { items: [{ id: 'feed-1', group: 'ready', title: 'Ready item' }] };
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/webchat/v2/workbench/feed');
  assert.equal(calls[0].options.signal, signal);
  assert.equal(feed[0].id, 'feed-1');
  assert.equal(feed[0].groupId, 'needs-review');
});

test('workbenchFeedReadSupported is explicit and quiet by default', () => {
  assert.equal(workbenchFeedReadSupported(null), false);
  assert.equal(workbenchFeedReadSupported({ capabilities: { workbench_feed_read: true } }), true);
  assert.equal(
    workbenchFeedReadSupported({ capabilities: { pending_feed_read: 'enabled' } }),
    true
  );
  assert.equal(
    workbenchFeedReadSupported({ capabilities: { changed_feed_read: 'available' } }),
    true
  );
  assert.equal(workbenchFeedReadSupported({ features: { workbench_feed_read: 'true' } }), true);
  assert.equal(workbenchFeedReadSupported({ workbench: { feed_read: true } }), true);
  assert.equal(workbenchFeedReadSupported({ feed: { read: true } }), true);
  assert.equal(workbenchFeedReadSupported({ capabilities: { workbench_feed_read: false } }), false);
});
