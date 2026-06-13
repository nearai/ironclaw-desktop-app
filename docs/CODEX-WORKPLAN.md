# IronClaw Desktop — Codex Workplan

> Master plan to improve the app **in every facet**, structured for parallel `codex exec`
> worktree lanes (one file-locked lane per task, PR-per-lane, merge in dependency order).
>
> **Provenance.** Phase-1 ship-ready facets (distribution, approval-enforcement,
> legacy-removal, review-debt, test/CI, security, performance) were mined by a 16-agent
> planning workflow against the live codebase — those 46 task briefs are verbatim-faithful
> and line-anchored. The design/UX + Phase-2 facets were authored from the same research the
> workflow agents read (`DESIGN.md`, `docs/reviews/design-pass-research-synthesis-2026-06-10.md`,
> `docs/reviews/capability-overhaul-plan-2026-06-10.md`,
> `research/ironclaw-desktop-gaps-and-design-tests-2026-06-01.md`) after the run hit the weekly
> subagent limit. Re-verify line numbers before executing any task — the code moves.

## North-star & the three decisions

1. **Desk-lite front door.** Chat stays the home surface, but fold *needs-you* approval
   gates + agent-action **receipts** above the chat greeting — realizing DESIGN.md's
   *anticipation* law without a full Today/Desk rebuild. The design synthesis calls the
   front-door question "the largest unresolved decision — everything inherits from it."
2. **Mine, then remove the legacy SvelteKit `src/`.** The packaged app's `frontendDist`
   is the **static UI** (`crates/ironclaw_webui_v2_static/static`, React 19 + htm, ~47k
   lines). The 103k-line SvelteKit `src/` tree is runtime-dead (zero static-UI imports,
   no Svelte in the shipped bundle) and only survives because CI still exercises it. Port
   the two genuinely-wanted utils, then delete it and retarget the test suite.
3. **Ship-ready, then leap.** Phase 1 makes the public release **trustworthy**
   (notarization + signing + working auto-update, universal approval enforcement, the
   review debt, security, perf, a11y, design-system + desk-lite + chat-craft). Phase 2 is
   the capability leap. Backend-only items get **filed upstream, not faked**.

**Definition of done.**
- *Phase 1 done* = a notarized, auto-updating public DMG that opens without Gatekeeper
  friction; every agent dispatch path gates; `src/` is gone and `green == the real app
  passes`; the visible surfaces pass DT-1/2/3/6 + DT-4/5 (zero shimmer, one accent/screen)
  + axe.
- *Phase 2 done* = visualizations render and export losslessly, connectors connect like
  Claude's, native macOS depth (Spotlight/TTS/Notes/vibrancy), and the upstream asks are
  filed with honest stubs in place.

---

## Phase 1 — Ship-ready (trustworthy public release)

### Distribution & packaging  *(the public-install ship-gate)*
The release pipeline today produces **unsigned, un-notarized, non-auto-updating** builds,
and the README misstates this. `release.yml` runs two per-arch `tauri build`s and never
emits a `latest.json`, so the in-app updater 404s forever.

| id | task | effort | deps | owned lane | acceptance (1-line) |
|----|------|--------|------|-----------|---------------------|
| **DIST-1** | Generate + attach a correct multi-arch `latest.json` so auto-update actually works | M | — | `release.yml`, `scripts/build-updater-manifest.mjs`, `README.md` | `curl …/releases/latest/download/latest.json \| jq '.platforms\|keys'` returns both darwin keys; README:345 false claim rewritten |
| **DIST-2** | Apple Developer-ID codesign + notarize + staple in release CI **(SHIP-GATE)** | L | DIST-1 | `release.yml`, `src-tauri/Entitlements.plist`, `tauri.conf.json`, `docs/RELEASE-SIGNING.md` | `spctl -a -vvv` → `accepted, Notarized Developer ID`; `stapler validate` ok; degrades gracefully without secrets. **Blocked on owner-supplied Apple cert + notarytool creds (code lands now).** |
| **DIST-3** | Universal (fat) macOS DMG — one binary for Apple Silicon + Intel | M | DIST-1, DIST-2 | `release.yml` | `lipo -archs` shows `x86_64 arm64`; resolve per-arch sidecar `externalBin` under the universal target |
| **DIST-4** | Release preflight: signing-key-present + version-skew gate + honest docs | S | — | `scripts/check-release-readiness.sh`, `release-prep.sh` | preflight exits non-zero if `TAURI_SIGNING_PRIVATE_KEY` absent or the 3 version files disagree |
| **DIST-5** | Unblock GitHub Actions + prove a green `workflow_dispatch` dry-run | M | DIST-1/2/3 | `release.yml`, CI | a dispatch run completes green on macos-14 (resolve the historical billing block first) |

