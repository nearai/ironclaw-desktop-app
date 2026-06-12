# Hostile Product Review - 2026-06-12

## Handoff: Phase 1 - Product Truth And Surface Polish

Status: YELLOW
Owner lane: Static UI / Connector / Hostile QA

### Goal

Run an escalating hostile review against the current Reborn static desktop surface, remove obvious user-facing product lies, and make the normal desktop path feel like a NEAR AI Cloud chief-of-staff app instead of a gateway/debug console.

### Changed

- `crates/ironclaw_webui_v2_static/static/js/layout/gateway-layout.js`: made gateway outage copy route-aware so Settings and Connections no longer claim "Chat is paused".
- `crates/ironclaw_webui_v2_static/static/js/lib/model-readiness.js`: changed unknown gateway status to a blocked "Checking gateway" state and softened unverified execution to "Verification pending".
- `crates/ironclaw_webui_v2_static/static/js/pages/settings/*`: marked offline NEAR fallback providers as synthetic/unavailable, kept them out of the ready bucket, and relabeled API-key fallback as "Use NEAR API key".
- `crates/ironclaw_webui_v2_static/static/js/pages/extensions/*`: renamed visible tabs to My apps, Messaging, Knowledge, and Browse; disabled curated connector cards unless the gateway actually exposes installable registry entries; added honest gateway-offline messaging states.
- `crates/ironclaw_webui_v2_static/static/js/pages/chat/components/*`: disabled first-run prompt suggestions while setup blocks execution.
- `crates/ironclaw_webui_v2_static/static/js/pages/**/**/*.test.mjs`: added regression coverage for synthetic connector and provider fallback truth states.

### Verified

- Rendered desktop routes in Browser: `/chat`, `/settings/inference`, `/extensions/registry`, `/extensions/installed`, `/extensions/channels`, `/extensions/mcp`.
- Rendered mobile routes at 390px in Browser: `/chat`, `/settings/inference`, `/extensions/registry`.
- `node --test` focused static suites: 34/34 passed.
- `npm run test:static`: 290/290 passed.
- `npm run verify:static-frontend`: passed.
- `npm run smoke:webui-static`: passed.
- `npm run check`: 0 errors, 0 warnings.
- `npm run test`: 161 files, 1294 tests passed.
- `npm run tauri -- build`: produced `IronClaw.app` and `IronClaw_0.4.158_aarch64.dmg`.
- `npm run smoke:packaged`: passed; Reborn gateway healthy, app terminated cleanly, no orphan sidecar.

### Evidence

- Browser desktop matrix showed no raw gateway internals, no OpenRouter/Anthropic/Claude/ChatGPT/Qwen/GLM leaks, no `Ready to use`/`Ready to verify`, and no visible `Inference`, `Registry`, or `MCP Servers` labels on the checked English desktop routes.
- Browser mobile matrix showed no horizontal overflow at 390px on Settings, Browse, or Chat.
- Packaged smoke log: `/tmp/ironclaw-packaged-smoke-20260612-070657.log`.

### Still RED

- Live connector OAuth/read-only tool calls were not proven in this pass; offline and empty-catalog states are honest, but real Gmail/Google Calendar/Notion/Slack login success still needs active gateway/account evidence.
- Work-product generation with real attached PDF/DOCX/XLSX inputs was not re-run in this pass; existing static export/attachment tests are green, but hostile end-to-end app scenarios should continue.

### Risks

- Non-English locales still carry older terminology for some settings labels through the existing missing-key baseline.
- Legacy Svelte reference surfaces still contain old provider/test terminology; this pass stayed scoped to the canonical static desktop UI.
- The UI now correctly disables synthetic connector installs; if the gateway registry is empty in a real packaged build, users see product direction but cannot connect until backend catalog projection is fixed.

### Next Agent Should Start Here

1. Run a live gateway connector gauntlet with real auth-capable fixtures and capture the exact `/api/webchat/v2/extensions/*` request/response sequence.
2. Run hostile work-product scenarios inside the app: PDF-to-DOCX agreement draft, XLSX analysis, CSV export, MD/HTML export, and reload persistence.

### Do Not Touch

- Do not reintroduce OpenRouter/Anthropic/OpenAI/Claude as normal desktop setup paths.
- Do not make slash-prefixed catalog refs into lifecycle route names.
- Do not mark connectors connected or providers ready without gateway evidence.

## Handoff: Phase 2 - Gateway-Unavailable Onboarding Guardrail

