# IronClaw Desktop Design + Usability Escalation

Date: 2026-06-13
Branch under review: `codex/design-system-usability-push`
Design system source: `/Users/abhishekvaidyanathan/Downloads/IronClaw Desktop Design System.zip`

## User Promises Verified

- IronClaw Desktop should feel like a serious agentic chief-of-staff product, not a generic chat wrapper.
- Normal users should see NEAR AI Cloud as the model path; ChatGPT, OpenRouter, Anthropic, Claude, and Codex-specific setup should not leak into the default product surface.
- Chat should start from a prepared desk: visible readiness, document/file affordances, and useful work prompts.
- Connectors should be easy but honest: Gmail, Google Calendar, Slack, Notion, and workspace flows may not pretend to be connected when OAuth/setup is unavailable.
- Generated work product and attachments should remain first-class product commitments, not hidden JSON.
- Rendered UI evidence is required before declaring product progress.

## Evidence

- Fresh rendered capture: `CAPTURE_MODE=chat CAPTURE_READY=1 node scripts/capture-readme-shots.mjs`
  - `output/readme-shots/contact-sheet.png`
  - `output/readme-shots/chat.png`
  - `output/readme-shots/extensions.png`
  - `output/readme-shots/extensions-registry.png`
  - `output/readme-shots/settings-inference.png`
  - `output/readme-shots/onboarding-welcome.png`
  - Console errors: none.
- In-app browser sanity: `http://127.0.0.1:17666/v2/chat` on the raw static server redirects to first-run welcome without Tauri settings; visible text contains IronClaw/NEAR AI Cloud setup and no ChatGPT/OpenRouter/Anthropic/Claude leakage.
- Rendered copy sweep: in-app browser against `http://127.0.0.1:17668` covered `/v2/welcome`, `/v2/extensions/channels?token=render-copy-token`, `/v2/jobs?token=render-copy-token`, `/v2/routines?token=render-copy-token`, and `/v2/projects?token=render-copy-token`.
  - Console warnings/errors: none.
  - Banned visible-copy hits: none for OpenRouter, Anthropic, Claude, ChatGPT, Codex login, provider marketplace, `operator` copy, `without leaving v2`, or developer-console framing.
- Static contract: `npm run verify:static-frontend`
- Static token lint: `npm run lint:static-tokens`
  - Status: passed.
  - Scans 226 shipped static JS files and fails if raw red/yellow/amber/orange/green/lime status utilities return outside generated bundles/tests.
- Static copy lint: `npm run lint:static-copy`
  - Status: passed.
  - Scans 190 shipped static JS files and fails if normal desktop copy leaks OpenRouter, Anthropic, Claude, ChatGPT, Codex login, provider marketplace framing, `operator`, generic `console`, or `Gateway v2`/route wording.
- Rendered static smoke: `npm run smoke:webui-static`
- Static JS tests: `npm run test:static` -> 325 passed.
- Full test suite: `npm run test` -> 161 files / 1294 tests passed.
- Type/UI check: `npm run check` -> 0 errors / 0 warnings.
- Packaged build: `npm run tauri -- build`
  - App: `src-tauri/target/release/bundle/macos/IronClaw.app`
  - DMG: `src-tauri/target/release/bundle/dmg/IronClaw_0.4.158_aarch64.dmg`
  - Local artifact is unsigned because `TAURI_SIGNING_PRIVATE_KEY` is not set.
- Packaged WebView smoke: `npm run smoke:packaged -- --webview-smoke`
  - Status: passed.
  - Evidence: `/tmp/ironclaw-packaged-webview-smoke-20260613-113630.json`
  - 15 checks passed.
  - Chat proof: timeline.
  - Export proof: Markdown, HTML, JSON, PDF, DOCX blobs parse/render, and a saved file exists on disk.
- Live connector truth probe: `node scripts/probe-live-reborn-connectors.mjs`
  - Evidence: `output/live-connector-probe/reborn-live-connector-probe-2026-06-13T14-28-15-711Z.json`
  - Contract violations: none.
  - Gmail OAuth: 503 honest blocked.
  - Google Calendar OAuth: 503 honest blocked.
  - Notion OAuth: 200.
  - Upstream defect: raw `POST /activate` can still report `authenticated:true` without credential proof for Gmail, Google Calendar, and Notion; the desktop UI must keep guarding this.
- NEAR AI execution honesty probe: `IRONCLAW_PROBE_MODES=nearai node scripts/probe-live-reborn-model-execution.mjs`
  - Evidence: `output/live-model-execution-probe/reborn-live-model-execution-2026-06-13T14-28-51-559Z.json`
  - Send accepted, timeline projected the prompt, run lifecycle reached failed, assistant marker was not fabricated, assistant message count stayed 0.
