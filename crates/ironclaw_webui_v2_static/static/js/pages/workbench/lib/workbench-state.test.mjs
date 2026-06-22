import assert from 'node:assert/strict';
import test from 'node:test';

import { THREAD_STATE } from '../../../lib/thread-state.js';
import { buildWorkbenchStateRail } from './workbench-state.js';

test('workbench rail keeps source catalog/setup noise out of active work', () => {
  const rail = buildWorkbenchStateRail({
    sourceReadiness: [
      source('calendar', 'catalog-unavailable', 'Catalog unavailable'),
      source('drive', 'blocked', 'Blocked by setup'),
      source('notion', 'needs-setup', 'Needs setup'),
      source('github', 'not-in-catalog', 'Not in catalog'),
      source('web', 'gateway-offline', 'Gateway offline')
    ]
  });

  const needsApproval = rail.find((group) => group.id === 'needs-approval');
  const blocked = rail.find((group) => group.id === 'blocked');
  assert.equal(needsApproval.total, 0);
  assert.deepEqual(needsApproval.rows, []);
  assert.equal(blocked.total, 0);
  assert.deepEqual(blocked.rows, []);
  assert.equal(needsApproval.emptyDetail, 'Approvals that need your review will appear here.');
});

test('workbench rail still surfaces real source reconnect and in-progress states', () => {
  const rail = buildWorkbenchStateRail({
    sourceReadiness: [
      source('slack', 'needs-reconnect', 'Needs reconnect', 0),
      source('gmail', 'in-progress', 'Setup in progress', 1),
      source('drive', 'blocked', 'Blocked by setup', 0)
    ]
  });

  const blocked = rail.find((group) => group.id === 'blocked');
  const working = rail.find((group) => group.id === 'working');
  assert.equal(blocked.total, 1);
  assert.equal(working.total, 1);
  assert.deepEqual(
    [...blocked.rows, ...working.rows].map((row) => row.title),
    ['Slack', 'Gmail']
  );
});

test('workbench rail preserves thread attention ahead of passive source setup states', () => {
  const rail = buildWorkbenchStateRail({
    threads: [
      {
        id: 'thread-approval',
        title: 'Approve customer response',
        state: THREAD_STATE.NEEDS_ATTENTION,
        turn_count: 4,
        updated_at: '2026-06-19T15:00:00.000Z'
      }
    ],
    sourceReadiness: [source('drive', 'blocked', 'Blocked by setup', 0)]
  });

  const needsApproval = rail.find((group) => group.id === 'needs-approval');
  assert.equal(needsApproval.total, 1);
  assert.equal(needsApproval.rows[0].title, 'Approve customer response');
  assert.equal(needsApproval.rows[0].kind, 'thread');
});

test('workbench rail uses live gate detail when a thread needs a decision', () => {
  const rail = buildWorkbenchStateRail({
    threads: [
      {
        id: 'thread-approval',
        title: 'Customer renewal thread',
        state: THREAD_STATE.NEEDS_ATTENTION,
        turn_count: 4,
        updated_at: '2026-06-19T15:00:00.000Z'
      }
    ],
    threadAttentionDetails: new Map([
      [
        'thread-approval',
        {
          title: 'Approve counter to Northwind',
          detail: 'External email with net 45 terms is waiting.',
          badge: 'Needs approval',
          icon: 'mail',
          timestamp: '2026-06-20T04:30:00.000Z'
        }
      ]
    ])
  });

  const needsApproval = rail.find((group) => group.id === 'needs-approval');
  assert.equal(needsApproval.total, 1);
  assert.equal(needsApproval.rows[0].title, 'Approve counter to Northwind');
  assert.equal(needsApproval.rows[0].detail, 'External email with net 45 terms is waiting.');
  assert.equal(needsApproval.rows[0].badge, 'Needs approval');
  assert.equal(needsApproval.rows[0].icon, 'mail');
});

