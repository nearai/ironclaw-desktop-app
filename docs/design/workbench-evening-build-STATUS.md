# Workbench — Autonomous Evening Build (2026-06-28 →)

Operator: Abhishek (CLO, NEAR AI). Works by triage — wants what needs his attention/decision
**surfaced proactively**, hates noise, legal/strategy focus. The product bar: a prepared
chief-of-staff desk, not a chatbot.

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
- Use Workflows for substantial chunks + adversarial review (near-ai-code-review / codex-fanout).
- Gated-write posture holds; outbound sends per-message approved. Slack send before a PR needs the review gate.

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
