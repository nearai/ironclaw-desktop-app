// Pure normalizer for GitHub notification reads on the Workbench.
//
// Unlike a synthesized briefing, this is an on-demand read: the chip runs a
// single read-only route (GITHUB_LIST_NOTIFICATIONS_FOR_THE_AUTHENTICATED_USER)
// and renders the real unread notifications with a deep link to each repo/thread.
// No agent, no model round-trip. Honest framing: these are the user's actual
// GitHub notifications — surfaced for them to judge — not an LLM's verdict.
//
// Side-effect free and resilient: malformed or empty payloads degrade to an
// honest empty result, never to a fabricated row. The sidecar holds the Composio
// credential; the key never reaches the browser.

import { formatInboxWhen } from './workbench-connectors.js';

// How many notification rows the Workbench surfaces by default.
export const GITHUB_NOTIFICATION_LIMIT = 6;

function asString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Build a real GitHub link for a notification: prefer the repository's
// `html_url` when it is an http(s) URL, fall back to the repo's notifications-
// style URL when a repo slug is present, and finally to the global
// notifications page. Returns a usable URL so the card never renders a dead link.
function readLink(repoUrl, repo) {
  if (/^https?:\/\//i.test(repoUrl)) return repoUrl;
  if (repo) return `https://github.com/${repo}`;
  return 'https://github.com/notifications';
}

// Normalize a GITHUB_LIST_NOTIFICATIONS_FOR_THE_AUTHENTICATED_USER read into
// notification rows: `{ id, title, kind, reason, repo, when, link }`. Honest
// contract: [] on any unsuccessful/empty/malformed payload; never fabricates a
// row; drops entries with no usable subject title.
export function normalizeGithubNotifications(result, { limit = GITHUB_NOTIFICATION_LIMIT } = {}) {
  if (!result || result.successful === false) return [];
  const data = result.data || result;
  const details = data?.details;
  if (!Array.isArray(details)) return [];
  const rows = [];
  for (const entry of details) {
    if (!entry || typeof entry !== 'object') continue;
    const subject = entry.subject || {};
    const title = asString(subject.title);
    if (!title) continue;
    const repository = entry.repository || {};
    const repo = asString(repository.full_name);
    rows.push({
      id: asString(entry.id) || `${repo}:${title.slice(0, 24)}`,
      title,
      kind: asString(subject.type),
      reason: asString(entry.reason),
      repo,
      when: formatInboxWhen(entry.updated_at),
      link: readLink(asString(repository.html_url), repo)
    });
    if (rows.length >= limit) break;
  }
  return rows;
}