test('workbench rail uses backend thread pending gate detail when present', () => {
  const rail = buildWorkbenchStateRail({
    threads: [
      {
        id: 'thread-backend-gate',
        title: 'Generic waiting thread',
        state: THREAD_STATE.NEEDS_ATTENTION,
        turn_count: 3,
        updated_at: '2026-06-20T12:00:00.000Z',
        pending_gate: {
          kind: 'approval_required',
          headline: 'Approve Slack reply to finance',
          detail: 'Prepared Slack response is held until review.',
          tool_name: 'slack_reply',
          run_id: 'run-gate-1',
          gate_ref: 'gate-slack-1'
        }
      }
    ]
  });

  const needsApproval = rail.find((group) => group.id === 'needs-approval');
  assert.equal(needsApproval.total, 1);
  assert.equal(needsApproval.rows[0].title, 'Approve Slack reply to finance');
  assert.equal(needsApproval.rows[0].detail, 'Prepared Slack response is held until review.');
  assert.equal(needsApproval.rows[0].timestamp, '2026-06-20T12:00:00.000Z');
});

test('workbench rail surfaces authoritative approvals feed rows', () => {
  const rail = buildWorkbenchStateRail({
    approvals: [
      {
        id: 'approval-northwind',
        title: 'Approve counter to Northwind',
        badge: 'Needs approval',
        detail: 'External email with net 45 terms is waiting.',
        icon: 'mail',
        href: '/chat/thread-northwind',
        timestamp: '2026-06-21T06:45:00.000Z'
      }
    ]
  });

  const needsApproval = rail.find((group) => group.id === 'needs-approval');
  assert.equal(needsApproval.total, 1);
  assert.deepEqual(needsApproval.rows[0], {
    id: 'approval-feed-approval-northwind',
    groupId: 'needs-approval',
    kind: 'approval-feed',
    icon: 'mail',
    title: 'Approve counter to Northwind',
    badge: 'Needs approval',
    detail: 'External email with net 45 terms is waiting.',
    href: '/chat/thread-northwind',
    timestamp: '2026-06-21T06:45:00.000Z'
  });
});

test('workbench rail surfaces authoritative receipts feed rows', () => {
  const rail = buildWorkbenchStateRail({
    receipts: [
      {
        id: 'receipt-northwind-draft',
        title: 'Draft saved for Northwind',
        badge: 'Completed',
        detail: 'Gmail draft created; nothing was sent.',
        icon: 'mail',
        href: '/chat/thread-northwind',
        timestamp: '2026-06-21T07:45:00.000Z'
      }
    ]
  });

  const receipts = rail.find((group) => group.id === 'receipts');
  assert.equal(receipts.total, 1);
  assert.deepEqual(receipts.rows[0], {
    id: 'receipt-feed-receipt-northwind-draft',
    groupId: 'receipts',
    kind: 'receipt-feed',
    icon: 'mail',
    title: 'Draft saved for Northwind',
    badge: 'Completed',
    detail: 'Gmail draft created; nothing was sent.',
    href: '/chat/thread-northwind',
    timestamp: '2026-06-21T07:45:00.000Z'
  });
});

test('workbench rail surfaces authoritative global feed rows', () => {
  const rail = buildWorkbenchStateRail({
    feedItems: [
      {
        id: 'feed-vendor-onboarding',
        groupId: 'needs-review',
        title: 'Vendor onboarding packet changed',
        badge: 'Ready to review',
        detail: 'Two new security exhibits were added overnight.',
        icon: 'file',
        href: '/chat/thread-vendor',
        timestamp: '2026-06-21T08:15:00.000Z'
      },
      {
        id: 'feed-unknown',
        groupId: 'unknown',
        title: 'Unknown group',
        detail: 'This should not render.'
      }
    ]
  });

  const needsReview = rail.find((group) => group.id === 'needs-review');
  assert.equal(needsReview.total, 1);
  assert.deepEqual(needsReview.rows[0], {
    id: 'workbench-feed-feed-vendor-onboarding',
    groupId: 'needs-review',
    kind: 'workbench-feed',
    icon: 'file',
    title: 'Vendor onboarding packet changed',
    badge: 'Ready to review',
    detail: 'Two new security exhibits were added overnight.',
    href: '/chat/thread-vendor',
    timestamp: '2026-06-21T08:15:00.000Z'
  });
});

