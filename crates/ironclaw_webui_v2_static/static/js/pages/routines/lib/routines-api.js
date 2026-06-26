import { listAutomations } from '../../../lib/automations-api.js';
import {
  automationSummary,
  normalizeAutomations
} from '../../automations/lib/automations-presenters.js';

const ROUTINES_PAGE_LIMIT = 50;
const ROUTINE_RUNS_LIMIT = 25;

export async function fetchRoutines() {
  const response = await listAutomations({
    limit: ROUTINES_PAGE_LIMIT,
    runLimit: ROUTINE_RUNS_LIMIT
  });
  const automations = normalizeAutomations(response);
  return {
    routines: automations.map(automationToRoutine),
    scheduler_enabled: response?.scheduler_enabled !== false,
    todo: false
  };
}

export async function fetchRoutinesSummary() {
  const response = await fetchRoutines();
  return routineSummary(response.routines);
}

export async function fetchRoutineDetail(routineId) {
  if (!routineId) return null;
  const response = await fetchRoutines();
  return response.routines.find((routine) => routine.id === routineId) || null;
}

export function triggerRoutine(_routineId) {
  return Promise.reject(new Error('Routine run controls require a writable v2 automation action.'));
}

export function toggleRoutine(_routineId) {
  return Promise.reject(
    new Error('Routine status controls require a writable v2 automation action.')
  );
}

export function deleteRoutine(_routineId) {
  return Promise.reject(new Error('Routine deletion requires a writable v2 automation action.'));
}

export function automationToRoutine(automation) {
  const enabled = isAutomationEnabled(automation);
  const status = automation.has_running_run
    ? 'running'
    : automation.has_failed_runs
      ? 'failing'
      : enabled
        ? 'active'
        : 'disabled';
  return {
    id: automation.automation_id,
    name: automation.display_name,
    description:
      automation.description ||
      automation.prompt ||
      automation.goal ||
      automation.schedule_label ||
      'Scheduled chat automation',
    enabled,
    status,
    verification_status: automation.has_failed_runs ? 'unverified' : 'verified',
    trigger_type: 'schedule',
    trigger_summary: automation.schedule_label,
    action_type: automation.target?.type || automation.action_type || 'chat',
    next_fire_at: automation.next_run_at,
    last_run_at: automation.latest_run?.completed_at || automation.last_run_at,
    run_count: automation.recent_runs.length,
    recent_runs: automation.recent_runs,
    source_automation: automation
  };
}

function isAutomationEnabled(automation) {
  const state = String(automation?.state || '').toLowerCase();
  return state !== 'paused' && state !== 'disabled' && state !== 'inactive';
}

export function routineSummary(routines = []) {
  const summary = automationSummary(routines.map((routine) => routine.source_automation || {}));
  return {
    total: routines.length,
    enabled: routines.filter((routine) => routine.enabled).length,
    disabled: routines.filter((routine) => !routine.enabled).length,
    unverified: routines.filter((routine) => routine.verification_status !== 'verified').length,
    failing: routines.filter((routine) => routine.status === 'failing').length,
    runs_today: routines.reduce((sum, routine) => sum + runsToday(routine.recent_runs), 0),
    nextRun: summary.nextRun || null
  };
}

function runsToday(runs = []) {
  const today = new Date().toISOString().slice(0, 10);
  return runs.filter((run) =>
    String(run.fired_at || run.completed_at || run.timestamp_source || '').startsWith(today)
  ).length;
}
