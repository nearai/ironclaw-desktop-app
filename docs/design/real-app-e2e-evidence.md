# Real-app E2E proof — the Workbench populates against real connectors

**2026-06-21.** Ran the actual desktop app (`npm run tauri dev`) — NOT a headless
proxy or a static-frontend mock. The Tauri shell built, launched, spawned the
sidecar (`ironclaw-reborn serve --port 3000`), and the frontend (in the
WKWebView) drove the full boot through the native `gateway_http_fetch` bridge.

Captured bridge calls (raw: `real-app-e2e-evidence.log`, 112 lines, all 200,
zero real errors — the only WARNs are startup races where the frontend hit the
sidecar before it bound and retried successfully):

| Endpoint | Calls | Result |
|---|---|---|
| `/api/webchat/v2/connectors/read` | **5** | 200 — Workbench pulled real Gmail/Calendar/Drive/Notion/GitHub data |
| `/api/webchat/v2/connectors/connected` | 1 | 200 — connected accounts |
| `/api/webchat/v2/llm/providers` + `/llm/list-models` | 2 | 200 — model state honest |
| `/api/webchat/v2/threads` | 1 | 200 |
| `/api/webchat/v2/extensions` + `/extensions/registry` | 2 | 200 |
| `/api/webchat/v2/automations` | 1 | 200 |
| `/api/webchat/v2/channels/connectable` | 1 | 200 |

**Conclusion:** the real desktop app boots and the Workbench POPULATES with the
user's real connector data end-to-end (sidecar + bridge + frontend), against the
real `~/.ironclaw/reborn` profile (Composio bound). This closes the "headless
proofs are not enough / nothing populates in the REAL app" gap.

Reproduce: `npm run tauri dev` (NEAR AI token in Keychain, Composio bound in the
profile). Connector API layer independently proven 14/14 via
`COMPOSIO_API_KEY=… node scripts/connector-live-test.mjs --write`.