Status: YELLOW
Owner lane: Static UI / Hostile QA

### Goal

Escalate first-run testing from "gateway outage copy looks sane" to the more subtle empty-provider case where the gateway responds successfully but exposes no actionable NEAR AI Cloud provider.

### Changed

- `crates/ironclaw_webui_v2_static/static/js/pages/onboarding/onboarding-page.js`: first-run access now distinguishes real provider rows from fallback/synthetic rows. Loading, errored, empty, and synthetic-only provider snapshots are non-actionable.
- `scripts/smoke-webui-static.mjs`: added a rendered mobile and desktop welcome gauntlet for `{ providers: [], active: null }` LLM provider snapshots. It asserts the outage copy, disabled GitHub/Google/Wallet/API-key actions, no stale `:3000` requests, no raw gateway text, no hidden provider leaks, and no horizontal overflow.
- `scripts/smoke-webui-static.mjs`: the empty connector registry smoke now asserts curated connector cards are disabled as `Not available` and cannot emit synthetic install calls.

### Verified

- Live Browser check at `http://127.0.0.1:1425/v2/welcome` with the gateway pointed at a dead port: mobile 390px and desktop 1440px rendered the outage copy, disabled all four auth/setup actions, showed no raw gateway text, showed no OpenRouter/Anthropic/Claude/ChatGPT/Qwen/GLM leaks, and had no horizontal overflow.
- `npm run smoke:webui-static`: passed with the new empty-provider welcome gauntlet and empty-registry connector gauntlet.
- `npm run test:static`: 290/290 passed.
- `npm run verify:static-frontend`: passed.
- `npm run check`: 0 errors, 0 warnings.
- `npm run test`: 161 files, 1294 tests passed.
- `npm run tauri -- build`: produced `IronClaw.app` and `IronClaw_0.4.158_aarch64.dmg`.
- `npm run smoke:packaged`: passed; Reborn gateway healthy, app terminated cleanly, no orphan sidecar.

### Evidence

- Rendered Browser DOM check proved `/v2/welcome` disables `Sign in with GitHub`, `Use Google`, `Use NEAR Wallet`, and `Use API key` when the local gateway/provider snapshot is unavailable.
- Static smoke now proves the same contract on both mobile and desktop without relying on manual observation.
- Packaged smoke log: `/tmp/ironclaw-packaged-smoke-20260612-072156.log`.

### Still RED

- Live connector OAuth/read-only tool calls are still not proven with active accounts.
- Live model-quality generation from real PDF/DOCX/XLSX inputs still needs active gateway/account evidence; the rendered app mechanics are covered by the Phase 3 smoke below.

### Risks

- The first-run surface is now intentionally inert until provider truth resolves. If the gateway is slow but healthy, users may briefly see "Checking the local gateway" instead of immediately clickable auth buttons.

### Next Agent Should Start Here

1. Run live connector OAuth/read-only setup with active token evidence, or document exact backend blockers.
2. Run live model-quality work-product scenarios with active NEAR AI Cloud execution: PDF-to-DOCX agreement draft, XLSX analysis, CSV export, MD/HTML export, and reload persistence.

### Do Not Touch

- Do not make fallback/synthetic NEAR rows actionable before backend provider truth resolves.
- Do not allow empty registry connector cards to call install/activate lifecycle endpoints.
- Do not expose old BYO provider setup as the normal desktop onboarding path.

## Handoff: Phase 3 - Rendered Work-Product File Matrix

Status: YELLOW
Owner lane: Static UI / Work Product / Hostile QA

### Goal

Escalate work-product proof from unit-level extractors/export builders to rendered app behavior: real file inputs through the composer, reload-safe attachment metadata, hidden embedded text, preview, and desktop-native save bytes for every assistant export format.

### Changed

- `scripts/smoke-webui-static.mjs`: added dependency-free stored-ZIP DOCX/XLSX fixtures so the rendered composer ingests valid Office documents, not only text-ish payloads and a PDF.
- `scripts/smoke-webui-static.mjs`: the Tauri shim now implements `save_bytes_dialog`, records the exported base64 bytes, and verifies those bytes after clicking the actual assistant export menu.
- `scripts/smoke-webui-static.mjs`: expanded the chat/work-product smoke to assert extracted text from PDF, DOCX, and XLSX reaches the Reborn message payload, durable attachment manifests preserve filenames without base64, embedded document text stays out of the visible transcript, preview shows retained text on demand, and exports are parseable.

