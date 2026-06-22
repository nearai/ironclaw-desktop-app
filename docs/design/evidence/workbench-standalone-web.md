# Workbench as a standalone WEB app — WORKING (broken out of the desktop app)

**When:** 2026-06-21 21:47 EDT · **How:** `scripts/workbench-standalone.mjs` (new)

User direction: break the Workbench out of the IronClaw Tauri desktop app into its
own thing; **standalone web app, function first** (option 2). This is the first
working cut — no Tauri shell, no native fetch bridge.

## What runs
- **Gateway sidecar** (the staged binary the desktop app ships) booted standalone on
  :17640 against a fresh `/tmp/wb-standalone-home` (so it never locks the real
  `~/.ironclaw` libSQL db), env: NEAR AI key from Keychain, `IRONCLAW_AGENT_CONNECTORS_ENABLED=1`,
  `IRONCLAW_TRIGGER_POLLER_ENABLED=1`, `NEARAI_MODEL=z-ai/glm-5.2`.
- **Web tier** = the existing `scripts/serve-webui-static.mjs` (serves the v2 SPA,
  proxies `/api/*` + `/auth/*` to the gateway over HTTP) on :17641.

## Why it works without Tauri (verified in api.js)
- In a browser `inTauri()` is false → `gatewayOrigin()` returns `''` → API calls are
  **relative** `/api/*` and hit the serve proxy. No native bridge needed.
- Auth: token in `sessionStorage['ironclaw_token']` → `Authorization: Bearer`. The SPA
  also consumes `#token=` from the URL fragment (auth.js `consumeTokenFromUrl`), so a
  one-click link authenticates.

## Proof (browser, preview)
- `http://127.0.0.1:17641/workbench#token=...` → authenticated **/workbench** with REAL
  data: "NEEDS A REPLY 6" + real Gmail messages from The Information.
- `connectors/connected` → **8 accounts** (gmail, googlecalendar, googledrive×2,
  googledocs, notion, slack, github). `connectors/read` Gmail → **200**.
- Model **GLM 5.2** active in the command well. **No console errors.**

## Known rough edges (function-first; polish next)
- This is the **live teal/Geist Workbench**, NOT the v13 design (Newsreader/blue +
  behaviour-ranked Home + "You" surface). Porting v13 in is the next phase.
- **Auth doesn't persist a plain reload** — the `#token` link authenticates per load;
  a no-hash reload returns to onboarding (fresh home not onboarded). Persisted/auto
  auth is a follow-up.
- Still served from inside the desktop repo. Proper extraction into its own
  package/repo is per the break-out plan.

## Run it
```
COMPOSIO_API_KEY=ak_... node scripts/workbench-standalone.mjs
# then open the printed http://127.0.0.1:17641/workbench#token=... link
```
