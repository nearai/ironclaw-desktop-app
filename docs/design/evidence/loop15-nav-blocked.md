# Loop #15 — /you nav promotion BLOCKED (a11y) + mandated validation PASS (2026-06-22 03:45 EDT)

## Attempted: promote /you to the visible primary nav
Unhid the route, added it to the Work nav section, added `nav.you` to en.js (count
933→934 + BASELINE_MISSING_KEYS, the repo's pattern), updated the IA-guard expected list.
test:static went green (808). **a11y went RED, deterministically (2 runs):** 4
`connections` sub-pages each hit one `scrollable-region-focusable` (serious) violation —
an empty conversations sub-panel (`div.overflow-y-auto.[scrollbar-width:thin]`,
"No conversations yet") that lacks keyboard access. It only trips with the 7th visible
nav item present.

Per the no-regression guardrail (red after one retry → revert + log BLOCKED), the
promotion was **reverted**: tree back to green (static 808, a11y 138). `/you` stays
hidden but reachable (loop #14). 

**Prerequisite to unblock:** give the empty conversations scrollable region keyboard
access (tabindex=0 / role+aria-label) in the shared chrome, then re-attempt promotion.
That a11y fix is its own (shared-component) change — next tick.

## Mandated validation (does it still work for HIM after 14 ticks) — ALL PASS
- connector suite **14/14** (`connector-live-test.mjs --write`, live Composio): 8 accounts,
  6 families read, write-gate (send rejected / delete forbidden / draft 200), agent turn.
- profile engine (180 sent / 250 inbox / 98 senders): V1 newsletter suppression 0 leaked,
  V2 surfaces 2 real human threads (john@salt.org, tjkovacs@fbi.gov), 0 bulk.
