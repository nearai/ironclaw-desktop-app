import { useQuery } from '@tanstack/react-query';
import { Icon } from '../../../design-system/icons.js';
import { React, html } from '../../../lib/html.js';
import { cn } from '../../../utils/cn.js';
import {
  fetchJarvisSummary,
  actionableCommitments,
  commitmentStateLabel
} from '../lib/jarvis-api.js';

// jarvis (pm-backend) surface inside the Workbench: the project-management layer —
// what you owe, what's owed to you, and the active projects — read live from jarvis.
// Read-only here; creating/updating commitments stays an explicit, gated action.

function statePillClass(commitment) {
  if (commitment.needsApproval || commitment.state === 'needs_approval') return 'is-decision';
  if (commitment.state === 'blocked') return 'is-blocked';
  if (commitment.state === 'done') return 'is-done';
  if (commitment.state === 'in_progress') return 'is-working';
  return 'is-reply';
}

function dueLabel(dueDate) {
  const value = String(dueDate || '').trim();
  if (!value) return '';
  return `Due ${value.slice(0, 10)}`;
}

function CommitmentCard({ commitment }) {
  const meta = [commitment.shortId, dueLabel(commitment.dueDate)].filter(Boolean).join(' · ');
  return html`
    <div className="wb13-card wb13-card-readable">
      <div className="wb13-card-main">
        <div className="wb13-card-status">
          <span className=${cn('wb13-status-pill', statePillClass(commitment))}>
            ${commitmentStateLabel(commitment.state)}
          </span>
          ${meta ? html`<span className="wb13-card-when">${meta}</span>` : null}
        </div>
        <div className="wb13-card-title">${commitment.title || 'Untitled commitment'}</div>
      </div>
    </div>
  `;
}

function CommitmentList({ items, testid }) {
  return html`<div className="wb13-section wb13-list" data-testid=${testid}>
    ${items.map(
      (c, i) => html`<${CommitmentCard} key=${c.id || c.shortId || `c-${i}`} commitment=${c} />`
    )}
  </div>`;
}

export function JarvisView() {
  const query = useQuery({
    queryKey: ['workbench-jarvis-summary'],
    queryFn: fetchJarvisSummary,
    staleTime: 60_000,
    retry: 1,
    throwOnError: false
  });

  const data = query.data || { configured: false, projects: [], outstanding: [], commitments: [] };
  const loading = query.isLoading;
  // A failed fetch (network / gateway down) must read as an error, NOT as
  // "not connected" — those are different situations and the user fixes them differently.
  const fetchFailed = query.isError;
  const outstanding = data.outstanding || [];
  const open = actionableCommitments(data.commitments);
  const projects = data.projects || [];

  return html`
    <main className="wb13-main">
      <div className="wb13-page">
        <div className="wb13-wrap">
          <div className="wb13-triage-head">
            <h2>Projects</h2>
            <span className="count">jarvis · pm-backend</span>
          </div>

          ${loading
            ? html`<div className="wb13-section wb13-list" data-testid="workbench-jarvis-skeleton">
                ${[0, 1, 2].map(
                  (i) =>
                    html`<div key=${i} className="wb13-card wb13-skel-card">
                      <div className="wb13-card-main">
                        <div className="wb13-skel-line is-pill"></div>
                        <div className="wb13-skel-line is-title"></div>
                      </div>
                    </div>`
                )}
              </div>`
            : fetchFailed
              ? html`<div className="wb13-reader-note is-error" role="alert">
                  <${Icon} name="flag" /><span
                    >jarvis could not be reached. Check the connection and try again.</span
                  >
                </div>`
              : !data.configured
                ? html`<div className="wb13-allclear" data-testid="workbench-jarvis-unconfigured">
                    jarvis is not connected yet. Add the jarvis credential to surface your
                    commitments, projects, and decisions here.
                  </div>`
                : data.error
                  ? html`<div className="wb13-reader-note is-error" role="alert">
                      <${Icon} name="flag" /><span>jarvis could not be reached: ${data.error}</span>
                    </div>`
                  : html`
                      <div className="wb13-section-label">
                        <${Icon} name="check" /> Owed to you
                        <span className="wb13-section-count">${outstanding.length}</span>
                      </div>
                      ${outstanding.length
                        ? html`<${CommitmentList}
                            items=${outstanding}
                            testid="workbench-jarvis-outstanding"
                          />`
                        : html`<div className="wb13-allclear">
                            Nobody owes you an open commitment right now.
                          </div>`}

                      <div className="wb13-section-label">
                        <${Icon} name="spark" /> Your commitments
                        <span className="wb13-section-count">${open.length}</span>
                      </div>
                      ${open.length
                        ? html`<${CommitmentList}
                            items=${open}
                            testid="workbench-jarvis-commitments"
                          />`
                        : html`<div className="wb13-allclear">
                            No open commitments assigned to you.
                          </div>`}

                      <div className="wb13-section-label">
                        <${Icon} name="folder" /> Projects
                        <span className="wb13-section-count">${projects.length}</span>
                      </div>
                      <div
                        className="wb13-section wb13-list"
                        data-testid="workbench-jarvis-projects"
                      >
                        ${projects.map(
                          (p, i) =>
                            html`<div
                              key=${p.id || p.slug || `p-${i}`}
                              className="wb13-card wb13-card-readable"
                            >
                              <div className="wb13-card-main">
                                <div className="wb13-card-title">${p.name || p.slug}</div>
                                <div className="wb13-card-copy">
                                  ${[
                                    p.lead ? `Lead: ${p.lead}` : '',
                                    p.openIssueCount ? `${p.openIssueCount} open` : ''
                                  ]
                                    .filter(Boolean)
                                    .join(' · ') || 'Active project'}
                                </div>
                              </div>
                            </div>`
                        )}
                      </div>
                    `}
        </div>
      </div>
    </main>
  `;
}
