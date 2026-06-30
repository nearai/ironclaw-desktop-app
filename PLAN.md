# Overnight Build Plan — IronClaw Desktop (2026-06-29)

Branch: `overnight/desktop-build-20260629` off `chore/retire-svelte` (v0.4.158).
Autonomous run. No user intervention. Default: NO outward push / NO PR — leave clean branch + `OVERNIGHT_REPORT.md`.

## Baseline (verified at start, all GREEN)
verify:static-frontend ✓ · check:static-bundle ✓ · lint:static-tokens ✓ · lint:static-copy ✓ ·
test:scripts 19/0 ✓ · test:static 501/0 ✓ · test:design-static DT-1..6 ✓ · smoke:webui-static ✓ ·
smoke:gate-enforcement ✓ · test:a11y-static 65/0 ✓

## Goal
Get IronClaw Desktop running really well and elevate craft to "as good as possible":
1. Confirm it builds + runs + dogfoods (live preview).
2. Drain the autonomous-safe work queue (a11y, RTL, focus traps, polish, gate hardening).
3. Full design overhaul across all surfaces with the entire UX/UI skill set — honoring the Design Laws.
4. Test + retest to green throughout. Evidence per change (rebuild + screenshot + gates).

## Guardrails (load-bearing)
- DO NOT blow away the fork. No merge/re-align/re-fork of upstream. Surgical ports only.
- NEAR AI Cloud only for live model. Never OpenRouter/OpenAI/Anthropic in desktop paths.
- NEVER prettier `static/styles/app.css`. Only prettier `.js/.ts/.mjs` then `prepare:webui-static`.
- i18n: new sacred-surface copy needs a key in ALL 11 packs + lock bump (fails CI silently otherwise).
- Color is legal: `#0091fd`=user/blue, `#fbbf24`=agent/gold. One blue primary action per screen.
- Rebuild static after EVERY js/css edit. Run full gate before any "done" claim.
- EXCLUDE Workbench (`~/Documents/Playground/ironclaw-desktop-app-main`, branch workbench-overnight-20260620).
- Sidecar source = `~/Documents/Playground/ironclaw`. Do NOT rebuild the bundled bespoke sidecar.

Full brief: `docs/reviews/overnight-2026-06-29-brief.md`.

## Phases
- P1 build/run/dogfood (gate green ✓ — finish: live preview proof)
- P2 work queue (autonomous-safe): elite-audit #7/#20/#21/#26/#30 + ~60 low/polish + DT design tests + a11y deferred
- P3 test + retest to green + regression
- P4 design overhaul (all UX/UI skills, surface-by-surface, evidence per surface)
- P5 final QA + reviews + OVERNIGHT_REPORT.md (no push)

## Definition of done
Clean tree on branch · full gate green · evidence per claimed fix · no fork-deleting op · no Workbench touch ·
auth guardrails intact · human-gated items stubbed+flagged · OVERNIGHT_REPORT.md written.
