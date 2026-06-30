# Loop #13 (P3) — behaviour-profile core for the "You" surface (2026-06-22 02:53 EDT)

The "You" surface's validated foundation (UI next tick), mirroring the build-core-first
pattern. Pure, no I/O — callers pass already-read normalized messages.

- `pages/workbench/lib/workbench-profile.js`: `computeBehaviourProfile({ sent, inbox })`
  → { people:[{email,tier,replyRate,medianLatencyHrs,received,replied,bulk,important}],
  counts:{senders,vip,respond,fyi,ignore,bulk}, patterns:[] }. Same tier rubric as the
  validated standalone engine (bulk+unreplied→ignore; fast 60%+→vip; 30%+→respond; else
  fyi); ranks VIP-first; patterns are evidence-backed only.
- **Unit tests (4):** Dana (fast 100% replier)→VIP, news@substack (unreplied)→ignore,
  colleague (read, unreplied)→fyi; VIP ranks first; patterns name the fastest VIP + report
  filed bulk; empty input degrades safely.
- **Live-validated on real mail** (gateway :17640, sent+inbox reads → compute): 17 distinct
  senders; **11 newsletters correctly tiered ignore** ("11 bulk senders auto-filed"); 6 real
  humans listed (anelda, richard@fabric.vc, harshit, chris.briseno, jonathan, deana).
  HONEST CAVEAT: with only a small live sent-read (12) the reply-threads aren't matched, so
  humans show fyi (0%); VIP/respond tiering needs fuller sent history — the standalone engine
  on 180 sent confirms the real tiers (john@salt.org, tjkovacs → respond). Logic correct;
  the You-surface tick will read a larger sent window.
- **Gate green:** test:static 807 (4 new tests), design DT-1..6, a11y 138, smoke. No UI
  change (module not yet bundled) → no design risk.

Next: render the "You" surface from this core (with a fuller sent read); long-horizon research proof.