test('workbench rail promotes backend pending gates when thread state is missing or stale', () => {
  const rail = buildWorkbenchStateRail({
    threads: [
      {
        id: 'thread-missing-state-gate',
        title: 'Recent thread label',
        turn_count: 8,
        updated_at: '2026-06-20T12:02:00.000Z',
        pending_gates: [
          {
            kind: 'approval_required',
            title: 'Approve vendor shortlist',
            body: 'The prepared research summary is waiting for review.',
            tool: 'send_email'
          }
        ]
      },
      {
        id: 'thread-stale-running-gate',
        title: 'Running-looking thread',
        state: THREAD_STATE.RUNNING,
        turn_count: 2,
        updated_at: '2026-06-20T12:03:00.000Z',
        pending_gate: {
          kind: 'auth_required',
          provider_id: 'google_drive',
          account_label: 'Work Drive'
        }
      }
    ]
  });

  const needsApproval = rail.find((group) => group.id === 'needs-approval');
  const working = rail.find((group) => group.id === 'working');
  const needsReview = rail.find((group) => group.id === 'needs-review');
  assert.equal(needsApproval.total, 2);
  assert.deepEqual(
    needsApproval.rows.map((row) => row.title),
    ['Google Drive sign-in needed', 'Approve vendor shortlist']
  );
  assert.equal(working.total, 0);
  assert.equal(needsReview.total, 0);
});

test('workbench rail still surfaces cached waiting decisions without a thread-feed error row', () => {
  // v13 fidelity: the home rail is a forward-looking "what needs me" surface, not
  // an ops console. A transient thread-feed outage degrades quietly (no scary
  // "Conversation list unavailable" row) while cached waiting decisions still
  // surface from the threads already in hand.
  const rail = buildWorkbenchStateRail({
    threads: [
      {
        id: 'thread-cached-gate',
        title: 'Cached gate thread',
        turn_count: 2,
        updated_at: '2026-06-20T12:04:00.000Z',
        pending_gate: {
          kind: 'approval_required',
          title: 'Approve cached draft',
          detail: 'A cached thread still has a waiting decision.'
        }
      }
    ]
  });

  const blocked = rail.find((group) => group.id === 'blocked');
  const needsApproval = rail.find((group) => group.id === 'needs-approval');

  assert.equal(blocked.total, 0);
  assert.deepEqual(blocked.rows, []);
  assert.equal(needsApproval.total, 1);
  assert.equal(needsApproval.rows[0].title, 'Approve cached draft');
});

test('workbench rail renders real unread inbox mail as a Needs a reply group', () => {
  const rail = buildWorkbenchStateRail({
    inbox: {
      messages: [
        {
          id: 'm1',
          sender: 'Dana Lee',
          subject: 'Renewal terms for Q3',
          unread: true,
          timestamp: '2026-06-20T16:00:00.000Z'
        },
        {
          id: 'm2',
          sender: 'GitHub',
          subject: 'PR merged',
          unread: false,
          timestamp: '2026-06-20T12:00:00.000Z'
        }
      ]
    }
  });

  const needsReply = rail.find((group) => group.id === 'needs-reply');
  assert.equal(needsReply.total, 1);
  assert.equal(needsReply.rows[0].title, 'Renewal terms for Q3');
  assert.equal(needsReply.rows[0].badge, 'Unread');
  assert.equal(needsReply.rows[0].detail, 'From Dana Lee');
});

test('workbench rail renders real calendar events as an Upcoming group, soonest first', () => {
  const rail = buildWorkbenchStateRail({
    calendar: {
      events: [
        {
          id: 'e-late',
          title: 'Strategy sync',
          when: 'Mon, Jun 23 · 1:00 PM',
          start: '2026-06-23T17:00:00.000Z',
          location: ''
        },
        {
          id: 'e-soon',
          title: 'Legal Weekly',
          when: 'Mon, Jun 22 · 10:00 AM',
          start: '2026-06-22T14:00:00.000Z',
          location: 'Zoom'
        }
      ]
    }
  });

  const upcoming = rail.find((group) => group.id === 'upcoming');
  assert.equal(upcoming.total, 2);
  assert.deepEqual(
    upcoming.rows.map((row) => row.title),
    ['Legal Weekly', 'Strategy sync']
  );
  assert.equal(upcoming.rows[0].detail, 'Zoom');
});

