import assert from 'node:assert/strict';
import test from 'node:test';

import { THREAD_STATE } from '../../../lib/thread-state.js';
import { buildFrontDoorData, relativeAge } from './frontdoor-data.js';

const now = Date.parse('2026-06-13T18:00:00.000Z');

test('buildFrontDoorData ranks backed needs-you threads before ordinary recent work', () => {
  const data = buildFrontDoorData({
    now,
    threadStates: new Map([
      ['legal-approval', THREAD_STATE.NEEDS_ATTENTION],
      ['failed-run', THREAD_STATE.FAILED]
    ]),
    threads: [
      {
        id: 'legal-approval',
        title: 'Legal review approval',
        updated_at: '2026-06-13T17:45:00.000Z',
        turn_count: 4
      },
      {
        id: 'recent-thread',
        title: 'Draft launch memo',
        updated_at: '2026-06-13T16:00:00.000Z',
        turn_count: 3
      },
      {
        id: 'failed-run',
        title: 'Workspace sync recovery',
        updated_at: '2026-06-13T17:50:00.000Z',
        turn_count: 2
      }
    ],
    automations: []
  });

  assert.deepEqual(
    data.needsYou.map((item) => [item.title, item.badge, item.href]),
    [
      ['Workspace sync recovery', 'Needs recovery', '/chat/failed-run'],
      ['Legal review approval', 'Needs approval', '/chat/legal-approval']
    ]
  );
  assert.deepEqual(
    data.handled.map((item) => item.title),
    ['Draft launch memo']
  );
  assert.equal(data.handled[0].badge, 'Recent work');
});

test('buildFrontDoorData surfaces completed automation receipts without faking failed ones', () => {
  const data = buildFrontDoorData({
    now,
    threads: [],
    automations: [
      {
        id: 'daily-digest',
        display_name: 'Daily digest',
        last_status: 'ok',
        last_run_at: '2026-06-13T17:30:00.000Z',
        last_run_label: 'Jun 13, 05:30 PM'
      },
      {
        id: 'broken-digest',
        display_name: 'Broken digest',
        last_status: 'error',
        last_run_at: '2026-06-13T17:50:00.000Z'
      }
    ]
  });

  assert.equal(data.needsYou.length, 0);
  assert.equal(data.handled.length, 1);
  assert.equal(data.handled[0].title, 'Daily digest');
  assert.equal(data.handled[0].badge, 'Completed');
  assert.equal(data.handled[0].href, '/automations');
});

test('relativeAge keeps the front door compact', () => {
  assert.equal(relativeAge('2026-06-13T17:59:00.000Z', now), '1m ago');
  assert.equal(relativeAge('2026-06-13T16:00:00.000Z', now), '2h ago');
  assert.equal(relativeAge('2026-06-11T18:00:00.000Z', now), '2d ago');
  assert.equal(relativeAge('', now), '');
});
