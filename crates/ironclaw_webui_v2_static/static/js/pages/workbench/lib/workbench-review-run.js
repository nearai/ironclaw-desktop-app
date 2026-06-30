import { parseReviewCells } from './workbench-review-extract.js';

// Orchestrate the per-document Tabular Review extraction. `extractDoc(doc, token) -> rawModelText`
// is INJECTED (it reads the document's text and runs the one chat turn); this module owns only
// the concurrency, the per-document error isolation, and parsing the model output into cells.
// Pure + deterministic given extractDoc, so it is fully unit-testable; slice 3b-ii supplies the
// real extractor (Drive doc read + chat-API turn) and the UI subscribes via onUpdate to fill the
// grid progressively. A single document's failure NEVER blocks the others — it marks that
// document's cells 'error'. Cells themselves are produced by the hardened parseReviewCells
// (token-gated, never-fabricate), so nothing here can invent a finding.
export async function runReview(
  docs,
  columns,
  { extractDoc, token, concurrency = 3, onUpdate } = {}
) {
  const cols = Array.isArray(columns) ? columns : [];
  const queue = Array.isArray(docs) ? docs.filter((doc) => doc && doc.id) : [];
  const result = {};
  if (typeof extractDoc !== 'function' || !queue.length) return result;

  let cursor = 0;
  const worker = async () => {
    while (cursor < queue.length) {
      const doc = queue[cursor++];
      onUpdate?.(doc.id, { cells: {}, status: 'running' });
      try {
        const raw = await extractDoc(doc, token);
        const cells = parseReviewCells(raw, cols, { token });
        result[doc.id] = { cells, status: 'done' };
        onUpdate?.(doc.id, { cells, status: 'done' });
      } catch (err) {
        result[doc.id] = { cells: {}, status: 'error' };
        onUpdate?.(doc.id, {
          cells: {},
          status: 'error',
          error: String((err && err.message) || err)
        });
      }
    }
  };

  const lanes = Math.max(1, Math.min(Number(concurrency) || 1, queue.length));
  await Promise.all(Array.from({ length: lanes }, () => worker()));
  return result;
}
