# Workbench — Autonomous Evening Build (2026-06-28 →)

Operator: Abhishek (CLO, NEAR AI). Works by triage — wants what needs his attention/decision
**surfaced proactively**, hates noise, legal/strategy focus. The product bar: a prepared
chief-of-staff desk, not a chatbot.

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
- [ ] **Notion new-creation digest**: detect newly-created/updated Notion pages (e.g. Project
  Passports) since last seen; summarize each in 1–2 lines on the home ("New: Project Passport —
  IronClaw Desktop, created by …; gist: …"). Source: NOTION_SEARCH_NOTION_PAGE (sort by created/edited),
  diff vs a seen-set (localStorage), LLM one-line summary. Honest empty when nothing new.
- [ ] **Slack matters-surfacing on the default home**: surface the decisions-forming / @-mentions /
  key threads that need the operator — promote the deep-read "worth weighing in" + "awaiting reply"
  onto the default home (today they only appear after "Catch me up"). Rank by the existing
  FootprintGatedRelevance; keep it quiet/curated, not a feed.

### P2 — Conversation history (#6)
- [ ] A real conversations surface: list past threads (reuse useThreads/listThreads), reopen one
  into WorkbenchSceneWorkspace (pure fn of threadId). New `components/workbench-history.js` + nav
  entry + reopen handler; optionally invalidate ['threads'] on onStartedWork so a finished Ask shows.

### P3 — UX/UI craft pass (#8)
- [ ] Spacing/hierarchy/states across the shell + cockpit using the installed craft skills
  (interface-design, make-interfaces-feel-better, baseline-ui). One focal point per view; quiet rail;
  consistent card rhythm; loading/empty/error dignity.

## Log
- 2026-06-28: Plan created. P0 gateway build in flight (web-access auto-activate). Prior this session:
  markdown replies, Notion body text, stale-read refetch, jarvis connect, gated Slack reply — all
  shipped + pushed (eb35969).
