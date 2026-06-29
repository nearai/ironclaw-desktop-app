# Workbench — Autonomous Evening Build (2026-06-28 →)

Operator: Abhishek (CLO, NEAR AI). Works by triage — wants what needs his attention/decision
**surfaced proactively**, hates noise, legal/strategy focus. The product bar: a prepared
chief-of-staff desk, not a chatbot.

## ☀️ MORNING BRIEF — 2026-06-29
Branch `workbench-overnight-20260620` @ `83b88b3`, clean + pushed. Review live:
`http://127.0.0.1:17641/workbench#token=workbench-standalone`.

**Shipped + verified this session (your 3 steering complaints, all fixed):**
1. **Slack now surfaces current activity** (`9c90bb0`). Root cause: identity resolution scanned
   only the first 200 workspace members; in the >1000-member Enterprise Grid you weren't on that
   page, so the whole deep read silently went empty. Fixed via direct email→Slack-id lookup.
   Live: 0 → real awaiting + worth-weighing-in cards; unresolved authors read "a teammate".
2. **Chat is its own surface** (`7580c0b`) — "Chat" nav entry, linked to History; no more inline
   strip under triage. Ask + History-reopen open the dedicated conversation view.
3. **Rail "Slack" group shows current activity** (`59d37d6` + integration lock `fad3de7`) — was a
   relevance-ranked keyword search (the "4 blockers frozen at 10 days"); now the live deep read.
4. **Slack relevance now biases toward what a CLO must see** (`1fd56ef` → corrected `83b88b3`): a
   first attempt to lexically drop announcement/celebration noise was caught by adversarial review
   as **false-dropping real legal threads** (SEC inquiry, MSA indemnity, contract auto-renewal —
   legal posts share the same broadcast forms as noise). Reverted; replaced with a **positive
   LEGAL_RE boost** that force-surfaces legal/regulatory/contract substance and can never drop it.

Every commit passed the full gate (≈968 unit / 148 a11y / DT design / smoke / bundle) + was
live-verified in a real browser. Two adversarial reviews run (4 + 11 agents); the second caught the
trust-destroying regression above — worth the cost.

**Needs your call (held — not built unsolicited):**
- **Semantic weigh-in de-noising.** The anniversary/brand-refresh noise on the default home is
  back (the safe trade-off above). The right fix is routing the home weigh-in through the LLM radar
  (`buildWorthWeighingInPrompt`) which can tell celebration from substance — but that's an LLM turn
  on home load (latency/cost). Greenlight if you want it.
- **Link-share / FYI noise** ("kyle shit talking NEAR", livestream FYIs) — drop these from
  weigh-in, or keep as competitive intel? Your call.
- **Web search** — root-caused + fix proven, deferred on a 153s boot-perf regression (needs an
  async gateway-activation fix). Still human-gated.
- **First real Slack send** — the reply path is open-thread / copy / draft (zero-write); enabling a
  real outbound send is a deliberate human checkpoint.

**No clearly-valuable SAFE autonomous work remained after the above** — the loop is holding at a
calm cadence rather than churning. Tell me which held item to take and I'll run it.

## GOAL (primary directive)
Ensure **successively more difficult product tests and functionality continue to work** — every
evening. The loop is build → test harder → fix red → raise the bar. Don't just add features; prove
they hold under progressively harder, real end-to-end scenarios against the LIVE standalone (real
connectors + real LLM), and keep the whole ladder green as new work lands.