### Verified

- `npm run smoke:webui-static`: passed with rendered composer upload of PDF, valid DOCX, valid XLSX, Markdown, JSON, HTML, and corrupt DOCX rejection.
- The same smoke clicked the actual assistant `Export` menu and verified desktop-native save bytes for Markdown, HTML, PDF, DOCX, JSON, Thread MD, and Thread JSON.

### Evidence

- Rendered attachment proof includes `services-template.docx` extracted marker `MSA-CLAUSE-17` and `pricing-model.xlsx` extracted row `Enterprise\t42000` in the posted Reborn payload.
- Export proof checks include PDF `%PDF-1.4` + `startxref`, DOCX `PK` + `word/document.xml`, structured assistant JSON, whole-thread Markdown with attachment names, and whole-thread JSON without `data_base64`.

### Still RED

- Live connector OAuth/read-only tool calls are still not proven with active accounts.
- Live model-quality generation from the uploaded documents is still not proven; the smoke uses a deterministic mocked assistant response to prove the app surfaces and persistence/export mechanics.

### Risks

- The rendered smoke is heavier now because it exercises real PDF/DOCX/XLSX extraction and seven export actions. It is intentionally hostile but may need timeout tuning if CI hardware is slow.

### Next Agent Should Start Here

1. Run live connector OAuth/read-only setup with active token evidence, or document exact backend blockers.
2. Run live model-quality work-product scenarios with active NEAR AI Cloud execution and inspect the generated agreement/spreadsheet/document quality, not just the UI mechanics.

### Do Not Touch

- Do not reduce work-product proof back to attachment chips alone.
- Do not treat browser anchor downloads as desktop proof; desktop exports must traverse `save_bytes_dialog`.
- Do not allow exported thread JSON to include base64 file payloads.

## Handoff: Phase 4 - Connector Activation Truth Hardening

Status: YELLOW
Owner lane: Connector / Static UI / Hostile QA

### Goal

Escalate connector proof from route-canonicalization to false-positive defense: if the gateway says a lifecycle action "completed" without proving credentials/readiness, the app must not show Connected.

### Changed

- `crates/ironclaw_webui_v2_static/static/js/pages/extensions/hooks/useExtensions.js`: one-click connect and the lower-level Activate mutation now require explicit active/ready/connected phase evidence or credential/account proof plus activation proof. Blockers and negative readiness/auth flags always win.
- `crates/ironclaw_webui_v2_static/static/js/pages/extensions/hooks/useConnectExtension.test.mjs`: added regression coverage for weak activation success and blocker-bearing responses.
- `crates/ironclaw_webui_v2_static/static/js/pages/extensions/hooks/useExtensions-activation.test.mjs`: added mutation-level coverage so installed-extension activation cannot show a success toast from weak lifecycle success.
- `crates/ironclaw_webui_v2_static/static/js/main.bundle.js`: regenerated static bundle for the desktop shell.

### Verified

- Focused connector tests: `node --test crates/ironclaw_webui_v2_static/static/js/pages/extensions/hooks/useConnectExtension.test.mjs` passed 10/10.
- Focused activation mutation tests: `node --test crates/ironclaw_webui_v2_static/static/js/pages/extensions/hooks/useExtensions-activation.test.mjs` passed 2/2.
- `npm run test:static`: passed 294/294.
- `npm run verify:static-frontend`: passed.
- `npm run smoke:webui-static`: passed rendered static desktop bootstrap smoke.
- `npm run check`: 0 errors, 0 warnings.
- `npm run test`: 161 files, 1294 tests passed.
- `npm run tauri -- build`: produced `IronClaw.app` and `IronClaw_0.4.158_aarch64.dmg`.
- `npm run smoke:packaged`: passed; packaged app stayed alive, Reborn gateway healthy on port 3000, sidecar terminated cleanly.
- `node scripts/probe-live-reborn-connectors.mjs`: passed with no contract violations, while preserving known upstream activation false positives as defects.
- `IRONCLAW_PROBE_MODES=nearai node scripts/probe-live-reborn-model-execution.mjs`: send path accepted and no fake assistant reply; NEAR execution still honestly failed without local session/API-key credentials.

### Evidence