- Calm-motion contract: `node --test crates/ironclaw_webui_v2_static/static/js/design-system/calm-motion.test.mjs`
  - Status: passed.
  - Guards committed source, generated `main.bundle.js`, and generated Tailwind CSS against `animate-pulse`, `animate-bounce`, default pulse/bounce keyframes, and skeleton shimmer.
  - Guards reduced-motion policy: all ambient animation/transition is suppressed, and live/running dots opt into `v2-breathing-dot` only under `prefers-reduced-motion: no-preference`.
  - `rg "animate-pulse|animate-bounce|animate-\\[v2-breathe|v2-skeleton-shimmer|@keyframes pulse|@keyframes bounce" crates/ironclaw_webui_v2_static/static/js crates/ironclaw_webui_v2_static/static/styles --glob '!vendor/**' --glob '!*.test.mjs'` returns no shipped UI hits.
- Static accessibility gate: `npm run test:a11y-static`
  - Status: passed.
  - Full static Playwright project now runs 24 rendered tests: 15 axe surfaces, 3 attachment ingress proofs, and 6 keyboard/approval flows.
  - Covers 15 shipped static `/v2` surfaces with mocked Reborn API responses: onboarding, chat, connections registry/installed/channels/MCP, AI setup, language settings, automations, workspace, projects, jobs, routines, missions, and logs.
  - Fails on critical/serious axe violations and console/page errors; `color-contrast` remains excluded for the same token/opacity false-positive reason as the legacy a11y suite.
  - The expanded run caught and fixed a critical Logs control-name violation; the Logs route now keeps its local-only empty state while exposing named select controls.
  - The gate now starts the static server on the same port it tests (`PORT=1420`), removing the fake-green dependency on a previously-running local server.
- Static keyboard gate: `npx playwright test --config playwright.static.config.ts tests/static/keyboard-static.spec.ts`
  - Status: passed, 6 rendered tests.
  - Proves keyboard traversal through the chat composer reaches model settings, attachment upload, and send controls in order.
  - Proves the model selector opens from keyboard, closes on Escape, and the NEAR AI Cloud setup escape hatch remains reachable.
  - Proves the command palette opens with Ctrl/Cmd+K, does not expose hidden work surfaces, and navigates to Connections.
  - Proves a streamed approval gate resolves through the real Reborn gate endpoint with Ctrl+Enter for approve and Escape for deny.
  - Caught and fixed a real `/v2` scope regression: the Connections empty-state `Browse apps` anchor previously jumped to `/extensions/registry` outside the Tauri static basename.
- Static attachment ingress gate: `npx playwright test --config playwright.static.config.ts tests/static/attachments-static.spec.ts`
  - Status: passed, 3 rendered tests.
  - Proves file picker, clipboard paste, and drag/drop each render a file chip, preserve the typed prompt, and send through the real Reborn `/messages` route via the Tauri bridge.
  - Captures the request body and verifies both channels the model depends on: first-class `attachments[0].base64` plus the readable `<attachments ic="1">` durable text block appended to `content`.
- Logs design contract: `node --test crates/ironclaw_webui_v2_static/static/js/pages/logs/logs-design-contract.test.mjs`
  - Status: passed.
  - Guards the rendered Logs route against raw red/yellow/amber/orange/green status classes so warning and danger states keep using semantic desktop tokens.
- Chat design contract: `node --test crates/ironclaw_webui_v2_static/static/js/pages/chat/lib/chat-design-contract.test.mjs`
  - Status: passed.
  - Guards primary chat failure, connection, composer-remove, and Slack pairing status states against raw red/yellow/amber/orange/green utility classes.
- Settings design contract: `node --test crates/ironclaw_webui_v2_static/static/js/pages/settings/lib/settings-design-contract.test.mjs`
  - Status: passed.
  - Guards the NEAR AI/model setup path against raw status color utilities in save errors, provider login/test messages, restart feedback, and skill action results.
- Routed/admin design contract: `node --test crates/ironclaw_webui_v2_static/static/js/pages/deep-link-design-contract.test.mjs`
  - Status: passed.
  - Guards automations, jobs, missions, projects, routines, workspace, and admin delete/error states against raw red/yellow/amber/orange/green utility classes.
- Hostile usability sidecar fixes:
  - Bare backend readiness tokens (`needs_token`, `blocked`, `auth_required`, `credentials_unavailable`) now block chat send even without extra reason text.
  - `/v2/workspace` no longer selects a phantom `README.md`; backend-blocked workspace writes surface errors instead of success.
  - Google connector setup guidance now stays scoped to `/v2/settings/inference#google-oauth` when launched from hosted static routes.

## Escalated Findings

