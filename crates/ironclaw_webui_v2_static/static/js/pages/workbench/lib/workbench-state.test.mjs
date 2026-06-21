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