- Connector live probe artifact: `output/live-connector-probe/reborn-live-connector-probe-2026-06-12T11-40-56-983Z.json`.
- Model execution live probe artifact: `output/live-model-execution-probe/reborn-live-model-execution-2026-06-12T11-40-56-998Z.json`.
- Packaged smoke log: `/tmp/ironclaw-packaged-smoke-20260612-074247.log`.
- Live probe still reports known upstream defects for Gmail, Google Calendar, and Notion: `POST /activate` can succeed without credentials and later report `authenticated:true`; the static UI now refuses weak activation responses without credential/readiness proof.

### Still RED

- Live Gmail/Google Calendar/Notion/Slack OAuth plus read-only tool proof still requires working backend OAuth/configured accounts. Current live evidence shows honest blocked states or upstream false-positive lifecycle behavior, not successful account use.
- Live model-quality work-product generation still requires an active NEAR AI Cloud session/API key. The probe proves no fake success, but not high-quality generated output.

### Risks

- If the backend continues returning only generic lifecycle success for genuinely connected extensions, users may see an error until the backend includes explicit readiness/credential proof. That is preferable to showing fake Connected.
- The UI hardening guards weak activation responses but cannot repair backend list endpoints that misreport installed connector readiness; those need backend contract fixes.

### Next Agent Should Start Here

1. Fix backend activation/list readiness so Gmail, Google Calendar, Notion, and Slack cannot report authenticated/active without credentials.
2. Re-run `node scripts/probe-live-reborn-connectors.mjs` with real accounts and add read-only tool-call proof.
3. Re-run live NEAR model execution with `NEARAI_SESSION_TOKEN` or `NEARAI_API_KEY` set and inspect generated PDF/DOCX/XLSX work-product quality.

### Do Not Touch

- Do not loosen `activationProvedConnected` back to accepting `success: true` alone.
- Do not hide backend false positives by filtering probe output.
- Do not claim live connector success until rendered UI clicks and captured Reborn requests prove account-level readiness.

## Handoff: Phase 5 - First-Run Surface Polish And Mobile Access Regression

Status: YELLOW
Owner lane: Static UI / Design-hostile QA

### Goal

Escalate design review from "copy is honest" to "the first screen feels like a credible desktop product and the setup controls are immediately reachable." The hostile finding was that first-run looked like a generic dark panel on empty space, and mobile pushed the actual sign-in controls below proof-point content.

### Changed

- `crates/ironclaw_webui_v2_static/static/js/pages/onboarding/onboarding-page.js`: first-run now leads with `IronClaw Desktop`, uses NEAR AI Cloud as the access step, adds structured trust rows, introduces an explicit gateway status callout, and renders disabled gateway-blocked auth actions as secondary controls instead of a fake-primary button.
- `crates/ironclaw_webui_v2_static/static/js/pages/onboarding/onboarding-page.js`: mobile order now shows the NEAR AI Cloud access panel before trust rows so GitHub/Google/Wallet/API-key controls are visible in the first viewport.
- `crates/ironclaw_webui_v2_static/static/js/i18n/en.js`: tightened first-run copy around agentic chief-of-staff value and NEAR AI Cloud access.
- `scripts/smoke-webui-static.mjs`: gateway-unavailable welcome smoke now asserts all four auth controls are present, disabled, and inside the first viewport on both mobile and desktop.
- `crates/ironclaw_webui_v2_static/static/js/main.bundle.js`: regenerated static bundle for the desktop shell.

### Verified

- Browser visual QA at `http://127.0.0.1:1420/v2/welcome` desktop 1440x920: page title `IronClaw`, no console errors/warnings, no horizontal overflow, disabled auth controls visible in first viewport.
- Browser visual QA at `http://127.0.0.1:1420/v2/welcome` mobile 390x844: no console errors/warnings, no horizontal overflow, all four auth controls visible in the first viewport after the reorder.
- `npm run smoke:webui-static`: passed with the new first-viewport auth-control assertion.
- `npm run test:static`: passed 294/294.
- `npm run verify:static-frontend`: passed.
- `npm run check`: 0 errors, 0 warnings.
- `npm run test`: 161 files, 1294 tests passed.
- `npm run tauri -- build`: produced `IronClaw.app` and `IronClaw_0.4.158_aarch64.dmg`.
- `npm run smoke:packaged`: passed; packaged app stayed alive, Reborn gateway healthy on port 3000, sidecar terminated cleanly.

### Evidence

