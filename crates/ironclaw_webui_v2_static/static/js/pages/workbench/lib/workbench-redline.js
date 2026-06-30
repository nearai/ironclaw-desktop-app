// Tracked-changes redline — the pure diff core (legal #2). Given an original and a revised text,
// produce an ordered list of tracked-changes segments and a clause-aligned redline a reviewer can
// scan. Pattern REIMPLEMENTED from the legal-OSS research (AGPL sources copied NOTHING) — a fresh
// word-level LCS diff. Pure + deterministic, so it is fully unit-testable; later slices render it
// (read-only), add per-clause accept/reject, and export tracked-changes docx (server-side).
//
// A wrong diff is a misleading redline — a legal-accuracy risk — so the diff is exact: the equal +
// delete segments always reconstruct the original, and the equal + insert segments always
// reconstruct the revised text (regression-locked by tests).

// Bound the O(n·m) LCS table. Word diffs run per clause (short), so this rarely binds; when it
// does (a huge single block), degrade honestly to a whole-block replace rather than stall.
export const MAX_DIFF_TOKENS = 4000;

// Tokenize into alternating whitespace / non-whitespace runs so the diff is word-level yet
// reconstructs the source exactly (whitespace is preserved as its own tokens).
export function tokenize(text) {
  const s = typeof text === 'string' ? text : '';
  return s.match(/\s+|\S+/g) || [];
}

function mergeSegments(raw) {
  const out = [];
  for (const seg of raw) {
    if (!seg.text) continue;
    const last = out[out.length - 1];
    if (last && last.op === seg.op) last.text += seg.text;
    else out.push({ op: seg.op, text: seg.text });
  }
  return out;
}

function lcsTable(A, B) {
  const n = A.length;
  const m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  return dp;
}

// Word-level diff of two strings → ordered segments [{op:'equal'|'insert'|'delete', text}],
// adjacent same-op runs merged. 'delete' is text only in `a`, 'insert' only in `b`.
export function diffWords(a, b) {
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.length + B.length > MAX_DIFF_TOKENS) {
    // Too large for the exact table — fall back to a whole-block replace (still exact-reconstructing).
    const segs = [];
    if (typeof a === 'string' && a) segs.push({ op: 'delete', text: a });
    if (typeof b === 'string' && b) segs.push({ op: 'insert', text: b });
    return segs;
  }
  const dp = lcsTable(A, B);
  const n = A.length;
  const m = B.length;
  const raw = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      raw.push({ op: 'equal', text: A[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      raw.push({ op: 'delete', text: A[i] });
      i++;
    } else {
      raw.push({ op: 'insert', text: B[j] });
      j++;
    }
  }
  while (i < n) raw.push({ op: 'delete', text: A[i++] });
  while (j < m) raw.push({ op: 'insert', text: B[j++] });
  return mergeSegments(raw);
}

// Word-overlap similarity of two clauses in [0,1] (2·LCS / total words). Used to decide whether a
// deleted clause and an inserted clause are the SAME clause modified (high overlap → word-diff
// them) or genuinely a removal + a separate addition (low overlap → don't force a confusing diff).
export function clauseSimilarity(a, b) {
  const A = String(a == null ? '' : a).match(/\S+/g) || [];
  const B = String(b == null ? '' : b).match(/\S+/g) || [];
  if (!A.length && !B.length) return 1;
  if (!A.length || !B.length) return 0;
  return (2 * lcsTable(A, B)[0][0]) / (A.length + B.length);
}

// Below this overlap, a delete + insert is two separate clauses, not one modified clause.
export const MODIFY_SIMILARITY = 0.4;

// Cap the all-pairs similarity scan inside one changed block (dels × ins). Blocks are bounded by
// unchanged clauses so this rarely binds; beyond it, pairing is skipped (all removed/added).
export const MAX_BLOCK_PAIRS = 2500;

// Split a document into clauses (blank-line- or newline-separated paragraphs), trimmed, no blanks.
export function splitClauses(text) {
  const s = typeof text === 'string' ? text : '';
  return s
    .split(/\n+/)
    .map((clause) => clause.trim())
    .filter(Boolean);
}