test('workbench rail uses direct thread attention detail before browser-local fallback', () => {
  const rail = buildWorkbenchStateRail({
    threads: [
      {
        id: 'thread-direct-detail',
        title: 'Browser fallback title',
        state: THREAD_STATE.NEEDS_ATTENTION,
        turn_count: 2,
        updated_at: '2026-06-20T12:01:00.000Z',
        attention_detail: {
          kind: 'auth',
          title: 'Drive sign-in needed',
          detail: 'Reconnect Drive before this request can continue.',
          badge: 'Auth required',
          icon: 'plug'
        }
      }
    ],
    threadAttentionDetails: {
      'thread-direct-detail': {
        title: 'Stale browser-local approval',
        detail: 'This local fallback should not win.',
        badge: 'Needs approval',
        icon: 'shield'
      }
    }
  });

  const needsApproval = rail.find((group) => group.id === 'needs-approval');
  assert.equal(needsApproval.total, 1);
  assert.equal(needsApproval.rows[0].title, 'Drive sign-in needed');
  assert.equal(needsApproval.rows[0].detail, 'Reconnect Drive before this request can continue.');
  assert.equal(needsApproval.rows[0].badge, 'Auth required');
  assert.equal(needsApproval.rows[0].icon, 'plug');
});

test('workbench rail separates saved approvals, schedules, review work, and receipts', () => {
  const rail = buildWorkbenchStateRail({
    savedItems: [
      {
        id: 'work-response',
        title: 'Customer response',
        updated_at: '2026-06-19T15:00:00.000Z',
        openApprovals: [{ id: 'send', title: 'Send response', summary: 'Email held.' }],
        watches: [{ id: 'weekly', title: 'Competitor watch', cadence: 'Fridays' }],
        receipts: [{ id: 'sent', title: 'Response sent', status: 'Sent', detail: 'Email sent.' }],
        artifacts: [
          {
            id: 'artifact',
            title: 'Renewal summary',
            status: 'ready',
            content: 'Renewal terms summary'
          }
        ]
      }
    ]
  });

  assert.equal(rail.find((group) => group.id === 'needs-approval').total, 2);
  assert.equal(rail.find((group) => group.id === 'scheduled').rows[0].title, 'Competitor watch');
  assert.equal(rail.find((group) => group.id === 'receipts').rows[0].title, 'Response sent');
  assert.equal(
    rail.find((group) => group.id === 'needs-review').rows.length,
    0,
    'approval-held artifacts stay in needs approval instead of duplicating into ready review'
  );
});

test('workbench rail does not fabricate a blocked row for saved-work storage status', () => {
  // The saved-work storage source is reported in Library, not as a scary blocked
  // row on the forward-looking home rail. A corrupt/unavailable/local status
  // never injects a blocked error card here.
  const corruptRail = buildWorkbenchStateRail({});
  const blocked = corruptRail.find((group) => group.id === 'blocked');
  assert.equal(blocked.total, 0);
  assert.deepEqual(blocked.rows, []);
});

test('workbench rail surfaces real read-only automation runs without fake write controls', () => {
  const rail = buildWorkbenchStateRail({
    automations: [
      {
        automation_id: 'weekly-digest',
        display_name: 'Weekly digest',
        state: 'active',
        state_tone: 'gold',
        schedule_label: 'Fridays at 9:00 AM',
        next_run_at: '2026-06-26T13:00:00.000Z',
        next_run_label: 'Jun 26, 09:00 AM',
        latest_run: {
          run_id: 'run-ok',
          status: 'ok',
          completed_at: '2026-06-19T13:05:00.000Z',
          completed_label: 'Jun 19, 09:05 AM',
          chat_path: '/chat/thread-digest'
        }
      },
      {
        automation_id: 'market-watch',
        display_name: 'Market watch',
        state: 'active',
        state_tone: 'gold',
        schedule_label: 'Every day at 8:00 AM',
        has_running_run: true,
        current_run: {
          status: 'running',
          fired_label: 'Jun 20, 08:00 AM',
          timestamp_source: '2026-06-20T12:00:00.000Z',
          chat_path: '/chat/thread-market'
        }
      },
      {
        automation_id: 'failed-sync',
        display_name: 'Source sync',
        state: 'active',
        state_tone: 'gold',
        schedule_label: 'Hourly at :00',
        latest_run: {
          status: 'error',
          completed_at: '2026-06-20T11:00:00.000Z',
          completed_label: 'Jun 20, 07:00 AM',
          chat_path: '/chat/thread-sync'
        }
      }
    ]
  });

  const scheduled = rail.find((group) => group.id === 'scheduled');
  const working = rail.find((group) => group.id === 'working');
  const blocked = rail.find((group) => group.id === 'blocked');
  const receipts = rail.find((group) => group.id === 'receipts');

  assert.equal(scheduled.total, 3);
  assert.equal(working.rows[0].title, 'Market watch');
  assert.equal(working.rows[0].href, '/chat/thread-market');
  assert.equal(blocked.rows[0].title, 'Source sync');
  assert.equal(blocked.rows[0].href, '/chat/thread-sync');
  assert.equal(receipts.rows[0].title, 'Weekly digest');
  assert.equal(receipts.rows[0].href, '/chat/thread-digest');
  assert.equal(scheduled.rows[0].badge, 'Fridays at 9:00 AM');
});

