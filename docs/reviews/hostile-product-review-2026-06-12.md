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
- Real in-app work-product generation from attached PDF/DOCX/XLSX inputs still needs the next hostile pass.

### Risks

- The first-run surface is now intentionally inert until provider truth resolves. If the gateway is slow but healthy, users may briefly see "Checking the local gateway" instead of immediately clickable auth buttons.

### Next Agent Should Start Here

1. Run live connector OAuth/read-only setup with active token evidence, or document exact backend blockers.
2. Run hostile work-product scenarios inside the app: PDF-to-DOCX agreement draft, XLSX analysis, CSV export, MD/HTML export, and reload persistence.

### Do Not Touch

- Do not make fallback/synthetic NEAR rows actionable before backend provider truth resolves.
- Do not allow empty registry connector cards to call install/activate lifecycle endpoints.
- Do not expose old BYO provider setup as the normal desktop onboarding path.
