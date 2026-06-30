import assert from 'node:assert/strict';
import test from 'node:test';

import {
  automationSummary,
  filterAutomations,
  normalizeAutomations,
  runSummaryView,
  scheduleLabel,
  stateTone
} from './automations-presenters.js';

test('normalizeAutomations keeps only schedule rows and avoids raw schedule text', () => {
  const automations = normalizeAutomations({
    automations: [
      {
        automation_id: 'daily',
        name: 'Daily summary',
        source: { type: 'schedule', cron: '0 9 * * 1-5' },
        state: 'active',
        is_active: true,
        next_run_at: '2026-06-05T16:00:00Z',
        last_run_at: '2026-06-04T16:01:00Z',
        last_status: 'ok'
      },
      {
        automation_id: 'future-webhook',
        name: 'Future webhook',
        source: { type: 'webhook' },
        state: 'active',
        is_active: true
      }
    ]
  });

  assert.equal(automations.length, 1);
  assert.equal(automations[0].display_name, 'Daily summary');
  assert.equal(automations[0].schedule_label, 'Weekdays at 9:00 AM');
  assert.equal(automations[0].last_status_label, 'Done');
});

test('normalizeAutomations folds recent runs into status, links, and success rate', () => {
  const automations = normalizeAutomations({
    automations: [
      {
        automation_id: 'daily',
        name: 'Daily summary',
        source: { type: 'schedule', cron: '0 9 * * *', timezone: 'America/Toronto' },
        state: 'active',
        recent_runs: [
          {
            status: 'error',
            fired_at: '2026-06-05T13:00:00Z',
            completed_at: '2026-06-05T13:02:00Z',
            thread_id: 'thread-failed',
            run_id: 'run-failed'
          },
          {
            status: 'ok',
            fired_at: '2026-06-04T13:00:00Z',
            completed_at: '2026-06-04T13:01:00Z',
            thread_id: 'thread-ok'
          },
          {
            status: 'running',
            fired_at: '2026-06-06T13:00:00Z',
            thread_id: 'thread-running'
          }
        ]
      }
    ]
  });

  assert.equal(automations[0].has_running_run, true);
  assert.equal(automations[0].has_failed_runs, true);
  assert.equal(automations[0].current_run.thread_id, 'thread-running');
  assert.equal(automations[0].recent_runs[0].status, 'running');
  assert.equal(automations[0].recent_runs[0].chat_path, '/chat/thread-running');
  assert.equal(automations[0].last_status_label, 'Error');
  assert.equal(automations[0].last_status_tone, 'danger');
  assert.equal(automations[0].success_rate_label, '50% successful');
  assert.deepEqual(runSummaryView(automations[0].recent_runs), {
    total: 3,
    totalText: '3 runs',
    chips: [
      { key: 'ok', tone: 'success', count: 1, text: '1 done' },
      { key: 'error', tone: 'danger', count: 1, text: '1 failed' },
      { key: 'running', tone: 'info', count: 1, text: '1 running' }
    ]
  });
});

test('runSummaryView localizes every counted run bucket including unknown', () => {
  const t = (key, params = {}) => {
    const copy = {
      'automations.runs.total': 'Recent runs: {count}',
      'automations.runs.ok': 'OK: {count}',
      'automations.runs.error': 'Failed: {count}',
      'automations.runs.running': 'Running: {count}',
      'automations.runs.unknown': 'Unknown: {count}'
    };
    return (copy[key] || key).replace('{count}', params.count);
  };
  const view = runSummaryView(
    [{ status: 'ok' }, { status: 'error' }, { status: 'running' }, { status: 'mystery' }, {}],
    t
  );

  assert.deepEqual(view, {
    total: 5,
    totalText: 'Recent runs: 5',
    chips: [
      { key: 'ok', tone: 'success', count: 1, text: 'OK: 1' },
      { key: 'error', tone: 'danger', count: 1, text: 'Failed: 1' },
      { key: 'running', tone: 'info', count: 1, text: 'Running: 1' },
      { key: 'unknown', tone: 'muted', count: 2, text: 'Unknown: 2' }
    ]
  });
  assert.equal(
    view.chips.reduce((sum, chip) => sum + chip.count, 0),
    view.total
  );
});

test('normalizeAutomations handles empty and malformed schedule payloads', () => {
  assert.deepEqual(normalizeAutomations(null), []);
  assert.deepEqual(normalizeAutomations({ automations: 'not-an-array' }), []);

  const automations = normalizeAutomations({
    automations: [
      {
        automation_id: 'partial',
        source: { type: 'schedule', cron: 'bad schedule value' },
        state: 'unexpected',
        is_active: false,
        next_run_at: 'not-a-date',
        last_run_at: null,
        created_at: null,
        last_status: 'unknown'
      }
    ]
  });

  assert.equal(automations.length, 1);
  assert.equal(automations[0].display_name, 'Untitled automation');
  assert.equal(automations[0].schedule_label, 'Custom schedule');
  assert.equal(automations[0].state_label, 'Unknown');
  assert.equal(automations[0].state_tone, 'muted');
  assert.equal(automations[0].next_run_label, 'Not scheduled');
  assert.equal(automations[0].last_run_label, 'No runs yet');
  assert.equal(automations[0].created_label, 'Unknown');
  assert.equal(automations[0].last_status_label, 'No result');
  assert.equal(automations[0].last_status_tone, 'muted');
});

