import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  normalizeGithubNotifications,
  GITHUB_NOTIFICATION_LIMIT
} from './workbench-github.js';

test('GITHUB_NOTIFICATION_LIMIT is a sane positive default', () => {
  assert.equal(GITHUB_NOTIFICATION_LIMIT, 6);
});

test('normalizeGithubNotifications maps real notification details', () => {
  const rows = normalizeGithubNotifications({
    successful: true,
    data: {
      details: [
        {
          id: '12345',
          reason: 'mention',
          unread: true,
          updated_at: '2026-06-20T10:00:00.000Z',
          repository: {
            full_name: 'nearai/ironclaw',
            html_url: 'https://github.com/nearai/ironclaw'
          },
          subject: { title: 'Bug Bash blocker', type: 'Issue' }
        },
        {
          id: 'no-title',
          reason: 'subscribed',
          updated_at: '2026-06-20T09:00:00.000Z',
          repository: { full_name: 'nearai/ironclaw', html_url: 'https://github.com/nearai/ironclaw' },
          subject: { type: 'PullRequest' }
        }
      ]
    }
  });
  assert.equal(rows.length, 1, 'entries with no subject.title are dropped');
  const [row] = rows;
  assert.equal(row.id, '12345');
  assert.equal(row.title, 'Bug Bash blocker');
  assert.equal(row.kind, 'Issue');
  assert.equal(row.reason, 'mention');
  assert.equal(row.repo, 'nearai/ironclaw');
  assert.equal(row.link, 'https://github.com/nearai/ironclaw');
  assert.ok(row.when, 'a human time is derived from the ISO updated_at');
});

test('normalizeGithubNotifications falls back to the repo URL when html_url is missing', () => {
  const rows = normalizeGithubNotifications({
    successful: true,
    data: {
      details: [
        {
          id: '999',
          reason: 'review_requested',
          updated_at: '2026-06-20T11:00:00.000Z',
          repository: { full_name: 'nearai/ironclaw' },
          subject: { title: 'Add normalizer', type: 'PullRequest' }
        }
      ]
    }
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].link, 'https://github.com/nearai/ironclaw', 'link derived from repo slug');
  assert.equal(rows[0].reason, 'review_requested');
});

test('normalizeGithubNotifications returns [] for unsuccessful or malformed payloads', () => {
  assert.deepEqual(normalizeGithubNotifications(null), []);
  assert.deepEqual(normalizeGithubNotifications({ successful: false }), []);
  assert.deepEqual(normalizeGithubNotifications({ data: {} }), []);
  assert.deepEqual(normalizeGithubNotifications({ data: { details: 'nope' } }), []);
});
