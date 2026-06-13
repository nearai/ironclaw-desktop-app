# IronClaw Desktop Design + Usability Escalation

Date: 2026-06-13
Branch under review: `codex/nearai-first-product-polish`
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
- Static contract: `npm run verify:static-frontend`
- Rendered static smoke: `npm run smoke:webui-static`
- Static JS tests: `npm run test:static` -> 313 passed.
- Full test suite: `npm run test` -> 161 files / 1294 tests passed.
- Type/UI check: `npm run check` -> 0 errors / 0 warnings.

## Escalated Findings

| Surface | State | Hostile finding | Decision |
| --- | --- | --- | --- |
| Onboarding | GREEN | The first-run screen now says `IronClaw Desktop`, explains NEAR AI Cloud native model access, approvals, and file continuity. It does not ask users to choose third-party LLM vendors before they can work. | Keep. Next proof should be a packaged OAuth smoke with a real token. |
| Chat front door | GREEN | The blank chat state is no longer an empty prompt box. It shows readiness, connector limits, approval behavior, file entry points, and practical prompts. | Keep. Add live pending-approval rows when gateway exposes them globally. |
| Model selector | GREEN | Normal desktop UI exposes NEAR AI Cloud and `auto`; non-NEAR providers are hidden from search/default setup. | Keep. Advanced provider management must remain deep-link/admin-only. |
| Provider copy | GREEN | A new desktop provider contract test prevents ChatGPT/Codex login paths and Codex-specific routes from returning to normal setup surfaces. | Keep as a release gate. |
| Connections installed state | GREEN | Empty installed state is clear and leads to Browse apps. | Keep. Add connected examples once live connector proofs exist. |
| Connections registry | YELLOW | Gmail, Google Calendar, Slack, and Notion appear as easy primary actions with honest install/setup guidance. | Still needs live route proof for each connector on a packaged app with an active token. |
| Google OAuth | RED | The UI is honest: Gmail/Calendar need a hosted Google OAuth client ID, and the screenshot shows `NEEDS CLIENT ID`. That means out-of-box Google auth is not complete yet. | Product cannot claim Google OAuth works out of the box until gateway/desktop ships hosted OAuth or a preconfigured desktop client flow. |
| Notion OAuth | YELLOW | Notion is visible and setup-gated rather than fake-connected. | Needs live DCR/OAuth proof or a clear manual-token fallback with exact copy. |
| Work product exports | YELLOW | Static tests cover export builders and parseable MD/HTML/JSON/PDF/DOCX. | Needs rendered app smoke of attaching a file, generating output, downloading, reopening, and parsing the downloaded artifact. |
| Visual system | GREEN | Inter Variable, restrained dark desk, 8px cards, quiet tokens, and left-nav hierarchy are coherent across captured surfaces. | Keep. Avoid returning to marketing-card layouts. |
| Screenshot process | GREEN | README/design capture now regenerates `contact-sheet.png` from current screenshots and does not leak proxy 502 console errors. | Keep as a review precondition. |

## Required Next Product Proofs

1. Packaged app smoke with a real NEAR AI Cloud session: launch, send chat, preserve user text, receive assistant result.
2. Live connector proof by app: Gmail, Google Calendar, Slack, Notion, and workspace files must either connect or show a specific blocked setup state with exact HTTP evidence.
3. Work-product proof: attach DOCX/PDF/XLSX/CSV/PPTX/JSON, generate an artifact, export DOCX/PDF/HTML/MD/JSON, parse or render downloaded files, reload thread and confirm artifact persistence.
4. OAuth completion decision: either ship hosted Google/Notion OAuth through the gateway or keep the UI in explicit blocked setup state.
5. Browser-level regression: drive onboarding, chat, settings, and connections in a real packaged WebView after every static bridge/runtime change.

## Release Bar

This design push is shippable as a static UI/product-surface cleanup. It is not yet sufficient to claim connectors work out of the box. The correct public claim is:

> IronClaw Desktop now presents a coherent NEAR AI Cloud-first assistant surface, exposes connector setup honestly, and has rendered/static test coverage for the redesigned flows. Live connector OAuth and packaged work-product proofs remain the next release blockers.
