import { React, html } from '../../../lib/html.js';
import { redlineClauses } from '../lib/workbench-redline.js';

// Read-only tracked-changes redline (legal #2, slice D2). Paste an original and a revised version;
// redlineClauses aligns them clause-by-clause and this renders the word-level diff — insertions
// underlined/green, deletions struck-through/red — with a per-clause kind chip. Display only: no
// write or export (a later slice adds accept/reject + a server-side tracked-changes docx export).
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
  .wb13-rl-list { display: flex; flex-direction: column; gap: 8px; max-width: 920px; }
  .wb13-rl-clause {
    border: 1px solid var(--wb-line);
    border-radius: 12px;
    background: var(--wb-surface);
    padding: 12px 14px;
  }
  .wb13-rl-clause.is-unchanged { opacity: 0.62; }
  .wb13-rl-head { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
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
  const changedCount = clauses.filter((c) => c.changed).length;
  const hasInput = Boolean(original.trim() || revised.trim());

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
                <div className="wb13-rl-list" data-testid="workbench-redline-list">
                  ${clauses.map(
                    (clause) => html`
                      <div
                        className=${`wb13-rl-clause is-${clause.kind}`}
                        key=${clause.id}
                        data-testid="workbench-redline-clause"
                        data-kind=${clause.kind}
                      >
                        <div className="wb13-rl-head">
                          <span className=${`wb13-rl-chip is-${clause.kind}`}>
                            ${KIND_LABEL[clause.kind] || clause.kind}
                          </span>
                        </div>
                        <${ClauseText} segments=${clause.segments} />
                      </div>
                    `
                  )}
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
