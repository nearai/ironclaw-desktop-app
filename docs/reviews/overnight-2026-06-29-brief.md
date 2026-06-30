# IronClaw Desktop — Ground-Truth Brief (2026-06-29)

Source: workflow wrkanxz0e. Repo: /Users/abhishekvaidyanathan/openclaw-knowledge/ironclaw-desktop
Branch base: chore/retire-svelte (v0.4.158, clean tree, 313 ahead / 108 behind origin/main).
Sidecar source repo: ~/Documents/Playground/ironclaw (has ironclaw_reborn_cli). NOT ~/Desktop/ironclaw.
Bundled sidecar v0.29.0 = bespoke build w/ ~42 uncommitted webui_inbound.rs patches — DO NOT rebuild from origin/main.
EXCLUDE: Workbench at ~/Documents/Playground/ironclaw-desktop-app-main (branch workbench-overnight-20260620, sidecar :4900, proxy :1474).

## #1 GUARDRAIL — DO NOT BLOW AWAY THE FORK
Hard one-way fork of nearai/ironclaw webui_v2_static. No merge-base. Desktop surfaces 2-6x larger, 85 desktop-only files. Blind merge/re-align/re-fork DELETES the product. Port upstream SURGICALLY only.
Three desktop divergences to re-apply on every port:
1. Blob fetch via gatewayFetch(gatewayUrl(path)) + credentials per gatewayOrigin() (upstream plain fetch 404s in WKWebView).
2. Downloads via saveBlob / lib/save-file.js (native dialog) — upstream lib/download.js no-ops in Tauri.
3. extractWorkspaceFilePaths strips code spans.
Do NOT port from upstream: extension-setup, approval-gate, work-product-persist, thread-export modules.

## BUILD / RUN / VERIFY (from repo root)
- npm install
- npm run prepare:webui-static   (rebuild after EVERY js/css edit; Tauri embeds at compile time)
- Dev: npm run dev:webui-static (UI :1420 proxy -> sidecar :3000) | full: npm run tauri dev
- Sidecar (only if needed): IRONCLAW_REPO_DIR=~/Documents/Playground/ironclaw npm run build:reborn-sidecars
- Live model proof: IRONCLAW_PROBE_MODES=nearai node scripts/probe-live-reborn-model-execution.mjs
- Screenshot evidence (needs live sidecar :3700 + token /tmp/ironclaw-design-token.txt): CAPTURE_MODE=chat CAPTURE_READY=1 node scripts/capture-readme-shots.mjs
- FULL pre-push gate (all must pass): verify:static-frontend, check:static-bundle, lint:static-tokens, lint:static-copy, test:design-static, smoke:webui-static, smoke:gate-enforcement, test:a11y-static, test:static, test:scripts

## AUTH / RUNTIME GUARDRAILS
- NEAR AI Cloud ONLY for live model. sk-* -> cloud-api.near.ai; session token -> private.near.ai.
- NEARAI_API_KEY in keychain slot llm-nearai; set via storeNearaiCredential()+restartDesktopSidecar, NEVER upsertLlmProvider (breaks list-models 400).
- Model precedence: ~/.ironclaw/reborn/config.toml [llm.default] OUTRANKS NEARAI_MODEL. NEARAI_MODEL=auto -> 400. Fallback z-ai/glm-5.2.
- Gateway aborts if NEARAI_BASE_URL set w/o NEARAI_API_KEY. private.near.ai rejects loopback OAuth; GitHub/Google SSO dead for local builds.
- Color is legal: #0091fd = user/blue, #fbbf24 = agent/gold. One blue primary action per screen.

## GOTCHAS
- NEVER prettier static/styles/app.css. Only prettier .js/.ts/.mjs then prepare:webui-static.
- i18n lock (i18n-completeness.test.mjs, ~1080+ over 11 packs ar/de/en/es/fr/hi/ja/ko/pt-BR/uk/zh-CN): new sacred-surface copy needs a key in ALL 11 packs + lock bump; missing pack fails CI SILENTLY.
- test:static PASS = zero summed 'ℹ fail' lines (NOT 'not ok').
- Bundle freshness = esbuild byte-match not mtime. On fail: prepare:webui-static, re-run.
- vm-harness tests (useChat-send, chat-input, useHistory, configure-modal): new imports need stub entries; cross-realm arrays via .join(',')+assert.equal.
- Attachments: append buildDurableAttachmentBlock manifest; content <=64KiB bytes, no CRLF/control chars, <=6/message.
- cn(): Tailwind classes complete at parse time (min-h-[44px], not 'min-h-'+val).
- WebUI-v2 route changes: update Expected[] in webui_v2_descriptors_contract.rs.
- Approvals per-thread (?thread_id=); gate on Boolean(threadId), render read-only.
- OCR/WKWebView: ocr_assets.rs loopback server; CSP needs http://127.0.0.1:* + 'wasm-unsafe-eval'. pdf.js/tesseract detach buffers -> bytes.slice().
- Bump version on meaningful builds; /Applications/IronClaw.app caches old strings.
- Git push: git -c http.version=HTTP/1.1 -c http.postBuffer=524288000 push -u origin <branch>. abbyshekit can push branches not merge. Never force-push main.

## QUALITY BAR
Prepared-desk chief-of-staff, not a chat clone. Front door answers in 60s: what changed / needs me / can be handled / where's work product / connector status. Approval gates inline (action+target+destination+outbound+risk; Cmd+Return approve, Esc deny), never modal. Work product durable; Render==Export invariant. No fake readiness. Dense calm bordered surfaces. No jargon. Inter Variable type scale (28/600, 20/600, 16/600, 14/450, 12/500, 11/600; radii 6/12/16).
Patterns: Morning Brief, Needs-You desk, Handled Receipt card, Work Dossier, Artifact Chip.
EVIDENCE RULE: no GREEN from code inspection alone — launch real app, exercise real flow, observe real payload/export, run gates.

## WORK QUEUE
A (autonomous):
1. elite-audit #7 mtime->content bundle gate (verify-static-frontend-contract.mjs:104-115)
2. #20 RTL dir + logical Tailwind utilities (lib/i18n.js)
3. #21 popover focus trap (popover.js; copy modal.js:50-68)
4. #26 command-palette combobox semantics (components/command-palette.js)
5. #30 token-fidelity coverage gate (scripts/lint-static-status-tokens.mjs)
6. remaining ~60 low/polish (dead-code, 44px mobile targets, keyboard a11y, empty/loading dignity unification)
7. run DT-1..DT-6 design tests + fix
8. expand Playwright: connector-completion / Needs-You / dossier
9. deferred UX/a11y (skeletons, aria-live Thinking, focus traps, aria-labels, arrow-key nav)
10. surgical upstream ports per PORT RULES

B (HUMAN-GATED — scaffold/stub + flag only):
- #8 i18n translation content (scaffold keys + ratchet only)
- Apple cert / M1 signing
- Svelte-retirement confirmation
- wire-vs-delete 4 dead affordances (RecoveryNotice / delete-chat / suggestion-cards / resume-probe)
- backend-blocked endpoints (honest stubs only): DELETE /threads/{id}, users CRUD, /automations trigger CRUD, GET /audit, POST /search, durable memory
- #4933 download port (wait for upstream merge)

DONE (do not redo): CoS parity 9/9, DEBT-1/2, SEC-2-5, work-product download port eee1492, auth-gate #5067, surgical align.
