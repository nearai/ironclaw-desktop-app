# Workbench Build-Out — Overnight Run STATUS

**Run started:** 2026-06-20 23:12 EDT (epoch 1782011524) · **Budget:** ~8h → deadline ~07:12 EDT (1782040324)
**Branch:** `workbench-overnight-20260620` (desktop repo `nearai/ironclaw-desktop-app`) — NOT merged to main; for your morning review.
**Plan:** `~/.claude/plans/squishy-wobbling-sparrow.md`
**Discipline:** every task = implement → full gate (prepare + test:static + a11y + smoke; cargo for backend) → commit only if green; revert + log BLOCKED if red. No regression. No merge to main.

## Gate baseline (green restore point)
- Commit `f986602` "baseline: workbench session work + regenerated bundle".
- `test:static` 759/759 · `test:a11y-static` 120/120 (incl. `tests/static/workbench-static.spec.ts`) · `smoke:webui-static` PASS · prettier hook clean.
- Note: the tree's static + Playwright suites were ALREADY green at start (the `sourceProblems` briefing spec is satisfied; extensive workbench Playwright coverage already exists). Starting point is healthier than the plan assumed.

## Queue status
| ID | Task | State | Commit | Verified by |
|----|------|-------|--------|-------------|
| Q0 | Branch + green baseline | ✅ done | f986602 | 759 static + 120 a11y + smoke |
| Q1 | Kill proxy; document `tauri dev`; sidecar build pipeline | ⏳ | | |
| Q2 | Visual-regression / screenshot harness; baselines | ⏳ | | |
| Q3–Q10 | v13 fidelity spec items (read spec first → real gaps) | ⏳ | | |
| Q11 | Port connector route into real gateway build (cargo) | ⏳ | | |
| Q12 | `/workbench/execute` endpoint + LIVE agent verify (keychain token) | ⏳ | | |
| Q13 | Live agent/command-box + connector-read smoke | ⏳ | | |
| Qf | Final gate, push branch, PR, morning brief | ⏳ | | |

## Running log
- 23:12 — Q0: created branch off `codex/workbench-overhaul-backend-loop`; regenerated bundle; full gate green; committed baseline f986602. Began STATUS.

## Morning brief (filled at Qf)
_pending_

## Needs you (morning)
- Enable real outbound sends (+ approve the first real send) — currently drafts-only by design.
- Review the branch + merge to main.
- (NEAR AI auth is NOT needed — existing Keychain token used + verified.)
