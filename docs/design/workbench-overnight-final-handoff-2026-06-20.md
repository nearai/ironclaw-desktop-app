# Workbench Overnight — Final Handoff (2026-06-20)

Branch: `codex/workbench-overhaul-backend-loop`. No commits, no pushes. Unrelated
changes preserved. This summarizes the full overnight run: a Codex agent's
14-loop overhaul plus the Claude coordinator's analysis, two carried-over fixes,
an a11y focus pass, and an independent adversarial QA gate.

## Ship verdict

**Safe to bring the Workbench scaffold toward main — zero regressions.**
Independent QA (4 read-only lanes → adversarial verify → synthesis) returned
`safe-with-minor-followups`. Remaining items are product/back-end follow-ups,
not correctness defects. Do not claim the full product is "done": several
backend feeds are intentionally staged/empty (see Missing backend).

## Tree state

- Branch: `codex/workbench-overhaul-backend-loop` (correct, unchanged).
- `git status`: 26 modified tracked, 11 deleted + matching new generated chunks,
  26 untracked. Untracked includes the whole Workbench scaffold
  (`crates/.../pages/workbench/`), `extensions/lib/registry-{catalog,readiness}.js`,
  `scripts/probe-workbench-live-wiring.mjs`, `tests/static/workbench-*`, and the
  `docs/design/workbench-*` set.
- Generated static (`main.bundle.js`, locale chunks, `tailwind.generated.css`)
  regenerated from source via `npm run prepare:webui-static`; deleted old chunks
  + added new chunks are one paired generated set. `verify:static-frontend` OK.

## Largest Workbench source files (post-overhaul, all reasonable)

| File | Lines |
|---|---|
| components/workbench-packet.js | 584 |
| styles/packet.js | 436 |
| workbench-page.js | 429 |
| lib/workbench-state.js | 402 |
| components/workbench-command.js | 344 |
| styles/workspace.js | 343 |
| hooks/useWorkbenchStart.js | 336 |
| lib/workbench-plan.js | 318 |

Route file is a thin shell; the page/style/packet splits are in place
(`workbench-styles.js` aggregates `styles/` modules; `workbench-packet-model.js`
is the pure packet model). `workbench-packet.js` (584) is the next split
candidate if it grows.

## Test matrix (final, exact commands)

```
node --check (whole workbench tree)                                   clean
npm run test:static                                                   689/689 pass
npx playwright test --config playwright.static.config.ts \
  tests/static/workbench-static.spec.ts                               28/28 pass
npm run test:a11y-static -- tests/static/a11y-static.spec.ts          27/27 pass
npm run prepare:webui-static                                          OK
npm run verify:static-frontend                                        OK
npm run check:static-bundle                                           OK (pre-existing tesseract WARN only)
```

The 28 Workbench Playwright tests now include the coordinator's added
Escape-close, inspector focus move/restore, and ApprovalModal focus-trap tests.

## What changed overnight

**Codex (Loops 2–14, see progress doc):** live NEAR AI Cloud model/effort wiring
(real catalog labels, 47-model `nearai` profile proven live), honest source
readiness + setup routing, automations rail from the real `/automations` read
route, started-scene live Chat timeline, pending-gate detail in the rail,
suggestion label/fill split + adaptive command verb, packet-model split, blank
home no longer mounting empty review/files panels, type-aware saved-work labels,
source/boundary chrome simplification (Memory de-promoted, top-shield removed),
font tokens + dark mode + mobile composer hardening, and `probe-workbench-live-wiring.mjs`.

**Coordinator (Loops 1, 15):** baseline + screenshots; `savedArtifactText`
base64→readable-format allowlist honesty fix (`lib/workbench-work-items.js`);
inspector Escape-to-close (`workbench-page.js`); best-effort `.catch` on
model-switch cache invalidation (`hooks/useWorkbenchStart.js`); a11y focus pass
via new `hooks/useDialogFocus.js` applied to `ApprovalModal` (move + restore +
Tab trap) and the three inspectors (move + restore), plus a 44px close-button
tap target; the backend wiring map, visual/product QA, progress, and this
handoff doc.

## Rendered / live evidence (outside repo)

- `/tmp/ironclaw-workbench-final-002218/` — dark home (bg rgb(11,16,22)), blank
  home with no empty panels, 0 overflow desktop+mobile, Escape closes inspector.
- `/tmp/ironclaw-workbench-a11y-004401/` — sources inspector; close button
  measured 44×44; focus confirmed inside on open.
- Codex live-profile probes + in-app-browser shots throughout the progress doc
  (e.g. `/tmp/ironclaw-workbench-iab-*`, `/tmp/ironclaw-workbench-live-wiring-*`)
  proving real model catalog, Ask→Chat runtime start, and connector readiness
  against a local Reborn gateway.

## Known blockers

None for bringing the scaffold toward main. The product is not yet
"pull my inbox/calendar/drive" usable because Google OAuth is not configured —
but the UI is honest about that (routes to setup, never fakes data).

## Missing backend / API dependencies (shown honestly as staged/empty today)

Per `workbench-backend-wiring-map-2026-06-20.md` (G1–G6): durable saved-Work
read (`GET /work`), cross-thread approvals feed, receipts/audit, automation
write/CRUD, memory/preference persistence, and a global pending-work feed; plus
Google desktop OAuth (`oauth/start` 503). No Workbench-only endpoints were
invented; work starts through the existing Chat runtime path.

## Recommended next 5 tasks

1. Artifact-type-specific saved-work **body** layouts (labels already adapt; body
   does not) — branch packet body off the inferred work shape in
   `workbench-packet-model.js`. Highest-value product follow-up.
2. Decide inspector semantics: keep as non-modal drawers (current, honest) or
   promote to `role=dialog`/`aria-modal` + add the inspector Tab trap — the
   dialog route must update the 17 `getByRole('complementary')` spec selectors in
   the same change.
3. Wire `GET /work` durable saved-Work read into the existing packet model
   (adapter boundary already exists) once the backend route lands.
4. Configure Google desktop OAuth so the installed Gmail/Calendar/Drive/Docs
   connectors move from "needs setup" to ready.
5. Capture a model-switch **failure-state** screenshot (DoD evidence gap; the
   behavior is already tested and the draft-preserve path verified).
