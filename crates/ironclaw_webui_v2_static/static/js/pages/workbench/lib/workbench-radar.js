// Role → domain scoping for the "Worth weighing in" radar — the proactive layer
// that surfaces decisions forming in the user's domain that they were NOT tagged
// on. Ported from the daily-briefing skill's config.yaml (the canonical model).
//
// A live job title maps to a domain (title_map: case-insensitive, substring-
// tolerant so "VP, Legal & Governance" still resolves to legal); each domain
// carries a trigger vocabulary the radar scans for WITHIN the user's own channels
// only. Generic + role-agnostic on purpose: the user's actual title and channel
// allowlist are supplied at runtime (a live Slack profile read or settings), never
// hardcoded into the product. Unknown title → no domain → the radar is silently
// off (fail-safe to empty, never another role's vocabulary).

// title regex → domain key. Order matters only for overlapping matches.
const DOMAIN_TITLE_MAP = [
  [/(chief legal officer|general counsel|\blegal\b|\bcounsel\b|governance)/i, 'legal'],
  [/(chief financial officer|\bcfo\b|\bfinance\b|controller|treasur)/i, 'finance'],
  [/(chief technology officer|\bcto\b|\bengineering\b|head of eng|platform)/i, 'engineering'],
  [/(chief people officer|\bpeople\b|\bhr\b|talent|recruit)/i, 'people']
];

// Per-domain trigger vocabulary the radar scans for. Legal is verbatim from the
// skill's config.yaml; the others are sensible product defaults, swappable later.
export const DOMAIN_TRIGGERS = Object.freeze({
  legal: [
    'user funds',
    'custody',
    'token mechanics',
    'securities',
    'personal data',
    'retention',
    'third-party data',
    'IP',
    'licensing',
    'ToS',
    'liability',
    'jurisdiction',
    'disclosures'
  ],
  finance: ['budget', 'spend', 'runway', 'revenue', 'pricing', 'invoice', 'audit', 'forecast'],
  engineering: [
    'migration',
    'launch',
    'deploy',
    'incident',
    'architecture',
    'dependency',
    'breaking change'
  ],
  people: ['hiring', 'offer', 'comp', 'performance', 'attrition', 'org change', 'reorg']
});

// Map a job title to a radar domain key, or null when nothing matches (radar off).
export function resolveDomain(title) {
  const value = String(title || '').trim();
  if (!value) return null;
  for (const [pattern, domain] of DOMAIN_TITLE_MAP) {
    if (pattern.test(value)) return domain;
  }
  return null;
}

// The radar's scope for a given title: its domain + trigger vocabulary. Empty +
// off when the title is unknown.
export function radarScopeForTitle(title) {
  const domain = resolveDomain(title);
  return { domain, triggers: domain ? DOMAIN_TRIGGERS[domain] || [] : [] };
}

// Normalize a user-supplied channel allowlist (the radar only ever reads channels
// the user is a member of). Strips leading '#', lowercases, dedupes, drops blanks.
export function normalizeChannelAllowlist(channels) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(channels) ? channels : []) {
    const name = String(raw || '')
      .trim()
      .replace(/^#+/, '')
      .toLowerCase();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}
