import { React, html } from '../../../lib/html.js';
import {
  redlineClauses,
  resolvedText,
  buildRedlineHtml,
  clauseDegraded
} from '../lib/workbench-redline.js';

// Tracked-changes redline (legal #2, slices D2–D3). Paste an original and a revised version;
// redlineClauses aligns them clause-by-clause and this renders the word-level diff — insertions
// underlined/green, deletions struck-through/red — with a per-clause kind chip. Each changed clause
// can be accepted (take the revision) or rejected (keep the original); "Copy resolved text" copies
// the resulting document to the clipboard. READ-ONLY — nothing is sent or written to a file (a
// later slice adds a server-side tracked-changes docx export, behind the send checkpoint).
const KIND_LABEL = {
  unchanged: 'Unchanged',
  modified: 'Modified',
  added: 'Added',
  removed: 'Removed'
};

const REDLINE_STYLE = `
  .wb13-rl-entry { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; max-width: 920px; }
  .wb13-rl-pane { flex: 1; min-width: 240px; display: flex; flex-direction: column; gap: 6px; }
  .wb13-rl-pane label { font-size: 10.5px; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase; color: var(--wb-muted); }
  .wb13-rl-pane textarea {
    min-height: 150px;
    padding: 11px 13px;
    border: 1px solid var(--wb-line);
    border-radius: 12px;
    background: var(--wb-input, var(--wb-surface));
    color: var(--wb-ink);
    font: 13px/1.5 var(--wb-font-body);
    resize: vertical;
  }
  .wb13-rl-pane textarea:focus-visible { outline: 2px solid var(--wb-accent, var(--wb-ink)); outline-offset: 1px; }
  .wb13-rl-summary { font-size: 13px; color: var(--wb-muted); margin-bottom: 12px; max-width: 920px; }
  .wb13-rl-degraded {
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--wb-warn-text, var(--wb-muted));
    max-width: 920px;
    margin: -4px 0 12px;
    padding: 9px 12px;
    border: 1px solid var(--wb-warn-line, var(--wb-line));
    border-radius: 10px;
    background: var(--wb-warn-soft, transparent);
  }
  .wb13-rl-list { display: flex; flex-direction: column; gap: 8px; max-width: 920px; }
  .wb13-rl-clause {
    border: 1px solid var(--wb-line);
    border-radius: 12px;
    background: var(--wb-surface);
    padding: 12px 14px;
  }
  .wb13-rl-clause.is-unchanged { opacity: 0.62; }
  .wb13-rl-head { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
  .wb13-rl-decide { margin-left: auto; display: inline-flex; gap: 4px; }
  .wb13-rl-decide button {
    font-size: 11px;
    font-weight: 600;
    padding: 3px 9px;
    border: 1px solid var(--wb-line);
    border-radius: 999px;
    background: transparent;
    color: var(--wb-muted);
    cursor: pointer;
  }
  .wb13-rl-decide button[aria-pressed='true'].is-accept { color: var(--wb-good-text, var(--wb-good)); border-color: var(--wb-good-line, var(--wb-good)); }
  .wb13-rl-decide button[aria-pressed='true'].is-reject { color: var(--wb-danger); border-color: var(--wb-danger); }
  .wb13-rl-clause.is-rejected { border-style: dashed; }
  .wb13-rl-foot { display: flex; align-items: center; gap: 12px; margin-top: 14px; max-width: 920px; }
  .wb13-rl-foot .wb13-rl-count { font-size: 12.5px; color: var(--wb-muted); }
  .wb13-rl-chip {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    padding: 2px 7px;
    border-radius: 999px;
    color: var(--wb-muted);
    background: var(--wb-surface-2, transparent);
    border: 1px solid var(--wb-line);
  }
  .wb13-rl-chip.is-modified { color: var(--wb-warn-text, var(--wb-gold)); border-color: var(--wb-warn-line, var(--wb-line)); }
  .wb13-rl-chip.is-added { color: var(--wb-good-text, var(--wb-good)); border-color: var(--wb-good-line, var(--wb-line)); }
  .wb13-rl-chip.is-removed { color: var(--wb-danger); border-color: var(--wb-danger); }
  .wb13-rl-text { font: 13.5px/1.6 var(--wb-font-body); color: var(--wb-ink-2); white-space: pre-wrap; word-break: break-word; }
  .wb13-rl-ins { color: var(--wb-good-text, var(--wb-good)); text-decoration: underline; text-decoration-thickness: 1px; }
  .wb13-rl-del { color: var(--wb-danger); text-decoration: line-through; }
  .wb13-rl-empty {
    max-width: 560px;
    padding: 16px 18px;
    border: 1px solid var(--wb-line);
    border-radius: 14px;
    background: var(--wb-surface);
    font-size: 13px;
    line-height: 1.5;
    color: var(--wb-muted);
  }
  /* Touch: the accept/reject toggles are small on a fine pointer — give them a 44px target. */
  @media (pointer: coarse) {
    .wb13-rl-decide button { min-height: 44px; padding-left: 14px; padding-right: 14px; }
  }
`;

function ClauseText({ segments }) {
  const parts = Array.isArray(segments) ? segments : [];
  return html`<div className="wb13-rl-text">
    ${parts.map((seg, idx) => {
      if (seg.op === 'insert')
        return html`<ins key=${idx} className="wb13-rl-ins">${seg.text}</ins>`;
      if (seg.op === 'delete')
        return html`<del key=${idx} className="wb13-rl-del">${seg.text}</del>`;
      return html`<span key=${idx}>${seg.text}</span>`;
    })}
  </div>`;
}

