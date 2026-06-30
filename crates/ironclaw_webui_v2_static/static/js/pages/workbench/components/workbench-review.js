import { Icon } from '../../../design-system/icons.js';
import { React, html } from '../../../lib/html.js';
import { REVIEW_COLUMNS } from '../lib/workbench-review-columns.js';
import { ReviewGrid } from './workbench-review-grid.js';

// Tabular Review — review a set of documents across named columns, each cell a
// {summary, flag, reasoning} the user can scan at a glance. Pattern REIMPLEMENTED from the
// legal-OSS research (docs/design/legal-oss-build-plan.md); the canonical Mike implementation
// is AGPL, so nothing is copied — only the shape (rows = documents, columns = extraction
// prompts, cell = summary + risk flag).
//
// SLICE 2b: the document picker (Google Drive via the existing connector read) + the grid
// skeleton. Selecting documents builds rows; every cell is PENDING — NO LLM yet. Slice 3 runs
// the per-document extraction and fills the cells.
const REVIEW_STYLE = `
  .wb13-review-empty {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    max-width: 560px;
    margin: 10px 0;
    padding: 18px 20px;
    border: 1px solid var(--wb-line);
    border-radius: 14px;
    background: var(--wb-surface);
  }
  .wb13-review-empty .wb13-review-icon { width: 22px; height: 22px; flex: none; color: var(--wb-muted); margin-top: 2px; }
  .wb13-review-empty .wb13-review-title { font-weight: 650; font-size: 15px; color: var(--wb-ink); margin-bottom: 4px; }
  .wb13-review-empty .wb13-review-sub { font-size: 13px; line-height: 1.5; color: var(--wb-muted); }
  .wb13-review-empty .wb13-review-actions { margin-top: 14px; }
  .wb13-review-layout { display: flex; flex-direction: column; gap: 16px; margin-top: 4px; }
  .wb13-review-pick {
    border: 1px solid var(--wb-line);
    border-radius: 14px;
    background: var(--wb-surface);
    overflow: hidden;
    max-width: 560px;
  }
  .wb13-review-pick-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--wb-line);
    font-weight: 600;
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--wb-muted);
  }
  .wb13-review-pick-head .wb13-review-pick-count { margin-left: auto; color: var(--wb-ink-2); }
  .wb13-review-pick-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    font-size: 13.5px;
    color: var(--wb-ink);
    cursor: pointer;
    min-height: 44px;
  }
  .wb13-review-pick-row + .wb13-review-pick-row { border-top: 1px solid var(--wb-line); }
  .wb13-review-pick-row input { width: 16px; height: 16px; flex: none; }
  .wb13-review-pick-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wb13-review-hint { font-size: 13px; color: var(--wb-muted); max-width: 560px; }
`;

function ReviewEmpty({ subline }) {
  return html`
    <div className="wb13-review-empty" data-testid="workbench-review-empty">
      <span className="wb13-review-icon" aria-hidden="true"><${Icon} name="layers" /></span>
      <div>
        <div className="wb13-review-title">Review your terms across many documents at once</div>
        <div className="wb13-review-sub">${subline}</div>
        <div className="wb13-review-actions">
          <button type="button" className="wb13-button is-primary is-sm" disabled>
            Choose documents
          </button>
        </div>
      </div>
    </div>
  `;
}

export function ReviewView({ files = [], driveReady = false, driveLoading = false }) {
  const docs = Array.isArray(files) ? files : [];
  const [selected, setSelected] = React.useState(() => new Set());
  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectedDocs = docs
    .filter((file) => selected.has(file.id))
    .map((file) => ({ id: file.id, name: file.name }));

  let body;
  if (!driveReady) {
    body = html`<${ReviewEmpty}
      subline="Choose a set of contracts and the terms to pull from each — parties, governing law, term, termination, change of control — and IronClaw fills a grid you can scan. Connect Google Drive to pick documents."
    />`;
  } else if (driveLoading && !docs.length) {
    body = html`<div className="wb13-review-hint" data-testid="workbench-review-loading">
      Loading documents from Google Drive…
    </div>`;
  } else if (!docs.length) {
    body = html`<${ReviewEmpty}
      subline="No documents found in your Google Drive yet. Add contracts there and they'll appear here to review."
    />`;
  } else {
    body = html`
      <div className="wb13-review-layout">
        <div className="wb13-review-pick" data-testid="workbench-review-picker">
          <div className="wb13-review-pick-head">
            Documents<span className="wb13-review-pick-count">${selected.size} selected</span>
          </div>
          ${docs.map(
            (file) => html`
              <label className="wb13-review-pick-row" key=${file.id}>
                <input
                  type="checkbox"
                  data-testid="workbench-review-doc"
                  checked=${selected.has(file.id)}
                  onChange=${() => toggle(file.id)}
                />
                <span className="wb13-review-pick-name" title=${file.name}>${file.name}</span>
              </label>
            `
          )}
        </div>
        ${selectedDocs.length
          ? html`<${ReviewGrid} columns=${REVIEW_COLUMNS} documents=${selectedDocs} cells=${{}} />`
          : html`<div className="wb13-review-hint" data-testid="workbench-review-hint">
              Pick documents above to build the review grid — the columns (parties, governing law,
              term, termination, change of control) fill once extraction runs.
            </div>`}
      </div>
    `;
  }

  return html`
    <main className="wb13-main">
      <style>
        ${REVIEW_STYLE}
      </style>
      <div className="wb13-page">
        <div className="wb13-wide">
          <div className="wb13-head"><h1>Review</h1></div>
          ${body}
        </div>
      </div>
    </main>
  `;
}
