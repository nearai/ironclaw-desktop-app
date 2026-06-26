// Read client for the jarvis (pm-backend) project-management surface. The endpoint is
// served by the gateway in the packaged app and by the standalone dev harness today
// (scripts/jarvis-proxy.mjs); either way the credential stays server-side. Read-only.
//
// Honest contract: returns { configured, projects, outstanding, commitments, error }.
// `configured:false` means no jarvis credential is wired — the surface shows a connect
// hint rather than an error.

import { apiFetch } from '../../../lib/api.js';

export async function fetchJarvisSummary() {
  const data = await apiFetch('/api/jarvis/summary');
  return {
    configured: Boolean(data && data.configured),
    error: String((data && data.error) || ''),
    projects: Array.isArray(data && data.projects) ? data.projects : [],
    outstanding: Array.isArray(data && data.outstanding) ? data.outstanding : [],
    commitments: Array.isArray(data && data.commitments) ? data.commitments : []
  };
}

// Commitments the user must act on: pending approvals first, then everything still open
// (not done/canceled), newest kept in the order the backend returned. Pure + tested.
export function actionableCommitments(commitments) {
  const list = Array.isArray(commitments) ? commitments : [];
  const open = list.filter((c) => c && c.state && c.state !== 'done' && c.state !== 'canceled');
  const rank = (c) => (c.needsApproval || c.state === 'needs_approval' ? 0 : 1);
  return open.slice().sort((a, b) => rank(a) - rank(b));
}

// A short, human label for a commitment state.
export function commitmentStateLabel(state) {
  const map = {
    needs_approval: 'Needs approval',
    todo: 'To do',
    in_progress: 'In progress',
    blocked: 'Blocked',
    done: 'Done',
    canceled: 'Canceled'
  };
  return map[String(state || '')] || String(state || '').replace(/_/g, ' ') || 'Open';
}
