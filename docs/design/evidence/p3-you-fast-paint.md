# Loop #18 (P3) — cut /you first-load: two-phase (fast paint → deep refine) (2026-06-22 04:32 EDT)

Loop #17 deepened tiering but first-load was ~22s blank. Now the surface paints fast and
refines in place.

- `you-page.js`: two React-Query passes. **quick** = readProfile(1 sent page + 1 inbox page)
  → renders at ~one read; **deep** = readProfile(4 sent + 2 inbox) → refines tiers in the
  background. `query = deep.data ? deep : quick`; a subtle "Refining from more of your
  history…" hint shows while deep loads. staleTime 120s.
- **Live-verified** (standalone :17641 /you): ~8s → painted (0 VIP/1 respond/14 FYI, 15 rows,
  "Refining…" shown); ~26s → refined (0 VIP/**2 respond**/20 FYI/5 auto-filed, 22 rows, hint
  gone). Content visible in ~8s vs a 22s blank spinner before. No console errors.
- **Gate green:** test:static 808, a11y 138, design DT-1..6, smoke, bundle under budget.

Underlying per-read gateway latency (~3.6s, Composio round-trip) is unchanged; this is a
UX fix (perceived load), the right lever for a cached secondary surface.
