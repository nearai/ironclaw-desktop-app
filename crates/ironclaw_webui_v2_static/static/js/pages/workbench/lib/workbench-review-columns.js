// Tabular Review — the built-in column set for the first slice (NDA review). Each column is a
// named extraction: a stable id, a display label, a type (for later value coercion/sorting),
// and the per-document prompt the model answers. Pattern reimplemented from the legal-OSS
// research; nothing is copied from the AGPL source. Custom columns come later — these five are
// the terms a CLO pulls from every NDA.

export const REVIEW_FLAGS = Object.freeze(['green', 'yellow', 'red', 'grey']);

export const REVIEW_COLUMNS = Object.freeze([
  {
    id: 'parties',
    label: 'Parties',
    type: 'text',
    prompt:
      'Who are the named parties to this agreement? List each party and its role (e.g. Disclosing / Receiving).'
  },
  {
    id: 'governing-law',
    label: 'Governing Law',
    type: 'text',
    prompt:
      'What governing law and jurisdiction does this agreement specify? Quote the clause if present, otherwise say "not specified".'
  },
  {
    id: 'term',
    label: 'Term',
    type: 'text',
    prompt:
      'What is the term/duration of this agreement and when does it commence? Include any confidentiality survival period.'
  },
  {
    id: 'termination',
    label: 'Termination',
    type: 'text',
    prompt:
      'How can this agreement be terminated? Summarise the termination rights, any notice period, and whether cause is required.'
  },
  {
    id: 'change-of-control',
    label: 'Change of Control',
    type: 'text',
    prompt:
      'Does this agreement address change of control or assignment? Summarise any consent, notice, or termination right triggered by a change of control or assignment.'
  }
]);

export function reviewColumnById(id) {
  return REVIEW_COLUMNS.find((column) => column.id === String(id)) || null;
}

export const CUSTOM_COLUMN_LABEL_MAX = 40;
export const CUSTOM_COLUMN_PROMPT_MAX = 280;

// Build a user-defined column from a label + extraction prompt. Returns null when either is
// blank so the caller can keep the Add control disabled. The id is namespaced `custom-<seq>` so
// it can NEVER collide with a built-in column id (the parser keys cells by id and maps by index,
// so a collision would mis-attribute a finding). Label/prompt are trimmed and length-capped.
// Non-string inputs (other than null/undefined) are rejected rather than coerced, so a misuse
// can't smuggle "[object Object]" or a number in as a column label.
export function makeCustomColumn(label, prompt, seq) {
  if (label != null && typeof label !== 'string') return null;
  if (prompt != null && typeof prompt !== 'string') return null;
  const cleanLabel = String(label == null ? '' : label)
    .trim()
    .slice(0, CUSTOM_COLUMN_LABEL_MAX);
  const cleanPrompt = String(prompt == null ? '' : prompt)
    .trim()
    .slice(0, CUSTOM_COLUMN_PROMPT_MAX);
  if (!cleanLabel || !cleanPrompt) return null;
  const n = Number.isInteger(seq) && seq > 0 ? seq : 1;
  return {
    id: `custom-${n}`,
    label: cleanLabel,
    type: 'custom',
    prompt: cleanPrompt,
    custom: true
  };
}

// The full column set for a run: the built-ins followed by the user's custom columns, in order.
// One array is the single source of truth for BOTH the prompt (column index) and the parser, so
// index mapping stays consistent. Invalid/duplicate-id custom entries are dropped defensively.
export function effectiveColumns(custom) {
  const list = Array.isArray(custom) ? custom : [];
  const seen = new Set(REVIEW_COLUMNS.map((c) => c.id));
  const extra = [];
  for (const c of list) {
    if (!c || typeof c !== 'object') continue;
    const id = String(c.id || '');
    if (!id || seen.has(id) || !c.label || !c.prompt) continue;
    seen.add(id);
    extra.push(c);
  }
  return [...REVIEW_COLUMNS, ...extra];
}
