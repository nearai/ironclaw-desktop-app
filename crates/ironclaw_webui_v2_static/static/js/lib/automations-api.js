import { V2_BASE, apiFetch } from './api.js';

export function listAutomations({ limit, runLimit } = {}) {
  const params = new URLSearchParams();
  if (limit != null) params.set('limit', String(limit));
  if (runLimit != null) params.set('run_limit', String(runLimit));
  const query = params.toString();
  return apiFetch(`${V2_BASE}/automations${query ? `?${query}` : ''}`);
}
