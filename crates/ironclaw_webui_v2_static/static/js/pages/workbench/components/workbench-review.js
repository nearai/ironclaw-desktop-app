import { Icon } from '../../../design-system/icons.js';
import { React, html } from '../../../lib/html.js';
import { connectorRead, createThread, sendMessage, fetchTimeline } from '../../../lib/api.js';
import {
  makeCustomColumn,
  effectiveColumns,
  CUSTOM_COLUMN_LABEL_MAX,
  CUSTOM_COLUMN_PROMPT_MAX
} from '../lib/workbench-review-columns.js';
import { runReview } from '../lib/workbench-review-run.js';
import { makeReviewExtractor, runReviewChatTurn } from '../lib/workbench-review-extract-doc.js';
import { GOOGLE_DOC_MIME } from '../lib/workbench-drive.js';
import { ReviewGrid } from './workbench-review-grid.js';

// Tabular Review reads native Google Docs today (the read-only connector path is
// GOOGLEDOCS_GET_DOCUMENT_BY_ID; PDFs/.docx blobs need server-side text extraction, not yet wired).
// So the picker marks non-Doc files as not-yet-reviewable up front instead of letting a reviewer
// select them and get a wall of "couldn't read".
const isReviewableFile = (file) => file && file.mimeType === GOOGLE_DOC_MIME;