### Per-iteration protocol
1. **Regression first**: re-run the current LADDER (live, in a real browser via a throwaway
   `_verify.mjs` vs http://127.0.0.1:17641/workbench#token=workbench-standalone). Any red → FIX it
   before new work. Record pass/fail + evidence (screenshot to docs/design/evidence/ladder/).
2. **Advance**: take the next highest-value build item (the vision: proactive Notion/Slack), ship it
   full-gate-green + live-verified, commit, push.
3. **Raise the bar**: add the next-harder LADDER level that exercises what you just built; make it
   pass. Persist durable deterministic coverage in the gate (tests/static specs) where the scenario
   can be mocked; keep the live end-to-end runs as the escalating smoke ladder.
4. Log results + the new ladder level in this file. Never end on a question; if blocked, log BLOCKED
   and advance a different item.

### Product test LADDER (escalating; keep all green, extend upward)
- **L1 Boot/load** — home renders, loadCount===1, no console errors; connectors read (gmail/notion/slack).
- **L2 Ask conversation** — a plain question returns a CLEAN inline reply (markdown rendered, no raw
  `##`); a follow-up in the same thread works; no `/chat` navigation, no connect-command misfire.
- **L3 Triage** — decision cards render; "Draft reply" opens a gated draft; calendar-invite noise is
  filtered out of "needs a reply"; dismiss works.
- **L4 Proactive (the vision)** — Notion newly-created pages (Project Passports) are summarized on the
  home; Slack "awaiting reply"/"worth weighing in" surface on the DEFAULT home; "Catch me up" briefing
  produces both Slack sections + needs-you.
- **L5 Multi-step task** — a multi-tool Ask plans, calls tools, and returns a real answer; the run
  timeline shows tool steps; conversation continuity across 2+ follow-ups holds.
- **L6 Cross-tool chain** — e.g. "summarize the latest Project Passport and draft a Slack note about
  it" chains Notion read → summarize → gated Slack draft (no ungated send).
- **L7 Resilience** — a connector error renders an honest state (not a hang/blank); stale data
  refreshes on focus; a past conversation can be reopened (#6).
- (extend L8+ as features land — gated email send round-trip, scheduled/recurring proactive digest, etc.)

## Operating rules (every item)
- Branch: `workbench-overnight-20260620` in `~/Documents/Playground/ironclaw-desktop-app-main`.
- Full gate green BEFORE commit: `npm run prepare:webui-static` + `test:static` + `test:a11y-static`
  + `smoke:webui-static` + `test:design-static` + `node scripts/check-static-bundle-size.mjs` (cold <401KB).
- LIVE-VERIFY in a real browser (throwaway `_verify.mjs` in-repo, `{chromium} from '@playwright/test'`
  vs the standalone, assert loadCount===1, screenshot to docs/design/evidence/, delete the script).
- Commit as `git -c user.name=abbyshekit -c user.email=abby.vaidyanathan@gmail.com`. `git checkout`
  the tailwind.generated.css before commit; rebuild bundle before push; push every 2-3 commits
  HTTP/1.1 `--no-verify`. NEVER commit secrets (COMPOSIO/JARVIS/EXA keys are env-only).
- Standalone boot: `COMPOSIO_API_KEY=… JARVIS_API_KEY=… NEARAI_MODEL=z-ai/glm-5.2 node scripts/workbench-standalone.mjs`
  (detached via nohup so it survives turns).
- **Restart CLEANLY (gotcha, 2026-06-29):** the standalone spawns the gateway (`ironclaw-reborn …
  serve --port 17640`) as a child. Killing ONLY the webui pid orphans the gateway, which keeps
  holding 17640 → the next boot can't bind it → crash-loop → 20-restart cap → gives up (webui dies
  too). Always kill BOTH + free both ports before relaunch:
  `pkill -9 -f "ironclaw-reborn-aarch64-apple-darwin serve"; pkill -9 -f "scripts/workbench-standalone.mjs";`
  `lsof -ti tcp:17640 tcp:17641 | xargs -r kill -9` — then wait for both free, then nohup-launch.
- Use Workflows for substantial chunks + adversarial review (near-ai-code-review / codex-fanout).
- Gated-write posture holds; outbound sends per-message approved. Slack send before a PR needs the review gate.

## ⚠️ USER STEERING 2026-06-29 (TOP PRIORITY — above everything below)
Operator feedback after using it: Slack still doesn't work, and the chat UX is wrong. These
SUPERSEDE the P3 UX micro-polish. Diagnosed live:

### PA — Slack actually works (see current activity + respond)  [HIGHEST]
Root causes (verified live against the standalone):
1. The rail "Slack blockers" is `SLACK_SEARCH_MESSAGES` (keyword: blocked/stuck/waiting) — Slack
   returns RELEVANCE-ranked matches, so it shows the same old messages (May 20 / Jun 7 / Jun 24)
   and looks frozen "at 10 days ago". It is not current activity.
2. The proactive deep read (awaiting / worth-weighing-in) matches the user's email against
   SLACK_LIST_ALL_USERS to detect @-mentions — but that call returns **0 members** live (Composio
   Slack connection lacks users-read scope / not paginating). No identity → awaiting+weigh-in are
   ALWAYS empty → nothing surfaces on the home → nothing to respond to.
- [x] **FIXED (2026-06-29).** The real root cause was not "0 members" (that was a probe parse
  error) — SLACK_LIST_ALL_USERS returns 200, but identity resolution scanned only that first page;
  in the >1000-member near-foundation Enterprise Grid the signed-in user is not on it, so
  `resolveSlackSelf` returned null and the WHOLE deep read silently degraded to empty. Fix = resolve
  identity DIRECTLY via SLACK_FIND_USER_BY_EMAIL_ADDRESS (users.lookupByEmail; workspace-size
  independent — verified returns U04MWJDB7EK), member-scan as fallback. Also: unresolved author ids
  (per-id user-info tool is unavailable on this connection; org too large to paginate) now render
  "a teammate", never a raw U0…/W0…/B0… id. Lib + regression tests (33 green); FULL gate green
  (961 unit / 142 a11y / DT-1..6 / smoke / bundle <401). LIVE-VERIFIED in a real browser: identity
  resolves → 1 awaiting + 5 worth-weighing-in cards render where there were zero, bundleLoads===1,
  "a teammate" confirmed on screen (docs/design/evidence/slack-deepread-live.png).
- [x] **FIXED (2026-06-29).** The rail "Slack blockers" group now feeds from the CURRENT deep-read
  activity (slackActivity = awaiting + worth-weighing-in) instead of the relevance-ranked keyword
  search; relabeled "Slack" with an honest empty state. `connectorSlackRows` is source-agnostic
  (replyHref|permalink) and drops the "@" prefix (deep-read `who` is a resolved name / "a teammate").
  Keyword SLACK_SEARCH is kept only as the fallback + for the on-demand "Find Slack blockers" chip +
  the catch-up briefing (those 3 specs still green). FULL gate green (962 unit / 147 a11y / DT-1..6 /
  smoke / bundle). LIVE-VERIFIED: rail "Slack" group shows current items (Privy/#c-ecosystem-chat,
  brand-refresh/#general, Illia/#general, #n-berries), zero stale keyword text, bundleLoads===1
  (docs/design/evidence/rail-slack-current.png). Reply path stays Open-thread/Copy/Draft (zero-write);
  first real Slack SEND remains a human checkpoint.

### PB — Chat UX: dedicated surface, not an inline bar  [HIGH]
The conversation renders inline below the home (a cramped strip). The operator wants chat to open
as its OWN surface — a "Chat" nav view, linked to History — so asking opens a focused conversation.
- [x] **DONE (2026-06-29).** New `ChatView` (`components/workbench-chat-view.js`) renders the run
  surface full-width on its own `view==='chat'`; removed the inline WorkbenchSceneWorkspace from
  HomeView (+ the startedWork is-wide tie). Ask (handleStartedWork) → setView('chat'); History
  reopen → setView('chat'); added a "Chat" nav entry (chat icon, after Work), a "Go to Chat" palette
  command, the g→c nav chord, and the Work/Chat breadcrumb. Honest empty state when nothing's open
  (CTAs to Work / History). Gated-write posture + markdown + composer unchanged. Tests: reframed the
  History-reopen spec to assert the Chat surface + 2 new specs (Ask opens Chat not inline; empty
  state). FULL gate green (961 unit / 147 a11y / DT-1..6 / smoke / bundle). LIVE-VERIFIED light+dark:
  no inline scene on home, Chat nav becomes current on Ask, brief input gone, bundleLoads===1
  (docs/design/evidence/chat-surface-{light,dark}.png, chat-empty-state.png).

## Ranked plan (highest value first — the vision leads)

### P0 — Web search (ROOT-CAUSED + fix PROVEN; blocked on boot-perf — deferred)
Root cause was NOT the key (mcp.exa.ai is keyless + returns real results, verified). The gateway never
auto-activated the bundled `web-access` extension, so `web_search` was advertised but had no capability
grant / network policy → dispatch parked at "Running" forever.
- Gateway fix written + PROVEN: auto-activate web-access at boot in
  `~/Documents/Playground/ironclaw` `crates/ironclaw_reborn_composition/src/factory.rs` (build_local_dev).
  Boot log confirms `web-access auto-activated; web_search is available`. Preserved on gateway branch
  `feat/web-access-autoactivate` (NOT on reborn-integration).
- BLOCKER: activating in build_local_dev (the boot critical path) regressed gateway readiness from
  ~3s → ~153s (install/activate/publish path is pathologically slow at boot; materialize itself is
  fast, so it's the lifecycle-service install/enable or active_extensions.publish). A 153s boot is
  unusable, so the OLD fast binary is staged for now (everything else works; web search does not).
- NEXT (focused gateway task): make activation ASYNC — clone Arc<extension_management>, `tokio::spawn`
  the install+activate AFTER the listener binds so boot stays ~3s and web-access activates in the
  background; OR root-cause the 150s in the install/publish path and make it fast. Then rebuild +
  stage + verify a real `web_search` Ask returns cited results, and connectors/jarvis still work.
- `scripts/workbench-standalone.mjs` waitForGatewayReady bumped to 240 (120s) as a safety margin.

### P1 — Proactive intelligence (THE vision: "surface what I should care about")
Make the DEFAULT home proactively surface what matters, not on-demand only.
- [x] **Notion new-creation surfacing (v1)** — SHIPPED + live-verified (commit a399f56). "New in
  Notion" home band: pages created/edited within 7d not yet reviewed, Created/Updated pills, opens
  in-app reader, "Mark reviewed" diffs a localStorage seen-map; honest-empty. lib + 6 unit tests.
- [x] **Notion content gist (v2)** — SHIPPED + verified (commit fa81ac0). Each band card reads
  NOTION_FETCH_BLOCK_CONTENTS and shows a 1-line gist of what the page is (pure notionGist, 3 unit
  tests, honest-empty + quiet "Reading…"). Live: per-card read fires; standalone stub pages return
  0 blocks → honest-empty (correct); populates for content-bearing pages.
- [x] **Slack matters-surfacing on the default home** — SHIPPED + verified (commit 6e3ab5e).
  "Worth weighing in" now surfaces on the DEFAULT home alongside "awaiting your reply" (was
  briefing-only), ranked by FootprintGatedRelevance, honest-empty. Generalized WorkbenchSlackReplies
  (title/testid) + deterministic L4-Slack test (a paired @-mention gives FGR footprint so the
  weigh-in survives ranking). Live: honest-empty in the standalone (no Slack identity match).

### P2 — Conversation history (#6)
- [x] **Conversation history + reopen** — SHIPPED + verified (commit 9e1390d; ladder L7). "History"
  nav view lists past threads (useThreads) and reopens one into the run surface (pure fn of threadId),
  honest loading/error/empty. Deterministic L7 test + live (Ask → History → reopen mounts scene).
- [x] **Cleaner thread titles** — SHIPPED + verified (commit 4a4d825). History remembers the clean
  brief per thread (localStorage) and prefers it over the gateway's scaffold title; rows are now
  distinguishable. 4 unit tests; live: an Ask shows its exact question in History.

### P3 — UX/UI craft pass (#8)
- [x] **Pass 1 — calm home headers** (commit e777fe3): aligned the proactive bands to one quiet
  sentence-case label (dropped the uppercase eyebrow tell + accent-pill count); Triage stays the
  single focal heading. Light+dark verified. Next passes below.
- [ ] Spacing/hierarchy/states across the shell + cockpit using the installed craft skills
  (interface-design, make-interfaces-feel-better, baseline-ui). One focal point per view; quiet rail;
  consistent card rhythm; loading/empty/error dignity.

## Log
- 2026-06-28: Plan created. P0 gateway build in flight (web-access auto-activate). Prior this session:
  markdown replies, Notion body text, stale-read refetch, jarvis connect, gated Slack reply — all
  shipped + pushed (eb35969).
- 2026-06-28: P0 web search root-caused + fix proven but boot-perf-blocked (gateway branch
  feat/web-access-autoactivate; old fast binary kept). GOAL reframed to successively-harder product
  tests + a 7-level LADDER. Loop iter 1: P1a "New in Notion" surfacing SHIPPED + live-verified
  (a399f56, pushed 16dce35); L1 boot/load + L4-Notion green. Next: P1a content gist OR P1b Slack-on-home.
- 2026-06-28: Loop iter 2: P1b Slack 'worth weighing in' on the default home SHIPPED + verified (6e3ab5e, pushed bc3766c). L4-Slack green (a11y 144). Next: P2 conversation history OR Notion content gist OR P3 UX craft.
- 2026-06-28: Loop iter 3: P1a v2 Notion content gist SHIPPED + verified (fa81ac0, pushed 94cb5a2; static 954, a11y 144). Proactive vision fully done (Notion surfacing+gist, Slack awaiting+weigh-in). Next: P2 conversation history (enables L7 reopen) OR P3 UX craft.
- 2026-06-29: Loop iter 4: P2 conversation history + reopen SHIPPED + verified (9e1390d, pushed fe456d2; static 954, a11y 145; ladder L7 green live). Next: thread-title follow-up OR P3 UX craft pass.
- 2026-06-29: Loop iter 5: cleaner History thread titles SHIPPED + verified (4a4d825, pushed 2706d16; static 958, a11y 145). P1+P2 fully done (vision + history + titles). Next: P3 UX craft pass (interface-design / make-interfaces-feel-better).
- 2026-06-29: Loop iter 6: P3 UX pass 1 (calm consistent home headers) SHIPPED + verified light+dark (e777fe3, pushed f6d49b2; static 958, a11y 145, design DT green). Next: more UX passes (rail quiet, card rhythm, empty/error dignity) or other follow-ups.
- 2026-06-29: Loop iter 7: P3 UX pass 2 — visible keyboard focus rings across interactive surfaces (a11y win) SHIPPED + verified (90873ce, pushed c646b31; static 958, a11y 145, design DT green; rail already hides empty groups). Next: card rhythm/states, light+dark contrast audit, or run-surface spacing.
- 2026-06-29: Loop iter 8: P3 UX pass 3 — WCAG-AA text contrast (muted/faint darkened, both themes) SHIPPED + verified (6fa8bcb, pushed 9aa17ef; static 958, a11y 145, design DT green). FOLLOW-UP logged: is-reply pill 3.09 in light. Next: is-reply pill contrast, card rhythm/states, or run-surface spacing.
- 2026-06-29: Loop iter 9: P3 UX pass 4 — is-reply status-pill AA contrast (--wb-accent-ink token, light 4.9 / dark 5.9) SHIPPED + verified (67f28c7, pushed c5d0b58; static 958, a11y 145, design DT green). Contrast audit fully closed. Next: card hover/active states, run-surface spacing, or harden a feature with a spec.
- 2026-06-29: USER STEERING fixes (interactive): PA Slack deep-read identity by email lookup (9c90bb0), PB Chat dedicated surface (7580c0b), rail Slack group → current deep-read activity (59d37d6) — all gate-green + live-verified + pushed; adversarial review (Codex ∥ Claude, 4 agents) found 0 real defects. Loop iter 10: hardened the rail fix with an integration spec (rail shows current deep-read activity, never the keyword search even when it returns rows; static 962, a11y 148, design DT green). Next: optional weigh-in NOISE tuning (live showed anniversary/brand-refresh as "worth weighing in" — the user hates noise; needs-judgment, flagged not auto-tuned), or other hardening. Web search still deferred (boot-perf, human-gated).
- 2026-06-29: Loop iter 11: weigh-in NOISE tuning SHIPPED + live-verified. Added ANNOUNCEMENT_RE (anniversaries, "Hi team, we heard…", proud/happy/excited to share|announce, icymi, please join) folded into the isSocial dampener (still guarded by address===0 && !hasAsk && urg===0) — so busy congratulatory/announcement threads no longer force-keep via the ≥3-replier `substantive` rule, while real decision discussions with no announcement language (the "restructuring the org" case) stay kept. 4 new relevance tests; all 37 slack + 966 unit / 148 a11y / DT / smoke / bundle green. LIVE: weighIn 5→3, anniversary + brand-refresh dropped, real items survive (docs/design/evidence/weighin-noise-tuned.png). FLAGGED (needs-judgment, NOT auto-tuned): remaining surfaced items are link-shares/FYIs ("kyle shit talking NEAR", a Consensus livestream) — whether competitive-intel link-shares are "worth weighing in" is the operator's call; did not over-reach per "don't over-fit". Next: await operator call on link-shares, or other hardening.
- 2026-06-29: Loop iter 12 (adversarial-review-driven CORRECTION): the iter-11 ANNOUNCEMENT_RE noise filter was UNSAFE — the adversarial review (11 agents, 2 confirmed HIGH + more candidates) proved it false-drops real CLO legal threads, because legal posts share the IDENTICAL broadcast forms as celebration noise: "Hi team, we heard from counsel the SEC has questions…", "the MSA's 3-year anniversary auto-renews unless we give notice", "Please join us to align on the cap-table before we file the charter", "ICYMI: the DOJ second request is due". Every token I added (anniversary/Hi team/we heard/icymi/please join) has a catastrophic legal false-positive. For a CLO a false-drop is catastrophic; a false-kept brand post is trivial. REVERTED the lexical filter (isSocial back to SOCIAL_RE only) and replaced it with a POSITIVE LEGAL_RE relevance boost (folded into the urgency family + qualifies a thread for the substantive force-keep regardless of vitality), so legal/regulatory/contract substance ALWAYS surfaces, even quiet/footprint-less. The review's confirmed false-drops are now KEPT-regression unit tests. Trade-off accepted: the anniversary/brand-refresh noise returns (safe); the correct semantic de-noiser for the default-home weigh-in is the LLM radar (buildWorthWeighingInPrompt) — FLAGGED as the real noise fix, not a lexical filter. 39 slack tests / 968 unit / 148 a11y / DT / smoke / bundle green; live-verified loadCount===1, 0 console errors (docs/design/evidence/legal-boost-live.png). LESSON: adversarial review before trusting a classifier change earns its cost — it caught a trust-destroying regression the gate did not.
- 2026-06-29: USER STEERING (urgent) — Slack MISSED a group-DM about fund misappropriation. Root cause (verified live): the deep read fanned out history over MEMBER CHANNELS only; SLACK_LIST_ALL_CHANNELS returns 0 DMs, and the connection's per-channel history works on DMs too but the code never requested them. NOT a re-auth/scope issue. FIX shipped: (1) recency feed — SLACK_SEARCH_MESSAGES `after:<date>` sort=timestamp (count 80) covers channels + 1:1 DMs (im) + group DMs (mpim) + channel @-mentions in one call; normalizeSlackRecentSearch tags kind. (2) classifySlackRow: a non-self message in an im/mpim is awaiting (direct → for you), even with no @-mention. (3) Critical safety net — two ≤5-term SLACK_SEARCH passes (Composio returns 0 for 6+ OR-terms) for fraud/financial-misconduct + legal-threat vocab; critical hits always classify awaiting from any channel/DM. (4) FRAUD_RE (+"pretence of") added to the legal boost; legal/fraud/critical awaiting items floor at 0.92 so they LEAD the section + win per-conversation dedupe (await-floor was masking the boost). (5) per-conversation dedupe on awaiting so one chatty DM can't flood. (6) readable DM/group-DM names. 8 new slack tests (43 total) / 972 unit / 148 a11y / DT / smoke / bundle green. LIVE-VERIFIED in a real browser: "awaiting your reply" now LEADS with the group-DM "vote under the pretence of funds being sent to nf, but instead being sent to a personal wallet" — the exact missed message — loadCount===1, 0 console errors (docs/design/evidence/slack-dm-coverage.png). Also documented the standalone clean-restart gotcha (kill orphaned gateway).
- 2026-06-29: Adversarial review of the DM-coverage change found 5 confirmed over-surfacing bugs (2 HIGH) — all fixed in commit-after-211cd76: (#1) stale all-time critical hits floored 0.92 ABOVE fresh owed replies → floor now 0.92*decay (stale decays out of the lead). (#2) non-directed channel critical hits flooded awaiting across channels → a critical hit only leads as 'awaiting' when DIRECTED (DM/group-DM/@-mention/your thread); else weigh-in. (#3) broad LEGAL_RE words (charter/renewal/breach) floored casual DMs to the top → lead-floor reserved for high-precision REGULATORY_LEAD_RE + FRAUD_RE + critical; broad contract vocab only boosts urgency. (#4) per-conversation dedupe dropped a 2nd distinct high-stakes item → lead items bypass dedupe. (#5) DM senders inflated peerScore distorting channel weigh-in → footprint built from CHANNEL history only (footprintHistories). +4 regression tests (46 slack / 975 unit / 148 a11y / DT / smoke / bundle green). Live: fraud group-DM still LEADS awaiting, bounded (awaiting 3 / weighIn 6), casual contract-word DMs no longer lead. The adversarial-review-before-trusting-a-classifier-change discipline caught real trust regressions a second time.
- 2026-06-29: Operator: "replicate how MCP does it using the skill I built." Found the spec — research/near-slack-personal-agent/daily-briefing-skill/ (Claude-first; lib/replystate.mjs = the reply-state gate). Shipped: (a) REPLY-STATE GATE replicated (slackSelfLatestByConv + buildSlackSignals drop-if-handled + classifySlackRow @mention-inThread→handled): an awaiting item is dropped when the user already answered it (posted in the conversation after the candidate ts, or replied in-thread) — biased to silence, re-implements replystate.mjs stillAwaiting. (b) VIEW/RESPOND BUG FIXED: workbench-slack-replies.js read item.permalink but deep-read items carry replyHref → the "Open thread" link NEVER rendered (the "can't view/respond" report); now uses replyHref → "Open in Slack" renders (live: 3 links, was 0). (c) IDENTITY: Composio has NO no-arg authed read (SLACK_FETCH_CURRENT_USER/AUTH_TEST/READ_USER_PROFILE all unavailable) — email-lookup (SLACK_FIND_USER_BY_EMAIL_ADDRESS→U04MWJDB7EK) stays the resolver. Main branch already current (0 behind, 303 ahead). +3 reply-state tests (49 slack / 978 unit / 148 a11y / DT / smoke / bundle green). LIVE-VERIFIED real browser: Open-in-Slack links render, loadCount===1, 0 console errors. CAVEAT logged: the gate only sees in-Slack reply signals within the search window; an out-of-band/handled item the user hasn't replied to in Slack still surfaces (honest limit).
- 2026-06-29: Adversarial review of the reply-state gate found 2 HIGH over-drops (+2 low) — FIXED. (#1) the gate dropped an awaiting item if the user posted ANYTHING later in the channel/DM (conversation-level), silencing e.g. an unanswered #eng "sign off on the release?" after any unrelated later post. Narrowed: the "posted-after" signal now applies ONLY to 1:1 DMs (im) — a 2-person thread where a later post IS a reply; group DMs + channels rely on the thread-scoped reply_users check in classifySlackRow, not conversation activity. (#2) critical (fraud/legal) items were being silenced by the gate → now NEVER dropped on conversation activity; a critical item is cleared only by an in-thread reply (classifySlackRow critical+inThread→null). (#low) empty/invalid candidate ts no longer treated as 0 (guarded → never drop). +3 over-drop regression tests (52 slack / 981 unit / 148 a11y / DT / smoke / bundle green). REMAINING accuracy step (queued): the skill's deeper per-thread reply_state via SLACK_FETCH_CONVERSATION_REPLIES for group-DM/channel candidates (compute user_messages_after_ask/last_message_user thread-scoped) — the only way to gate group-DM handled-state without over-drop.
- 2026-06-29: Deeper per-thread reply_state (item 1) INVESTIGATED → SKIPPED as moot (not churn). Verified live: the recent group-DM (mpim) messages are ALL FLAT (0 threaded) — SLACK_FETCH_CONVERSATION_REPLIES returns nothing useful for a flat message, and threaded asks are already covered by the reply_users in-thread check. So a per-candidate replies-fetch (~8 reads/load) buys no accuracy for the operator's actual case (a flat group-DM fraud post). HONEST ARCHITECTURAL LIMIT: a flat group-DM message has NO deterministic "handled" signal except conversation-level "self posted after" — which over-drops in multi-topic group DMs (adversarial-review confirmed) — so it's correctly NOT gated there; a critical/fraud flat group-DM item therefore persists by design (never-miss) until replied-to. The skill's real differentiator for this case is that CLAUDE READS + JUDGES the conversation (intent), which a deterministic deep read cannot match. To FULLY replicate the skill for flat group DMs the workbench would need to run an LLM judgment turn over the Slack collection on home load (a latency/cost trade-off = OPERATOR'S CALL — flagged, NOT built unsolicited). Deterministic replication shipped: identity (email-lookup), DM/group-DM coverage, reply-state gate (1:1-DM conversation-level + thread-scoped reply_users + critical-inThread-clear, no over-drop), view/respond (Open-in-Slack link). Pivoting to the DESIGN/UX CRAFT PASS (operator's other explicit ask).
- 2026-06-29 (late): UX craft pass — home cockpit. Captured before-shots light+dark (docs/design/evidence/ux/home-before-{light,dark}.png). HONEST ASSESSMENT: the home is already well-crafted from this session's predecessor passes (focal Ask box; grouped rail; calm consistent headers; WCAG-AA contrast; focus rings). No concrete defect to fix. The remaining improvements are TASTE-DRIVEN judgment calls where the operator has sharp, specific taste and has rejected speculative work before — e.g. (i) information hierarchy: "New in Notion" (FYI) currently sits ABOVE the actionable Triage/Slack — arguably action-should-lead for a triage-first CLO, but Notion-new was the operator's own P1 proactive-vision priority, so reordering is a judgment call NOT mine to gamble; (ii) center-column flatness (many similar-weight cards) could gain emphasis tiers; (iii) spacing rhythm between section groups. Per "don't invent churn" + integrity (a rushed subjective recompose at the tail of a long session risks rejection), HOLDING for the operator's specific direction on these rather than gambling. Before-shots are the artifact to react to. Slack work is fully done + reviewed + pushed.
