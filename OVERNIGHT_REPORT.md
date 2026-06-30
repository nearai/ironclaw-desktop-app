# Overnight Build Report — IronClaw Desktop (2026-06-29 → 30)

**Status: GREEN — all phases complete.**
**Branch:** `overnight/desktop-build-20260629` (off `chore/retire-svelte`) · **25 commits** · **pushed? NO** (local only, by design — push is your call).

## Goal
Get IronClaw Desktop building/running well, drain the verified work queue, then overhaul the design with the full UX/UI skill set — autonomously, overnight, no intervention.

## Final verification (full pre-push gate GREEN at HEAD `319fa9f`)
verify:static-frontend ✓ (now also runs an alias-class coverage gate) · check:static-bundle ✓ ·
lint:static-tokens ✓ · lint:static-copy ✓ · test:scripts 19/0 ✓ · **test:static 521/0** ✓ (+20 vs the 501 baseline) ·
test:design-static DT-1..6 ✓ · smoke:webui-static ✓ · smoke:gate-enforcement ✓ (now asserts all 11 locales) · **test:a11y-static 66/0** ✓.

Adversarial review of the whole 5,192-line diff (4 lenses: bugs / security / honesty-regression / tests-i18n, each finding adversarially verified) returned **zero confirmed findings**. (Reviewers were Haiku-grade — see "Before you push".)

## What shipped

### A. Work queue — every autonomous-safe item from the re-verified elite audit (45 items)
The 2026-06-14 elite audit (79 findings) was **re-verified against current code** (it was 15 days stale); 9 were already fixed, and all 45 remaining autonomous-safe items shipped. Highlights:
- **Build hygiene:** restored prettier repo-wide (a dead `prettier-plugin-svelte` ref from the Svelte retirement was breaking `prettier --check` and the pre-commit hook).
- **A11y:** shared Popover focus contract (focus-in/Tab-trap/restore); command-palette combobox/listbox/option semantics; always-mounted assertive error live-region; connector overflow-menu keyboard nav; ConfigureModal accessible name; wallet `aria-live`; labeled thread-search.
- **Honesty:** cancelled save-dialogs no longer toast success; Slack "connected" requires real proof; wallet/provider real errors surface; readiness brief no longer contradicts the "verification pending" chip; OAuth expiry handled; unknown tools badge "review parameters" (not green "reads"); raw approval params collapsed behind `<details>`.
- **Correctness:** Work `localStorage` quota guard; `addFiles` size-cap race fixed (live running total); rate-limit cooldown interval no longer leaks; work-save now client-side routes (no full reload + base-path double-prefix bug caught by a Playwright spec); PDF export renders real tables.
- **Mobile:** safe-area insets (notch/home-indicator), 44px tap targets, /logs no longer overflows 375px, drawer closes on nav.
- **Dead code:** removed SuggestionChips + dead props + unreachable provider branches + dead i18n keys.
- **Gate hardening:** gate-enforcement smoke now asserts the localized approval gate across all 11 locales; new alias-class coverage gate (wired into verify) catches no-op utility classes — then the 24 existing no-op alias classes were mapped so it passes for real.

Spec/report: `docs/reviews/elite-audit-reverify-2026-06-29.md`.

### B. Design craft pass — 8 batches (the "overhaul")
Finding: **the design is already strong and intentional**, and its defining choice is *stillness* — app.css enforces a global `transition: none !important` (deliberate, documented). So the overhaul is a **precision craft pass that makes the implementation be the spec it already declares**, with **zero motion added** (adding motion would have violated intent and the gates). Applied the full UX/UI skill set (impeccable, interface-design, emil-design-eng, make-interfaces-feel-better, baseline-ui, oklch, web-design-guidelines) as critique lenses, then shipped:
1. Removed 6 dead `transition-*` classes that lied about the stillness law.
2. Snapped display/subtitle/section type to the DESIGN.md scale (onboarding hero 40→28px, now in parity with the chat hero).
3. Micro-type: 11px risk caps, button md `text-sm` (44px target intact), tabular StatCard numerals.
4. Radius discipline: off-system `14px`/`xl`/`1.5rem`/bare-`rounded` → controls 6 / cards 12 / modals 16.
5. `CardHeader/Body/Footer` honor a `padding` prop (no more double-padding a `padding='none'` Card).
6. Unified page-gutter progression (4→6→8) + intra-card spacing rhythm.
7. Token discipline: `SubLabel` uses the semantic muted token; gold-soft dark/light parity fixed.
8. Sidebar empty/error/loading states now match main-page dignity (the one inconsistency users actually perceive).

Critique + rationale: `docs/reviews/design-craft-pass-2026-06-30.md`. Before/after screenshots: `output/design-before/` vs `output/design-capture/` (onboarding hero is the most visible change).

## Evidence
- Full gate logs verified green at HEAD (see verification above).
- Before/after design screenshots: `output/design-before/*.png` vs `output/design-capture/*.png`.
- Reports under `docs/reviews/`: `overnight-2026-06-29-brief.md` (ground truth), `elite-audit-reverify-2026-06-29.md` (work queue), `design-craft-pass-2026-06-30.md` (design).

## Known issue (not a regression)
- `tests/static/keyboard-static.spec.ts:196` ("model selector … keeps setup reachable") is **flaky under full-suite parallel load** — it intermittently sees 2 case-insensitive "NEAR AI Cloud" heading matches on /settings/inference during the route transition. Passes 4/4 in isolation and on a clean full a11y run (currently 66/0). Pre-existing (the only design diffs near it are font-size class changes that cannot add a heading). **Harden before relying on the pre-push gate** (scope the `getByRole('heading')` locator or wait for the popover to detach).

## Human decisions needed (deferred — I did NOT decide these)
- **i18n translations (#19, #34, #67):** command-palette, `connection.paused`, onboarding gateway-status — English wiring + baseline ratchet are in; the non-English translation *content* needs a human/translator.
- **#69 delete-chat UI / #78 RecoveryNotice:** wire-vs-delete product calls (no `DELETE /threads/{id}` backend exists yet).
- **#72:** migrate high-traffic files off the hand-enumerated alias remap onto Card/Input/Button tokens (large refactor; the new coverage gate now guards it).
- **Apple Developer ID** signing/notarization for distributable M1 releases.

## Before you push
The adversarial review here was Haiku-grade. Per your standing rule, run the **formal pre-PR gate** before opening a PR: `thermo-nuclear-code-quality-review` (structure) + `near-ai-code-review` (5 lenses) on this branch, fix findings, then:

```
git -c http.version=HTTP/1.1 -c http.postBuffer=524288000 push -u origin overnight/desktop-build-20260629
```
(`origin` = abbyshekit fork. Do **not** push `nearai/main`.)

## Next agent should start here
1. Harden the flaky `keyboard-static.spec.ts:196` locator (above).
2. Run the formal pre-PR review gate; address findings.
3. Make the human-gated calls (translations, wire-vs-delete, signing).

## Do not touch
- The global `transition: none !important` motion policy (app.css) — it's intentional.
- The 3 desktop fork divergences (gatewayFetch / saveBlob / extractWorkspaceFilePaths span-strip).
- The bundled reborn sidecar binary (bespoke build with uncommitted patches — don't rebuild from origin/main).