test('workbench rail treats an empty/unavailable automation feed as honest empty', () => {
  // v13 fidelity: an unwired or transiently-failed automations feed is honest
  // empty, not a "Scheduled work unavailable" error card. The rail simply omits
  // the Scheduled group rather than screaming a red row on the primary surface.
  const rail = buildWorkbenchStateRail({ automations: [] });

  const blocked = rail.find((group) => group.id === 'blocked');
  const scheduled = rail.find((group) => group.id === 'scheduled');

  assert.equal(blocked.total, 0);
  assert.deepEqual(blocked.rows, []);
  assert.equal(scheduled.total, 0);
});

test('workbench rail ignores saved artifact placeholders without content or file payload', () => {
  const rail = buildWorkbenchStateRail({
    savedItems: [
      {
        id: 'work-placeholder',
        title: 'Draft placeholder',
        artifacts: [{ id: 'artifact-placeholder', title: 'No saved body yet', status: 'ready' }]
      }
    ]
  });

  assert.equal(rail.find((group) => group.id === 'needs-review').total, 0);
});

function source(id, state, statusLabel, priority = 2) {
  return {
    id,
    state,
    statusLabel,
    displayName: displayName(id),
    body: `${displayName(id)} source state`,
    priority
  };
}

function displayName(id) {
  return id
    .split('-')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

test('needs-a-reply ranks IMPORTANT human mail first, badges it, and never includes bulk', () => {
  const rail = buildWorkbenchStateRail({
    inbox: {
      messages: [
        // unread, non-important human mail (older)
        {
          id: 'a',
          subject: 'Tax fly-in',
          sender: 'jonathan@digitalchamber.org',
          unread: true,
          isBulk: false,
          important: false,
          timestamp: '2026-06-22T08:00:00Z'
        },
        // unread, IMPORTANT human mail (should rank first despite being older than 'a')
        {
          id: 'b',
          subject: 'GDPR coverage enquiry',
          sender: 'anelda@near.foundation',
          unread: true,
          isBulk: false,
          important: true,
          timestamp: '2026-06-22T07:00:00Z'
        },
        // unread newsletter — must be excluded even though it is "important" + newest
        {
          id: 'c',
          subject: 'The Briefing',
          sender: 'news@substack.com',
          unread: true,
          isBulk: true,
          important: true,
          timestamp: '2026-06-22T11:00:00Z'
        }
      ]
    }
  });
  const reply = rail.find((group) => group.id === 'needs-reply');
  assert.ok(reply, 'needs-reply group present');
  assert.deepEqual(
    reply.rows.map((row) => row.id),
    ['reply-b', 'reply-a'],
    'IMPORTANT human mail first; bulk excluded entirely'
  );
  assert.equal(reply.rows[0].badge, 'Important', 'important row badged Important');
  assert.equal(reply.rows[1].badge, 'Unread', 'non-important row badged Unread');
});

test('a VIP correction floats that sender above Gmail IMPORTANT in needs-a-reply', () => {
  const rail = buildWorkbenchStateRail({
    inbox: {
      messages: [
        // IMPORTANT human mail (would normally rank first)
        {
          id: 'imp',
          subject: 'Board deck',
          sender: 'Chair',
          fromEmail: 'chair@near.foundation',
          unread: true,
          isBulk: false,
          important: true,
          timestamp: '2026-06-22T09:00:00Z'
        },
        // ordinary unread from a sender the user corrected to VIP — should outrank IMPORTANT
        {
          id: 'vip',
          subject: 'quick question',
          sender: 'Dana',
          fromEmail: 'dana@northwind.com',
          unread: true,
          isBulk: false,
          important: false,
          timestamp: '2026-06-22T08:00:00Z'
        }
      ]
    },
    tierOverrides: { 'dana@northwind.com': 'vip' }
  });
  const reply = rail.find((group) => group.id === 'needs-reply');
  assert.deepEqual(
    reply.rows.map((row) => row.id),
    ['reply-vip', 'reply-imp'],
    'VIP-corrected sender ranks above IMPORTANT'
  );
  assert.equal(reply.rows[0].badge, 'VIP', 'VIP-corrected row carries the VIP badge');
});

test('an Ignore correction removes that sender from needs-a-reply entirely', () => {
  const rail = buildWorkbenchStateRail({
    inbox: {
      messages: [
        {
          id: 'keep',
          subject: 'Renewal',
          sender: 'Dana',
          fromEmail: 'dana@northwind.com',
          unread: true,
          isBulk: false,
          important: false,
          timestamp: '2026-06-22T09:00:00Z'
        },
        // even though IMPORTANT + newest, an ignore correction drops it
        {
          id: 'drop',
          subject: 'FYI roundup',
          sender: 'Auto',
          fromEmail: 'noreply@vendor.com',
          unread: true,
          isBulk: false,
          important: true,
          timestamp: '2026-06-22T10:00:00Z'
        }
      ]
    },
    tierOverrides: { 'noreply@vendor.com': 'ignore' }
  });
  const reply = rail.find((group) => group.id === 'needs-reply');
  assert.deepEqual(
    reply.rows.map((row) => row.id),
    ['reply-keep'],
    'ignore-corrected sender is suppressed'
  );
});

test('tier corrections match the sender email case-insensitively', () => {
  const rail = buildWorkbenchStateRail({
    inbox: {
      messages: [
        {
          id: 'x',
          subject: 'hi',
          sender: 'Dana',
          fromEmail: 'Dana@Northwind.com',
          unread: true,
          isBulk: false,
          important: false,
          timestamp: '2026-06-22T09:00:00Z'
        }
      ]
    },
    tierOverrides: { 'dana@northwind.com': 'respond' }
  });
  const reply = rail.find((group) => group.id === 'needs-reply');
  assert.equal(
    reply.rows[0].badge,
    'Respond',
    'respond correction applied despite mixed-case email'
  );
  assert.equal(reply.rows[0].replyRank, 2, 'respond outranks IMPORTANT (1)');
});

test('workbench rail surfaces Slack blockers as their own group, recency-preserving', () => {
  const rail = buildWorkbenchStateRail({
    slackBlockers: [
      {
        id: 't1',
        who: 'cameron',
        channel: 'gtm',
        when: '10:00',
        text: 'Launch copy is blocked on pricing approval',
        permalink: 'https://near-foundation.slack.com/archives/C1/p1'
      },
      {
        id: 't2',
        who: 'joe',
        channel: 'bug-bash',
        when: '09:00',
        text: 'QA is stuck waiting on the staging deploy',
        permalink: 'https://near-foundation.slack.com/archives/C2/p2'
      }
    ]
  });
  const slack = rail.find((group) => group.id === 'slack');
  assert.ok(slack, 'slack group present');
  assert.equal(slack.total, 2);
  assert.deepEqual(
    slack.rows.map((row) => row.id),
    ['slack-t1', 'slack-t2'],
    'API recency order preserved'
  );
  assert.equal(slack.rows[0].title, 'Launch copy is blocked on pricing approval');
  assert.equal(slack.rows[0].badge, '#gtm', 'channel becomes the badge');
  assert.equal(slack.rows[0].detail, 'From @cameron in #gtm');
  assert.equal(
    slack.rows[0].href,
    'https://near-foundation.slack.com/archives/C1/p1',
    'permalink opens the message'
  );
});

test('workbench Slack group degrades to an honest empty state with no blockers', () => {
  const rail = buildWorkbenchStateRail({ slackBlockers: [] });
  const slack = rail.find((group) => group.id === 'slack');
  assert.ok(slack, 'group still present');
  assert.equal(slack.total, 0);
  assert.deepEqual(slack.rows, []);
  assert.equal(slack.emptyTitle, 'No Slack blockers.');
});

test('workbench Slack rows truncate long messages and never fabricate a row', () => {
  const long = 'x'.repeat(200);
  const rail = buildWorkbenchStateRail({
    slackBlockers: [
      { id: 'a', who: '', channel: '', when: '', text: long, permalink: '' },
      { id: 'b', who: 'kai', channel: 'eng', when: '', text: '', permalink: '' } // empty text -> dropped
    ]
  });
  const slack = rail.find((group) => group.id === 'slack');
  assert.equal(slack.total, 1, 'empty-text row dropped');
  assert.ok(slack.rows[0].title.endsWith('…'), 'long text truncated');
  assert.equal(slack.rows[0].title.length, 90, 'truncated to 90 chars incl. ellipsis');
  assert.equal(slack.rows[0].detail, 'In Slack', 'no sender/channel -> generic detail');
  assert.equal(slack.rows[0].href, undefined, 'no permalink -> no href');
});

test('workbench rail surfaces GitHub notifications as their own group', () => {
  const rail = buildWorkbenchStateRail({
    githubNotifications: [
      {
        id: 'n1',
        title: 'Approve the routing scheduler fix',
        kind: 'PullRequest',
        reason: 'review_requested',
        repo: 'nearai/ironclaw',
        when: '10:00',
        link: 'https://github.com/nearai/ironclaw/pull/1'
      },
      {
        id: 'n2',
        title: 'CI failed on fix/routing',
        kind: 'CheckSuite',
        reason: 'ci_activity',
        repo: 'nearai/ironclaw',
        when: '09:00',
        link: 'https://github.com/nearai/ironclaw/actions'
      }
    ]
  });
  const github = rail.find((group) => group.id === 'github');
  assert.ok(github, 'github group present');
  assert.equal(github.total, 2);
  assert.equal(github.rows[0].title, 'Approve the routing scheduler fix');
  assert.equal(github.rows[0].badge, 'PullRequest', 'subject type becomes the badge');
  assert.equal(
    github.rows[0].detail,
    'review requested · nearai/ironclaw',
    'reason (de-underscored) + repo'
  );
  assert.equal(github.rows[0].href, 'https://github.com/nearai/ironclaw/pull/1');
  assert.equal(github.rows[0].icon, 'spark', 'matches the briefing GitHub icon');
});

test('workbench GitHub group ranks by reason — review requests above digest/subscribed mentions', () => {
  const rail = buildWorkbenchStateRail({
    githubNotifications: [
      // newsletter-as-GitHub: a bot digest @-mention (reason: mention) on a repo you don't own
      {
        id: 'spam',
        title: '🦞 Daily ecosystem digest 2026-06-20',
        kind: 'Issue',
        reason: 'mention',
        repo: 'thirdparty/agents-radar',
        when: '11:00',
        link: 'https://github.com/x/1'
      },
      // a passive subscribed-thread update
      {
        id: 'sub',
        title: 'Thread you follow updated',
        kind: 'Issue',
        reason: 'subscribed',
        repo: 'nearai/ironclaw',
        when: '10:30',
        link: 'https://github.com/x/2'
      },
      // a genuine action item, oldest — must still rank first
      {
        id: 'req',
        title: 'Please review the scheduler fix',
        kind: 'PullRequest',
        reason: 'review_requested',
        repo: 'nearai/ironclaw',
        when: '08:00',
        link: 'https://github.com/x/3'
      }
    ]
  });
  const github = rail.find((group) => group.id === 'github');
  assert.deepEqual(
    github.rows.map((row) => row.id),
    ['github-req', 'github-spam', 'github-sub'],
    'review_requested floats to the top; subscribed sinks; digest mention in the middle'
  );
  assert.equal(github.rows[0].githubRank, 5, 'review_requested ranks highest');
  assert.equal(github.rows[2].githubRank, 1, 'subscribed ranks lowest');
});

test('workbench GitHub group degrades to an honest empty state with no activity', () => {
  const rail = buildWorkbenchStateRail({ githubNotifications: [] });
  const github = rail.find((group) => group.id === 'github');
  assert.ok(github, 'group still present');
  assert.equal(github.total, 0);
  assert.deepEqual(github.rows, []);
  assert.equal(github.emptyTitle, 'No GitHub activity.');
});

test('workbench GitHub rows truncate long titles and drop title-less notifications', () => {
  const long = 'y'.repeat(200);
  const rail = buildWorkbenchStateRail({
    githubNotifications: [
      { id: 'a', title: long, kind: '', reason: '', repo: '', when: '', link: '' },
      { id: 'b', title: '', kind: 'Issue', reason: 'mention', repo: 'x/y', when: '', link: '' } // no title -> dropped
    ]
  });
  const github = rail.find((group) => group.id === 'github');
  assert.equal(github.total, 1, 'title-less notification dropped');
  assert.ok(github.rows[0].title.endsWith('…'), 'long title truncated');
  assert.equal(github.rows[0].title.length, 90);
  assert.equal(github.rows[0].badge, 'GitHub', 'no subject type -> generic badge');
  assert.equal(github.rows[0].detail, 'On GitHub', 'no reason/repo -> generic detail');
  assert.equal(github.rows[0].href, undefined, 'no link -> no href');
});

test('workbench rail surfaces recent Notion pages and Drive files as awareness groups', () => {
  const rail = buildWorkbenchStateRail({
    notionPages: [
      { id: 'p1', title: 'Q2 Management Meeting', url: 'https://notion.so/p1', when: '11:41 AM' },
      { id: 'p2', title: '', url: '', when: '' } // no title/url -> still filtered by title here
    ],
    driveFiles: [
      {
        id: 'd1',
        name: 'JASON Levels.xlsx',
        kind: 'Sheet',
        when: '4:11 PM',
        link: 'https://docs.google.com/d1'
      }
    ]
  });
  const notion = rail.find((group) => group.id === 'notion');
  const drive = rail.find((group) => group.id === 'drive');
  assert.equal(notion.total, 1, 'title-less notion page dropped');
  assert.equal(notion.rows[0].title, 'Q2 Management Meeting');
  assert.equal(notion.rows[0].badge, 'Notion');
  assert.equal(notion.rows[0].detail, 'Edited 11:41 AM');
  // Notion rows open the in-app viewer: no external href; carry the page id +
  // url for the read + the "Open in Notion" fallback.
  assert.equal(notion.rows[0].href, undefined, 'no external href — opens in-app');
  assert.equal(notion.rows[0].pageId, 'p1');
  assert.equal(notion.rows[0].pageUrl, 'https://notion.so/p1');
  assert.equal(notion.rows[0].icon, 'file');
  assert.equal(drive.total, 1);
  assert.equal(drive.rows[0].title, 'JASON Levels.xlsx');
  assert.equal(drive.rows[0].badge, 'Sheet', 'mime-derived kind becomes the badge');
  assert.equal(drive.rows[0].detail, 'Modified 4:11 PM');
  assert.equal(drive.rows[0].href, 'https://docs.google.com/d1');
  assert.equal(drive.rows[0].icon, 'folder');
});

test('a Drive Google Doc opens the in-app viewer (drivedoc); other types stay external', () => {
  const rail = buildWorkbenchStateRail({
    driveFiles: [
      {
        id: 'doc1',
        name: 'IronClaw Use Cases',
        kind: 'Doc',
        mimeType: 'application/vnd.google-apps.document',
        when: '7:06 AM',
        link: 'https://docs.google.com/document/d/doc1'
      },
      {
        id: 'sheet1',
        name: 'BD Data',
        kind: 'Sheet',
        mimeType: 'application/vnd.google-apps.spreadsheet',
        when: '6:00 AM',
        link: 'https://docs.google.com/spreadsheets/d/sheet1'
      }
    ]
  });
  const drive = rail.find((group) => group.id === 'drive');
  const docRow = drive.rows.find((row) => row.id === 'drive-doc1');
  const sheetRow = drive.rows.find((row) => row.id === 'drive-sheet1');
  assert.equal(docRow.kind, 'drivedoc', 'Google Doc opens the in-app viewer');
  assert.equal(docRow.href, undefined, 'no external href for the Doc');
  assert.equal(docRow.docId, 'doc1');
  assert.equal(docRow.docUrl, 'https://docs.google.com/document/d/doc1');
  assert.equal(sheetRow.kind, 'drive', 'a Sheet stays a plain external drive row');
  assert.equal(sheetRow.href, 'https://docs.google.com/spreadsheets/d/sheet1');
});

test('workbench Notion/Drive groups degrade to honest empty states with no data', () => {
  const rail = buildWorkbenchStateRail({ notionPages: [], driveFiles: [] });
  const notion = rail.find((group) => group.id === 'notion');
  const drive = rail.find((group) => group.id === 'drive');
  assert.equal(notion.total, 0);
  assert.deepEqual(notion.rows, []);
  assert.equal(notion.emptyDetail, 'Recently edited Notion pages will appear here.');
  assert.equal(drive.total, 0);
  assert.deepEqual(drive.rows, []);
  assert.equal(drive.emptyDetail, 'Recently modified Drive files will appear here.');
});