// Align the original and revised clause lists (clause-level LCS on exact matches), then classify
// each result clause: 'unchanged' | 'modified' (a delete immediately followed by an insert, word-
// diffed) | 'added' | 'removed'. Returns [{id, kind, before, after, segments, changed}].
export function redlineClauses(origText, revText) {
  const O = splitClauses(origText);
  const R = splitClauses(revText);
  const dp = lcsTable(O, R);
  const n = O.length;
  const m = R.length;
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (O[i] === R[j]) {
      ops.push({ kind: 'equal', before: O[i], after: R[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ kind: 'del', before: O[i] });
      i++;
    } else {
      ops.push({ kind: 'ins', after: R[j] });
      j++;
    }
  }
  while (i < n) ops.push({ kind: 'del', before: O[i++] });
  while (j < m) ops.push({ kind: 'ins', after: R[j++] });

  const modified = (before, after) => ({
    kind: 'modified',
    before,
    after,
    segments: diffWords(before, after),
    changed: true
  });
  const removed = (before) => ({
    kind: 'removed',
    before,
    after: '',
    segments: [{ op: 'delete', text: before }],
    changed: true
  });
  const added = (after) => ({
    kind: 'added',
    before: '',
    after,
    segments: [{ op: 'insert', text: after }],
    changed: true
  });

  const result = [];
  let k = 0;
  while (k < ops.length) {
    if (ops[k].kind === 'equal') {
      const op = ops[k];
      result.push({
        kind: 'unchanged',
        before: op.before,
        after: op.after,
        segments: op.before ? [{ op: 'equal', text: op.before }] : [],
        changed: false
      });
      k++;
      continue;
    }
    // Gather a maximal changed block, then pair deletes to inserts by CONTENT, not position: a
    // deleted clause is "modified into" the inserted clause it most resembles (greedy, highest
    // similarity first, each used once, only above MODIFY_SIMILARITY). Index pairing would
    // misattribute a change when clauses are reordered or one is inserted mid-block; matching by
    // similarity keeps each edit on the right clause. Unmatched deletes are removals, unmatched
    // inserts are additions. Output follows the revised order (removals shown first in the block).
    const dels = [];
    const ins = [];
    while (k < ops.length && ops[k].kind !== 'equal') {
      if (ops[k].kind === 'del') dels.push(ops[k].before);
      else ins.push(ops[k].after);
      k++;
    }
    const delMatched = new Array(dels.length).fill(false);
    const insMatchTo = new Array(ins.length).fill(-1); // ins index -> matched del index
    // Past a size guard the all-pairs similarity scan is skipped (everything becomes removed/added);
    // changed blocks are normally small (bounded by unchanged clauses), so this rarely binds.
    if (dels.length * ins.length <= MAX_BLOCK_PAIRS) {
      const candidates = [];
      for (let di = 0; di < dels.length; di++) {
        for (let ii = 0; ii < ins.length; ii++) {
          const sim = clauseSimilarity(dels[di], ins[ii]);
          if (sim >= MODIFY_SIMILARITY) candidates.push({ di, ii, sim });
        }
      }
      // Deterministic: best similarity first, then by original positions.
      candidates.sort((a, b) => b.sim - a.sim || a.di - b.di || a.ii - b.ii);
      for (const c of candidates) {
        if (delMatched[c.di] || insMatchTo[c.ii] !== -1) continue;
        delMatched[c.di] = true;
        insMatchTo[c.ii] = c.di;
      }
    }
    for (let di = 0; di < dels.length; di++) if (!delMatched[di]) result.push(removed(dels[di]));
    for (let ii = 0; ii < ins.length; ii++) {
      result.push(insMatchTo[ii] !== -1 ? modified(dels[insMatchTo[ii]], ins[ii]) : added(ins[ii]));
    }
  }
  return result.filter(Boolean).map((clause, idx) => ({ id: `clause-${idx}`, ...clause }));
}

// Resolve a redline into final text given per-clause decisions ({clauseId: 'accept' | 'reject'}).
// ACCEPT (the default) takes the revision: a modified clause becomes its revised wording, an added
// clause is kept, a removed clause is dropped. REJECT keeps the original: a modified clause reverts,
// an added clause is dropped, a removed clause is kept. Unchanged clauses always pass through.
// Pure — a wrong resolution would be a wrong final document, so this is the single source of truth.
export function resolvedText(clauses, decisions) {
  const list = Array.isArray(clauses) ? clauses : [];
  const map = decisions && typeof decisions === 'object' ? decisions : {};
  return list
    .map((clause) => {
      if (!clause || typeof clause !== 'object') return '';
      const text = map[clause.id] === 'reject' ? clause.before : clause.after;
      return typeof text === 'string' ? text : '';
    })
    .filter((text) => text.length > 0)
    .join('\n');
}

const HTML_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => HTML_ESCAPE[ch]);
}

// Build a self-contained, printable HTML artifact of the redline (insertions underlined, deletions
// struck through, a kind tag per clause). ALL document text is HTML-escaped — the inputs are
// user-pasted, so this never lets clause content inject markup/script into the downloaded file.
// This is the redline RECORD (every tracked change), distinct from resolvedText (the decided final
// document). Pure: returns the HTML string; the caller downloads it as a local file (no network).
export function buildRedlineHtml(clauses, { title = 'Redline' } = {}) {
  const list = Array.isArray(clauses) ? clauses : [];
  const safeTitle = escapeHtml(title);
  const rows = list
    .map((clause) => {
      if (!clause || typeof clause !== 'object') return '';
      const segs = (Array.isArray(clause.segments) ? clause.segments : [])
        .map((seg) => {
          const text = escapeHtml(seg && seg.text);
          if (seg && seg.op === 'insert') return `<ins>${text}</ins>`;
          if (seg && seg.op === 'delete') return `<del>${text}</del>`;
          return text;
        })
        .join('');
      return `<p class="c"><span class="k">${escapeHtml(clause.kind)}</span>${segs}</p>`;
    })
    .filter(Boolean)
    .join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${safeTitle}</title>
<style>
body{font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:760px;margin:40px auto;padding:0 22px;color:#1b1b1b}
h1{font-size:20px;margin:0 0 18px}
.c{margin:0 0 12px;padding:11px 13px;border:1px solid #e4e4e4;border-radius:8px;white-space:pre-wrap}
.k{display:inline-block;font:700 10px/1 sans-serif;text-transform:uppercase;letter-spacing:.07em;color:#8a8a8a;margin-right:8px}
ins{color:#0a7d33;text-decoration:underline}
del{color:#c0392b;text-decoration:line-through}
</style></head>
<body><h1>${safeTitle}</h1>
${rows}
</body></html>`;
}