// Tabular Review — review a set of documents across named columns, each cell a
// {summary, flag, reasoning} the user can scan at a glance. Pattern REIMPLEMENTED from the
// legal-OSS research; the canonical Mike implementation is AGPL, so nothing is copied — only the
// shape (rows = documents, columns = extraction prompts, cell = summary + risk flag).
//
// SLICE 3b-ii: live. Pick Google Drive documents → "Run review" → for each document the body is
// read and ONE chat turn extracts the columns (concurrency-capped, per-doc error isolation,
// hardened parser). READ-ONLY — no writes. Cells are produced only by the model output through
// the token-gated parser, so nothing here can fabricate a finding.
const TZ = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
})();

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
  .wb13-review-pick-row.is-unavailable { cursor: default; color: var(--wb-muted); }
  .wb13-review-pick-row.is-unavailable .wb13-review-pick-name { color: var(--wb-muted); }
  .wb13-review-pick-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wb13-review-pick-tag { margin-left: auto; flex: none; font-size: 11px; color: var(--wb-faint); white-space: nowrap; }
  .wb13-review-pick-note { padding: 11px 16px; border-top: 1px solid var(--wb-line); font-size: 12.5px; color: var(--wb-muted); line-height: 1.5; }
  .wb13-review-runbar { display: flex; align-items: center; gap: 12px; }
  .wb13-review-hint { font-size: 13px; color: var(--wb-muted); max-width: 560px; }
  .wb13-review-runerror {
    max-width: 560px;
    padding: 12px 14px;
    border: 1px solid var(--wb-danger);
    border-radius: 12px;
    background: var(--wb-danger-soft, var(--wb-surface));
    font-size: 13px;
    line-height: 1.5;
    color: var(--wb-danger-text, var(--wb-ink));
  }
  .wb13-review-cols {
    max-width: 560px;
    border: 1px solid var(--wb-line);
    border-radius: 14px;
    background: var(--wb-surface);
    padding: 14px 16px;
  }
  .wb13-review-cols-head {
    font-weight: 600;
    font-size: 10.5px;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--wb-muted);
    margin-bottom: 10px;
  }
  .wb13-review-col-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
  .wb13-review-col-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 6px 5px 11px;
    border: 1px solid var(--wb-line);
    border-radius: 999px;
    font-size: 12.5px;
    color: var(--wb-ink-2);
    background: var(--wb-surface-2, transparent);
  }
  .wb13-review-col-chip button {
    display: inline-flex;
    width: 18px;
    height: 18px;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--wb-muted);
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
  }
  .wb13-review-col-chip button:hover { color: var(--wb-danger); }
  .wb13-review-col-add { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .wb13-review-col-add input {
    flex: 1;
    min-width: 130px;
    padding: 8px 10px;
    border: 1px solid var(--wb-line);
    border-radius: 9px;
    background: var(--wb-input, var(--wb-surface));
    color: var(--wb-ink);
    font-size: 13px;
  }
  .wb13-review-col-add input.is-prompt { flex: 2; min-width: 180px; }
  .wb13-review-col-add input:focus-visible {
    outline: 2px solid var(--wb-accent, var(--wb-ink));
    outline-offset: 1px;
  }
  /* Touch: the remove-column control is a tiny glyph on a fine pointer — give it a 44px target. */
  @media (pointer: coarse) {
    .wb13-review-col-chip { min-height: 44px; }
    .wb13-review-col-chip button { width: 44px; height: 44px; font-size: 18px; }
    .wb13-review-col-add input { min-height: 44px; }
  }
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

// Map a runReview onUpdate into the per-document cell map the grid renders. 'done' uses the
// real parsed cells (answered columns only — others stay pending); 'running'/'error' mark every
// column so the grid reflects the document-level state.
function statusCells(update, columns) {
  if (update.status === 'done') return update.cells || {};
  const status = update.status === 'error' ? 'error' : 'running';
  const out = {};
  for (const column of columns) out[column.id] = { status };
  return out;
}

export function ReviewView({
  files = [],
  driveReady = false,
  driveLoading = false,
  driveError = false
}) {
  const docs = Array.isArray(files) ? files : [];
  const [selected, setSelected] = React.useState(() => new Set());
  const [cells, setCells] = React.useState({});
  const [running, setRunning] = React.useState(false);
  const [perDocStatus, setPerDocStatus] = React.useState({});
  const [customColumns, setCustomColumns] = React.useState([]);
  const [seq, setSeq] = React.useState(1);
  const [newLabel, setNewLabel] = React.useState('');
  const [newPrompt, setNewPrompt] = React.useState('');
  const columns = effectiveColumns(customColumns);
  const draftColumn = makeCustomColumn(newLabel, newPrompt, seq);
  const addColumn = () => {
    if (!draftColumn) return;
    setCustomColumns((prev) => [...prev, draftColumn]);
    setSeq((n) => n + 1);
    setNewLabel('');
    setNewPrompt('');
  };
  const removeColumn = (id) => {
    setCustomColumns((prev) => prev.filter((c) => c.id !== id));
    // Prune any filled cells for the removed column so stale results aren't retained in memory
    // (ids are never reused, so this can't affect another column — purely housekeeping).
    setCells((prev) => {
      const next = {};
      for (const docId of Object.keys(prev)) {
        const { [id]: _removed, ...rest } = prev[docId] || {};
        next[docId] = rest;
      }
      return next;
    });
  };
  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const reviewableDocs = docs.filter(isReviewableFile);
  const selectedDocs = docs
    .filter((file) => selected.has(file.id) && isReviewableFile(file))
    .map((file) => ({ id: file.id, name: file.name }));

  const onRun = async () => {
    if (!selectedDocs.length || running) return;
    setRunning(true);
    setPerDocStatus({}); // clear a previous run's outcome before this one
    const token =
      (typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID()) ||
      `tok-${Date.now()}`;
    const runTurn = (prompt) =>
      runReviewChatTurn(prompt, { createThread, sendMessage, fetchTimeline, timezone: TZ });
    // Snapshot the effective columns for THIS run so the prompt (column index) and the parser use
    // the identical array — a mid-run add/remove can't desync the index→column mapping.
    const runColumns = effectiveColumns(customColumns);
    const extractDoc = makeReviewExtractor({ connectorRead, runTurn, columns: runColumns });
    try {
      await runReview(selectedDocs, runColumns, {
        extractDoc,
        token,
        concurrency: 3,
        onUpdate: (id, update) => {
          setCells((prev) => ({ ...prev, [id]: statusCells(update, runColumns) }));
          setPerDocStatus((prev) => ({ ...prev, [id]: update.status }));
        }
      });
    } finally {
      setRunning(false);
    }
  };

  // The whole run failed when it has settled, documents were selected, and EVERY one errored —
  // a systemic failure (the model or a connected source was unreachable), distinct from a single
  // unreadable document among others. Surfaced as one honest run-level note, not just empty cells.
  const runFailed =
    !running &&
    selectedDocs.length > 0 &&
    selectedDocs.every((doc) => perDocStatus[doc.id] === 'error');

  let body;
  if (!driveReady) {
    body = html`<${ReviewEmpty}
      subline="Choose a set of contracts and the terms to pull from each — parties, governing law, term, termination, change of control — and IronClaw fills a grid you can scan. Connect Google Drive to pick documents."
    />`;
  } else if (driveLoading && !docs.length) {
    body = html`<div className="wb13-review-hint" data-testid="workbench-review-loading">
      Loading documents from Google Drive…
    </div>`;
  } else if (driveError && !docs.length) {
    // Drive is connected but the file list failed to load — an error, NOT an empty Drive.
    body = html`<div
      className="wb13-review-runerror"
      data-testid="workbench-review-drive-error"
      role="status"
    >
      Couldn't load your Drive documents — the connection may have dropped. Try again in a moment.
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
          ${docs.map((file) => {
            const reviewable = isReviewableFile(file);
            return html`
              <label
                className=${`wb13-review-pick-row${reviewable ? '' : ' is-unavailable'}`}
                key=${file.id}
              >
                <input
                  type="checkbox"
                  data-testid="workbench-review-doc"
                  checked=${selected.has(file.id)}
                  disabled=${!reviewable}
                  onChange=${() => reviewable && toggle(file.id)}
                />
                <span className="wb13-review-pick-name" title=${file.name}>${file.name}</span>
                ${reviewable
                  ? null
                  : html`<span className="wb13-review-pick-tag">Google Docs only</span>`}
              </label>
            `;
          })}
          ${docs.length && !reviewableDocs.length
            ? html`<div className="wb13-review-pick-note" data-testid="workbench-review-no-docs">
                Tabular Review reads Google Docs today. None of these Drive files are Google Docs
                yet.
              </div>`
            : null}
        </div>
        <div className="wb13-review-cols" data-testid="workbench-review-cols">
          <div className="wb13-review-cols-head">Columns · ${columns.length}</div>
          <div className="wb13-review-col-chips">
            ${columns.map(
              (col) => html`
                <span className="wb13-review-col-chip" key=${col.id}>
                  ${col.label}
                  ${col.custom
                    ? html`<button
                        type="button"
                        data-testid="workbench-review-col-remove"
                        aria-label=${`Remove ${col.label} column`}
                        onClick=${() => removeColumn(col.id)}
                      >
                        ×
                      </button>`
                    : null}
                </span>
              `
            )}
          </div>
          <div className="wb13-review-col-add">
            <input
              data-testid="workbench-review-add-label"
              aria-label="New column name"
              placeholder="Column name (e.g. Indemnity cap)"
              maxlength=${CUSTOM_COLUMN_LABEL_MAX}
              value=${newLabel}
              onInput=${(e) => setNewLabel(e.target.value)}
            />
            <input
              className="is-prompt"
              data-testid="workbench-review-add-prompt"
              aria-label="What to pull from each document"
              placeholder="What should IronClaw pull from each document?"
              maxlength=${CUSTOM_COLUMN_PROMPT_MAX}
              value=${newPrompt}
              onInput=${(e) => setNewPrompt(e.target.value)}
            />
            <button
              type="button"
              className="wb13-button is-sm"
              data-testid="workbench-review-add-column"
              disabled=${!draftColumn}
              onClick=${addColumn}
            >
              Add column
            </button>
          </div>
        </div>
        <div className="wb13-review-runbar">
          <button
            type="button"
            className="wb13-button is-primary is-sm"
            data-testid="workbench-review-run"
            disabled=${!selectedDocs.length || running}
            onClick=${onRun}
          >
            ${running ? 'Reviewing…' : 'Run review'}
          </button>
          ${running
            ? html`<span className="wb13-review-hint"
                >Reading each document and pulling the columns…</span
              >`
            : null}
        </div>
        ${runFailed
          ? html`<div
              className="wb13-review-runerror"
              data-testid="workbench-review-run-error"
              role="status"
            >
              Couldn't complete the review — the model or a connected source was unreachable. Your
              documents weren't changed. Try running it again.
            </div>`
          : null}
        ${selectedDocs.length
          ? html`<${ReviewGrid} columns=${columns} documents=${selectedDocs} cells=${cells} />`
          : html`<div className="wb13-review-hint" data-testid="workbench-review-hint">
              Pick documents above to build the review grid — the columns (parties, governing law,
              term, termination, change of control) fill once you run the review.
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
