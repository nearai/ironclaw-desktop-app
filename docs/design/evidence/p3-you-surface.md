# Loop #14 (P3) — the "You" perspective surface, live (2026-06-22 03:17 EDT)

Renders the behaviour-profile core (loop #13) as a real route: what IronClaw learned
about how you work, from your own mail. v13-styled (Newsreader serif, --v2 tokens).

- New page `pages/you/you-page.js` + route `/you` (routes.js `hidden: true` for now → no
  nav-rail change; mounted in app.js under the authed layout). Reads in:sent + the
  Primary inbox, runs computeBehaviourProfile, renders: tier stats (VIP/respond/FYI/filed),
  evidence-backed patterns, and a per-person list with tier badges + reply latency.
  Self-contained `<style>` on app-wide --v2-* tokens (the route doesn't mount the
  workbench token sheet). Read-only; nothing is sent.
- **Live-verified** (standalone :17641 /you, real mail): renders "How you work" in
  **Newsreader serif**; stats **"0 VIP · 1 respond · 14 FYI · 2 auto-filed"** (a 25-msg
  sent read matched a respond-tier correspondent — tiering deepens with more history);
  15 person rows; suppression noted; **no console errors**; design clean (dark + serif).
- **Gate green:** test:static 808 (route-registration test; profile core's 4 tests),
  design DT-1..6, a11y 138, smoke, bundle-size under budget.

Next: promote /you to the visible nav (i18n nav.you + nav section + count tripwire) once
tiering reads a fuller sent window; long-horizon research verb proof.
