# THE LIVE RICH BRIEFING RENDERS (2026-06-23 15:38 EDT)

## Root cause FIXED
The briefing reverted to null because RequireAuth (app/app.js) did `if (auth.isChecking) return
<AuthLoading/>` — so a BACKGROUND token re-exchange (isChecking flips true again; auth.js calls
queryClient.clear() on exchange) swapped the whole tree to the loading screen, UNMOUNTING + remounting
every page below and resetting WorkbenchPage's useState (briefing -> null). Confirmed by instrumentation:
"PAGE MOUNT ... briefing det ... PAGE MOUNT ... briefing NULL".

FIX (1 line, app/app.js): `if (auth.isChecking && !auth.isAuthenticated) return <AuthLoading/>` —
only block on the INITIAL check; once authenticated, a background re-check keeps the app mounted. This
is independently correct (never tear down an authenticated app on a background re-validation) and fixes
ALL WorkbenchPage state loss, not just the briefing.

## LIVE PROOF (standalone, healthy connectors, GLM-5.2)
Triggered "What needs me today?". det rendered + PERSISTED (8s, 20s), then the one synthesis turn
(needsYou) converged (~20s) and upgraded to the RICH brief — and it STAYED. Screenshot shows:
- "DAILY BRIEFING · UPDATED JUST NOW" + "1 awaiting your reply · 4 weekly signals" (Newsreader serif)
- NEEDS YOU · 1: "Email · Alex Scharrer", badges "FYI · time-sensitive", synthesized context
  "Alex thanking Arthur ... ETF targeting a September go-live. As CLO this sits on you because an ETF
  launch is a regulatory..." — real, domain-scoped, in the user's voice.
- THIS WEEK · 4: real calendar items ("[ooo] Chris · Tue 23 Jun", "Hot Takes | NEAR | Abhishek
  Vaidyanathan <> Wachsman · Wed 24 Jun · 9:00").
- v13 fidelity intact (serif, blue #1c63d6, dark dock).
worthWeighingIn was empty this session (no slack signals hit a domain trigger — deterministic radar,
honest). Full gate green: static 882, a11y 140 (incl auth-redirect), design DT-1..6, smoke, cold-start
397.1<401.

## NET: briefing-as-home WORKS LIVE. The home is the daily briefing.
