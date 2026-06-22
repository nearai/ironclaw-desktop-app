# Loop #17 (P3) — deepen "You" tiering with a paginated sent read (2026-06-22 04:13 EDT)

The You surface tiered almost everyone "fyi" because a single 25-msg sent read missed
the reply-threads. Now it pages the sent folder (connector nextPageToken).

- `you-page.js`: `readPaged(query, {pages, perPage})` follows the connector's
  `nextPageToken`; sent read deepened to ~4 pages (≈100) + Primary inbox ~2 pages (≈50).
  Each 25-row page is reliable where a single large read 503s.
- **Live-verified** (standalone :17641 /you, real mail): tiers improved **0 VIP · 1 respond → 0 VIP · 2 respond · 20 FYI · 5 auto-filed** (22 rows) — the deeper sent window now
  matches the real reply-threads (incl. tjkovacs@fbi.gov), agreeing with the standalone
  engine's V2 (john@salt.org, tjkovacs). The "You" nav item is visible. No console errors.
- **Gate green:** test:static 808, a11y 138, design DT-1..6, smoke, bundle under budget.
- HONEST: first-load ≈22s (6 sequential connector reads + intermittent gateway 503s); the
  result caches 120s. Follow-up: prefetch / parallelize pages / reduce gateway read latency.

VIP stays 0 by rubric (needs reply_rate≥0.6 + median<6h + received≥2; the demo's respond
senders have received=1–2) — correct, not a bug.