| Surface | State | Hostile finding | Decision |
| --- | --- | --- | --- |
| Onboarding | GREEN | The first-run screen now says `IronClaw Desktop`, explains NEAR AI Cloud native model access, approvals, and file continuity. It does not ask users to choose third-party LLM vendors before they can work. | Keep. Next proof should be a packaged OAuth smoke with a real token. |
| Chat front door | GREEN | The blank chat state is no longer an empty prompt box. It shows readiness, connector limits, approval behavior, file entry points, and practical prompts. | Keep. Add live pending-approval rows when gateway exposes them globally. |
| Model selector | GREEN | Normal desktop UI exposes NEAR AI Cloud and `auto`; non-NEAR providers are hidden from search/default setup. | Keep. Advanced provider management must remain deep-link/admin-only. |
| Provider copy | GREEN | A new desktop provider contract test prevents ChatGPT/Codex login paths and Codex-specific routes from returning to normal setup surfaces. | Keep as a release gate. |
| Connections installed state | GREEN | Empty installed state is clear and leads to Browse apps. A rendered keyboard test now proves the link stays inside `/v2/extensions/registry` instead of escaping the desktop basename. | Keep. Add connected examples once live connector proofs exist. |
| Connections registry | YELLOW | Gmail, Google Calendar, Slack, and Notion appear as easy primary actions with honest install/setup guidance. Live probe found no route-contract violations. | Keep UI credential-proof guard because backend raw activate still reports authenticated without credential proof. |
| Google OAuth | RED | The UI is honest: Gmail/Calendar need hosted OAuth/client-id support and the live probe returns 503 honest blocked. Blocked setup links now stay inside `/v2` and land on the AI setup target. | Product cannot claim Google OAuth works out of the box until gateway/desktop ships hosted OAuth or a preconfigured desktop client flow. |
| Notion OAuth | YELLOW | Notion is visible and setup-gated; live OAuth start returns 200. | Needs a rendered packaged connector flow that completes credential proof, not just OAuth start. |
| Workspace deep link | YELLOW | Workspace is still backend-blocked, but it no longer invents a README file or reports successful saves from `{ success:false }`. | Keep hidden/deep-link-only until real v2 workspace endpoints exist. |
| Work product exports | GREEN | Packaged WebView smoke proves attachment send, timeline chat proof, parseable MD/HTML/JSON/PDF/DOCX export blobs, and native saved-file bytes. Static rendered tests now separately prove picker, paste, and drag/drop attachment ingress sends readable payloads to Reborn. | Keep. Deep OCR remains opt-in in packaged smoke. |
| Real assistant generation | RED | NEAR AI no-credential probe correctly fails without fabricating assistant work. | Needs a real NEAR AI Cloud token/session proof to produce assistant work from attachments. |
| Visual system | GREEN | Inter Variable, restrained dark desk, 8px cards, quiet tokens, and left-nav hierarchy are coherent across captured surfaces. Loading placeholders now use static `v2-skeleton` blocks, chat typing no longer bounces, live/running dots use a reduced-motion-aware semantic class, and primary chat/Settings/Logs/deep-link/admin status states now use warning/danger/positive tokens instead of raw Tailwind colors. | Keep. Avoid returning to marketing-card layouts, raw status palettes, or perpetual skeleton motion. |
| Copy/product language | GREEN | Remaining visible `operator`, `without leaving v2`, and developer-console leaks in jobs/routines/channels/projects copy were removed. `npm run lint:static-copy` now blocks the normal setup/provider-brand leaks the user has repeatedly called out. | Keep Google Cloud Console allowed only as the proper external Google product name. |
| Accessibility gate | GREEN | The shipped static WebUI now has a dedicated Playwright/axe project for 15 onboarding/chat/connection/settings/deep-link surfaces plus rendered keyboard/focus gates for composer, attachment upload, model selector, command palette, Connections, AI setup, streamed approval gates, and attachment picker/paste/drop. These gates caught a Logs select-name violation and a `/v2` Browse-apps routing regression. Raw status color regressions are blocked by `npm run lint:static-tokens`; jargon/provider copy regressions are blocked by `npm run lint:static-copy` in pre-push and CI. | Keep expanding toward connector-completion keyboard paths. |
| Screenshot process | GREEN | README/design capture now regenerates `contact-sheet.png` from current screenshots and does not leak proxy 502 console errors. | Keep as a review precondition. |

## Required Next Product Proofs

1. Real NEAR AI Cloud session proof: launch packaged app with a valid session/token, send chat with one of the proven attachment ingress paths, and receive an assistant result from attachment content.
2. Connector completion proof by app: Gmail, Google Calendar, Slack, Notion, and workspace files must either connect with credential/account proof or show a specific blocked setup state with exact HTTP evidence.
3. Real generated work-product proof: after a live assistant result, export the generated work as DOCX/PDF/HTML/MD/JSON, parse or render downloaded files, reload thread and confirm artifact persistence.
4. OAuth completion decision: either ship hosted Google/Notion OAuth through the gateway or keep the UI in explicit blocked setup state.
5. Browser-level regression: drive onboarding, chat, settings, and connections in a real packaged WebView after every static bridge/runtime change.

## Release Bar

This design push is shippable as a static UI/product-surface cleanup. It is not yet sufficient to claim connectors work out of the box. The correct public claim is:

> IronClaw Desktop now presents a coherent NEAR AI Cloud-first assistant surface, exposes connector setup honestly, builds into a packaged app, and has rendered/static/package proof for chat attachment persistence and work-product exports. Live connector completion and real NEAR AI assistant generation remain the next release blockers.
