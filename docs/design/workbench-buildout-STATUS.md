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
| Q11 | Source gateway connector route — verify live reads + write-gate | ✅ PASS (verify) | (gateway working tree, not committed) | /tmp/wb-q11.mjs |
| Q11b | Rebase connector route onto gateway main (+/llm+agent) → PR | ⛔ MORNING | | needs careful rebase |
| Q12 | `/workbench/execute` endpoint + LIVE multi-step agent verify | ⛔ MORNING (rebase-blocked) | | needs /llm on same binary |
| QF1a | Memory scene (L26) — wire `view==='memory'` → `MemoryView` | ✅ done | (this tick) | static 760 + a11y 121 |
| QF1b | Theme default per DESIGN.md | ✅ decided (no change) | — | DESIGN.md silent → keep dark (user global pref); v13 light = toggle |
| QF1c | L19/L20 richer decision/blocked context lines | ⏭️ skip (data-honest) | — | cards already render real data; no fake context added |
| Q11p | Capture connector-route patch + rebase runbook (de-risk Q11b) | ✅ done | (this tick) | docs/design/gateway-connector-route.patch |
| Q3UI | Phase-3 Workbench execution UI (hook + run-timeline) against contract, mock-tested | ⏳ NEXT | | unit tests |
| Q2 | Screenshot/visual-regression baselines of the real frontend | ⏳ | | screenshots |
| Qf | Final gate, push branch, PR, morning brief | ⏳ | | |

### Q11b rebase runbook (morning)
1. In `~/Documents/Playground/ironclaw`, fetch + branch off current main: `git fetch origin && git checkout -b connector-route origin/main`.
2. Apply the captured changes: `git apply --3way docs/.../gateway-connector-route.patch` (reference copy in the desktop repo at `docs/design/gateway-connector-route.patch`) OR re-create from the reproduction recipe in memory `ironclaw_workbench_mcp_delivery`. Resolve any conflicts (route is additive; main has `/llm`+agent which the route does not touch).
3. Build: `cargo build -p ironclaw_reborn_cli --features webui-v2-beta`. Fix the 6 `RebornServicesApi` test stubs if main added trait methods. Run `cargo test -p ironclaw_product_workflow --lib reborn_services::connectors` (expect 5/5).
4. Verify live with `/tmp/wb-q11.mjs` pattern (now the SAME binary will have BOTH `/llm` 200 AND `/connectors/*`).
5. Open a PR to `nearai/ironclaw` (HTTP/1.1 push). Then Q12: add `/api/webchat/v2/workbench/execute` + verify a live multi-step run.

### Backend status & the key morning task (Q11b/Q12)
- The connector route + gated-write classifier are **verified working live** on the source-built gateway (Q11 PASS).
- BUT my gateway source (`~/Documents/Playground/ironclaw`, branch `reborn-integration`, 57 uncommitted files incl. codex's Notion-OAuth work) is **behind current main: `/llm/providers` 404s on it**, while the PREBUILT shipped sidecar HAS `/llm`+agent (QA proved that). So no single binary today has BOTH the agent AND the connector route.
- **THE unifying task (morning, human-careful):** rebase the connector-route files onto current `nearai/ironclaw` main (which has `/llm`+agent), rebuild, and open a PR. Files: `crates/ironclaw_product_workflow/src/{reborn_services/connectors.rs,reborn_services.rs,lib.rs,reborn_services/lifecycle_setup.rs}`, `crates/ironclaw_reborn_composition/src/{connectors.rs,lib.rs}`, `crates/ironclaw_webui_v2/src/{router,handlers,descriptors}.rs`, + the 6 RebornServicesApi test stubs. Connector unit tests pass (5/5). Not committed/pushed overnight — too risky on a 57-file multi-source integration branch unattended; preserved in the working tree + reproducible (see memory `ironclaw_workbench_mcp_delivery`).
- Q12 (`/workbench/execute`) is deferred with Q11b because live-verifying it needs `/llm`+agent on the SAME binary as the route.

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
- 00:11 — **QF1a done.** Wired the v13 Memory scene: `view==='memory'` now renders `MemoryView` (the "Save a preference?" scope-capture scene) instead of falling back to Library. MemoryView component already existed + is faithful (scope chips, honest "save disabled until writable backend"); it was just never routed. Gate green: bundle + static 760 + a11y 121 + smoke. **QF1b theme:** DESIGN.md doesn't mandate a default; kept dark (matches the user's global preference) with v13 light as the working toggle — no risky whole-app flip. QF1c (richer card context) is data-dependent, deferred.
- 23:56 — **Q11 PASS (verify).** Booted the SOURCE gateway binary (has the connector route) on a fresh HOME + Composio key: configure 200, /connectors/connected 200 (all accounts), GMAIL_FETCH_EMAILS read 200 successful w/ 3 real messages, and the write-gate rejected GMAIL_SEND_EMAIL (send off) + GMAIL_DELETE_MESSAGE (forbidden) + draft-tool-on-read-route. Connector unit tests 5/5. Found: source fork lacks /llm (404) → connector route must be rebased onto current main (which has /llm+agent) → that + Q12 are the careful MORNING task (Q11b). Gateway changes preserved in working tree, not committed unattended (57-file multi-source branch). Reprioritized remaining overnight work to safe frontend QF1/Q2. Evidence `/tmp/wb-q11.mjs`.
- 23:35 — **QA PASS (major).** Booted the REAL prebuilt sidecar `ironclaw-reborn-aarch64-apple-darwin` with the Keychain NEAR AI token on a throwaway HOME. `/api/webchat/v2/llm/providers` = **200** (providers incl. nearai; active provider=nearai model=auto). createThread 200; sendMessage 200 (outcome:submitted, turn_id returned); timeline produced the assistant reply ("pong"). **Conclusion: the real gateway + agent runtime + existing token WORK end-to-end.** The prior "agent never completes" was the divergent dev fork/proxy, not the product. Verify-only (no repo changes); evidence script `/tmp/wb-qa.mjs`. Next: Q11 — build the source gateway with the connector route + verify connector reads/writes live.

## Morning brief (filled at Qf)
_pending_

## Needs you (morning)
- Enable real outbound sends (+ approve the first real send) — currently drafts-only by design.
- Review the branch + merge to main.
- (NEAR AI auth is NOT needed — existing Keychain token used + verified.)