- Browser rendered desktop copy includes `IronClaw Desktop`, `Connect NEAR AI Cloud`, and `Checking local gateway`; auth controls are disabled and in view.
- Browser rendered mobile auth-control positions after the fix: GitHub top 512/bottom 552, Google/Wallet top 560/bottom 592, API key top 600/bottom 632 inside an 844px viewport.
- Packaged smoke log: `/tmp/ironclaw-packaged-smoke-20260612-075236.log`.

### Still RED

- This pass improves first-run design and regression coverage only. It does not prove live connector OAuth/read-only account use.
- Live model-quality work-product generation still requires active NEAR AI Cloud credentials.

### Risks

- Only English copy was tightened in this pass; non-English locales still follow the existing missing-key baseline and may retain older phrasing.
- The visual polish is first-run focused. Chat, Connections, Settings, and Work surfaces still need the same rendered hostile pass once live gateway fixtures are available.

### Next Agent Should Start Here

1. Continue the design-hostile pass on authenticated/fixture-backed chat, Connections, Settings, and Work routes.
2. Add screenshot-backed regression checks for chat model picker, attachment composer, connector setup drawer, and work-product export menus.
3. Pair backend connector readiness fixes with rendered route proof so the app can show real connected states without lying.

### Do Not Touch

- Do not move first-run auth controls below trust/proof content on mobile.
- Do not style disabled gateway-blocked auth actions as bright primary actions.
- Do not replace the product headline with provider/debug terminology.

## Handoff: Phase 6 - Chat Work Product Becomes A First-Class Artifact

Status: YELLOW
Owner lane: Static UI / Work Product / Design-hostile QA

### Goal

Escalate from "the assistant reply exists" to "the generated work product is visible, usable, and not buried inside chat." The hostile finding was that a services-agreement-style output rendered as a narrow assistant bubble with export controls nearby, which reinforced the user's complaint that work product disappeared into the transcript.

### Changed

- `crates/ironclaw_webui_v2_static/static/js/pages/chat/components/message-bubble.js`: assistant responses that look like document work product now render as wide artifact panels with a real border/background/shadow treatment instead of the normal gold hairline reply.
- `crates/ironclaw_webui_v2_static/static/js/pages/chat/components/message-bubble.js`: added explicit outer/shell/body sizing helpers so artifact panels claim available chat width instead of shrink-wrapping to their Markdown text.
- `crates/ironclaw_webui_v2_static/static/js/pages/chat/lib/message-bubble.test.mjs`: added regression coverage for work-product detection, width classes, and ordinary assistant replies staying lightweight.
- `scripts/smoke-webui-static.mjs`: rendered chat smoke now fails if the mocked services-agreement work product is not visible as a wide `assistant-work-product` panel with document content intact.
- `crates/ironclaw_webui_v2_static/static/js/main.bundle.js` and `crates/ironclaw_webui_v2_static/static/styles/tailwind.generated.css`: regenerated static artifacts for the desktop shell.

### Verified

- Focused component test: `node --test crates/ironclaw_webui_v2_static/static/js/pages/chat/lib/message-bubble.test.mjs` passed 7/7.
- `npm run smoke:webui-static`: passed; the rendered browser test uploaded PDF/DOCX/XLSX/MD/JSON/HTML fixtures, sent the prompt, rendered the services-agreement reply, asserted the artifact panel width was at least 520px, previewed retained attachment text, and verified all export bytes.
- Rendered screenshot inspected: `output/playwright/static-work-product-attachment-chat.png` now shows the generated `Services agreement` output as a standalone document panel with visible Save to Work and Export controls beneath it.
- In-app Browser QA at `http://127.0.0.1:17630/v2/chat`: local static app loaded with no console errors/warnings and honestly redirected to the gateway-unavailable NEAR AI Cloud first-run screen when no gateway mock/session was present.
- `npm run test:static`: passed 295/295.
- `npm run verify:static-frontend`: passed.
- `npm run check`: 0 errors, 0 warnings.
- `npm run test`: 161 files, 1294 tests passed.
- `npm run tauri -- build`: produced `IronClaw.app` and `IronClaw_0.4.158_aarch64.dmg`.
- `npm run smoke:packaged`: passed; packaged app stayed alive, Reborn gateway healthy on port 3000, sidecar terminated cleanly.

### Evidence