export function RedlineView({ initialOriginal = '', initialRevised = '' }) {
  const [original, setOriginal] = React.useState(initialOriginal);
  const [revised, setRevised] = React.useState(initialRevised);
  const clauses = React.useMemo(() => redlineClauses(original, revised), [original, revised]);
  const [decisions, setDecisions] = React.useState({});
  const [copied, setCopied] = React.useState(false);
  const changedCount = clauses.filter((c) => c.changed).length;
  const anyDegraded = clauses.some(clauseDegraded);
  const hasInput = Boolean(original.trim() || revised.trim());
  const decisionFor = (id) => (decisions[id] === 'reject' ? 'reject' : 'accept');
  const setDecision = (id, value) => {
    setCopied(false);
    setDecisions((prev) => ({ ...prev, [id]: value }));
  };
  const rejectedCount = clauses.filter((c) => c.changed && decisionFor(c.id) === 'reject').length;
  const resolved = React.useMemo(() => resolvedText(clauses, decisions), [clauses, decisions]);
  const copyResolved = async () => {
    try {
      await navigator.clipboard.writeText(resolved);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  // Download the redline RECORD (all tracked changes) as a self-contained, printable HTML file —
  // a local download of content already on screen, no network. The escaped HTML is built in the lib.
  const downloadRedline = () => {
    try {
      const blob = new Blob([buildRedlineHtml(clauses, { title: 'Redline' })], {
        type: 'text/html'
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'redline.html';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      /* download unavailable in this environment */
    }
  };

  return html`
    <main className="wb13-main">
      <style>
        ${REDLINE_STYLE}
      </style>
      <div className="wb13-page">
        <div className="wb13-wide">
          <div className="wb13-head"><h1>Redline</h1></div>
          <div className="wb13-rl-entry">
            <div className="wb13-rl-pane">
              <label htmlFor="wb13-rl-original">Original</label>
              <textarea
                id="wb13-rl-original"
                data-testid="workbench-redline-original"
                placeholder="Paste the original version…"
                value=${original}
                onInput=${(e) => setOriginal(e.target.value)}
              ></textarea>
            </div>
            <div className="wb13-rl-pane">
              <label htmlFor="wb13-rl-revised">Revised</label>
              <textarea
                id="wb13-rl-revised"
                data-testid="workbench-redline-revised"
                placeholder="Paste the revised version…"
                value=${revised}
                onInput=${(e) => setRevised(e.target.value)}
              ></textarea>
            </div>
          </div>
          ${hasInput
            ? html`
                <div className="wb13-rl-summary" data-testid="workbench-redline-summary">
                  ${changedCount
                    ? `${changedCount} ${changedCount === 1 ? 'clause' : 'clauses'} changed of ${clauses.length}`
                    : 'No changes — the two versions match.'}
                </div>
                ${anyDegraded
                  ? html`<div className="wb13-rl-degraded" data-testid="workbench-redline-degraded">
                      One or more clauses were too large to compare word-by-word and are shown as a
                      full replacement.
                    </div>`
                  : null}
                <div className="wb13-rl-list" data-testid="workbench-redline-list">
                  ${clauses.map((clause) => {
                    const decision = decisionFor(clause.id);
                    return html`
                      <div
                        className=${`wb13-rl-clause is-${clause.kind}${
                          clause.changed && decision === 'reject' ? ' is-rejected' : ''
                        }`}
                        key=${clause.id}
                        data-testid="workbench-redline-clause"
                        data-kind=${clause.kind}
                        data-decision=${clause.changed ? decision : ''}
                      >
                        <div className="wb13-rl-head">
                          <span className=${`wb13-rl-chip is-${clause.kind}`}>
                            ${KIND_LABEL[clause.kind] || clause.kind}
                          </span>
                          ${clause.changed
                            ? html`<span className="wb13-rl-decide">
                                <button
                                  type="button"
                                  className="is-accept"
                                  data-testid="workbench-redline-accept"
                                  aria-pressed=${decision === 'accept'}
                                  aria-label=${`Accept change to ${clause.id}`}
                                  onClick=${() => setDecision(clause.id, 'accept')}
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  className="is-reject"
                                  data-testid="workbench-redline-reject"
                                  aria-pressed=${decision === 'reject'}
                                  aria-label=${`Reject change to ${clause.id}`}
                                  onClick=${() => setDecision(clause.id, 'reject')}
                                >
                                  Reject
                                </button>
                              </span>`
                            : null}
                        </div>
                        <${ClauseText} segments=${clause.segments} />
                      </div>
                    `;
                  })}
                </div>
                <div className="wb13-rl-foot">
                  <button
                    type="button"
                    className="wb13-button is-sm"
                    data-testid="workbench-redline-copy"
                    disabled=${!resolved}
                    onClick=${copyResolved}
                  >
                    ${copied ? 'Copied' : 'Copy resolved text'}
                  </button>
                  <button
                    type="button"
                    className="wb13-button is-sm"
                    data-testid="workbench-redline-download"
                    disabled=${!clauses.length}
                    onClick=${downloadRedline}
                  >
                    Download redline
                  </button>
                  <span className="wb13-rl-count" data-testid="workbench-redline-count">
                    ${changedCount - rejectedCount} of ${changedCount} changes
                    accepted${rejectedCount ? ` · ${rejectedCount} reverted to the original` : ''}
                  </span>
                </div>
              `
            : html`<div className="wb13-rl-empty" data-testid="workbench-redline-empty">
                Paste an original and a revised version above to see a tracked-changes redline —
                insertions underlined, deletions struck through, aligned clause by clause.
                Read-only: nothing is sent or saved.
              </div>`}
        </div>
      </div>
    </main>
  `;
}
