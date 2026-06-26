import { V2_BASE, apiFetch } from './api.js';

export function queryOperatorLogs({
  limit,
  cursor,
  level,
  target,
  threadId,
  runId,
  turnId,
  toolCallId,
  toolName,
  source
} = {}) {
  const url = new URL(`${V2_BASE}/operator/logs`, window.location.origin);
  if (limit != null) url.searchParams.set('limit', String(limit));
  if (cursor) url.searchParams.set('cursor', cursor);
  if (level) url.searchParams.set('level', level);
  if (target) url.searchParams.set('target', target);
  if (threadId) url.searchParams.set('thread_id', threadId);
  if (runId) url.searchParams.set('run_id', runId);
  if (turnId) url.searchParams.set('turn_id', turnId);
  if (toolCallId) url.searchParams.set('tool_call_id', toolCallId);
  if (toolName) url.searchParams.set('tool_name', toolName);
  if (source) url.searchParams.set('source', source);
  return apiFetch(url.pathname + url.search);
}