### Approval enforcement  *(the #1 product-safety ship-gate)*
In the shipped static UI the only live dispatch path is chat-send; enforcement is a **wire
property** of the sidecar. The client job is: carry full gate metadata end-to-end, never let
a future routine/job/mission "Run" button dispatch off the gate path, and wire-verify.

| id | task | effort | deps | owned lane | acceptance |
|----|------|--------|------|-----------|-----------|
| **APPR-1** | Carry full tool metadata + `allow_always` through gate normalization | S | — | `gates.js` (+test) | `gates.test.mjs` asserts `toolName/parameters/allowAlways` populated (today they're dropped → risk classifier runs on `undefined`) |
| **APPR-2** | Propagate gate metadata through the projection `item.gate` path; fix the `requestId` footgun | M | APPR-1 | `useChatEvents.js` (+test) | resolve no longer relies on the accidental `pendingGate` read; metadata reaches the card |
| **APPR-3** | Harden the risk taxonomy with the legacy approval action-kinds **before** deleting `src/` | S | — | `approval-risk.js` (+test) | send/trade/push/pr/export/delete/write kinds inform `classifyRisk` |
| **APPR-4** | Wire-probe harness: mock sidecar emits gate/auth/resolve frames; assert UI gates→resolves→continues | L | APPR-1/2 | `scripts/smoke-gate-enforcement.mjs` | `node scripts/smoke-gate-enforcement.mjs` exits 0 (the design-synthesis "wire-verify enforcement" line) |
| **APPR-5** | Dispatch-router guard: every agent-run entry point routes through the gate-aware send path | M | APPR-2 | `agent-dispatch.js` (+test) | future routine/job/mission Run buttons **cannot** dispatch except through a gate-aware path |
| **APPR-6** | **DT-6 gate-craft** on `ApprovalCard`: touches / *what-leaves-the-machine* / "Nothing sent yet" / ⌘⏎ Approve · Esc Deny / gold context | M | APPR-1/2 | `approval-card.js` (+test) | DT-6 rubric green; rendered before/after |
| **APPR-7** | **UPSTREAM**: confirm the sidecar gate-prompt exposes `tool_name/parameters/allow_always` and gates *every* send/write/export/delete tool | S | — | `docs/reviews/upstream-gate-enforcement-questions.md` | issue filed against `nearai/ironclaw` (reborn) |

### Legacy removal  *(mine, then delete 103k lines)*
Only **two** legacy utils are genuinely wanted-but-missing; the rest are bonded to retired
desk/missions surfaces the static UI replaced. Deletion is gated by 4 CI hooks.

| id | task | effort | deps | owned lane | acceptance |
|----|------|--------|------|-----------|-----------|
| **LEG-1** | Port the 2 wanted utils — `approval-enforcement` (the universal-gate policy) + `redact` (bearer/PII masker) — into the static UI with `node:test` | M | — | `lib/approval-enforcement.js`, `lib/redact.js` (+tests) | both covered; `chat-work-routing` reduced to an approval-kind check |
| **LEG-2** | Triage + migrate the vitest suite: drop legacy-only specs, retarget the few that test still-shipped logic, repoint vitest off `src/` | M | LEG-1 | `vitest.config.ts`, retargeted specs | per-spec DROP/RETARGET decision recorded in the PR for all ~159 `src/**/*.test.ts` |
| **LEG-3** | Delete the SvelteKit app (`src/`, `svelte.config.js`, `vite.config.js`, legacy e2e) + strip legacy CI/build hooks | L | LEG-1/2 | `src/`, configs, `package.json`, `.github/workflows/*` | `git ls-files src/` empty; `check.yml` no longer runs `svelte-check`/`vite build`/legacy playwright |
| **LEG-4** | Scrub legacy `src/` references from docs | S | LEG-3 | `ARCHITECTURE.md`, `CONTRIBUTING.md`, `UX_NOTES.md`, `README.md` | grep for `src/lib`/`SvelteKit`/`svelte.config`/`.svelte` returns only accurate historical notes |

### Review debt  *(latent bugs first, then structural dup)*

| id | task | effort | deps | owned lane | acceptance |
|----|------|--------|------|-----------|-----------|
| **DEBT-1** | Extract `lib/messageUpsert.js`; fix the two-writer `err-${runId}` **clobber** (divergent merge → a real failure summary can be silently overwritten by the generic poll-fallback) | M | — | `lib/messageUpsert.js`, `useChatEvents.js`, `useChat.js` | dup-insert yields ONE message; specific summary never overwritten by fallback regardless of race order |
| **DEBT-2** | Thread export from the messages array, not DOM scrape — **stop silently dropping tool/thinking/image turns** | M | DEBT-1 | `message-bubble.js`, `lib/thread-export.js` | export of a thread with a tool turn contains that turn (test + manual) |
| **DEBT-3** | Collapse the byte-identical provider→`BackendConfig` dispatcher (×2) + trim helpers in `lib.rs` | M | — | `lib.rs`, `sidecar.rs` | `grep -c BackendConfig::Anthropic lib.rs` == 1; boot-selection tests unchanged |
| **DEBT-4** | Unify the two OAuth connect/poll engines (`useOauthSetup` vs `useConnectExtension`) | M | — | `useExtensions.js`, `lib/oauth-poll.js` | one shared `waitForOauthCompletion`; both paths connect+activate (Gmail manual proof) |
| **DEBT-5** | Extract `lib/time.js` + `lib/format.js`; drop the dead `builtinOverrides` param | M | — | `lib/time.js`, `lib/format.js`, presenters, provider components | formatting consolidated; `builtinOverrides` gone from the provider chain |
| **DEBT-6** | Regression-guard the uncovered Tauri capability manifest + CSP | S | — | `lib/tauri-security.test.mjs` | test fails if a wildcard / `unsafe-eval` / 3rd shell binary is introduced |
| **DEBT-7** | i18n key-completeness test across all 11 packs (baseline-snapshot) | S | — | `i18n/i18n-completeness.test.mjs` | reports the real gaps (ar/hi ~320 missing); fails on NEW regressions vs baseline |

### Test / CI  *(make green == tested)*

| id | task | effort | deps | owned lane | acceptance |
|----|------|--------|------|-----------|-----------|
| **TCI-1** | Cover the SSE stream parser (`FetchEventStream`) — zero tests today | M | — | `lib/api-eventstream.test.mjs` | parser framing/heartbeat/abort covered under `test:static` |
| **TCI-2** | Cover `useConnectExtension` connect chain — timeout + no-auth-url branches | M | — | `useConnectExtension.test.mjs` | 4 phase-sequence cases asserted |
| **TCI-3** | Unit-test `sidecar.rs` pure helpers (0 `#[test]` today) | M | — | `sidecar.rs` | `selected_model`/`clean_secret`/env-allowlist covered |
| **TCI-4** | Test `save_bytes_dialog` path-traversal guard + base64 edges | S | — | `lib.rs` | pure `smoke_save_filename` extracted + traversal/abs-path cases |
| **TCI-5** | Retarget the design-token + hardcoded-color guards to the SHIPPED static UI | M | — | `design-tokens.test.*` | reads `static/styles/app.css` `:root`; fails on raw status colors |
| **TCI-6** | Build the **DT-1..DT-6** automatable design-test harness as a runnable gate | L | TCI-5 | `scripts/design-test-harness.mjs` | accent-count / animation-count / empty-state / gate checks runnable + in CI |
| **TCI-7** | Port E2E + a11y onto a **static-UI** Playwright project (pre-delete migration) | L | — | `playwright.static.config.ts` | webServer `dev:webui-static`; covers chat/onboarding/extensions/settings |
| **TCI-8** | Retire the legacy SvelteKit test surface after static coverage lands | M | TCI-5/6/7 | `vitest.config.ts`, configs | vitest `include` drops `src/**`; legacy playwright removed |
| **TCI-9** | Coverage instrumentation + thresholds (green == measured) | M | TCI-1/2 | `scripts/static-coverage.mjs` | `node --test --experimental-test-coverage` thresholds enforced |
| **TCI-10** | **UPSTREAM**: file backend-only test surfaces (not faked locally) | S | TCI-1/2 | `docs/reviews/test-ci-upstream-backlog-2026-06-11.md` | each mocked backend contract enumerated for the gateway team |

### Security  *(defense-in-depth on the uncovered surfaces)*

| id | task | effort | deps | owned lane | acceptance |
|----|------|--------|------|-----------|-----------|
| **SEC-1** | **Keystone**: migrate + extend the native-security regression guard to the surviving static-UI harness (it dies with `src/` otherwise) | M | — | `lib/native-security-guard.test.mjs` | pins CSP + capability windows + externalBin + interpreter paths under `test:static`; no `src/app.html` ref |
| **SEC-2** | Harden `gateway_http_fetch`: redirect-none, strip cookie/proxy headers, bound body, trust-boundary note | M | — | `lib.rs` | 302→off-allowlist doesn't leak the bearer; header-strip + body-cap tests |
| **SEC-3** | Lock the OCR loopback asset server to a per-boot token + Host check | M | — | `ocr_assets.rs` | 403 without token, 200 with; rejects non-loopback Host; OCR still works |
| **SEC-4** | Threat-model + test the plaintext keychain file-fallback; keep provider keys keychain-only | M | — | `keychain.rs` | provider creds never touch `tokens/`; local-token file write conditional on keychain failure; ARCHITECTURE.md threat-model |
| **SEC-5** | Eliminate the bare `http://*` `img-src` wildcard (mixed-content/tracking-pixel) | S | — | `tauri.conf.json` | `img-src` loopback+https only; guarded by SEC-1 |
| **SEC-6** | **(Phase 2)** Integrity-bind the SSRF allowlist: tamper-evident settings origin | L | SEC-2 | `settings.rs`, spec | HMAC/Rust-owned origin so a WebView compromise can't move the allowlist; fail-closed to loopback |
| **SEC-7** | **(Upstream/cross-check)** hardened-runtime entitlements + updater-key review for distribution | S | — | `docs/reviews/sec-distribution-crosscheck.md` | accept/reject entitlements list; confirm minisign private key not committed |

### Performance

| id | task | effort | deps | owned lane | acceptance |
|----|------|--------|------|-----------|-----------|
| **PERF-1** | Re-point the bundle-size gate at the **shipped static bundle** + vendor blobs (today it measures the dead Svelte build) | M | — | `scripts/check-static-bundle-size.mjs`, `scripts/static-bundle-budget.json` | `npm run check:static-bundle` measures shipped `main.bundle.js`, boot vendor, document/PDF assets, OCR assets, total, and largest tracked asset; gate is in `pre-push` |
| **PERF-2** | Lazy-load `highlight.js` off the cold-start critical path | M | — | `index.html`, loader | bootstrap chain = purify→marked→main; `hljs` loaded on first code block; guarded by `markdown-renderer.test.mjs`, `verify:static-frontend`, and `check:static-bundle` |
| **PERF-3** | Code-split never-visited routes via `React.lazy` + esbuild splitting | L | PERF-1 | `app.js`, `prepare-webui-static.mjs` | initial bundle drops measurably; hidden routes load on demand |
| **PERF-4** | Fix O(n²) streaming-markdown re-render + full-bubble repaint | M | — | `markdown-renderer.js` | coalesced re-renders (rAF/throttle); N streamed tokens ≠ N full reparses |
| **PERF-5** | **(Phase 2)** Virtualize long transcripts in `MessageList`; bound force-scroll | L | PERF-4 | `message-list.js` | windowed mount; large-thread scroll stays smooth |
| **PERF-6** | **(Phase 2)** Tune OCR cost ceiling; surface sidecar-startup timing | S | — | `sidecar.rs` | immediate first health probe (no 250ms tax); OCR ceiling configurable |

---

## Phase 1 — Design / UX

> *Authored from the design synthesis + DESIGN.md + the DT acceptance harness (these facets
> did not run before the limit). DT-6 gate-craft is **APPR-6** above. The DT-1..6 automatable
> checks are **TCI-6**.*

### Desk-lite front door  *(the north-star — everything inherits from this)*

| id | task | effort | deps | owned lane | acceptance |
|----|------|--------|------|-----------|-----------|
| **DESK-1** | Define the front-door data contract — probe the sidecar for cross-thread *pending gates* + *recent handled runs/automations* the home can read above the greeting; mark what's backend-blocked | M | — | `pages/chat/lib/frontdoor-data.js` (+probe note) | documented contract + a working read of pending-gate + recent-run sources (or an honest "needs `/api/...`" filed) |
| **DESK-2** | The **needs-you** gate strip above the greeting — ranked ≤5, lead with the one needing the user, gold attribution, one action each → resolve | L | DESK-1, APPR-1/2 | `pages/chat/components/needs-you-strip.js` | DT-1 cold-open: ≥4/5 testers identify the pending decision without typing |
| **DESK-3** | The **handled** receipts feed — completed agent actions as receipt cards (✓ outcome + deep link), calm | M | DESK-1, CHAT-1 | `pages/chat/components/handled-feed.js` | DT-1: ≥4/5 correctly name one agent action; gold attribution |
| **DESK-4** | Front-door composition + honest empty state — falls back to the clean greeting when nothing is backed (honest-by-construction) | M | DESK-2/3 | `pages/chat/components/empty-state.js` | landing is a prepared brief when state exists, a calm greeting when not; zero false "needs-you" |

### Chat craft  *(the 14 competitor patterns)*

| id | task | effort | deps | owned lane | acceptance |
|----|------|--------|------|-----------|-----------|
| **CHAT-1** | Receipt-card grammar for completed agent actions (✓ outcome + field rows + deep link, gold) — shared with DESK-3 | M | — | `pages/chat/components/receipt-card.js` | renders for a tool result; gold; reversible-where-real |
| **CHAT-2** | File **artifact chip** with preview/download — extend chip-click document preview to agent-**generated** work products, same chip grammar | M | — | `attachment-preview.js`, `artifact-chip.js` | generated DOCX/PDF appears as a chip → preview → save (reuses `saveBlob`) |
| **CHAT-3** | One-line collapsed tool steps inline ("Searched: …", expandable) — replace heavy thinking-trace cards | M | — | `pages/chat/components/tool-row.js` | quiet single-line row; expand → details/params/result |
| **CHAT-4** | Bubble-less assistant prose flush on canvas; user message in a subtle bubble | M | — | `message-bubble.js` | assistant text bubble-less; user bubble subtle (Claude/ChatGPT pattern) |
| **CHAT-5** | Single "+" composer sheet; kill the persistent tool-chip row / **chip soup** (cap to the design budget) | M | — | `chat-input.js` | ≤ the chip budget near the composer; "+"-sheet for attach/tools |
| **CHAT-6** | Attachment thumbnails above the user bubble as rounded images | S | — | `chat-input.js`, `message-bubble.js` | image attachments show as thumbnails |
| **CHAT-7** | Model-picker grouping (Active / Ready / Needs-setup) + "Manage providers" escape hatch | S | — | `model-picker.js` | grouped list with plain-language one-liners |

### Design-system enforcement & de-jargon

| id | task | effort | deps | owned lane | acceptance |
|----|------|--------|------|-----------|-----------|
| **DSYS-1** | Calm-density (DT-4): kill shimmer/pulse skeletons → calm fade; ≤1 accent-action + ≤1 looping anim at rest per screen | M | — | components + `app.css` | DT-4 counts green; zero `animate-pulse` skeletons |
| **DSYS-2** | Empty/loading dignity (DT-5) across visible surfaces — each empty state names next action + one-line why; no spinner-as-content | M | — | empty-state components | DT-5 set green |
| **DSYS-3** | Accent discipline — one blue action/screen, gold strictly agency; audit dense tables / mission cards / status chips | M | — | components + token usage | DT-2 dominance + DT-3 bicolor green |
| **DSYS-4** | Terminology + de-jargon sweep — one persona word (retire "operator"), one scheduled-work story (Missions/Automations/Routines), kill "v2"/"console" leakage; table the lexicon in DESIGN.md | M | — | `i18n/en.js`, `DESIGN.md` | copy-lint passes; lexicon table added |
| **DSYS-5** | AI-tell microcopy scrub (triads, "not X but Y", em-dash padding) + a copy-lint | S | DSYS-4 | `i18n/en.js`, `scripts/copy-lint.mjs` | lint fails on the banned formulations |

### Accessibility

| id | task | effort | deps | owned lane | acceptance |
|----|------|--------|------|-----------|-----------|
| **A11Y-1** | Axe gate over the static UI (`@axe-core/playwright`, already a dep) | M | TCI-7 | `tests/a11y-static.spec.ts` | zero serious/critical axe violations on chat/onboarding/extensions/settings |
| **A11Y-2** | Semantic-token sweep — route the ~348 hardcoded status color classes through DESIGN.md `--v2` tokens; lint fails CI on raw status colors | M | TCI-5 | components + `scripts/token-lint.mjs` | grep for raw `text-red-*/green-*` status colors returns 0; lint in CI |
| **A11Y-3** | Keyboard nav + focus management — focus order, modal/gate traps, ⌘⏎/Esc on gates, visible focus rings | M | — | `tests/static/keyboard-static.spec.ts`, `tests/static/attachments-static.spec.ts`, components | composer/model/attach/send, model popover Esc, command palette, setup-link tab-through, approval-gate Ctrl+Enter/Esc resolution, and attachment picker/paste/drop send payloads covered in the rendered app |
| **A11Y-4** | `prefers-reduced-motion` honored (calm fade) + AA contrast on tokens | S | DSYS-1 | `app.css`, tokens | reduced-motion disables transitions; contrast AA verified |

---

## Phase 2 — Capability leap

### Visualizations & the render==export law

| id | task | effort | deps | owned lane | acceptance |
|----|------|--------|------|-----------|-----------|
| **VIZ-1** | V0 — SVG `max-width` + table-overflow CSS hardening | S | — | `app.css`, markdown CSS | wide SVG/table never breaks layout; guarded by `markdown-layout-contract.test.mjs` and rendered `markdown-layout-static.spec.ts` geometry |
| **VIZ-2** | V1 — **Mermaid** (lazy vendored v11, on-click render, sanitized) — model emits mermaid fences unprompted | M | VIZ-1 | `markdown-renderer.js`, `vendor/mermaid.min.js`, `tests/static/mermaid-static.spec.ts` | DONE: fenced `mermaid` renders on click in the real static chat route; sanitized via DOMPurify SVG profile; lazy-loaded after user action; guarded by `markdown-renderer.test.mjs`, `test:a11y-static`, `verify:static-frontend`, and `check:static-bundle` |
| **VIZ-3** | **render==export law** — same markdown AST drives screen + every export; real lists/links/tables in DOCX; whole-conversation export; diagram image export (builds on the byte-accurate PDF/DOCX already shipped) | M | VIZ-2 | `work-product-export.js`, `markdown` lib | IN PROGRESS: Mermaid source is now labeled and preserved across MD/HTML/JSON/PDF/DOCX exports; remaining acceptance is rendered diagram/image parity plus broader AST parity |
| — | V3 KaTeX math — **recommend SKIP for main parity** (main shows raw `$…$` too); revisit if owner wants | — | — | — | (noted, not tasked) |

### Connectors / MCP parity

| id | task | effort | deps | owned lane | acceptance |
|----|------|--------|------|-----------|-----------|
| **CONN-1** | Connected-state chips ("Connected as you@…") from the setup/status route + disconnect/reconnect | M | DEBT-4 | `pages/extensions/components/*` | each connected extension shows account + disconnect |
| **CONN-2** | In-chat "Connect X" affordance when the model lacks a tool (gate-card deep link to `?setup=1&focus=<ext>`) | M | DESK-1 | gate cards, `extensions-page.js` | "I can't search Notion" becomes a Connect button |
| **CONN-3** | Custom remote MCP server add — what's buildable client-side (unauthenticated URL) vs upstream (OAuth/DCR generalization) | M | — | `pages/extensions/mcp-tab.js` | add an unauthenticated MCP URL; OAuth-MCP marked upstream |
| **CONN-4** | **Upstream** — hosted/zero-config Google OAuth (B1) + custom-MCP OAuth generalization | — | — | (see UP-1) | filed |

### Native macOS depth  *(re-anchored to the static UI)*

| id | task | effort | deps | owned lane | acceptance |
|----|------|--------|------|-----------|-----------|
| **MAC-1** | Spotlight thread indexing — wire the existing `spotlight.rs` to the static-UI thread lifecycle | M | — | `spotlight.rs`, thread hooks | Spotlight finds a thread by content |
| **MAC-2** | Native TTS — `say_text` Tauri command + a quiet voice-answer affordance | M | — | `tts.rs`, chat component | assistant answer can be spoken |
| **MAC-3** | Apple Notes / file export of a thread | M | DEBT-2 | `notes_export.rs`, export UI | export a thread to Notes/file |
| **MAC-4** | Window vibrancy + traffic-light inset | S | — | `tauri.conf.json`, window setup | native material; no web-app uncanny valley |
| **MAC-5** | Tray status + sidecar-death notification (verify current state first) | S | — | `lib.rs`, tray | tray flips on sidecar death; notification fires |

---

## Upstream — filed, not faked

> Honest-by-construction: keep the "Not available on this gateway yet" stub; do not render a
> capability the gateway can't back. File each as a crisp issue on `nearai/ironclaw`.

| id | ask | unblocks | honest stub today |
|----|-----|----------|-------------------|
| **UP-1** | Hosted/zero-config Google OAuth (NEAR-hosted verified client) — **B1** | one-click Gmail like Notion's DCR | BYO client-id in Settings (shipped) |
| **UP-2** | Generated images — image `MessageKind` + SSE variant — **B2** | the dead `role==='image'` bubble | none rendered |
| **UP-3** | Live token validation + scopes/`help_url` on auth prompts — **B3** | richer gate cards | static gate copy |
| **UP-4** | Work-item server persistence (`/api/work-items`) | durable dossier (localStorage-only today) | local-only, capability-probed |
| **UP-5** | Council multi-model (per-call provider override) + gateway holes (thread/memory/doc delete, routine-create, login-revoke, usage time-series) | those surfaces | "Not available on this gateway yet" |
| **UP-6** | **M2 main-sidecar adoption tradeoff** — enumerate the 42 uncommitted bundled-binary patches vs what main buys (M1 `allow_always`, Notion-DCR-in-main, #4717) | a decision, not a build | bundled binary as-is |

---

## Critical path & dependency backbone

The ordered spine (everything else parallelizes around it):

1. **SEC-1** (port the security guard) + **DEBT-6** (capability-manifest guard) — land first so
   every later lane's invariant is pinned the moment it merges.
2. **LEG-1 → LEG-2 → LEG-3 → LEG-4** — mine the 2 utils, migrate vitest, delete `src/`, scrub
   docs. This unblocks honest test gates and removes 103k lines of merge-contention. **LEG-3
   must wait for** TCI-5/6/7 (static-UI coverage exists) and SEC-1 (guard ported) so deletion
   doesn't drop the only nets.
3. **DIST-1 → DIST-2 → DIST-3 → DIST-5** — make the public install trustworthy. DIST-2 is
   **blocked on owner-supplied Apple credentials** (code lands now, proves green later).
4. **APPR-1 → APPR-2 → {APPR-4, APPR-6}**, and **APPR-5** gates future dispatch surfaces.
   **DESK-1 depends on APPR-1/2** (gate data contract).
5. **DEBT-1 → DEBT-2** (latent bugs) and **CHAT-1 → DESK-3** (receipt grammar feeds the desk).
6. **DESK-1 → DESK-2/3 → DESK-4** — the north-star front door, gated on the data contract.
7. Phase 2 (**VIZ / CONN / MAC / SEC-6 / PERF-5/6**) after Phase-1 gates are green.

## Worktree-lane discipline

One task = one `codex exec` worktree on `codex/<id>-<slug>`, owning **only** its `ownedFiles`.
Codex opens a PR per lane; the owner reviews and merges in dependency order. **No two
concurrently-running lanes may share an owned file.**

**Safe-to-parallelize batches** (file-disjoint, no shared owned files):

- **Batch 1 (independent, run together):** SEC-1, DEBT-6, DEBT-1, DEBT-3, DEBT-4, DEBT-5,
  SEC-3, SEC-4, SEC-5, TCI-1, TCI-2, TCI-3, PERF-1, PERF-2, PERF-4, DIST-1, DIST-4, APPR-1,
  APPR-3, LEG-1.
  - ⚠ **Serialize within `lib.rs`:** DEBT-3, SEC-2, TCI-4 all own `lib.rs` → run **one at a
    time** (DEBT-3 first, then SEC-2, then TCI-4), or merge into a single `lib.rs` lane.
  - ⚠ **Serialize within `release.yml`:** DIST-1 → DIST-2 → DIST-3 → DIST-5 (all own it).
  - ⚠ **Serialize `useChatEvents.js`/`useChat.js`:** DEBT-1 → DEBT-2; APPR-2 also touches
    `useChatEvents.js` → sequence APPR-2 after DEBT-1.
- **Batch 2 (after Batch-1 merges):** DEBT-2, APPR-2, APPR-4, APPR-6, TCI-5, TCI-6, TCI-7,
  CHAT-1..7, DSYS-1..5, A11Y-1..4, CONN-1.
- **Batch 3 (after coverage + guards green):** LEG-2 → LEG-3 → LEG-4; TCI-8; DESK-1..4.
- **Batch 4 (Phase 2):** VIZ-1..3, CONN-2/3, MAC-1..5, SEC-6, PERF-3/5/6.

## Definition-of-done gate stack  *(every lane's PR must pass)*

```
npm run test:static     # node --test, the 193+ shipped-UI suites (the real gate)
npm run test            # vitest (shrinks to the retargeted set after LEG-2/TCI-8)
cargo test --release    # incl. SSRF/keychain/sidecar unit tests
npm run check           # svelte-check (removed after LEG-3)
npm run smoke:webui-static
node scripts/tauri-cli.mjs build
bash scripts/smoke-packaged-app.sh --webview-smoke
node scripts/design-test-harness.mjs   # DT-1..6 (after TCI-6)
npx playwright test -c playwright.static.config.ts   # E2E + axe (after TCI-7)
```

## Risks & sequencing notes

- **DIST-2 is the one hard external blocker** — it needs a paid Apple Developer ID cert +
  notarization credentials as Actions secrets. The code lands now; it can't prove green until
  you provision them (`docs/RELEASE-SIGNING.md` will say exactly which secrets).
- **GitHub Actions was historically billing-blocked** — resolve before DIST-5.
- **Hardened-runtime entitlements** are the notarization trap: too tight → the wasm/sidecar
  crashes on notarized builds; too loose → guts the CSP (SEC-7 cross-checks).
- **SEC-4 (keychain file-fallback) is DO-NOT-REMOVE** after a 6-hour production incident —
  only make the local-token write conditional, never delete the fallback.
- **LEG-3 ordering is load-bearing** — deleting `src/` before TCI-5/6/7 + SEC-1 land would
  drop the only security + design guards. Sequence it last in its chain.
- **Thin evidence to re-verify:** all line numbers (code moved since the mine); the
  universal-binary sidecar `externalBin` resolution (DIST-3); whether tray/notifications
  already exist (MAC-5).
- **Owner decisions still open:** V3 KaTeX (recommend skip), M2 main-sidecar adoption (UP-6 —
  enumerate the 42 patches before deciding), and the exact "needs-you" data sources for
  DESK-1 (may surface an upstream `/api` need).
