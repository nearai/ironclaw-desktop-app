# Synthesis split — live results + remaining blockers (2026-06-23 14:32 EDT)

## What works (committed c3d68b5, gate green)
- synthesizeBriefing now runs TWO parallel turns (needsYou + radar) and merges. Engine 8/8, full gate
  green, the mocked a11y rich-brief test renders all five sections.
- LIVE: triggering "What needs me today?" fires BOTH turns (two synthesis threads created on the
  gateway — the split is real). The **needsYou turn (1065-char prompt) CONVERGED** with valid JSON
  (keys=['needsYou']) in ~30s — in-window.

## Remaining blockers (NOT yet a usable live rich brief)
1. **Radar turn still too slow.** The radar turn (1795-char prompt: worthWeighingIn over slack
   signals + domainTriggers + calendar) produced NO reply even at >58s. So the split helped the
   needsYou half but the radar half still overruns on z-ai/glm-5.2 — even ~1.8KB generative turns are
   slow on this gateway. This is the core #7 latency wall.
2. **Promise.all design flaw.** synthesizeBriefing awaits BOTH turns before rendering — so the whole
   briefing waits for the SLOW radar turn (up to the 48s timeout) instead of rendering the ready-at-
   ~30s needsYou immediately. FIX: progressive render — setBriefing(needsYou) as soon as turn A
   resolves, then merge radar when turn B resolves (two state updates, not one Promise.all).
3. **Live render hiccup.** After triggering, NEITHER the deterministic NOR the rich brief appeared in
   the DOM (decisions + command bar were present, no console errors). The deterministic rendered fine
   in earlier sessions, so something in the two-turn flow / token guard / lazy-Suspense interaction
   needs proper debugging (React DevTools / instrumentation), not eval-poking.

## Next (scheduled)
- Make the split PROGRESSIVE (render needsYou immediately; radar fills in or is deterministic) — this
  also sidesteps the radar-latency wait. 
- Debug the live non-render (instrument runBriefing / the briefingTokenRef guard / the Suspense
  boundary).
- Consider a DETERMINISTIC radar (the workbench-radar.js domain/channel scoping already exists — the
  "worth weighing in" set could be derived without an LLM turn) to remove the radar LLM turn entirely.
- Root dependency remains gateway #7 turn latency.