- The first rendered attempt failed exactly as intended with `width: 446.734375`; after fixing outer and body sizing, `npm run smoke:webui-static` passed.
- Screenshot artifact: `output/playwright/static-work-product-attachment-chat.png`.
- Packaged smoke log: `/tmp/ironclaw-packaged-smoke-20260612-080403.log`.
- In-app Browser screenshot showed `IronClaw Desktop`, `Connect NEAR AI Cloud`, disabled GitHub/Google/Wallet/API-key controls, and zero console warnings/errors in the no-gateway local render.

### Still RED

- First-run `Settings` copy/button is misleading without a session: it calls `/settings/inference`, but the unauthenticated local shell redirects back to `/welcome`. Next design pass should either make it a real reachable setup route or remove the button styling when it cannot navigate.
- Live connector OAuth/read-only account use is still not proven with active accounts.
- Live model-quality work-product generation from user documents still requires active NEAR AI Cloud credentials; this pass proves the rendered artifact surface and export mechanics, not model quality.

### Risks

- Work-product detection is intentionally heuristic: Markdown headings, lists, or tables become artifact panels. Plain conversational assistant replies remain lightweight.
- Artifact panel styling is now substantially better, but the lower composer can still overlap part of long transcript evidence in screenshots; a later chat-layout pass should review scroll anchoring, "Jump to latest", and composer docking together.

### Next Agent Should Start Here

1. Fix or remove the dead first-run Settings affordance in unauthenticated/gateway-offline state.
2. Continue hostile design review on authenticated chat, Connections, Settings, and Work with fresh rendered screenshots.
3. Add live NEAR AI Cloud model-quality tests for PDF/DOCX/XLSX work-product generation once credentials are available.

### Do Not Touch

- Do not collapse generated document work product back into the normal assistant hairline reply.
- Do not claim work-product support from chips alone; keep rendered upload, preview, reload, and export-byte proof.
- Do not weaken the smoke width assertion without replacing it with better visual artifact proof.

## Handoff: Phase 7 - Remove Dead First-Run Settings Affordance

Status: YELLOW
Owner lane: Static UI / Design-hostile QA

### Goal

Close the hostile-design RED found during the in-app Browser pass: gateway-offline first-run rendered a `Settings` button even though unauthenticated users were redirected back to `/welcome`, making the control look actionable while doing nothing useful.

### Changed

- `crates/ironclaw_webui_v2_static/static/js/pages/onboarding/onboarding-page.js`: changed the inline `Settings` affordance from a button to non-clickable emphasized text on the first-run page.
- `scripts/smoke-webui-static.mjs`: gateway-unavailable welcome smoke now fails if a dead `Settings` button appears on mobile or desktop.
- `crates/ironclaw_webui_v2_static/static/js/main.bundle.js` and `crates/ironclaw_webui_v2_static/static/styles/tailwind.generated.css`: regenerated static artifacts for the desktop shell.

### Verified

- `npm run smoke:webui-static`: passed with the new no-dead-Settings-button assertion.
- `npm run test:static`: passed 295/295.
- `npm run verify:static-frontend`: passed.
- `npm run check`: 0 errors, 0 warnings.
- `npm run test`: 161 files, 1294 tests passed.
- `npm run tauri -- build`: produced `IronClaw.app` and `IronClaw_0.4.158_aarch64.dmg`.
- `npm run smoke:packaged`: passed; packaged app stayed alive, Reborn gateway healthy on port 3000, sidecar terminated cleanly.

### Evidence

- The same rendered first-run smoke still verifies all four auth controls are disabled and visible in the first viewport while gateway is unavailable.
- Packaged smoke log: `/tmp/ironclaw-packaged-smoke-20260612-081141.log`.

### Still RED

- Live connector OAuth/read-only account use still needs active account evidence.
- Live NEAR AI Cloud model-quality output from real documents still needs credentials and human/product-quality inspection.
- Authenticated Settings and Connections still need a fresh design-hostile pass with live or fixture-backed gateway state.

### Risks

- This intentionally removes one misleading shortcut instead of solving unauthenticated access to Settings. If product wants Settings reachable before auth, that should be built as a real public setup route with its own routing contract.

### Next Agent Should Start Here

1. Run an authenticated/fixture-backed design-hostile pass on Connections and Settings.
2. Prove connector OAuth/readiness with active accounts or record exact backend blockers.
3. Exercise live NEAR AI Cloud work-product generation quality once credentials are available.

### Do Not Touch

- Do not reintroduce a first-run `Settings` button unless the target route is reachable in the same auth/gateway state.
- Do not make disabled or unreachable setup controls look primary/actionable.
