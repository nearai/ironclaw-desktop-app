import assert from 'node:assert/strict';
import test from 'node:test';

import {
  automationToRoutine,
  fetchRoutines,
  fetchRoutinesSummary,
  routineSummary,
  triggerRoutine
} from './routines-api.js';

function setupFetch(body) {
  const calls = [];
  globalThis.sessionStorage = {
    getItem: () => 'token-1',
    setItem: () => {},
    removeItem: () => {}
  };
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  return calls;
}

test('fetchRoutines reads real v2 schedule automations instead of returning TODO stubs', async () => {
  const calls = setupFetch({
    scheduler_enabled: true,
    automations: [
      {
        automation_id: 'calendar-prep',
        name: 'Calendar prep assistant',
        source: { type: 'schedule', cron: '*/30 * * * *', timezone: 'America/Toronto' },
        state: 'active',
        next_run_at: '2026-06-19T14:30:00Z',
        recent_runs: [{ status: 'ok', completed_at: '2026-06-19T14:00:00Z' }]
      },
      {
        automation_id: 'webhook-only',
        name: 'Webhook only',
        source: { type: 'webhook' },
        state: 'active'
      }
    ]
  });

  const response = await fetchRoutines();

  assert.equal(calls[0].path, '/api/webchat/v2/automations?limit=50&run_limit=25');
  assert.equal(response.todo, false);
  assert.equal(response.scheduler_enabled, true);
  assert.equal(response.routines.length, 1);
  assert.deepEqual(response.routines[0], {
    id: 'calendar-prep',
    name: 'Calendar prep assistant',
    description: 'Every 30 minutes',
    enabled: true,
    status: 'active',
    verification_status: 'verified',
    trigger_type: 'schedule',
    trigger_summary: 'Every 30 minutes',
    action_type: 'chat',
    next_fire_at: '2026-06-19T14:30:00Z',
    last_run_at: '2026-06-19T14:00:00Z',
    run_count: 1,
    recent_runs: response.routines[0].recent_runs,
    source_automation: response.routines[0].source_automation
  });
});

test('automationToRoutine marks failed recent runs as failing and unverified', () => {
  const routine = automationToRoutine({
    automation_id: 'health-watch',
    display_name: 'Deployment health watcher',
    state: 'active',
    schedule_label: 'Every 5 minutes',
    recent_runs: [{ status: 'error', completed_at: '2026-06-19T14:00:00Z' }],
    latest_run: { status: 'error', completed_at: '2026-06-19T14:00:00Z' },
    has_failed_runs: true,
    has_running_run: false
  });

  assert.equal(routine.status, 'failing');
  assert.equal(routine.verification_status, 'unverified');
  assert.equal(routine.trigger_summary, 'Every 5 minutes');
});

test('fetchRoutinesSummary summarizes backed routine rows', async () => {
  setupFetch({
    automations: [
      {
        automation_id: 'ok',
        name: 'OK routine',
        source: { type: 'schedule', cron: '0 * * * *' },
        state: 'active',
        recent_runs: [{ status: 'ok', completed_at: new Date().toISOString() }]
      },
      {
        automation_id: 'bad',
        name: 'Bad routine',
        source: { type: 'schedule', cron: '*/5 * * * *' },
        state: 'active',
        recent_runs: [{ status: 'error', completed_at: new Date().toISOString() }]
      },
      {
        automation_id: 'paused',
        name: 'Paused routine',
        source: { type: 'schedule', cron: '0 9 * * *' },
        state: 'paused',
        recent_runs: []
      }
    ]
  });

  const summary = await fetchRoutinesSummary();

  assert.equal(summary.total, 3);
  assert.equal(summary.enabled, 2);
  assert.equal(summary.disabled, 1);
  assert.equal(summary.unverified, 1);
  assert.equal(summary.failing, 1);
  assert.equal(summary.runs_today, 2);
});

test('routine action controls fail honestly until writable v2 automation actions exist', async () => {
  await assert.rejects(triggerRoutine('calendar-prep'), /writable v2 automation action/);
});
