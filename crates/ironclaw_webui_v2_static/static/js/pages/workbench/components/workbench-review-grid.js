import { html } from '../../../lib/html.js';
import { REVIEW_FLAGS } from '../lib/workbench-review-columns.js';

// Tabular Review grid — rows = documents, columns = extraction prompts, each cell a
// {summary, flag, reasoning, status}. SLICE 2: structure only — cells render their honest
// state (pending "—", or an error note), NEVER a fabricated value. SLICE 3 fills them from the
// per-document LLM turn. Pattern reimplemented from the legal-OSS research; nothing copied.

const FLAG_LABEL = Object.freeze({
  green: 'Clear',
  yellow: 'Review',
  red: 'Risk',
  grey: 'N/A'
});

export function reviewCell(cells, docId, colId) {
  const row = cells && cells[docId];
  return (row && row[colId]) || null;
}

export function ReviewGrid({ columns = [], documents = [], cells = {} }) {
  const cols = Array.isArray(columns) ? columns : [];
  const docs = Array.isArray(documents) ? documents : [];
  if (!cols.length || !docs.length) return null;
  return html`
    <div className="wb13-review-grid-wrap" data-testid="workbench-review-grid">
      <style>
        .wb13-review-grid-wrap {
          overflow-x: auto;
          border: 1px solid var(--wb-line);
          border-radius: 14px;
          background: var(--wb-surface);
        }
        .wb13-review-grid {
          border-collapse: collapse;
          width: 100%;
          font-size: 13px;
        }
        .wb13-review-grid th {
          text-align: left;
          font-weight: 600;
          font-size: 10.5px;
          line-height: 1.2;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--wb-muted);
          padding: 12px 14px;
          border-bottom: 1px solid var(--wb-line);
          white-space: nowrap;
        }
        .wb13-review-grid td {
          padding: 12px 14px;
          border-bottom: 1px solid var(--wb-line);
          vertical-align: top;
          color: var(--wb-ink-2);
          line-height: 1.45;
        }
        .wb13-review-grid tr:last-child td {
          border-bottom: 0;
        }
        .wb13-rev-doc {
          font-weight: 600;
          color: var(--wb-ink);
          white-space: nowrap;
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .wb13-rev-cell {
          min-width: 150px;
        }
        .wb13-rev-pending {
          color: var(--wb-faint);
        }
        .wb13-rev-flag {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 7px;
          vertical-align: 1px;
          background: var(--wb-muted);
        }
        .wb13-rev-flag.is-green {
          background: var(--wb-good);
        }
        .wb13-rev-flag.is-yellow {
          background: var(--wb-warn, var(--wb-gold));
        }
        .wb13-rev-flag.is-red {
          background: var(--wb-danger);
        }
        .wb13-rev-flag.is-grey {
          background: var(--wb-muted);
        }
        .wb13-review-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          padding: 10px 14px;
          font-size: 11.5px;
          color: var(--wb-muted);
          border-top: 1px solid var(--wb-line);
        }
        .wb13-review-legend span {
          display: inline-flex;
          align-items: center;
        }
      </style>
      <table className="wb13-review-grid">
        <thead>
          <tr>
            <th>Document</th>
            ${cols.map((column) => html`<th key=${column.id}>${column.label}</th>`)}
          </tr>
        </thead>
        <tbody>
          ${docs.map(
            (doc) => html`
              <tr key=${doc.id}>
                <td className="wb13-rev-doc" title=${doc.title || doc.name || doc.id}>
                  ${doc.title || doc.name || doc.id}
                </td>
                ${cols.map((column) => {
                  const cell = reviewCell(cells, doc.id, column.id);
                  const body =
                    cell && cell.status === 'done'
                      ? html`<span
                            className=${`wb13-rev-flag is-${REVIEW_FLAGS.includes(cell.flag) ? cell.flag : 'grey'}`}
                            aria-hidden="true"
                          ></span
                          ><span className="wb13-rev-summary">${cell.summary}</span>`
                      : cell && cell.status === 'error'
                        ? html`<span className="wb13-rev-pending">couldn't read</span>`
                        : html`<span className="wb13-rev-pending" aria-label="not run yet"
                            >—</span
                          >`;
                  return html`<td key=${column.id} className="wb13-rev-cell">${body}</td>`;
                })}
              </tr>
            `
          )}
        </tbody>
      </table>
      <div className="wb13-review-legend" aria-hidden="true">
        ${REVIEW_FLAGS.map(
          (flag) =>
            html`<span key=${flag}
              ><span className=${`wb13-rev-flag is-${flag}`}></span>${FLAG_LABEL[flag]}</span
            >`
        )}
      </div>
    </div>
  `;
}
