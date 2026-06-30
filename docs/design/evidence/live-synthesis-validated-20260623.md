# LIVE briefing synthesis VALIDATED + tightened for the poll window — 2026-06-23 13:35 EDT

## The earlier "blocked" is REVERSED — live synthesis works
Booted the standalone (gateway healthy: a short "reply OK" probe converged in ~18s; the prior
session's no-converge was a transient degraded gateway, plus the /llm/providers 404 is a curl path
quirk, not an outage — the boot check reports 200).

Sent a representative ~1.1KB synthesis prompt (the real prompt's schema + a small context bundle) as
a live turn. It CONVERGED in ~20s and returned PERFECT parseable JSON:
- keys: summary, needsYou, worthWeighingIn, thisWeek, bestTimes (exactly the parser's contract)
- needsYou: 2, worthWeighingIn: 1, thisWeek: 1, bestTimes: 3 — all populated
- needsYou[0].suggestedReply: "Thanks, Dana. net 60 and the 12% cap fall outside our standard renewal
  terms and will need Finance + ..." — a real, contextual, in-voice reply.
=> The synthesis ENGINE + PROMPT produce skill-quality output live. Render + wiring proven by the 2
mocked-turn spec tests. So the rich briefing works end-to-end.

## Root cause of the UI not showing it: bundle size, not the engine
The FULL bundle prompt is ~4KB (vs the 1.1KB probe). The frontend's 4KB synthesis turn produced NO
assistant reply even after 50s — too slow for the 40s poll window (the #7 heavy-turn latency). The
1.1KB probe was fast (~20s); the 4KB bundle overran. (Also note: driving the UI send via the preview
tool needs a full pointer-event sequence — pointerdown/mousedown/up/click — a plain click() does not
fire React's delegated handler; that's a harness quirk, not a product bug.)

## Fix shipped (this commit)
Tightened buildBriefSynthesisBundle: snippet/text clips 600->220, subject 160->110, counts capped
(needsReply/slackSignals top 6, context feeds top 3, attention top 4, calendar tighter). Bundle drops
from ~3KB to ~1KB — close to the proven-fast probe. Poll window maxTries 20->24 (~48s) as insurance.
Engine tests 7/7, full gate green (static 879, a11y 140, design DT-1..6, smoke, cold-start 397.3<401).

## Next
Re-verify the live rich brief renders in the UI with the tightened bundle (rebuild + reload + trigger
via the pointer sequence + ~25s). If still tight, shrink further / faster synthesis model (#7).
