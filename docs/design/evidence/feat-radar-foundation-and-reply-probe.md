# Briefing-as-home: radar derivation + reply-engine probe (2026-06-22 14:05 EDT)

The user reviewed the briefing-as-home mockup and greenlit option 1 (keep the Ask bar; per-card
actions correct), and pointed me to memory/sessions for how the skill derives identity + allowlist.

## Derivation (from memory + the skill's config.yaml) — "how the skill runs"
- **Identity:** Abhi = CLO (Chief Legal Officer), NEAR Foundation (personal-context.md) → **legal** domain.
- **Mechanism:** live title → domain via title_map (case-insensitive, substring-tolerant: "VP, Legal &
  Governance" → legal). Each domain has a radar trigger vocabulary; legal (verbatim from config.yaml) =
  user funds · custody · token mechanics · securities · personal data · retention · third-party data ·
  IP · licensing · ToS · liability · jurisdiction · disclosures. The radar scans those **within the
  user's own channels only** (#x-intents · #t-agentmarket · #x-nearai-compliance · #kyc_status ·
  #wallet_status), surfacing decisions forming that the user wasn't tagged on. Unknown title → radar off.
- **Hard constraint (memory):** the Hermes daily-briefing skill is the dismissed/old one; the canonical
  engine is Claude-first, **no Hermes / no OpenRouter** — the Workbench runs this through its own
  IronClaw gateway (NEAR AI).

## Shipped this tick: the radar scoping foundation (lib/workbench-radar.js)
`resolveDomain(title)` (title_map → domain, fail-safe null), `radarScopeForTitle` (domain + trigger
vocab), `DOMAIN_TRIGGERS` (legal verbatim + finance/engineering/people defaults),
`normalizeChannelAllowlist`. Generic + product-appropriate — the user's actual title/channels are
supplied at runtime (live Slack profile or settings), NEVER hardcoded. +4 unit tests.

## Reply-engine probe — the #1 ask ("replies ready") is buildable NOW
Drove a short generative "draft a one-sentence reply" turn against the live gateway (:17640): it
COMPLETED in **~17s** with a clean reply ("Yes, I'll have the final compliance-framework section to
you by end of day today."). So short generative turns are NOT #7-blocked — the pre-drafted reply on
the cards is buildable now (only the long read-everything radar turn is #7-gated).

## Build order for the rebuild (next ticks)
1. Wire the reply engine into the cards: "Draft reply" pre-fills the generated reply (short turn). 
2. Restructure the home to the briefing sections (Needs you → Worth weighing in → This week → Best
   times), keep the Ask bar, cut connector-health / Arrived / Upcoming-list.
3. Light up the radar with resolveDomain + the channel allowlist (live title/channels), once the
   read-everything turn is reliable (#7).

Gate: test:static 864 (+4), a11y 140, smoke, design, bundle — all green. Radar module is pure +
not yet imported (no bundle/cold-start impact).
