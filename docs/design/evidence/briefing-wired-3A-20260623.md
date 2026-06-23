# Briefing-as-home WIRED (step 3/3 A) + live-verify BLOCKED (gateway provider) — 2026-06-23 13:03 EDT

## Shipped (commit 49160e6, gate GREEN, pushed)
runBriefing renders the deterministic briefing INSTANTLY, then fires a tool-free synthesizeBriefing
turn; on success swaps in the rich five-section WorkbenchBrief (briefingTokenRef guards the swap).
onBriefDraftReply maps a rich item -> inbox message by id -> gated draft modal pre-filled.
WORKBENCH_PROFILE configured for Abhi (CLO + 5 channels), radar module stays generic.

## Proven (mocked-turn spec tests, GREEN)
- "a briefing trigger upgrades to the rich five-section brief via a synthesis turn" (2.6s): with a
  mocked synthesis turn returning rich JSON, the home renders all five sections + the inline reply
  textarea pre-filled. 
- "falls back to the deterministic brief" (2.8s): synthesis returns no JSON -> deterministic stays.
- Full gate: test:static 879, test:a11y-static 140 (+2), design DT-1..6, smoke, cold-start 400.3<401.
- Race-safe: fixture records only external/command sends (excludes the read-only synthesis prompt),
  fixing 2 failing + ~3 latently-racy briefing tests with one rule.

## Live-verify on the standalone: BLOCKED (environmental, not code)
- Deterministic briefing rendered live ("Good afternoon. 1 reply waiting, 1 Slack item, 5 GitHub
  items, and 5 events..."). Fallback works — never blank.
- The rich brief did NOT render live: the synthesis turn produced NO assistant reply after 60s.
- ROOT CAUSE (isolated): a trivial "reply OK" probe turn ALSO produced no assistant reply, and
  GET /llm/providers returned **404** (was 200 at boot) — the gateway's LLM provider dropped mid
  session, so NO agent turn converges (the #7 turn-convergence issue / a flaky NEAR AI provider in
  this boot). Not specific to the briefing prompt; not a wiring defect.
- IMPLICATION: the live rich brief needs a healthy gateway turn to demo. Re-verify when the standalone
  gateway's LLM provider is up; consider a faster/smaller synthesis model + a tighter prompt to make
  the turn cheap, and widen/stream the poll window. Tie-in: task #7.