test('scheduleLabel presents common recurring schedules in friendly language', () => {
  assert.equal(scheduleLabel('30 14 * * *'), 'Every day at 2:30 PM');
  assert.equal(scheduleLabel('0 30 14 * * *'), 'Every day at 2:30 PM');
  assert.equal(scheduleLabel('00 30 14 * * * *'), 'Every day at 2:30 PM');
  assert.equal(scheduleLabel('0 8 * * 1'), 'Mondays at 8:00 AM');
  assert.equal(scheduleLabel('0 8 * * MON'), 'Mondays at 8:00 AM');
  assert.equal(scheduleLabel('0 8 * * 7'), 'Sundays at 8:00 AM');
  assert.equal(scheduleLabel('0 9 * * MON-FRI'), 'Weekdays at 9:00 AM');
  assert.equal(scheduleLabel('0 17 1 * *'), '1st day of each month at 5:00 PM');
  assert.equal(scheduleLabel('0 17 11 * *'), '11th day of each month at 5:00 PM');
  assert.equal(scheduleLabel('0 17 12 * *'), '12th day of each month at 5:00 PM');
  assert.equal(scheduleLabel('0 17 13 * *'), '13th day of each month at 5:00 PM');
  assert.equal(scheduleLabel('0 0 9 1 1 * 2027'), 'Jan 1, 2027 at 9:00 AM');
  assert.equal(scheduleLabel('*/5 * * * *'), 'Every 5 minutes');
  assert.equal(scheduleLabel('* 0 9 * * *'), 'Custom schedule');
  assert.equal(scheduleLabel('0 24 * * *'), 'Custom schedule');
  assert.equal(scheduleLabel('0 0 32 * *'), 'Custom schedule');
  assert.equal(scheduleLabel('0 0 * 13 *'), 'Custom schedule');
});

test('filterAutomations, sorting, and summary use browser-visible active state', () => {
  const automations = normalizeAutomations({
    automations: [
      {
        automation_id: 'active',
        name: 'Active',
        source: { type: 'schedule', cron: '0 9 * * *' },
        state: 'active',
        is_active: false,
        next_run_at: '2026-06-05T17:00:00Z'
      },
      {
        automation_id: 'scheduled',
        name: 'Scheduled',
        source: { type: 'schedule', cron: '0 10 * * *' },
        state: 'scheduled',
        is_active: false,
        next_run_at: '2026-06-05T16:00:00Z'
      },
      {
        automation_id: 'paused',
        name: 'Paused',
        source: { type: 'schedule', cron: '0 11 * * *' },
        state: 'paused',
        is_active: true,
        next_run_at: '2026-06-05T18:00:00Z'
      }
    ]
  });

  assert.deepEqual(
    automations.map((automation) => automation.automation_id),
    ['scheduled', 'active', 'paused']
  );
  assert.deepEqual(
    filterAutomations(automations, 'active').map((automation) => automation.automation_id),
    ['scheduled', 'active']
  );
  assert.deepEqual(
    filterAutomations(automations, 'paused').map((automation) => automation.automation_id),
    ['paused']
  );
  assert.deepEqual(filterAutomations(automations, 'running'), []);
  assert.deepEqual(filterAutomations(automations, 'failures'), []);
  assert.deepEqual(automationSummary(automations), {
    scheduled: 3,
    active: 2,
    running: 0,
    failures: 0,
    paused: 1,
    nextRun: automations[0].next_run_label
  });
});

test('automationSummary ignores unparseable next_run_at values', () => {
  const automations = normalizeAutomations({
    automations: [
      {
        automation_id: 'invalid-next-run',
        name: 'Invalid next run',
        source: { type: 'schedule', cron: '0 9 * * *' },
        state: 'scheduled',
        is_active: false,
        next_run_at: 'not-a-date'
      }
    ]
  });

  assert.equal(automations[0].next_run_label, 'Not scheduled');
  assert.deepEqual(automationSummary(automations), {
    scheduled: 1,
    active: 1,
    running: 0,
    failures: 0,
    paused: 0,
    nextRun: null
  });
});

test('enabled states use agent-gold attribution, never the live success tone', () => {
  // Status truth: an enabled-but-idle schedule must not borrow the success tone
  // (which the Badge renders identically to a completed "Done" run, with a live
  // breathing dot). Agent-owned scheduled work is gold; only a real completed
  // run keeps success. Paused/disabled read as warning; unknown stays muted.
  assert.equal(stateTone('active'), 'gold');
  assert.equal(stateTone('scheduled'), 'gold');
  assert.notEqual(stateTone('active'), 'signal');
  assert.notEqual(stateTone('active'), 'success');
  assert.equal(stateTone('paused'), 'warning');
  assert.equal(stateTone('disabled'), 'warning');
  assert.equal(stateTone('inactive'), 'warning');
  assert.equal(stateTone('completed'), 'success');
  assert.equal(stateTone('unknown'), 'muted');

  const automations = normalizeAutomations({
    automations: [
      {
        automation_id: 'enabled',
        name: 'Enabled',
        source: { type: 'schedule', cron: '0 9 * * *' },
        state: 'active',
        next_run_at: '2026-06-15T13:00:00Z',
        last_run_at: '2026-06-14T13:00:00Z',
        last_status: 'ok'
      }
    ]
  });
  // The row carries gold attribution for its enabled state while a genuinely
  // completed last run keeps the success tone — the two truths stay distinct.
  assert.equal(automations[0].state_tone, 'gold');
  assert.equal(automations[0].last_status_tone, 'success');
});

test('normalizeAutomations preserves explicit unknown state even when is_active is true', () => {
  const automations = normalizeAutomations({
    automations: [
      {
        automation_id: 'unknown-active',
        name: 'Unknown active',
        source: { type: 'schedule', cron: '0 9 * * *' },
        state: 'unknown',
        is_active: true
      }
    ]
  });

  assert.equal(automations[0].state_label, 'Unknown');
  assert.equal(automations[0].state_tone, 'muted');
});
