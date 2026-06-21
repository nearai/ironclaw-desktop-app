# Workbench Build-Out — Overnight Run STATUS

**Run started:** 2026-06-20 23:12 EDT (epoch 1782011524) · **Budget:** ~8h → deadline ~07:12 EDT (1782040324)
**Branch:** `workbench-overnight-20260620` (desktop repo `nearai/ironclaw-desktop-app`) — NOT merged to main; for your morning review.
**Plan:** `~/.claude/plans/squishy-wobbling-sparrow.md`
**Discipline:** every task = implement → full gate (prepare + test:static + a11y + smoke; cargo for backend) → commit only if green; revert + log BLOCKED if red. No regression. No merge to main.

## Gate baseline (green restore point)
- Commit `f986602` "baseline: workbench session work + regenerated bundle".
- `test:static` 759/759 · `test:a11y-static` 120/120 (incl. `tests/static/workbench-static.spec.ts`) · `smoke:webui-static` PASS · prettier hook clean.
- Note: the tree's static + Playwright suites were ALREADY green at start (the `sourceProblems` briefing spec is satisfied; extensive workbench Playwright coverage already exists). Starting point is healthier than the plan assumed.

## KEY REPRIORITIZATION (after reading the v13 spec + checking current state)
Most v13 fidelity items the spec flagged are **already implemented** in the current tree (verified by grep):
serif Newsreader font (L28 ✅), theme toggle (L1 ✅), Memory nav (L4 ✅), identity line "name · NEAR AI Cloud"
(L6 ✅), dense rail hides empty groups (L7 ✅), consolidated single all-clear + orange "Needs a decision" (L18/L23 ✅).
The fidelity spec was a snapshot of gaps that have since been fixed. **The frontend is close to v13; the real reason
it "looks broken / can't do anything" is that the REAL app never loaded for the user.** So the overnight focus pivots
from re-polishing done frontend → proving the REAL stack + agent work end-to-end and landing the backend pieces.

## Queue status (revised)
| ID | Task | State | Commit | Verified by |
|----|------|-------|--------|-------------|
| Q0 | Branch + green baseline | ✅ done | f986602 | 759 static + 120 a11y + smoke |
| Q1 | Remove misleading frontend proxy (use `tauri dev`) | ✅ done | 2a32217 | tests green after removal |
| QA | **Prove the REAL bundled sidecar + a live agent turn** (keychain token) | ✅ PASS | (verify-only, /tmp/wb-qa.mjs) | live turn: providers 200 + assistant "pong" |
| Q11 | Build source gateway with connector route + verify live reads/writes | ⏳ | | route curl + cargo |
| Q12 | `/workbench/execute` endpoint + LIVE multi-step agent verify | ⏳ | | live run transcript |
| QF1 | Remaining real fidelity gaps only: Memory scene (L26), theme default per DESIGN.md, L19/L20 context lines | ⏳ | | a11y + visual |
| Q2 | Screenshot/visual-regression baselines of the real frontend | ⏳ | | screenshots |
| Qf | Final gate, push branch, PR, morning brief | ⏳ | | |

## Continuation mechanism (how this runs unattended ~8h)
- Recurring cron job `2d280254` fires at :07/:31/:55 (~every 24 min) while the app/REPL is idle, re-invoking the
  continuation prompt. Each tick: read this STATUS + the plan, check `date +%s` vs deadline 1782040324, do the next
  ⏳ queue item with the green-commit gate, update this file, then end the turn. At/after the deadline it does the
  final wrap (push + PR + morning brief) and `CronDelete`s itself.
- Session-only: the loop needs this Claude session/app to stay OPEN overnight. If it stalls, resume manually by
  re-issuing the continuation prompt (same as the cron prompt) or asking me to "continue the overnight workbench build".
- Safety: branch only (`workbench-overnight-20260620`), never merge to main; drafts-only (no real sends); secrets stay
  Keychain/gateway-side; every commit green (prettier hook + tests).

## Running log
- 23:12 — Q0: created branch off `codex/workbench-overhaul-backend-loop`; regenerated bundle; full gate green; committed baseline f986602. Began STATUS.
- 23:18 — Q1: removed `scripts/workbench-live-proxy.mjs` (kept `probe-workbench-live-wiring.mjs`); killed leftover proxy/sidecar procs; removed proxy launch.json entries; tests green; committed 2a32217.
- 23:21 — Read v13 fidelity spec + checked current state: L1/L4/L6/L7/L18/L23/L28 already implemented. Reprioritized queue toward real-stack + agent verification. Committed d0c669e.
- 23:23 — Armed recurring cron `2d280254` to drive the overnight loop (next QA tick: boot real prebuilt sidecar + live agent turn). Handed off.
- 23:35 — **QA PASS (major).** Booted the REAL prebuilt sidecar `ironclaw-reborn-aarch64-apple-darwin` with the Keychain NEAR AI token on a throwaway HOME. `/api/webchat/v2/llm/providers` = **200** (providers incl. nearai; active provider=nearai model=auto). createThread 200; sendMessage 200 (outcome:submitted, turn_id returned); timeline produced the assistant reply ("pong"). **Conclusion: the real gateway + agent runtime + existing token WORK end-to-end.** The prior "agent never completes" was the divergent dev fork/proxy, not the product. Verify-only (no repo changes); evidence script `/tmp/wb-qa.mjs`. Next: Q11 — build the source gateway with the connector route + verify connector reads/writes live.

## Morning brief (filled at Qf)
_pending_

## Needs you (morning)
- Enable real outbound sends (+ approve the first real send) — currently drafts-only by design.
- Review the branch + merge to main.
- (NEAR AI auth is NOT needed — existing Keychain token used + verified.)
