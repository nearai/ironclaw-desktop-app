# Workbench Build-Out — Overnight Run STATUS

**Run started:** 2026-06-20 23:12 EDT (epoch 1782011524) · **Budget:** ~8h → deadline ~07:12 EDT (1782040324)
**Branch:** `workbench-overnight-20260620` (desktop repo `nearai/ironclaw-desktop-app`) — NOT merged to main; for your morning review.
**Plan:** `~/.claude/plans/squishy-wobbling-sparrow.md`
**Discipline:** every task = implement → full gate (prepare + test:static + a11y + smoke; cargo for backend) → commit only if green; revert + log BLOCKED if red. No regression. No merge to main.

## Tick (loop #29 — validation checkpoint): full foundation re-proven live

Mandated per-tick validation, run end-to-end after 8 triage ticks. Both gates green vs the real gateway.
- **Connector suite 14/14 PASS:** 6/6 live reads (gmail/calendar/drive/notion/github/slack); gated-write boundary holds (**SEND rejected · DELETE forbidden · DRAFT allowed**); approvals route; **live agent turn replied (68 chars)**.
- **Profile engine PASS:** V1 newsletter suppression **0 leaked**; V2 surfaced 2 items / 0 bulk (validated against the real `messageIsBulk`).
- No code change this tick (tree = loop #28's gate-green 828). Profile output (real sender data) not committed.
- Foundation proven for the first test user: live connectors + enforced gated writes + completing agent turns + newsletter suppression.
- Next: P2 verb depth (DOCX legal templates / research when web-search cred lands) or UX polish; own-repo extraction on your sign-off.

## User feedback round 1 — triage quality + dismiss-to-learn (`9c13e0b`, `43ea58a`, `03c63a2`)

Five issues raised; first three fixed (each gated + live-proven), two queued.
- **A — notes out of "Needs a decision" (`9c13e0b`):** WorkbenchDecisions was fed the raw inbox and only filtered `.unread`, never `messageIsBulk`, so gemini-notes meeting summaries became decision cards. New pure `selectTriageInbox()` (drops bulk + ignore-corrected + dismissed) feeds a `decisionMessages` prop; Arrived keeps raw (context view). Live: notes gone from Needs-a-decision.
- **B — Slack blocker precision (`43ea58a`):** the group was a keyword search, so multi-line "IronClaw QA Update … Blocked: …" reports matched. New `textLooksLikeBlocker()` drops broadcast/status reports (≥3 lines, >280 chars, report titles), keeps terse asks. Live: SLACK BLOCKERS 8 → 1 (only a real PR-review request).
- **C — dismiss-with-reason "so it learns" (`03c63a2`, the #1 ask):** new `workbench-dismissals.js` (localStorage; `dismissalSignalsBySender` for the learn loop). Each decision card has "Not for me" → inline reason picker → files the row (clears from decisions AND rail) + records reason+sender; survives reload. v13 fidelity intact (screenshot).
- **Gate green throughout:** static 836, a11y 138, design DT-1..6, smoke, bundle under budget.
- **QUEUED (raised, not yet done):** (D) in-app viewer for notes/Notion/Drive so the user reads them here instead of Chrome tabs (reading panel is Gmail-only today); (E) live streaming chat-window test (only mocked-complete responses tested today). Honest answer to "did you test the chat window": not the live streaming interaction — that gap is real and (E) closes it.

## Tick (loop #28 — P3): GitHub rail ranks by reason (`220efe4`)

Behaviour-ranked triage extended to GitHub — real action items above GitHub's "newsletters".
- `workbench-state.js`: `GITHUB_REASON_RANK` (review_requested/assign/security_alert=5, ci_activity=4, mention=3, …, subscribed=1); `connectorGithubRows` stamps `githubRank`; new `compareGithubRank` (rank desc, then API recency) set as the `github` group sort. Objective needs-you-ness, not per-user preference.
- **Live-proven** (real GitHub): group reordered recency→reason. Before: "Bản tin hàng ngày" digest @-mentions (third-party agents-radar) led. Now: **nearai/ironclaw CI failures** (ci_activity) lead; digest mentions sink below. Real work surfaces above GitHub-newsletter noise.
- **Gate green:** static 828 (1 new test), a11y 138, design DT-1..6, smoke, bundle under budget. No visual change (sort only).
- Next: P2 verb depth (DOCX legal templates / research when web-search cred lands), UX polish, or connector-suite 14/14 validation; own-repo extraction on your sign-off.

## Tick (loop #27 — P3): Slack decoupled to eager/cold-load (`bb446fd`)

Resolves the loop #24 deferral — **all six triage sources now load eagerly on cold load**.
- `workbench-page.js`: `useConnectorSlackBlockers` `enabled` → just `slackReady` (was gated on `slackBlockersActive||briefingSlackActive`).
- **The deferral was a false alarm:** the only broken assertion was test #118 line 2056 (no-read-before-catch-up laziness). The catch-up "Reading Slack" in-flight banner still works (500ms mock delay keeps the read in-flight at catch-up; in-flight test #119 passed unchanged). Updated #118 to assert the eager read is the read-only blocker search + nothing sent.
- **Live-proven:** cold load shows **SLACK BLOCKERS (8)** with no catch-up. Rail on cold load: NEEDS A REPLY · SLACK BLOCKERS · GITHUB · UPCOMING · RECENT IN NOTION · RECENT FILES.
- **Gate green:** static 827, a11y 138, design DT-1..6, smoke, bundle under budget. No visual change (same group as #24).
- Cross-source triage pillar is now COMPLETE (Gmail behaviour-ranked + Slack + GitHub + Notion + Drive + Calendar, all eager, newsletters suppressed, corrections drive ranking).
- Next: P2 verb depth (DOCX legal templates / research when web-search cred lands) or UX polish; own-repo extraction on your sign-off.

## Tick (loop #26 — P3): Notion + Drive as rail awareness groups (`b9fe20b`)

Rail triage now spans **Gmail · Slack · GitHub · Notion · Drive · Calendar** — the full source set.
- `workbench-state.js`: `connectorNotionRows` (title, "Edited <when>", page-url href, `file` icon) + `connectorDriveRows` (name, mime-kind badge, "Modified <when>", webViewLink href, `folder` icon); 90-char truncate, empties dropped. New `notion`/`drive` groups after Upcoming (awareness, low priority). Threaded via `buildWorkbenchStateRail({ notionPages, driveFiles })`; page passes `connectorNotion.pages`/`connectorDrive.files`.
- Both eager (deduped with briefing) → populate on **cold load**.
- **Live-proven** (real data): cold load shows **RECENT IN NOTION (6)** + **RECENT FILES (6)**, each linking out. Design intact (reuses group/row component + existing file/folder icons, no new CSS).
- **Gate green:** static 827 (2 new tests), a11y 138, design DT-1..6, smoke, bundle under budget.
- Next: decouple Slack eager-read (so it's cold-load like the rest); rank/group ordering polish; own-repo extraction on your sign-off; research blocked on web-search credential.

## Tick (loop #25 — P3): GitHub notifications as a rail group (`acac9de`)

Rail triage now spans Gmail + Slack + GitHub.
- `workbench-state.js`: `connectorGithubRows` maps GITHUB_LIST_NOTIFICATIONS into rail rows (subject-type badge, "<reason> · <repo>" detail, html_url href, 90-char truncation, title-less dropped); new `github` group after Ready-to-review (icon `spark`). Threaded via `buildWorkbenchStateRail({ githubNotifications })`; page passes `connectorGithub.notifications`.
- GitHub reads EAGERLY (deduped with the briefing → no extra read, no test #118 timing coupling), so the group populates on **cold load** — better than Slack (lazy).
- **Live-proven** (real GitHub): cold load shows **GITHUB (6)** real notifications (Issue mentions in public repos + nearai/ironclaw CI), each linking to the repo. Design intact (reuses group/row component + existing `spark` icon, no new CSS).
- **Gate green:** static 825 (3 new tests), a11y 138, design DT-1..6, smoke, bundle under budget.
- Rail breadth: Needs-a-reply (Gmail, behaviour-ranked) · Slack blockers (post catch-up) · GitHub (eager) · approvals/blocked/working/review · Upcoming (Calendar).
- Next: Notion/Drive into the rail (same eager pattern); decouple Slack eager-read; own-repo extraction on your sign-off; research blocked on web-search credential.

## Tick (loop #24 — P3): Slack blockers as a first-class rail group (`163e1a7`)

Triage now spans Gmail + Slack in the always-visible rail (not only the on-demand briefing).
- `workbench-state.js`: `connectorSlackRows` maps SLACK_SEARCH_MESSAGES into rail rows (channel badge, "From @who in #channel", permalink href, 90-char truncation, empty rows dropped); new `slack` group after Needs-a-reply, recency preserved. Threaded via `buildWorkbenchStateRail({ slackBlockers })`; page passes `slackBlockers.rows`.
- **Live-proven** (real Slack): before catch-up the group is hidden (empty); after catch-up the rail shows **SLACK BLOCKERS (8)** with real blocker messages from team channels, each linking to the Slack permalink, and it persists. Design intact (1180px screenshot).
- **Gate green:** static 822 (3 new tests), a11y 138, design DT-1..6, smoke, bundle under budget.
- **DEFERRED (logged):** eager always-on Slack read (rail shows Slack on cold load, no catch-up) was built + reverted — it shifts the catch-up briefing's in-flight read timing (test #118 asserts the "Reading Slack…" banner mid-read). Needs decoupling the rail read from the briefing summarize flow + a test redesign; not a one-line gate fix.
- Next: decouple eager Slack read (own queryKey, independent of briefing) OR GitHub/Notion into the rail; own-repo extraction on your sign-off; research blocked on web-search credential.

## Tick (loop #23 — P3 validation): gauntlet now tests the REAL bulk classifier (`0980aa7`)

The per-tick validation mandate, run after 3 ticks of triage changes — and tightened so it proves the ACTUAL surfaced logic.
- `scripts/workbench-profile-engine.mjs` imports the UI's `messageIsBulk` (Node-importable, same raw GMAIL shape) as the authoritative bulk determinant; the old parallel `BULK_LOCALPARTS`/`bulkMarkers` is now diagnostic-only. No more drift — UI newsletter-logic changes auto-validate.
- **Live run (real Gmail, 250 sent + 250 inbox):** V1 newsletter suppression **0 leaked → PASS ✅**; V2 surfaced **2 items, 0 bulk → PASS ✅**; V3 temporal-holdout clean (sparse positives). Profile output (real sender data) NOT committed.
- **Gate green:** static 819 (engine is a script, not bundled).
- **Own-repo extraction**: deliberately queued as a USER-REVIEW item, not auto-done — it's a structural decision (new repo location, sidecar binary handling, CI) the plan defers to morning review; the standalone is already functionally broken out (own gateway + serve, no Tauri). Research still blocked on web-search credential.
- Next: deeper triage sources (Slack into the rail) or DOCX legal-format templates; own-repo extraction on your sign-off.

## Tick (loop #22 — P3): tier corrections drive the live triage (`56f79b4`)

A "You" correction now changes the day — overrides feed BOTH triage paths (rail + briefing).
- `connectorReplyRows`/`buildBriefing` take `tierOverrides`: VIP/Respond outrank Gmail IMPORTANT (replyRank 3/2/1/0); Ignore drops the sender (and leaves `counts.replies`); badge reflects the tier. `workbench-page` re-reads on mount and threads them in.
- **Live-proven** (/workbench, real Gmail): correct jonathan@digitalchamber.org → VIP → "TDC Capitol Hill…" jumps to **row #1, badged VIP**, above 3 IMPORTANT threads. → Ignore → count **5→4**, row gone. Design intact (serif/blue/dark dock, 375 + 1280).
- **Gate green:** static 819 (5 new tests), a11y 138, design DT-1..6, smoke, bundle under budget. Bulk suppression untouched (messageIsBulk + tests unchanged).
- Next: own-repo extraction (the full "broken out" pillar); research still blocked on web-search credential.

## Tick (loop #21 — P4): gateway supervisor — standalone self-heals on sidecar exit (`718978f`)

Root-caused loop #20's "gateway crashed twice": NOT a crash (no panic/OOM) — the sidecar is reaped with the launcher's process group when the session tears down (the nohup'd reboot survived).
- `scripts/workbench-standalone.mjs`: `startGateway()` supervisor respawns the sidecar on unexpected exit (linear backoff cap 8s, 20-restart cap, shuttingDown guard); header documents running under `nohup … &`.
- **Live-proven** (alt ports 17646): boot → ready → `kill -9` sidecar → "respawn #1 in 1000ms" → gateway back up. Self-heals.
- **Gate green:** static 814, a11y 138, design DT-1..6, smoke (launcher not bundled; ran to confirm no regression).
- Next: own-repo extraction (the full "broken out" pillar); research stays blocked on web-search credential.

## Tick (loop #20 — P3): editable perspective — correct a sender's tier (`5a5d6f7`)

The "You" surface is now observed AND correctable (v13).
- `workbench-profile-overrides.js` (pure, 6 tests): localStorage per-sender tier overrides; `applyTierOverrides` overrides+flags+re-ranks (case-insensitive, non-mutating); `recountTiers`. You rows get a tier `<select>` → persists + re-renders + "you set this".
- **Live-verified** (/you): set mara@theblockchainassociation.org → VIP → **moved to top**, badge VIP, "you set this", **persisted across reload** (localStorage). Read-only; per-device for now.
- **Gate green:** static 814 (6 new tests), a11y 138, design DT-1..6, smoke, bundle under budget.
- OBSERVED (P4): the long-running standalone gateway (:17640) crashed twice under sustained multi-tick load — stability/hardening item, not a regression here. Rebooted for the app.
- Next: P4 — gateway stability under sustained load; own-repo extraction; (research blocked on web-search credential).

## Tick (loop #19): research verb diagnosed (BLOCKED on web-search credential) + validation PASS

- **Research verb e2e attempt** (live agent turns, :17640): math turn replies **68** (plumbing works); research turn ("EU AI Act enforcement dates, cite sources") **no reply in ~90s, 0 tools invoked**. Root cause (gateway source): `web-access` is registered for the agent but needs a **search-provider (Exa) credential** the standalone lacks → web-access can't run → no convergence. **BLOCKED** on provisioning that credential (user's domain; won't fabricate) + #7 convergence for long turns. Research frontend (scene/label/routing) stays done + gate-proven.
- **Mandated validation — ALL PASS:** connector suite **14/14** + profile engine V1 0 leaked + V2 2 real human threads.
- Evidence: `docs/design/evidence/loop19-research-blocked.md`.
- Next: You tier-correction (editable perspective, frontend, independent of the research blocker); P4 own-repo extraction.

## Tick (loop #18 — P3): cut /you first-load — two-phase fast-paint→deep-refine (`5deffe9`)

- `you-page.js`: two passes — **quick** (1 sent + 1 inbox page) paints at ~one read; **deep** (~100 sent) refines tiers in place with a "Refining from more of your history…" hint. `query = deep.data ? deep : quick`.
- **Live-verified** (/you): ~8s painted (1 respond, 15 rows, refining hint) → ~26s refined (**2 respond**, 22 rows, hint gone) — vs a 22s blank spinner before. No console errors.
- **Gate green:** static 808, a11y 138, design DT-1..6, smoke, bundle under budget.
- Per-read gateway latency (~3.6s Composio) unchanged — this is the perceived-load fix for a cached secondary surface.
- Next: long-horizon research verb proof; P4 hardening / own-repo extraction.

## Tick (loop #17 — P3): deepen "You" tiering with a paginated sent read (`52a251c`)

- `readPaged()` in you-page.js follows the connector `nextPageToken`; sent deepened to ~100 (4 pages) + Primary inbox ~50 (2 pages) — each 25-row page reliable where a single large read 503s.
- **Live-verified** (/you, real mail): tiers improve **0 VIP/1 respond → 0 VIP/2 respond/20 FYI/5 auto-filed** (22 rows), matching the standalone engine's V2 (john@salt.org, tjkovacs@fbi.gov). "You" nav item visible. No console errors.
- **Gate green:** static 808, a11y 138, design DT-1..6, smoke, bundle under budget.
- HONEST: first-load ≈22s (6 sequential reads + gateway 503s), caches 120s — follow-up (prefetch/parallelize/gateway latency). VIP stays 0 by rubric (respond senders have received 1–2), correct.
- Next: long-horizon research verb proof; P4 hardening / own-repo extraction; You first-load latency.

## Tick (loop #16): conversations a11y fixed → /you PROMOTED to the visible nav (`28faf6a`)

Unblocked loop #15.
- **a11y fix** (sidebar-threads.js): conversations scrollable region gets `role="region" aria-label tabindex=0` → clears the `scrollable-region-focusable` violation the 7th nav item exposed.
- **/you promoted** to the visible primary nav (hidden:false + Work section + `nav.you` en/baseline + IA-guard update + `book` icon).
- **Gate green:** static 808, **a11y 138 (held with the 7-item nav)**, design DT-1..6, smoke, bundle under budget. Live: /you renders (0 VIP/1 respond/14 FYI/2 auto-filed, 15 rows), no console errors.
- All 4 pillars now have working, discoverable surfaces. Next: deepen You tiering (fuller sent read), long-horizon research verb proof, P4 hardening/own-repo extraction.

## Tick (loop #15): /you nav promotion BLOCKED (a11y) + mandated validation PASS

- **Attempted** promoting /you to the visible primary nav (unhide + Work section + nav.you i18n + IA-guard update). test:static green (808) but **a11y RED, deterministic (2 runs)**: 4 `connections` sub-pages hit `scrollable-region-focusable` (serious) on an empty conversations sub-panel that lacks keyboard access — only with the 7th visible nav item. **Reverted** per guardrail; tree green (static 808, a11y 138). /you stays hidden + reachable. **Unblock prereq:** add keyboard access (tabindex=0/role) to that empty scrollable region in shared chrome, then re-attempt — next tick.
- **Mandated validation — ALL PASS:** connector suite **14/14** (live Composio, write-gate, agent turn) + profile engine (180 sent/250 inbox/98 senders) V1 0 leaked + V2 2 real human threads, 0 bulk. Stack still works after 14 ticks.
- Evidence: `docs/design/evidence/loop15-nav-blocked.md`.

## Tick (loop #14 — P3): the "You" perspective surface, live (`629fefb`)

Renders the behaviour-profile core as a real route — what IronClaw learned about how you work.
- New `pages/you/you-page.js` + `/you` route (routes.js `hidden:true` → no nav-rail change; mounted in app.js under the authed layout). Reads in:sent + Primary inbox → computeBehaviourProfile → tier stats (VIP/respond/FYI/filed) + evidence patterns + per-person list (tier badges, reply latency). Self-contained `<style>` on --v2-* tokens, Newsreader serif; read-only.
- **Live-verified** (:17641 /you, real mail): "How you work" serif heading; stats **0 VIP · 1 respond · 14 FYI · 2 auto-filed** (25-msg sent read matched a respond-tier — tiering deepens with more history); 15 rows; no console errors; design clean.
- **Gate green:** static 808 (route-registration test), design DT-1..6, a11y 138, smoke, bundle under budget.
- GOTCHA: adding a key to i18n/en.js trips a hard count (933) + per-locale baseline — a hidden route needs NO en key (label never renders). Kept en.js unchanged.
- Next: promote /you to visible nav (i18n nav.you + nav section + bump the 933 count + baseline) once tiering reads a fuller sent window; long-horizon research verb proof.

## Tick (loop #13 — P3): behaviour-profile core for the "You" surface (`efbd324`)

The "You" surface's validated foundation (UI next), pure + no I/O.
- `lib/workbench-profile.js` `computeBehaviourProfile({sent,inbox})` → people (tier/replyRate/medianLatency), counts {vip,respond,fyi,ignore,bulk}, evidence-backed patterns. Same tier rubric as the standalone engine; VIP-first ranking. 4 unit tests.
- **Live-validated** (gateway :17640): 17 senders, **11 newsletters → ignore** ("11 bulk senders auto-filed"), 6 real humans listed. Honest caveat: a small live sent-read (12) doesn't match reply-threads so humans show fyi; VIP/respond tiering needs a fuller sent window (standalone engine on 180 sent confirms john@salt.org/tjkovacs → respond). Logic correct; the You-UI tick reads more sent.
- **Gate green:** static 807 (4 new tests), design DT-1..6, a11y 138, smoke. No UI change (module not yet bundled) → no design risk.
- Next: render the "You" surface from this core (fuller sent read + tier badges + patterns, v13-styled); long-horizon research proof.

## Tick (loop #12 — P2): the "Draft" (Document) chat-bar verb (`f16a485`)

Third P2 verb. Doc-product asks were MISLABELED "Research" (memo|brief were in the research matcher). Now they route to a dedicated Document scene → chat → the existing assistant work-product .docx export (chat/lib/work-product-export.js — real, 28 tests).
- New `document` scene (before research; memo|brief removed from research) matches "draft a memo"/"one-pager"/"prepare a brief"/"compose a letter"/".docx/work product". Honest framing: a formatted doc (headings + Sources) you edit + export to .docx; sharing gated. `commandActionLabel` → "Draft".
- **Live-verified** (:17641): "Draft a memo on the Q3 roadmap" → **Draft**; "Write a one-pager…" → **Draft**; precedence preserved — contract → Review, research → Research, scheduling → Schedule. No console errors.
- **Gate green:** static 803 (new document-scene test), design DT-1..6, a11y 138, smoke.
- GOTCHA (recurring): `prettier --check` (lint-staged) rejects new .js until `npx prettier --write` is run — do that BEFORE committing, then re-prepare. And hash-only preview URL changes don't reload the bundle — use ?cb= to verify.
- P2 verbs now: Ask / **Draft (Document → .docx)** / Schedule / Research / Review. Next: long-horizon research proof; the "You" surface.

## Tick (loop #11 — P2): markdown → real .docx + full validation re-run (`137fdaf`)

Generalizes DOCX work product beyond the briefing: ANY drafted markdown → a real editable Word doc (reusable core for the document verb).
- `markdownToWorkProduct(md)` (pure, tested): #→title, ##/###→sections, lists→paragraphs, a Sources/References heading routed to editable citations, inline markdown stripped. python-docx-validated (sample memo → .docx reads back, markers stripped, Sources routed). Sample: `evidence/wb-memo-from-markdown.docx`.
- **Gate green:** static 802 (3 new parser tests, 10 docx tests), design DT-1..6, a11y 138, smoke, bundle under budget.
- **Mandated validation (does it still work for HIM after 11 ticks) — ALL PASS:** connector suite **14/14** (live Composio, write-gate, agent turn) + profile engine (180 sent/250 inbox/98 senders) V1 0 leaked + V2 2 real human threads, 0 bulk.
- Next: a 'document' scene drafting via the agent → export through markdownToWorkProduct (one-click .docx for any memo/brief); long-horizon research verb; the "You" surface.

## Tick (loop #10 — P2): DOCX work product, one click from the bar (`676bd79`)

Wired the .docx generator to the deterministic briefing — "what needs me today?" → a real editable Word work product, no agent turn.
- `briefingToWorkProduct(briefing)` (pure, tested): briefing → { title 'IronClaw Daily Brief', subtitle=headline, sections (Replies waiting / On your calendar / Needs a decision / Slack / GitHub), sources = connectors used + the "N newsletters filed — not surfaced" line }. Degrades safely on empty.
- `WorkbenchBriefing`: a "Download .docx" header button → `saveBlob(buildDocxBlob(briefingToWorkProduct(briefing)))` (desktop-safe, read-only — writes a local file, sends nothing).
- **Live-verified** (:17641): "what needs me today?" → briefing → **Download .docx button present**, clicks clean, no console errors. File is python-docx-validated (last tick).
- **Gate green:** static 799 (2 new mapper tests), design DT-1..6, a11y 138, smoke, bundle-size under budget (module now bundled, no library).
- Next: a 'document' scene so any drafted memo/brief exports to .docx; long-horizon research verb; the "You" surface.

## Tick (loop #9 — P2): real zero-dependency .docx work-product generator (`4828d0e`)

The DOCX pillar's hard part — a REAL editable Word doc — built with no library (no bundle-budget hit).
- `pages/workbench/lib/workbench-docx.js`: pure-JS OOXML + hand-rolled STORED zip (CRC32 + headers + EOCD). `buildDocxBytes/Blob(doc)` from { title, subtitle, sections[], sources[] }. Arial + bold headings + an explicit numbered **Sources** section (citations first-class + editable), per [[feedback_legal_doc_formatting]]; XML-escaped.
- **Validated it opens as Word:** /tmp sample → `unzip -l` shows 4 OPC parts; **python-docx read back all 6 paragraphs** with the heading bold + font Arial. Sample committed at `evidence/wb-sample-workproduct.docx`.
- **Gate green:** static 797 (5 new docx tests), design DT-1..6, a11y 138, smoke, bundle-size under budget. No UI change (no design risk).
- Next: wire it to the bar — a 'document' scene producing structured content + "Download .docx" via lib/save-file.js (one click from the bar); then long-horizon research verb + the "You" surface.

## Tick (loop #8 — P2 START): the "Schedule" chat-bar verb (`bd723c9`)

First P2 chat-bar verb. The bar now recognizes scheduling asks + the backend chain is proven live.
- New `schedule` scene (after `monitor` so "watch competitor … every Friday" stays Monitor; pure scheduling — "every weekday at 9am…", "schedule this daily", "remind me…", "automate a daily digest" — lands here). Honest framing: "recurring job that runs while the app is open, asks before anything leaves"; stages a native trigger, every run gated. `commandActionLabel` → "Schedule".
- **Live-verified** (:17641): "Every weekday at 9am summarize my inbox…" → action button reads **Schedule**.
- **Backend proven E2E** (trigger-fire-e2e, native poller, NO Hermes): agent creates a recurring trigger via builtin.trigger_create (gate→200) and the **poller FIRES it** (last_run_at ~5s after next_run_at).
- **Gate green:** static 792 (new schedule-scene test), design DT-1..6, a11y 138, smoke. Monitor precedence regression-tested.
- Still gated: bar frames + agent creates the trigger; a Workbench-native one-click create (no agent turn) is the later #9 route. Sends OFF.
- Next: the other P2 verbs (research, DOCX work product), then the "You" surface.

## Tick (loop #7 — pillar #3): needs-a-reply ranked by behaviour (`39f6530`)

needs-a-reply surfaced human mail but in raw recency order; now ranks by Gmail IMPORTANT (a behaviour signal — how you engage a sender, clean since bulk is excluded).
- `normalizeInboxMessages` stamps `important`; row carries it + "Important" badge; needs-reply group `sort: compareReplyRank` (IMPORTANT-first then recency — on the group, since the rail re-sorts groups). Inbox read 6→12 so more Primary threads surface. Regression test added.
- **Live-verified** (:17641, real Gmail): order = [Important] "Re: Re-Intro" (Harshit), [Important] two "GDPR Coverage Enquiry / Regulatory Exposure" (anelda), then [Unread] "Capitol Hill Tax Fly-In" (Jonathan). GDPR/re-intro float above the fly-in invite; gemini-notes suppressed, newsletters gone.
- **Gate green:** static 791 (new ranking test), design DT-1..6, a11y 138, smoke. Frontend-only.
- Next: the "You" surface (expose/edit the learned model), then P2 chat-bar verbs (automate/schedule, research, DOCX).

## Tick (loop #6 — pillar #3): needs-a-reply reads the Primary tab (`ad8442b`)

needs-a-reply was empty/flooded (the `in:inbox` read returns newsletters first → after suppression nothing human surfaced). Now it reads Gmail's Primary tab.
- Inbox query → `in:inbox -category:promotions -category:updates -category:forums -category:social` (Gmail's own classification = human correspondence); messageIsBulk still suppresses automated senders that slip into Primary. Tightened BULK_LOCALPARTS (gemini-notes/calendar-notification/drive-shares/via-google + hyphen boundary).
- **Live-verified** (:17641): needs-a-reply now shows a REAL human thread — "Re: Re-Intro - Abhi and Sidney — From Harshit Tiwari"; gemini-notes suppressed, The Information gone; human work mail present (anelda "Coverage Enquiry — DPO/GDPR", jonathan@digitalchamber). No console errors.
- **Gate green:** static 790, design DT-1..6, a11y 138, smoke. Frontend-only.
- Next: rank the surfaced human threads (latency/tier), the "You" surface, then P2 chat-bar verbs.

## Tick (loop #5 — pillar #3): suppression transparency ("N newsletters filed") (`cfed6a3`)

Suppression was silent; now the briefing owns it (v12 "handled, not surfaced" trust touch).
- `buildBriefing` reports `counts.filed`; headline appends "N newsletters filed — not surfaced." Suppression regression test extended.
- **Live-verified** (:17641, "what needs me today?"): "Good morning. 5 Slack items, 5 GitHub items, and 5 events on your calendar. 6 newsletters filed — not surfaced." — 0 replies-waiting (suppressed), real items still counted.
- **Mandated validation PASS:** profile engine (180 sent / 250 inbox / 98 senders) — V1 0 bulk leaked, V2 surfaces 2 real human threads, 0 bulk.
- **Gate green:** static 790, design DT-1..6, a11y 138, smoke. Frontend-only.
- Next: sent-history-aware "needs a reply" (surface established reply threads, not just unread — the only clean behaviour signal on this newsletter-flooded demo mailbox), then the "You" surface; P2 chat-bar verbs.

## Tick (loop #4 — P1): real Newsreader woff2, v13 typography complete (`835bf5c`)

Display headings were on a system-serif fallback. Self-hosted the real font.
- Added `static/fonts/newsreader-variable.woff2` (58 KB, variable wght 200–800, OFL) + license; `@font-face` in app.css alongside Geist (Geist untouched; serif is display-only via --wb-font-display, body stays Geist sans).
- **Live-verified** (:17641): font file 200 font/woff2; `document.fonts` "Newsreader" **loaded**; "What do you want handled?" renders real Newsreader; no console errors.
- **Gate green:** static 790, design DT-1..6, a11y 138, smoke, bundle-size under budget (fonts not in the JS/CSS budget).
- **v13 typography complete:** Newsreader serif display + Geist sans body + Geist Mono. v13 shell fidelity (accent + serif + brand) now done.
- Next: behaviour ORDERING in triage (tier/latency rank from sent-history), the "You" surface, then P2 chat-bar verbs (automate/schedule, research, DOCX).

## Tick (loop #3 — goal pillar #3): newsletters NEVER surface as "needs a reply" (`ba42ba2`)

The live triage was surfacing The Information / Substack newsletters under "Needs a reply" (buildBriefing + the rail's connectorReplyRows took every unread message, no bulk filter). The single most goal-critical bug — fixed.
- New exported `messageIsBulk()` in workbench-connectors.js (List-Unsubscribe / List-Id / Precedence:bulk|list / Gmail CATEGORY_* / automated local-part — the validated profile-engine signals). `normalizeInboxMessages` stamps `isBulk`; `connectorReplyRows` + `buildBriefing` suppress bulk from needs-a-reply. Newsletters still appear in "recent/arrived" context, never as needing a reply.
- **Live-validated** (standalone :17641, real Gmail): every newsletter in the unread sample suppressed, **0 surfaced as needs-a-reply**; the group correctly disappears when all unread is bulk. Profile engine V2 confirms the inverse (real human threads john@salt.org, tjkovacs@fbi.gov DO surface).
- **Gate green:** test:static 790 (new suppression regression test), design DT-1..6, a11y 138, smoke. Frontend-only — gateway connector route unchanged.
- Next: wire the full behaviour ranking (tiers/latency) into the live triage ordering, and the "You" surface; real Newsreader woff2.

## Tick (P1 loop #2): serif display + brand/avatar → blue (`7d677c2`)

Completes "zero teal" and adds the v13 editorial serif.
- `--wb-font-display` Geist sans → Newsreader-first serif stack (body stays Geist sans). Brand mark gradient + avatar teal → blue. Real Newsreader woff2 deferred (bundle-size budget) — system serif fallback reads editorial + faithful.
- Updated `tests/static/workbench-static.spec.ts` font-contract from the old no-serif decision to the v13 serif-display intent (intentional design move, not a silenced regression).
- **Live-verified** (:17641 /workbench, real data): greeting renders serif, brand/avatar/active-nav blue, **0 teal anywhere**, no console errors, layout intact.
- **Gate green:** static 789, design DT-1..6, a11y 138, smoke, bundle-size under budget.
- Next: real Newsreader woff2 (within size budget); then wire behaviour-ranked Home + "You" surface to the live profile engine (P1→P3 bridge).

## Tick (P1 loop): v13 fidelity — accent teal → signal blue (`d70b990`)

First autonomous-loop tick toward the goal. Killed the teal/Geist accent divergence on the live standalone Workbench by retargeting BOTH token systems to v13 blue: global `--v2-accent*` (app.css, light+dark → #1c63d6/#5b9bf2) and the Workbench-scoped `--wb-accent*` + `--wb-rail-accent` (pages/workbench/styles/tokens.js, light+dark). Ask button, wb13 dots, active-nav now blue.
- **Live-verified** (standalone :17641 /workbench, real auth + Gmail/Calendar data): Ask `#5b9bf2`, dots blue, **0 teal backgrounds remain**, no console errors, layout not degraded.
- **Gate green:** test:static 789/789 (incl. WCAG AA contrast light+dark), design DT-1..6, smoke, a11y. Geist untouched (design contract intact). Gotcha logged: `prepare:webui-static` rebuilds `main.bundle.js` (committed artifact) — a hash-only URL change does NOT reload it; needs a real reload to verify.
- Next P1 ticks: Newsreader serif for display (needs font asset), logo/avatar brand gradient (still teal-green), then behaviour-ranked Home + "You" surface wired to the live profile engine.

## Tick (2026-06-21 continuation): v13 design landed green + fresh 14/14 proof + #9 scoped

Two substantial items + the user's #1 "does it actually work" proof, on `workbench-overnight-20260620`.

- **v13 design committed `9f98921`** (behaviour-ranked Home + "You" perspective surface + model customizability, faithful to v12). **Full frontend gate green:** `test:static` 789/789, `test:a11y-static` 138/138, `test:design-static` DT-1..6, `smoke:webui-static` PASS. Removed the divergent Geist/teal render.
- **Phase 1 connector suite 14/14 (fresh)** on the staged binary `ironclaw-reborn-aarch64-apple-darwin` (`connector-live-test.mjs --write`, live Composio): 8 accounts; all 6 families read live (gmail/calendar/drive/notion/github/slack); write-gate enforced (SEND rejected flag-off, DELETE forbidden, DRAFT created s=200); approvals route; live agent turn replied. Evidence: `evidence/phase1-connector-continuation.md`. Confirms the legal-use-case foundation still works after the design commit.
- **#9 scoped precisely (why it's a multi-tick backend rock, not a one-tick UI add):**
  - The automations viewer is **intentionally READ-ONLY** — `automations-honesty.contract.test.mjs` HARD-asserts no `<form>/<input>/<textarea>` in the list and that creation routes through `/chat`. A create *form* cannot be added without first exposing a real create capability (Design Law: no fake readiness).
  - `ironclaw_triggers::TriggerRepository` exposes only reads (`get/list/list_scoped/list_due/list_active/run_history`) + `update_claimed_fire` — **no `create`, `pause/set_paused`, or `delete`.** Creation today runs through the `create_trigger` first-party tool (`first_party_tools/trigger_management.rs`) entangled with the conversation-init `TriggerCreateHook`.
  - So #9 = add repo-level create + pause/resume (+ optional delete) across the trait + `libsql.rs` + `postgres.rs` + in-memory impl → a service method in `ironclaw_product_workflow` → ingress route `POST /automations` + `POST /automations/{id}/pause` + descriptors → frontend `automations-api` create/pause + an honest create UI (unhide the form path, relax the read-only honesty test to "create via direct route" ) → **sidecar rebuild** + a create-without-agent e2e. Firing itself is already verified (poller, tick 4). **Next tick's main rock; budget for the Rust rebuild.**

## ⭐ Milestone (2026-06-21 late PM, tick 5): REAL APP E2E (npm run tauri dev) + poller live in-app

The user's #1 ask — "does it actually work?" — answered with a real GUI boot of the actual Tauri app.

- **REAL APP E2E (`npm run tauri dev`):** the actual desktop app built incrementally (`Finished dev in 11.77s`) and spawned its sidecar (the staged tri-fix binary, resolved via Tauri `.sidecar()`). Boot logs show **`agent connectors: connected-sources activated; connected-sources.read is now callable by the agent loop`** — the connector fix is **live in the real app**, not just throwaway tests. Readiness: `turn_runner: true, trigger_poller: true`. `GET http://127.0.0.1:3000/api/health` → **HTTP 200**. GUI killed immediately after capture. Evidence: `evidence/real-app-tauri-boot.md`.
- **Phase 5 poller live in-app (`97430fd`):** sidecar.rs now sets `IRONCLAW_TRIGGER_POLLER_ENABLED=1` so the native scheduler runs while the app is open (serve poller is off by default) — automations fire on cadence. The staged binary carries all gateway fixes (connector enable 693a41e1, reasoning cap 15b1d854, list-models f9d89e404).
- The real app now has the full chain proven: builds → boots → sidecar serves → connector fix live → model catalog 47 → preflight unblocked → multi-step agent turns → gated writes → native poller running.

## ⭐ Milestone (2026-06-21 late PM, tick 4): Phase 5 native trigger firing VERIFIED end-to-end

The Phase 5 gate ("verify a trigger actually fires before shipping the UI") is satisfied — IronClaw-native poller, NO Hermes.

- **Binary e2e (`scripts/trigger-fire-e2e.mjs`):** boot staged binary with `IRONCLAW_TRIGGER_POLLER_ENABLED=1` → `trigger_poller: true` on boot → the agent creates a recurring trigger via `builtin.trigger_create` (PermissionMode::Ask gate, approved over SSE) → **the native poller FIRES it** (`last_run_at` populated ~28s after `next_run_at`, within the 30s poll). Evidence: `evidence/phase5-trigger-fire.md`.
- **Rust e2e (authoritative):** 4/4 `trigger_poller_e2e` tests pass — fires recurring, drives trusted ingress for due triggers, respects future `next_run_at`, auth scoping.
- Confirmed `builtin.trigger_create` is model-visible + works (the agent created `phase5-tick` with correct cron/name/prompt/timezone args).
- **Next (task #9):** build POST `/automations` create/pause routes + a Workbench create UI ("runs while IronClaw is open") so the UI doesn't depend on an agent turn. Firing is no longer a blocker.

## ⭐ Milestone (2026-06-21 late PM, tick 3): model picker/readiness FIXED + Phase 3 evidence

- **FIXED #8 — nearai model-list returned 0 (gateway `f9d89e404`).** The model picker was empty / readiness degraded because `probe_provider` built the listing provider with `api_key_env:None`, so the persisted nearai endpoint resolved keyless and the base defaulted to the keyless `private.near.ai` (no model list) instead of `cloud-api.near.ai`. Inference was unaffected (the active provider reads `NEARAI_API_KEY` → cloud-api). Fix: for the persisted endpoint (`stored_key_allowed`) set `api_key_env` so resolution reads the env key → cloud-api. Gated so it never applies to a caller-overridden base (no key-exfiltration). **Verified live: `/llm/list-models` 0 → 47 models.** Crate suite green (1172 pass; 2 unrelated `runtime::` tests flake under parallel load, pass in isolation). Evidence: `evidence/model-list-fix.md`.
- **Phase 3 — real multi-step agent turn** on the latest tri-fix binary: agent calls `GMAIL_FETCH_EMAILS` (real data) → finalized assistant reply citing the real sender+subject. Evidence: `evidence/phase3-agent-multistep.md`.
- Combined with tick 2's preflight fix, the model-readiness story is now complete: catalog lists 47 models AND the preflight doesn't false-block. Real-app Workbench: boots → connectors populate (6/6) → model picker populated → start unblocked → multi-step agent turns use connectors and reply with real data → writes gated.

## ⭐ Milestone (2026-06-21 late PM, tick 2): real-app door-blocker FIXED + full real-app E2E

The biggest "does it actually work in the app" blocker is fixed.

- **Real-app E2E against the REAL `~/.ironclaw` profile** (probe-workbench-live-wiring, staged dual-fix binary): `healthy:true`, model `zai-org/GLM-5.1-FP8`, **all 6 connector families read live with real data** (gmail 3, calendar 1, drive 3, notion 3, github 3, slack 200). Evidence: `docs/design/evidence/real-app-e2e.md`.
- **FIXED the start-preflight door-blocker (`d2cf9cd`).** The probe exposed that the Workbench set `start_preflight.blocked=true` ("NEAR AI Cloud model access is not available") because list-models returns 0 for the nearai provider — even though a model is active and inference works. So a user opening the real app was **blocked at the door despite everything working.** `modelCatalogBlockReason` now skips the block when a concrete model is active. **Verified live: `start_preflight.blocked` flips true→false** (evidence: `preflight-fix-before-after.md`). +2 unit tests.
- **Flaky Cmd+K palette test stabilized (`95570aa`)** — awaits focused input before typing/Escape; no more parallel-load flake blocking pushes.
- **Phase 1 connector suite 14/14** re-confirmed on the dual-fix binary (evidence: `phase1-connector-suite.md`).
- **#7 multi-read convergence characterized** as model-bound (GLM over-tool-calls; reads succeed after self-correcting args; single-read works). New follow-ups: #7 (convergence), #8 (nearai list-models returns 0 → empty model picker).

## ⭐ Milestone (2026-06-21 PM): agent-driven connector use FIXED + live-proven

The headline "does the agent actually use my connectors?" question is answered and fixed.

- **Found the real gap:** asked to "use your Gmail tool", the agent looped on `builtin.extension_search`/`extension_install` and never replied — Composio setup wired the *deterministic* read/write route, not the agent loop's capability set (the read-only `connected-sources` extension was never enabled for the agent, and there was no boot path to enable it).
- **Fixed (gateway `693a41e1`, branch `connector-route-on-main` / PR #5109):** `bootstrap_local_dev_agent_connectors` enables `connected-sources` at boot when `IRONCLAW_AGENT_CONNECTORS_ENABLED=1`. Read-only, no boot credential (Composio key resolves host-side at invoke), `default_permission=allow`, non-fatal, default-off. Writes/sends stay on the gated route.
- **Wired into the app (desktop `0c33055`):** the bundled sidecar spawn now sets that env, so the fix is live in `npm run tauri dev` (not dormant).
- **Live-proven** (`scripts/agent-sse-e2e.mjs`, flag on, rebuilt+staged sidecar, NEAR AI `z-ai/glm-5.2` and `zai-org/GLM-5.1-FP8`): the agent calls `connected-sources.read` **directly** (no install loop, no gate) and returns a finalized reply citing the **real** email — *Sender: The Information <hello@theinformation.com>, Subject: "Inside Microsoft's …"*.
- **Also fixed (gateway `15b1d854`): reasoning-model crash.** A multi-step turn died with `HostUnavailable{Capability}` because the assistant-transcript serializer capped provider reasoning/signature at 4 KiB (below the safety layer's 16 KiB). Reasoning models exceed 4 KiB → `TranscriptWriteFailed` → terminal. Raised to `PROVIDER_METADATA_TEXT_MAX_BYTES`; verified the terminal failure is gone. threads tests green (135).
- **Honest caveat (open, task #7):** *single-read* connector turns work end-to-end (Gmail). *Heavy multi-read* turns don't yet converge — GLM-5.2 looped 25× on Calendar reads; opus made 6 and a subagent hit `HostUnavailable{Prompt}`. Separate, deeper agent-loop convergence/limit issue (NOT the connector or transcript fix). Common Workbench tasks (latest email, draft a reply) are 1–2 reads and work.
- **Gateway suite:** `cargo test -p ironclaw_reborn_composition` = 1171 pass; the 3 "failures" were CPU-contention timeouts (concurrent sidecar tests) — all 3 pass in isolation (3.23s).
- **Also resolved today:** the "agent doesn't reply" scare was a test artifact — `NEARAI_MODEL=auto` is invalid (HTTP 400) and the old "pong" check was a false positive. Real models (GLM-5.1-FP8 / glm-5.2) complete turns. The live turn runs over **SSE**; the gate→approve→resume loop works (resolve → 200, run continues).
- **Open:** Phase 5 trigger CREATE route/UI (firing itself is proven by Rust e2e + the `IRONCLAW_TRIGGER_POLLER_ENABLED` boot-enable). Real sends remain OFF (need your test address). Codex divergence process still needs stopping by you.

## Current live truth (2026-06-21 13:44 EDT)

- This supersedes earlier "PASS" notes that proved Workbench Ask reached Chat and persisted the user request, but did **not**
  require a real assistant result. The live probe now fails unless the model produces an assistant reply or reports a clean
  terminal success.
- Latest full Workbench + direct Chat required-gate artifact:
  `/tmp/ironclaw-workbench-live-wiring-2026-06-21T17-44-27-288Z/probe.json`.
- Latest user-default provider artifact:
  `/tmp/ironclaw-workbench-live-wiring-2026-06-21T17-44-11-105Z/probe.json`.
- **PASS with a disposable provider profile:** `node scripts/probe-workbench-live-wiring.mjs --llm-backend=openrouter --json`
  copies `~/.ironclaw/reborn` to a temporary Reborn home, activates OpenRouter only in that copy, and deletes the copy after
  the run. It does **not** mutate the user's persisted provider config.
- **PASS:** staged sidecar becomes healthy; `/llm/providers`, extensions, registry, channels, and automations serve; live
  Composio connector accounts return `8` accounts; Workbench families map to `gmail/calendar/drive/notion/slack/github`;
  Gmail/Calendar/Drive/Notion/GitHub reads return live rows; Slack read succeeds with `0` matching rows; read-route and
  write-route send attempts both reject `GMAIL_SEND_EMAIL` with `400`.
- **PASS:** Workbench Ask creates a real Chat thread, sends the Workbench draft, preserves the live source status, carries all
  6 ready source families plus bounded live row counts into the timeline (`Gmail 3`, `Calendar 3`, `Drive 3`, `Notion 3`,
  `GitHub 3`, `Slack 0`), observes SSE `running -> queued -> completed`, and receives an assistant reply.
- **PASS:** direct freeform Chat can invoke the read-only `connected-sources.read` bridge against live Composio-backed
  connected data when tested through the disposable OpenRouter profile. The required gate passes with `tool_used=yes`,
  `tool_activity_seen=true`, `tool_signal_count=5`, one durable `/timeline` completed tool signal, live SSE
  `connected-sources.read` started/completed frames, and fresh post-run SSE replay of those frames.
- **PASS:** the Workbench run preview now consumes the same replayable SSE projection used by Chat and merges it with
  durable `/timeline` user/assistant rows. This means active or reopened Workbench run cards can show real connector tool
  activity; completed connector previews are also present in `/timeline` once the durable row lands.
- **Resolved validation bug:** the earlier `timeline_tool_signal_count=0` was caused by the probe not parsing JSON
  `capability_display_preview` envelopes stored in timeline message content. The latest probe records
  `timeline_tool_signal_count=1`.
- **Still true for the persisted local profile:** active provider `nearai` / `zai-org/GLM-5.1-FP8` cannot currently complete a
  Workbench run on this machine. The current hardened run proves connected data remains live, then blocks before Chat handoff
  because the active NEAR AI Cloud provider advertises model listing but the model catalog check fails. Local config points
  at `api_key_env = "NEARAI_API_KEY"`, but this shell exposes `OPENROUTER_API_KEY` and no `NEARAI_API_KEY`. Refresh NEAR AI
  credentials or explicitly switch the persisted active provider before claiming the user-default app profile is end-to-end
  green.
- **PASS:** Workbench now preflights the active provider's model catalog when the provider advertises model-list support.
  If the active NEAR AI Cloud catalog check returns `ok:false` or errors, Ask is disabled with provider-access copy instead
  of starting a known-doomed Chat run. Providers that do not advertise model-list support, such as the proven OpenRouter
  disposable profile, are not blocked by this guard.
- **PASS:** the live probe now uses that same Workbench preflight contract. The user-default probe reports
  `workbench_start_preflight.blocked=true` and skips Chat handoff unless `--force-chat-handoff` is passed for backend
  diagnosis. This prevents future evidence from overclaiming by sending work that the UI would now correctly refuse.
- Current product truth: the Workbench can read live connected data, hand bounded source context to Chat, and complete an
  assistant answer when a working provider is active. The user-default profile is blocked on provider/auth truth, not on
  Workbench connector wiring.
- Sidecar coordination: a Claude Code process is running in `ironclaw-agent-worktrees/claude`, and other Claude processes
  are still running/resumed from `~/openclaw-knowledge`. The `ironclaw-agent-worktrees/claude` and
  `ironclaw-agent-worktrees/cursor` reports are stale 11:24 EDT handoff notes with no tracked desktop edits. Safe support
  path right now is contained QA/probe/docs plus provider/auth fixes, not visual rewrites that would step on sidecars.

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

| ID        | Task                                                                          | State                                            | Commit                                | Verified by                                                           |
| --------- | ----------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------- | --------------------------------------------------------------------- |
| Q0        | Branch + green baseline                                                       | ✅ done                                          | f986602                               | 759 static + 120 a11y + smoke                                         |
| Q1        | Remove misleading frontend proxy (use `tauri dev`)                            | ✅ done                                          | 2a32217                               | tests green after removal                                             |
| QA        | **Prove the REAL bundled sidecar + a live agent turn** (keychain token)       | ✅ PASS                                          | (verify-only, /tmp/wb-qa.mjs)         | live turn: providers 200 + assistant "pong"                           |
| Q11       | Source gateway connector route — verify live reads + write-gate               | ✅ PASS (verify)                                 | (gateway working tree, not committed) | /tmp/wb-q11.mjs                                                       |
| Q11b      | Rebase connector route onto gateway main (+/llm+agent) → PR                   | ⛔ MORNING                                       |                                       | needs careful rebase                                                  |
| Q11c      | Hard-gate live MCP/connector reads on staged binary + align inspector truth   | ✅ PASS                                          | (current continuation)                | `probe-workbench-live-wiring.mjs --json`, focused Workbench tests     |
| Q11d      | Hard-gate connector write-route send rejection on staged binary               | ✅ PASS                                          | (current continuation)                | `probe-workbench-live-wiring.mjs --json`                              |
| Q11e      | Hard-gate Workbench Ask through to a real terminal assistant result           | ✅ PASS w/ disposable OpenRouter profile         | current continuation                  | live probe completes assistant reply; user-default NEAR still blocked |
| Q11f      | Probe direct freeform Chat connector/MCP tool invocation                      | ✅ PASS via `connected-sources.read` bridge      | current continuation                  | required live gate: assistant `tool_used=yes` + SSE replay            |
| Q12       | `/workbench/execute` endpoint + LIVE multi-step agent verify                  | ⛔ MORNING (rebase-blocked)                      |                                       | needs /llm on same binary                                             |
| QF1a      | Memory scene (L26) — wire `view==='memory'` → `MemoryView`                    | ✅ done                                          | (this tick)                           | static 760 + a11y 121                                                 |
| QF1b      | Theme default per DESIGN.md                                                   | ✅ decided (no change)                           | —                                     | DESIGN.md silent → keep dark (user global pref); v13 light = toggle   |
| QF1c      | L19/L20 richer decision/blocked context lines                                 | ⏭️ skip (data-honest)                            | —                                     | cards already render real data; no fake context added                 |
| Q11p      | Capture connector-route patch + rebase runbook (de-risk Q11b)                 | ✅ done                                          | (this tick)                           | docs/design/gateway-connector-route.patch                             |
| QF1a-test | Memory-scene render test                                                      | ✅ done                                          | b3b46b0                               | a11y 122                                                              |
| Q3UI      | Phase-3 Workbench-native execution surface                                    | ⛔ MORNING (needs rebased backend + your UX eye) |                                       | scene-workspace mirror exists; native run UI needs /workbench/execute |
| Q2        | Screenshot evidence (home light/dark + Memory)                                | ✅ done                                          | 8fecd5f                               | docs/design/screenshots/\*.png                                        |
| CI        | Incorporate concurrent codex changes, rebuild, gate, commit-green (loop role) | ♻️ ongoing                                       | d595c6f                               | static 760 / a11y 123 / smoke                                         |
| Q2        | Screenshot/visual-regression baselines of the real frontend                   | ⏳                                               |                                       | screenshots                                                           |
| Qf        | Push branch + draft PR + morning brief                                        | ✅ done                                          | pushed                                | PR nearai/ironclaw-desktop-app#4                                      |
| CI-loop   | Keep integrating codex changes green until ~deadline, then CronDelete         | ♻️ ongoing                                       |                                       |                                                                       |

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

## ⚠️ Concurrent codex process on this branch

A separate codex run is ALSO editing this repo/branch intermittently (e.g. it added the "catch-up briefing replaces
the standalone Slack panel" change + tests + docs at ~01:03, incorporated green in d595c6f). So BOTH agents contributed
overnight. This loop's most valuable remaining role is **continuous integration**: each tick, rebuild the bundle from
the latest source, run the full gate, and commit-if-green — codex doesn't always rebuild the bundle / run a11y / commit,
so this keeps the branch always-green + consistent. The green gate is the coordination point; no clobbering observed.

## Continuation mechanism (how this runs unattended ~8h)

- Recurring cron drives the loop while the app/REPL is idle. Started at :07/:31/:55 (~24 min) for the build phase;
  **after the build queue was exhausted (~02:56) it was widened to hourly (`61df07dc`, fires :17)** for the idle
  CI-gate phase — fewer no-op wakes, still integrates codex within an hour. Each tick: read STATUS + plan, check
  `date +%s` vs deadline 1782040324, integrate any codex changes green / else no-op, and at/after the deadline do the
  final wrap (push + refresh PR #4 + finalize morning brief) and `CronDelete` itself.
- Session-only: the loop needs this Claude session/app to stay OPEN overnight. If it stalls, resume manually by
  re-issuing the continuation prompt (same as the cron prompt) or asking me to "continue the overnight workbench build".
- Safety: branch only (`workbench-overnight-20260620`), never merge to main; drafts-only (no real sends); secrets stay
  Keychain/gateway-side; every commit green (prettier hook + tests).

## RESUMED continuous build (user awake ~06:00 — "keep going, finish the plan; fonts look tired; nothing populates")

- **Design — fixed "tired fonts" (10deba9, pushed):** root cause was a font-LOADING bug — the Workbench display token referenced `Newsreader` with NO `@font-face` (serif fell back to system Charter/Palatino = tired) and body used bare `Inter` (not the loaded `Inter Variable` → system-ui). Self-hosted Newsreader (variable woff2, OFL, 208KB) + pointed body at Inter Variable. Headers now render the crisp editorial serif (verified by screenshot). Lesson saved: never `prettier --write` app.css — it flips quotes and breaks the contrast-test regex + DT-1 (memory `lessons_no_prettier_on_app_css`).
- **✅ Unifier DONE (the "nothing populates" fix):** rebased the connector route onto gateway `main` (414 ahead) in `/tmp/gw-unify` — reset the 7 conflicted files to main + re-applied the route surgically against main's current APIs (trait methods as default-503 so fakes don't break; `reqwest` gated by webui-v2-beta; `webui_actor_user_id()` accessor; `RuntimeCredentialAccountSelectionRequest`). Built clean (debug+release). Verified live on ONE binary: `/llm` 200 + agent turn AND `/connectors/connected` 200 (8 accounts) + real Gmail read + write-gate enforced. Staged the release binary into `src-tauri/binaries/ironclaw-reborn-aarch64-apple-darwin` (old → `.prebuilt-bak`). Source committed + pushed: **PR nearai/ironclaw#5109** (branch `connector-route-on-main`, commit f81b24550, durable in the gateway repo).
- Cron widened back to continuous (~20 min, `5734f301`); deadline-stop removed — keep building the plan.

## Running log

- 23:12 — Q0: created branch off `codex/workbench-overhaul-backend-loop`; regenerated bundle; full gate green; committed baseline f986602. Began STATUS.
- 23:18 — Q1: removed `scripts/workbench-live-proxy.mjs` (kept `probe-workbench-live-wiring.mjs`); killed leftover proxy/sidecar procs; removed proxy launch.json entries; tests green; committed 2a32217.
- 23:21 — Read v13 fidelity spec + checked current state: L1/L4/L6/L7/L18/L23/L28 already implemented. Reprioritized queue toward real-stack + agent verification. Committed d0c669e.
- 23:23 — Armed recurring cron `2d280254` to drive the overnight loop (next QA tick: boot real prebuilt sidecar + live agent turn). Handed off.
- 00:56 — Q11p patch+runbook committed (3c531d6). Investigated Q3UI: `WorkbenchSceneWorkspace` already mirrors the live Chat timeline (preview + "open in chat") — that's the route-to-Chat model; the chosen _Workbench-native_ execution (in-place run states + inline approval gates) needs the rebased `/workbench/execute` backend + your UX review, so it's a MORNING item, not safely buildable unattended. Added a Memory-scene render test (b3b46b0, a11y 122). Honest status: the safe unattended high-value queue is largely exhausted (agent proven, connectors verified, fidelity done+tested); remaining work needs the rebase or your sign-off. Next: screenshot evidence, then final wrap with a sharp morning plan.
- 00:11 — **QF1a done.** Wired the v13 Memory scene: `view==='memory'` now renders `MemoryView` (the "Save a preference?" scope-capture scene) instead of falling back to Library. MemoryView component already existed + is faithful (scope chips, honest "save disabled until writable backend"); it was just never routed. Gate green: bundle + static 760 + a11y 121 + smoke. **QF1b theme:** DESIGN.md doesn't mandate a default; kept dark (matches the user's global preference) with v13 light as the working toggle — no risky whole-app flip. QF1c (richer card context) is data-dependent, deferred.
- 23:56 — **Q11 PASS (verify).** Booted the SOURCE gateway binary (has the connector route) on a fresh HOME + Composio key: configure 200, /connectors/connected 200 (all accounts), GMAIL_FETCH_EMAILS read 200 successful w/ 3 real messages, and the write-gate rejected GMAIL_SEND_EMAIL (send off) + GMAIL_DELETE_MESSAGE (forbidden) + draft-tool-on-read-route. Connector unit tests 5/5. Found: source fork lacks /llm (404) → connector route must be rebased onto current main (which has /llm+agent) → that + Q12 are the careful MORNING task (Q11b). Gateway changes preserved in working tree, not committed unattended (57-file multi-source branch). Reprioritized remaining overnight work to safe frontend QF1/Q2. Evidence `/tmp/wb-q11.mjs`.
- 23:35 — **QA PASS (major).** Booted the REAL prebuilt sidecar `ironclaw-reborn-aarch64-apple-darwin` with the Keychain NEAR AI token on a throwaway HOME. `/api/webchat/v2/llm/providers` = **200** (providers incl. nearai; active provider=nearai model=auto). createThread 200; sendMessage 200 (outcome:submitted, turn_id returned); timeline produced the assistant reply ("pong"). **Conclusion: the real gateway + agent runtime + existing token WORK end-to-end.** The prior "agent never completes" was the divergent dev fork/proxy, not the product. Verify-only (no repo changes); evidence script `/tmp/wb-qa.mjs`. Next: Q11 — build the source gateway with the connector route + verify connector reads/writes live.
- 03:00 — **G2 approvals feed frontend seam done.** Added a capability-gated `GET /api/webchat/v2/approvals` reader (`approvals_read` / `approval_feed_read` / `pending_gates_read`) and wired it into Workbench's `Needs a decision` rail without probing the missing route when unadvertised. Gate green: Workbench Playwright 57/57, static 769/769, a11y/static 127/127, static contract OK. Backend route + resolve/status metadata still needed.
- 04:00 — **G5 receipts/audit feed frontend seam done.** Added a capability-gated `GET /api/webchat/v2/receipts` reader (`receipts_read` / `receipt_feed_read` / `audit_read`) and wired it into Workbench's `Recent receipts` rail without probing the missing route when unadvertised. Gate green: Workbench Playwright 59/59, static 774/774, a11y/static 129/129, static contract OK. Backend route + audit/provenance schema still needed.
- 05:00 — **G6 global Workbench feed frontend seam done.** Added a capability-gated `GET /api/webchat/v2/workbench/feed` reader (`workbench_feed_read` / `pending_feed_read` / `changed_feed_read`) and wired it into the existing Active Work rail groups without probing the missing route when unadvertised. Added a general non-legal feed regression (`Vendor onboarding packet changed`) and hardened the Gmail draft modal message textarea with an accessible `Draft message` name after the broad a11y run found a flaky focus/locator path. Gate green: Workbench Playwright 61/61, static 779/779, a11y/static 131/131, static contract OK. Backend route + changed/pending freshness/dismissal schema still needed.
- 06:30 — **UNIFIER DONE (the "nothing populates" root fix).** One `ironclaw-reborn` binary now serves BOTH `/llm`+agent AND the connector route; release build staged into `src-tauri/binaries/` (old → `.prebuilt-bak`), verified live (agent "pong" + `/connectors/connected` 200 / real Gmail read / write-gate enforced). Gateway source on `connector-route-on-main` (f81b24550), draft PR nearai/ironclaw#5109. Committed STATUS + pushed f39f030.
- 06:55 — **Cold-open connect state (design + "nothing populates" UX).** Even with the unified binary, an un-bound Workbench was a command box over empty sections. Added `WorkbenchColdStart` (workbench-arrived.js): anticipatory panel (DESIGN.md Law 1) naming what the Workbench fills with + one calm "Connect your tools" action reusing the in-app sources inspector; renders only after the connector check resolves with zero sources, yields to the readiness strip once one is live. Static tests assert show-when-empty + hide-when-active. Gate green: a11y/static 131/131, unit 0-fail, smoke, DT-1..6, token/copy lint. Committed de03af3, pushed (PR #4).
- 09:20 — **Unified+approvals binary STAGED + live-verified; DESIGN.md gold "agent's hand" pass (verified by viewing).** (1) Release-built `ironclaw_reborn_cli` from 249ccf667 (6m21s), strings-confirmed all three surfaces, swapped into `src-tauri/binaries/ironclaw-reborn-aarch64-apple-darwin` (old → `.pre-approvals-bak`, gitignored). **Live-verified the EXACT staged binary** (booted with the Keychain NEAR AI token): `/llm/providers` 200, `/approvals` 200 `{approvals:[]}`, `/approvals?thread_id=nope` 404 (per-thread ownership guard works), `/connectors/connected` 503 (route present; Composio just unbound in the throwaway boot). **The real app now serves the approvals route.** (2) Design-excellence pass grounded in DESIGN.md (not taste): blue `#0091fd` = user's hand, gold `#fbbf24` = agent's hand (generated work / proposed actions / approval context) + Law 2 Legible Agency. The scene surface used blue for agent output + amber for approval — off-spec. Added a distinct `--wb-gold` token family (light+dark, AA-aware) and applied it: LIVE RUN head + IRONCLAW agent-reply marker + run-card approval gates + Draft/Approval scene badges are now gold; YOU ASKED user marker stays blue (clean user/agent attribution); Private neutral; tool-success green. **Verified by rendering the real run card (light+dark) and viewing it** — clean, not muddy; artifact at `docs/design/screenshots/run-card-dark.png`. Gate green: a11y/static 134/134, unit 779/0, smoke, DT-1..6, token/copy lint. Committed 5afed0f (#4). Follow-up (flagged, not blind-applied): extend the gold law to home surfaces (briefing = "what the agent did"; verify each by render) — pairs with your design review.
- 2026-06-21 09:07 EDT — **Live MCP/connectors hard gate PASS + source inspector aligned.** The repo-local Claude sidecar process is stale/idle (cwd `ironclaw-agent-worktrees/claude`, no transcript writes since 2026-06-19 and no tracked worktree edits), so this continuation advanced the main Workbench branch directly without touching sidecar files. Re-ran `node scripts/probe-workbench-live-wiring.mjs --json` with local NEAR AI + Composio credentials: verdict **PASS**, active provider `nearai`, active model `zai-org/GLM-5.1-FP8`, model catalog `47`, Composio configure `200/active`, `/connectors/connected` `200` with `8` accounts, live toolkits `github/gmail/googlecalendar/googledocs/googledrive/notion/slack`, Gmail/Calendar/Drive/Notion/GitHub/Slack read checks pass, and the Gmail send write-gate rejects with `400`. Fixed one UX truth mismatch: `WorkbenchSourcesInspector` now receives the same live connector families that the command/start path already used, replacing stale first-party setup pills with `Ready via Composio` only when `/connectors/connected` reports an ACTIVE toolkit. Focused checks green: JS syntax, Workbench source-inspector Playwright regression, source setup route test, and connector/source unit slice.
- 2026-06-21 09:19 EDT — **Connector write-route send gate added to the live probe.** `scripts/probe-workbench-live-wiring.mjs` now verifies the dedicated `/api/webchat/v2/connectors/write` route rejects `GMAIL_SEND_EMAIL` with send capability off, in addition to the existing read-route rejection. This proves the draft/write route exists for the Gmail draft UI while real sends stay blocked server-side by default. Live probe with local NEAR AI + Composio credentials: verdict **PASS**, `/connectors/connected` `200` with `8` accounts, read-route send gate `400/rejected`, write-route send gate `400/rejected`, no warnings.
- 2026-06-21 09:25 EDT — **Workbench Ask now carries live connector readiness into Chat.** Claude Code is active in the main desktop repo session but is blocked on a design-direction question after a visual gold pass; the named agent worktrees still only have untracked task/mockup files. To support live-data wiring without touching visual work, the Workbench Chat draft now includes a privacy-safe `Live source status` line derived from ACTIVE connector families already shown in the UI (for example: Gmail/Drive/Slack ready via Composio). Initiated/disconnected sources are omitted; no message content, secrets, or tokens are serialized. Static regression proves a manual Slack request posts to the real Chat runtime with Gmail/Drive/Slack live status included, while Notion is not claimed ready. Gate green: Workbench/API unit slice `138/138`, Workbench Playwright `65/65`, static bundle under budget, `git diff --check`, and live NEAR AI + Composio probe **PASS**.
- 2026-06-21 09:28 EDT — **Live probe now proves the Workbench source-family mapping.** `scripts/probe-workbench-live-wiring.mjs` imports the same pure Workbench helpers used by the app (`connectorFamilyReadiness`, `buildWorkbenchLiveSourceStatus`) and fails if raw `/connectors/connected` accounts do not become ready Workbench source families. Live run with local NEAR AI + Composio credentials: verdict **PASS**, Workbench families `gmail/calendar/drive/notion/slack/github`, zero missing, and privacy-safe live source status included in the probe artifact.
- 2026-06-21 09:33 EDT — **Live probe now proves Workbench Ask reaches the real Chat runtime.** Extended `scripts/probe-workbench-live-wiring.mjs` to build the same Workbench Chat draft the UI uses, create a real `/api/webchat/v2/threads` thread, post the Workbench request through `/messages`, and poll the registered timeline until the user request lands. Live run with local NEAR AI + Composio credentials: verdict **PASS**, thread create `200`, message send `200/submitted`, run id present, timeline `200` on first poll, and the persisted Workbench request preserved all 6 ready live source families (`gmail/calendar/drive/notion/slack/github`). Artifact: `/tmp/ironclaw-workbench-live-wiring-2026-06-21T13-32-56-215Z/probe.json`. No external sends/posts/files/schedules were attempted; connector writes remain gated and send attempts reject with `400`.
- 2026-06-21 09:55 EDT — **Workbench Ask now carries bounded live connector rows, not just readiness.** Follow-up on the remaining live-data gap: the freeform Chat/agent capability surface still needs a runtime proof for direct connector/MCP tool invocation, but the Workbench Ask route now forwards the normalized connector rows the Workbench has already loaded (Gmail subjects/previews, calendar rows, Slack blocker rows, GitHub notifications, recent Drive files, recent Notion pages) into the Chat draft as a capped `Live connector rows already loaded in Workbench` packet. It uses the same safe view-model rows rendered by the UI, caps each family, redacts secret-shaped values, and tells the model the packet is partial instead of exhaustive. Focused validation green: JS syntax, Prettier, `git diff --check`, Workbench plan/start tests `21/21`.
- 2026-06-21 09:58 EDT — **Live probe hardened; current end-to-end assistant result is RED on local NEAR auth.** `scripts/probe-workbench-live-wiring.mjs` now uses the same lifecycle source as the UI (`/events` SSE + `/timeline`) and fails unless Workbench Ask receives an assistant result. Latest live run still proves connected data is real (8 accounts; Gmail/Calendar/Drive/Notion/GitHub live rows; Slack read succeeds empty; writes gated), and proves the Workbench request plus all six source families lands in Chat. It then fails correctly: SSE `running -> queued -> failed`, category `model_credentials_unavailable`, no assistant reply, model catalog `ok:false/count:0`. Artifact: `/tmp/ironclaw-workbench-live-wiring-2026-06-21T13-58-04-857Z/probe.json`. Next unblock is credential/provider truth, not more frontend polish.
- 2026-06-21 10:12 EDT — **Connected-data Workbench Ask is end-to-end green with a working provider profile.** Added `--llm-backend=openrouter` support to `scripts/probe-workbench-live-wiring.mjs` using a temporary copy of `~/.ironclaw/reborn`, so the probe can switch to OpenRouter without mutating the user's persisted provider config. The same run also stops writing raw connector row contents into probe artifacts; artifacts keep counts only. Live run: OpenRouter active in the temp profile, `8` connected accounts, ready source families `gmail/calendar/drive/notion/slack/github`, live normalized row counts `3/3/3/3/3/0`, read-route and write-route send gates reject, Workbench request plus live-row packet lands in Chat, SSE `running -> queued -> completed`, assistant reply observed on timeline attempt `4`. Artifact: `/tmp/ironclaw-workbench-live-wiring-2026-06-21T14-11-07-883Z/probe.json`. User-default NEAR still needs auth/provider remediation before it is green.
- 2026-06-21 10:24 EDT — **Direct freeform Chat connector invocation is now measured, and currently absent.** Added opt-in `--probe-direct-connector-chat` to the live probe. It creates a separate Chat thread with a read-only/no-private-content connector diagnostic and records only marker booleans plus tool metadata, never connector inputs/outputs. Live run with the disposable OpenRouter profile still passes the Workbench path (assistant reply + live rows) and adds a warning: direct Chat reply is present and follows the marker, but says `tool_used=no`; `tool_activity_seen=false`; `tool_signal_count=0`. Artifact: `/tmp/ironclaw-workbench-live-wiring-2026-06-21T14-23-45-414Z/probe.json`. This is the current hard boundary: direct freeform MCP/connector tools need backend/tool-exposure work; do not claim they work because deterministic Workbench reads work.
- 2026-06-21 10:39 EDT — **Live probe artifacts now have a stable sidecar-consumable summary.** Added `summary` to `scripts/probe-workbench-live-wiring.mjs` output so Claude/Cursor/Codex do not have to reverse-engineer nested probe fields. The summary records verdict, failed check names, warning names, active provider/model, connected account count, ready source families, live row counts, Workbench Ask handoff status, and direct connector-tool status. Fresh non-mutating live run with the disposable OpenRouter profile: verdict **WARN** only for no model-list support + missing shell `COMPOSIO_API_KEY`; hard checks pass; `/connectors/connected` `200` with `8` accounts; ready families `gmail/calendar/drive/notion/slack/github`; live row counts `3/3/3/3/3/0`; Workbench Ask posted to Chat (`200/submitted`) and assistant reply observed with live status + row packet preserved. Artifact: `/tmp/ironclaw-workbench-live-wiring-2026-06-21T14-38-42-000Z/probe.json`.
- 2026-06-21 10:56 EDT — **Direct Chat tool-exposure gap narrowed to lifecycle/tool-surface mismatch, not missing connected data.** Added `--activate-chat-source-tools` / `--prepare-direct-connector-chat` to the live probe. It refuses to mutate the persisted user profile unless `--allow-user-profile-extension-activation` is explicitly passed; the default proof path uses the disposable OpenRouter Reborn-home copy. Evidence artifact: `/tmp/ironclaw-workbench-live-wiring-2026-06-21T14-54-01-591Z/probe.json`. Result: Composio is already active/configured and deterministic `/connectors/*` reads are live (`8` accounts; Gmail/Calendar/Drive/Notion/GitHub rows; Slack read succeeds empty), but first-party source extensions do not activate in the copied profile: Gmail/Calendar/Drive/Notion need OAuth, GitHub needs a manual token, Slack is not present as a lifecycle extension in this build. Direct freeform Chat still returns `tool_used=no` with `tool_signal_count=0`. Product truth: Workbench can operate on live connected data today through the connector proxy and passes bounded live rows into Chat; generic Chat cannot yet decide to call those connector/MCP tools itself.
- 2026-06-21 11:09 EDT — **Sidecar support corrected away from stale v8 visual work.** The live Claude process is still in `ironclaw-agent-worktrees/claude`, but that worktree has no recent writes and no `AGENT_REPORT.md`; its old `AGENT_TASK_CLAUDE.md` still points at v8 visual fidelity. Added `docs/design/workbench-live-mcp-sidecar-support-2026-06-21.md` as the current sidecar runbook and dropped pointer files into both `ironclaw-agent-worktrees/claude` and `ironclaw-agent-worktrees/cursor`. The new sidecar mission is explicit: validate and improve live connected-data behavior, preserve deterministic Workbench connector reads plus bounded Chat handoff, and keep direct freeform Chat MCP/tool use marked unproven until `--require-direct-connector-chat` passes.
- 2026-06-21 11:12 EDT — **Fresh live probes rerun for sidecar handoff.** Baseline `node scripts/probe-workbench-live-wiring.mjs --llm-backend=openrouter --json` produced artifact `/tmp/ironclaw-workbench-live-wiring-2026-06-21T15-09-57-494Z/probe.json`: verdict `WARN` only for OpenRouter model-list support and shell `COMPOSIO_API_KEY`, with hard checks passing (`8` accounts, ready families `gmail/calendar/drive/notion/slack/github`, live row counts `3/3/3/3/3/0`, Workbench Ask `completed`, assistant reply seen, live status and row packet preserved, send routes rejected). Direct diagnostic artifact `/tmp/ironclaw-workbench-live-wiring-2026-06-21T15-10-21-797Z/probe.json` still fails only on the separate direct Chat connector probe: thread/send accepted, but no assistant result or tool activity after 32 polls; first-party source extensions remain blocked by setup in the disposable profile. This keeps the same product boundary: Workbench live-data path works; direct freeform connector-tool use is not proven.
- 2026-06-21 11:23 EDT — **Sidecar support rerun after Claude's M4 wide-layout commits; live path still green with OpenRouter, direct Chat still blocked.** Confirmed the sidecar push completed; branch clean/synced at `95384af`. Fresh baseline artifact `/tmp/ironclaw-workbench-live-wiring-2026-06-21T15-21-19-252Z/probe.json`: verdict `WARN` only for OpenRouter model-list support and shell `COMPOSIO_API_KEY`, hard checks pass, `8` connected accounts, ready families `gmail/calendar/drive/notion/slack/github`, live row counts `3/3/3/3/3/0`, Workbench Ask `completed`, assistant reply seen, live source status and live-row packet preserved. Fresh direct required-gate artifact `/tmp/ironclaw-workbench-live-wiring-2026-06-21T15-26-20-272Z/probe.json`: deterministic Workbench path still completes, but the direct Chat probe creates/sends then stays non-terminal after `32` polls with no assistant/tool result and `tool_signal_count = 0`; `summary.diagnostic_hints` now records `connector_proxy_not_model_visible_lifecycle_tool`. User-default artifact `/tmp/ironclaw-workbench-live-wiring-2026-06-21T15-20-57-800Z/probe.json` confirms connected data remains live but `nearai` / `zai-org/GLM-5.1-FP8` fails the assistant turn with `model_credentials_unavailable`. Added probe `summary.diagnostic_hints` plus runbook/status notes naming the narrowed root cause: Composio is live through the connector proxy, but generic Chat needs a model-visible lifecycle/tool-surface bridge before direct connected-data tool calls can pass.
- 2026-06-21 13:05 EDT — **Direct freeform Chat connected-data tool use now passes through the `connected-sources.read` bridge and replays over fresh SSE.** After the gateway bridge, approval exemption, and Composio network-policy fix were staged into the sidecar, the live probe now records the direct Chat run invoking `connected-sources.read` against live connected data. Artifact `/tmp/ironclaw-workbench-live-wiring-2026-06-21T17-05-00-689Z/probe.json`: verdict `WARN` only for OpenRouter model-list support, disposable-profile source OAuth blocks, and missing shell `COMPOSIO_API_KEY`; zero failed checks; Workbench path still green with `8` accounts and ready families `gmail/calendar/drive/notion/slack/github`; direct Chat completed, assistant marker `tool_used=yes`, `tool_activity_seen=true`, `tool_signal_count=4`, `sse_tool_signal_count=2` for the live `connected-sources.read` started/completed frames, and `replay_sse_tool_signal_count=2` from a fresh post-run SSE subscription. That probe reported `timeline_tool_signal_count=0`; the 13:22 probe fix below proves this was envelope parsing, not missing timeline persistence.
- 2026-06-21 13:16 EDT — **Workbench runtime preview now uses the same replayable connector activity stream.** Wired the Workbench run card to subscribe to Chat's SSE projection handler and merge live/replayed `tool_activity` rows with durable `/timeline` user/assistant rows, so the run card can display real `connected-sources.read` activity while live events are arriving. Fresh hard-gate artifact `/tmp/ironclaw-workbench-live-wiring-2026-06-21T17-15-59-895Z/probe.json`: zero failed checks; direct Chat required gate passed with `tool_activity_seen=true`, `sse_tool_signal_count=2`, `replay_sse_tool_signal_count=2`; a follow-up probe fix was needed to count the durable timeline envelope. Validation green: focused merge tests, `npm run test:static` 786/786, `npm run smoke:webui-static`.
- 2026-06-21 13:22 EDT — **Probe now proves completed connector activity also lands in `/timeline`.** Fixed the live probe to parse `capability_display_preview` JSON envelopes stored inside timeline message content. Fresh artifact `/tmp/ironclaw-workbench-live-wiring-2026-06-21T17-22-12-969Z/probe.json`: zero failed checks; Workbench Ask completed; direct Chat required gate passed with `tool_activity_seen=true`, `tool_signal_count=5`, `timeline_tool_signal_count=1`, `sse_tool_signal_count=2`, and `replay_sse_tool_signal_count=2`. The connected-data path now has durable timeline, live SSE, and replay-SSE evidence.
- 2026-06-21 13:24 EDT — **User-default provider truth rerun; blocker is local NEAR auth, not connected data.** Fresh artifact `/tmp/ironclaw-workbench-live-wiring-2026-06-21T17-24-24-154Z/probe.json`: verdict `FAIL` because the user-default provider is `nearai` / `zai-org/GLM-5.1-FP8` and the assistant run fails with `model_credentials_unavailable`. The same run still proves live connected data: `8` accounts, ready families `gmail/calendar/drive/notion/slack/github`, live row counts `3/3/3/3/3/0`, Workbench request persisted, live source status preserved, and the live source packet preserved. Local config says `api_key_env = "NEARAI_API_KEY"`; this shell has `OPENROUTER_API_KEY` but no `NEARAI_API_KEY`.
- 2026-06-21 13:32 EDT — **Workbench now blocks the current user-default provider failure before a doomed Chat send.** Added a model-catalog preflight to the Workbench start hook: if the active provider advertises model listing and `/llm/list-models` fails or returns `ok:false`, the command surface disables Ask with "model access is not available" copy and never posts to Chat. This covers the current NEAR failure mode from the 13:24 artifact while preserving the OpenRouter proof path, because OpenRouter does not advertise model-list support. Validation green: focused hook test, focused Workbench Playwright regression, `npm run test:static` 787/787, full `tests/static/workbench-static.spec.ts` 68/68, `npm run smoke:webui-static`, bundle budget, static token lint, static copy lint, and `git diff --check`.
- 2026-06-21 13:38 EDT — **Live probe now respects the same Workbench provider preflight.** Updated `scripts/probe-workbench-live-wiring.mjs` so the user-default path computes `modelCatalogBlockReason`, records `summary.workbench_start_preflight`, and skips Chat handoff when the UI would block Ask. Fresh user-default artifact `/tmp/ironclaw-workbench-live-wiring-2026-06-21T17-38-06-485Z/probe.json`: verdict `FAIL` only because `LLM model catalog is live` fails; connected data remains live with `8` accounts, ready families `gmail/calendar/drive/notion/slack/github`, and live row counts `3/3/3/3/3/0`; Workbench handoff is skipped with `skip_reason=workbench_start_preflight`. Fresh OpenRouter required-gate artifact `/tmp/ironclaw-workbench-live-wiring-2026-06-21T17-38-32-312Z/probe.json`: zero failed checks, Workbench Ask completed, direct Chat `connected-sources.read` required gate passed, durable timeline tool signal seen, live SSE tool activity seen, and post-run SSE replay seen. Validation green: `node --check scripts/probe-workbench-live-wiring.mjs`, `npm run test:scripts`, default provider probe, OpenRouter direct required gate, and `git diff --check`.
- 2026-06-21 13:44 EDT — **Post-commit live probes rerun on `03f240f`.** User-default artifact `/tmp/ironclaw-workbench-live-wiring-2026-06-21T17-44-11-105Z/probe.json`: verdict `FAIL` only on `LLM model catalog is live`; connected data is still live with `8` accounts, ready families `gmail/calendar/drive/notion/slack/github`, live row counts `3/3/3/3/3/0`, and Workbench start preflight blocks before Chat handoff. OpenRouter direct required-gate artifact `/tmp/ironclaw-workbench-live-wiring-2026-06-21T17-44-27-288Z/probe.json`: verdict `WARN` with zero failed checks; Workbench Ask completed with assistant reply, live source status, and live-row packet; direct Chat invoked `connected-sources.read` with `tool_activity_seen=true`, `tool_signal_count=5`, `timeline_tool_signal_count=1`, `sse_tool_signal_count=2`, and `replay_sse_tool_signal_count=2`.
- 08:55 — **Approvals route VERIFIED + PUSHED (#5109) + Phase 3 in-place approval gates LANDED (#4).** The background agent's gateway route (commit 249ccf667) was adversarially verified by a 3-lens workflow (build/route-table · auth/security · frontend-integration) → synthesis verdict **safe-to-push**: read-only, auth-safe (scope derived only from the authenticated caller, triple owner-scope, uniform 404 ownership guard, empty-feed short-circuit). **Real finding:** PR #5109's base f81b24550 (my connector commit) was GENUINELY RED on `route_table_has_exactly_the_expected_routes` (69≠66 — it added 3 routes without updating the contract test, and the GitHub status rollup never runs that cargo test); 249ccf667 backfills the expected table 66→70 (3 connector ids + LIST_APPROVALS) → green. Pushed 249ccf667 → **#5109 refreshed, contract test now green on branch**. ⚠️ #5109 is CONFLICTING against main — needs a rebase before merge (merge-time task; not blind-rebased now to protect the staged-binary provenance). **Frontend (verified integration, NOT the dead global path):** the global approvals rail can never populate (no backend emits `approvals_read` → capability gate permanently false; and `fetchApprovalsFeed` sent no thread_id). Correct fix shipped: `fetchApprovalsFeed` now takes a `thread_id`; the run card runs a per-thread approvals query scoped to `work.threadId`, gated on `Boolean(threadId)` NOT the capability flag, and renders pending gates **read-only** (resolve = real Phase-4 action, deliberately not wired). Static test asserts a pending gate renders read-only on the run card. Gate green: a11y/static 134/134, unit 779/0, smoke, DT-1..6, token/copy lint. Committed 5495a98 (#4). **Phase 3 now complete end-to-end** (inline timeline + run-states + in-place approval gates). Release rebuild of the unified+approvals binary compiling (detached) to re-stage `src-tauri/binaries/` so the REAL app serves `/approvals`; stage next tick.
- 08:05 — **Backend: approvals-list route DISPATCHED (Phase 4 foundation); retry deferred.** Corrected an initial mis-read: `ironclaw_approvals` is a resolver, BUT the pending-gate read model DOES exist — `ApprovalInteractionService::list_pending(ListPendingApprovalsRequest) -> ListPendingApprovalsResponse{ approvals: Vec<PendingApprovalInteractionView> }` in `crates/ironclaw_product_workflow/src/approval_interaction/` (already called at workflow.rs:1220), and `PendingApprovalInteractionView` carries `scope.thread_id` / `run_id` / `gate_ref` / `summary` / `action` — exactly the frontend's `normalizeApprovalsFeed` contract. `resolve_gate` (handler → reborn_services trait → composition → service) is the exact sibling template. Dispatched a background agent (ad14c6d1) to add read-only `GET /api/webchat/v2/approvals` on `connector-route-on-main` (so the unified binary gains it alongside connectors), advertise `approvals_read`, `cargo build -p ironclaw_reborn_cli --features webui-v2-beta` + boot-and-curl verify (200 + `{approvals:[]}` when none pending, without regressing `/llm` + `/connectors`), commit-if-green, NO push/PR, BLOCKED+restore if not green. Run-card **retry** deferred: `startWorkbenchRequest` reads the brief from closure, so a clean retry needs refactoring the tested start hook (model-switch + attachments + draft persistence) to take an explicit brief — too much risk to the working Ask flow for a marginal button. **Honest queue state:** Phase 3 frontend complete on real data; Phase 4 read side (approvals) in flight; Phase 4 sends + accent fork + z.ai need you; Phase 5 memory/automations need writable + triggers backends.
- 07:45 — **Design ground-truth check + Phase 3 run-states.** VIEWED the real rendered Workbench (docs/design/screenshots/workbench-home-{light,dark}.png): serif (Newsreader) renders crisp in both themes, dark mode is deep-navy with the teal/blue accent — the "tired fonts" was the pre-fix unloaded-font state, now resolved; design is in solid shape, so no speculative restyle. Completed Phase 3 run-states on real timeline data: a landed assistant reply = done; a failed tool with no recovery reply = an honest "Needs attention" (danger) marker; otherwise "Working…". No fabricated states. New static test asserts the failed-no-reply case. Gate green: a11y/static 133/133, unit 779/0, smoke, DT-1..6, token/copy lint. Committed 389ac50, pushed (PR #4). Remaining Phase 3 (cancel/retry, in-place approval gates) needs the runId plumbing + the absent `/approvals` + cancel backend routes; Phase 4 sends need your sign-off. Fresh cold-open/run-timeline screenshots need the live-gateway capture harness (real-app item).
- 07:20 — **Phase 3 chunk 1: inline run timeline.** The started-work surface showed only the latest reply + an "open in chat" punt — the "punts to Chat" weakness the plan flags. New `components/workbench-run-timeline.js` (`WorkbenchRunTimeline`) renders the REAL ordered run ON the Workbench: prompt → each tool step (name + running/done/failed status + detail/result) → assistant output, all from the live thread timeline (`messagesFromTimeline`: user/assistant + `tool_activity` capability cards). Wired into `TimelinePreview` (workbench-scenes.js) with a "Working…" marker until the reply lands; honest empty/error states preserved. Unblocked by the unifier (one binary now serves the timeline the agent writes). Static tests: prompt + real tool step + output render inline (new test) + updated the runtime-preview assertions. Gate green: a11y/static 132/132, unit 779/0, smoke, DT-1..6, token/copy lint. Committed a1ec4f8, pushed (PR #4). Next Phase 3 chunk: inline approval gates in the run card (approve/deny) on the `/approvals` reader + a resolve route.

## Morning brief

**Updated note (2026-06-21 13:44 EDT):** the hardened live probe now proves the Workbench connected-data path can complete
with a real assistant reply when run against a disposable OpenRouter profile. The user-default NEAR AI profile is still not
green because the configured `nearai` / `zai-org/GLM-5.1-FP8` provider cannot verify its model catalog in this environment;
Workbench now blocks Ask before sending to Chat in that state. Treat "works for real" as true for a working provider profile,
not for the current persisted NEAR config.

**TL;DR:** The app now POPULATES + WORKS for real. The one binary the desktop app runs now serves BOTH the agent
(`/llm`) AND the live connector route — built, verified end-to-end, and staged into the app (PR nearai/ironclaw#5109).
Every earlier "it doesn't work / doesn't load" was the dev proxy/fork harness, never the real app. The "tired fonts"
were a font-loading bug (now self-hosted + crisp). Two green draft PRs are up for review; nothing merged to main.

**Review package:** draft PR **nearai/ironclaw-desktop-app#4** (branch `workbench-overnight-20260620`, base main; the
`workbench-overnight-*` commits are the overnight delta). Screenshots: `docs/design/screenshots/`. Connector-route
patch + rebase runbook: `docs/design/gateway-connector-route.patch` + the Q11b runbook above.

**Proven this run (evidence):**

- Real agent turn end-to-end — real prebuilt sidecar + your Keychain NEAR AI token → `/llm/providers` 200 (nearai
  active) → assistant reply. (`/tmp/wb-qa.mjs`.) This is the "can it actually do anything" answer: yes.
- Connector route live on a real gateway build — real Gmail read + write-gate rejects send/forbidden/read-route-write.
  (`/tmp/wb-q11.mjs`.)
- v13 fidelity largely already implemented (serif, theme toggle, Memory nav, dense rail, identity, all-clear) + the
  Memory scene now wired + tested. Gate: 760 static, 123 a11y/Playwright, smoke — all green at every commit.

**To see it yourself:** `cd ironclaw-desktop-app-main && npm run tauri dev` (the REAL app — proxy is gone). Or open the
3 screenshots.

**✅ UNIFIER DONE (the "nothing populates" fix):** The connector route is now rebased onto current gateway `main` (which
has `/llm`+agent), built + verified live on ONE binary (`/llm` 200 + agent turn AND `/connectors/connected` 200, 8
accounts + real Gmail read + write-gate enforced), and the **release binary is staged into
`src-tauri/binaries/ironclaw-reborn-aarch64-apple-darwin`** (old prebuilt → `.prebuilt-bak`). Gateway source committed +
pushed as draft PR **nearai/ironclaw#5109**. So the real app's sidecar now serves BOTH the agent AND live connectors.

**Your move (in priority order):**

1. **See it populate:** `npm run tauri dev`. The bundled sidecar is now the unified binary. If connectors show empty,
   bind the Composio key once in Settings/extensions (`configure` flow is verified working on this binary) — then the
   Workbench populates Gmail/Calendar/Drive/Notion/Slack/GitHub.
2. **Review + merge the two PRs:** `nearai/ironclaw#5109` (gateway connector route) and `nearai/ironclaw-desktop-app#4`
   (desktop: fonts, Memory scene, screenshots, tests). Both draft, green, NOT merged.
3. **Enable real sends** (drafts-only by design) + approve the first send.
4. **Next build (Q12):** `POST /workbench/execute` for Workbench-native multi-step runs (now unblocked — the binary has
   `/llm`+agent+connectors together).

**Note:** a concurrent **codex** process also improved this branch tonight; this loop integrated its work green (see
the Concurrent codex note above). Both agents contributed.

**Pre-PR self-review (adversarial, 02:1x):** No blocking bugs — verdict "ready for PR." Write-path security solid
(client allowlist mirrors the gateway; approval modal is the only write trigger; server-side gate rejects SEND when
disabled — independently verified in Q11). Honesty contract excellent (all normalizers return [] on failure, never
fabricate; briefing shows a "could not read" section and never a false all-clear when a source errors). XSS/link
safety excellent (every external href validated against `^https?://`, ids encoded). Correctness/crash-safety good
(guarded access, strict email validation, intent precedence slack-before-briefing). One reminder carried into Q11b:
keep the server-side `/connectors/write` SEND-gate when rebasing onto main.

## Needs you (morning)

- Enable real outbound sends (+ approve the first real send) — currently drafts-only by design.
- Refresh NEAR AI auth or explicitly switch the real app profile to a working configured provider. Current proof command for
  the non-mutating path:
  `node scripts/probe-workbench-live-wiring.mjs --llm-backend=openrouter --json`.
  The user-default command `node scripts/probe-workbench-live-wiring.mjs --json` now mirrors Workbench and stops before Chat
  when provider preflight fails; use `--force-chat-handoff` only for deliberate backend diagnosis.
- Review the branch + merge to main.
- Direct freeform Chat connector/MCP tool invocation now passes with the staged
  `connected-sources.read` bridge when tested through the working provider
  profile:
  `node scripts/probe-workbench-live-wiring.mjs --llm-backend=openrouter --activate-chat-source-tools --require-direct-connector-chat --json`.
  Completed connector activity now has durable `/timeline`, live SSE, and
  replay-SSE evidence in the latest required-gate probe.

## Tick (2026-06-21, post-remediation): legal-use-case reality verified
- Phase 1 re-verified 14/14 on the credential-pin binary (#10 didn't break the real flow). Evidence: evidence/phase1-post-credential-pin.md.
- Legal-framing layer verified: inferWorkbenchScene matches msa|contract|redline -> legal scene + approval boundaries; 45/45 framing tests green (scenes-registry+plan+work-items+state).
- KEY: the corpus's richer Work contract (governing-law blocker, dossier, watches) is ASPIRATIONAL — its claimed fixtures src/lib/util/workflow-scenarios.ts do NOT exist. Implemented framing is the simpler scene+approval-boundary model; execution punts to a Chat agent turn (heavy multi-step review hits the #7 convergence limit).
- Wrote docs/reviews/legal-use-case-reality.md — honest what-works/what-gapped for the legal use case.
- Remaining: #12 tool-perm governance (from-scratch security feature, flagged for review), #13a connector consent, #14 live sign-off (user runs Part B).

## Tick (2026-06-21): v13 design — behaviour ranking + "You" + model customizability
Converged spec after user correction ("stop going back and forth"): KEEP model customizability, RANK by my behaviour, tell me WHAT TO DO, improve design — all faithful to v12 (Newsreader serif / blue #1c63d6 / dark dock). Built on `docs/design/workbench-v13.html` (= v12 verbatim copy + perspective layer). NOT embedded in the app — standalone design surface (workbench is meant to be separate from the IronClaw desktop app).
- **Behaviour ranking on Home.** `buildPriorities()` scores what-needs-you by sender tier + connected-to-focus + overdue-vs-your-pattern (not generic importance). Home now leads "What needs you · ranked by how you work"; every card shows the action + a "why you" line (e.g. "Dana is a VIP — you reply in ~38 min; she's waited 2h. This is your focus this week."). Skipped items shown honestly ("6 newsletters auto-filed — you archive these").
- **New "You" surface** (`renderPerspective`, nav after Memory): the learned model, Superhuman-style — focus, people ranked by reply tier (VIP/Respond/FYI/Ignore badges + observed reply latency + evidence), patterns with evidence. Each person's tier is an editable dropdown; changing it re-ranks the day live (verified: Finance FYI→VIP jumped 4th→2nd).
- **Model customizability KEPT** (reversed the earlier removal): per-task model + effort selectors in the command bar; defaults (model / effort / VIP-effort override) live on the You surface, with the guardrail note that model choice never widens what can leave (sends still gated).
- **Design improved:** command well restructured from absolute-positioned floating bar (which overlapped the textarea once the model/effort controls were added) into a proper composer container — textarea + control row in normal flow, wraps cleanly at 375px.
- Verified in browser (preview server :17620): no console errors; Home behaviour-rank, You surface (people/patterns/model), composer, and live re-rank all confirmed at mobile + desktop widths.
- NOT done / next: wire the behaviour model to real signals (reply-rate/latency from Gmail history) instead of the seeded PERSPECTIVE const; make the Workbench a genuinely separate surface in the build (not a route inside the desktop app).
