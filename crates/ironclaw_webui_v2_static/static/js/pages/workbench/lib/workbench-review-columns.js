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
