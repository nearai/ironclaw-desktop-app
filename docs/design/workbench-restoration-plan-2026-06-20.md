# Workbench Restoration Plan — barren regression → v13 fidelity, wired to live backend

Date: 2026-06-20
Author: PLAN synthesizer (consolidates Lanes L / C / D)
Scope: ordered, independently-shippable implementation layers. Read-only synthesis;
every claim below was re-verified against the live sidecar probe and source `file:line`.

---

## 0. The one thing to understand first (operator's words: "Composio has Gmail, Calendar, Drive, Notion … I don't understand why it is not working")

The operator's "Composio" IS live and authenticated on this machine — but it arrives
as the **generic `custom-mcp`** extension, and the WebUI never maps that generic MCP's
toolkits onto the Gmail/Calendar/Drive/Notion **source families**. Verified by booting
the bundled sidecar (`node scripts/probe-workbench-live-wiring.mjs --probe-oauth-start --json`):

```jsonc
// GET /api/webchat/v2/extensions  →  the Composio entry
{ "id": "custom-mcp", "display_name": "Composio", "kind": "mcp_server",
  "active": true, "authenticated": true, "has_auth": true, "needs_setup": false,
  "activation_status": "active" }
```

vs the first-party Google packages on the same profile, all unauthenticated, hosted
OAuth returning 503:

```jsonc
"gmail":           { "state": "auth_required", "oauth_start": { "status": 503 } }
"google-calendar": { "state": "auth_required", "oauth_start": { "status": 503 } }
"google-drive":    { "state": "auth_required", "oauth_start": { "status": 503 } }
"notion":          { "state": "auth_required", "oauth_start": { "status": 200, "host": "mcp.notion.com" } }
```

`genericWorkbenchMcpReadiness()`
(`crates/ironclaw_webui_v2_static/static/js/pages/workbench/hooks/useWorkbenchSourceReadiness.js:35-58`)
turns that authenticated Composio into exactly ONE generic "Connected MCP" row and
stops. `sourceFamilyReadiness()`
(`crates/ironclaw_webui_v2_static/static/js/pages/extensions/lib/registry-readiness.js:291`)
resolves Gmail/Calendar/Drive/Notion to the *unauthenticated first-party* package and
reports "Blocked by setup / Needs Google OAuth." So every family reads blocked while a
real authenticated provider for them sits one row away, unmapped. That is the bug. It is
**never-built**, not regressed — no version of `sourceMatchesFamily` ever mapped Composio.

Everything else the operator sees as "broken" cascades from this plus one default and one
regression:
- **Greyed "Ask" + amber "Could not check NEAR AI Cloud"** — the providers route is
  healthy in the probe (`route_status.providers = 200`, active model `zai-org/GLM-5.1-FP8`).
  The button greys only because the WebUI's `providers` query failed in the rendered env;
  `startBlocked` folds `providerSetupFailed` into a hard disable
  (`hooks/useWorkbenchStart.js:193,206,210-218` → `components/workbench-command.js:274`).
- **Barren rail / stacked dashed empties / no branding / no Memory nav / no theme toggle** —
  pure visual regressions Codex's 14-loop cleanup dropped (Lane L). The rail's feeds are
  real and real-but-empty on this profile (0 threads, 0 automations), not broken.
- **Default theme is `dark`** (`design-system/theme.js:18`) while the v13 mock is light;
  restoring the in-surface toggle (L1) gives the operator control back.

---

## 1. Honest seed-vs-real position (NO fake data)

The v13 mock's richness is a hardcoded `SEED` state machine
(`/Users/abhishekvaidyanathan/Desktop/private-workbench-v13.html:480-492`): "Counter to
Northwind," "2 emails need a reply," "Priya wants to move a call to 3 PM." None of that is
a feed. The plan never reintroduces it. Region-by-region honesty:

| v13 region | Can be REAL now? | Via |
|---|---|---|
| Branding "Abhi · NEAR AI Cloud" | **Real now** | `currentUser` (outlet) + provider `nearai` from `/llm/providers` |
| Needs-a-decision / Blocked / Working / Ready / Scheduled / Receipts | **Real now**, empty on this profile | live threads (`/threads`) + automations (`/automations`) + saved work + source-readiness; populates the moment a run/automation/gate exists (`lib/workbench-state.js:344-363`) |
| Source families "Ready" (Gmail/Cal/Drive/Notion/Slack) | **Real now after Layer 1** | Composio is `authenticated:true,active:true`; map its toolkits → families |
| "What needs me today" inbox/calendar readout | **Real via an agent RUN**, not a poll | after Layer 1 the run calls Composio `GMAIL_FETCH_EMAILS` / `GOOGLECALENDAR_EVENTS_LIST` and returns the v13 Readout scene; **there is no `GET /inbox`** |
| "Arrived since you last checked" home group (L22) | **Honest connect-state only** until a feed exists | show "Connect Gmail to see what arrived"; NEVER seed "2 emails" |
| Rich trigger sentence on decision cards (L19) | **Real when the gate carries it** | `threadAttentionDetails` already threads `{title,detail,timestamp,icon}` (`lib/workbench-state.js:71-84`); render when present, degrade to badge when not |
| Memory scene (L26), cross-thread approvals (G2), automation `latest_run.summary` (D5/G4), durable receipts (G5), durable Work read (G1) | **Genuine backend gaps** | stay empty/honest or disabled-mock until the named route/field ships |

The default-toolkit fallback in Layer 1 (when the backend doesn't enumerate Composio's
toolkits) is honest precisely because Composio is verifiably `authenticated:true,
active:true` — it reports a real, live provider, not invented data. The moment the gateway
ships `provided_families` or real per-toolkit `tools` ids (gap C0), the same function
reports exact coverage with zero further change.

---

## 2. Validation toolchain (applies to every layer)

- Per-file unit: `node --test <path>.test.mjs` (123 `*.test.mjs` exist; runner is plain `node --test`).
- Full static suite: `npm run test:static`.
- Design contract (string-include assertions + targeted tests): `npm run test:design-static`
  (`scripts/design-test-harness.mjs`).
- Static smoke / a11y: `npm run smoke:webui-static`, `npm run test:a11y-static`.
- Copy/token lints: `npm run lint:static-copy`, `npm run lint:static-tokens`.
- Syntax gate for any touched file: `node --check <file>`.
- **Live backend rendered check**: `node scripts/probe-workbench-live-wiring.mjs --probe-oauth-start --json`
  (boots the real sidecar `src-tauri/binaries/ironclaw-reborn-aarch64-apple-darwin`).
- **Rendered diff vs v13**: serve the static bundle (`npm run dev:webui-static`), screenshot
  `/workbench` light + dark, diff against `/tmp/wb-compare-070449/mock-v13-top.png` and
  `mock-v13-full.png`.
- Bundle note: the surface ships from `static/js/main.bundle.js` (generated). After source
  edits, regenerate via `npm run prepare:webui-static` before the smoke/probe render check.
  Do not hand-edit the bundle.

---

## 3. Layers (ordered by leverage; each independently shippable)

### Layer 1 — Composio connector readiness fix  ★ THE UNLOCK
**Goal:** an authenticated, active generic MCP (Composio / `custom-mcp`) marks the families
it covers as **Ready ("via Composio")**, so Gmail/Calendar/Drive/Sheets/Notion/Slack stop
reading "Blocked by setup." This flips the inspector to alive AND makes those families pass
`sourceReadinessUsable` so manual source-scope selection and the Ask run can actually use
them.

Items: **C1, C2, C3, C4, C5, D6** (D6 is the same mapping seen from the data lane).

Files (single-owner, disjoint from other layers):
- `crates/ironclaw_webui_v2_static/static/js/pages/extensions/lib/extension-actions.js`
  — add `GENERIC_MCP_PROVIDER_KEYS`, `COMPOSIO_TOOLKIT_TO_FAMILY`, `COMPOSIO_DEFAULT_FAMILIES`,
  `isGenericMcpProvider(source)`, `composioFamilyCoverage(entry)` (precedence:
  `provided_families` → `toolkits`/`connected_accounts` → real `tools` ids filtered of the
  opaque `custom-mcp.tools` → default set).
- `crates/ironclaw_webui_v2_static/static/js/pages/extensions/lib/registry-readiness.js`
  — add `extensionAuthenticated(entry)` + `composioReadinessForFamily(family, installed)`;
  rework precedence in `sourceFamilyReadiness()` (`:291`) to **first-party-authenticated →
  Composio-provided → first-party-needs-setup/registry → fallback**. `sourceMatchesFamily`
  stays first-party-only (keeps the generic-MCP concern out of per-source key matching).
- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/hooks/useWorkbenchSourceReadiness.js`
  — soften the generic-MCP row body to "Composio is connected; covered apps show their own
  readiness above; other Composio apps are routed at run time."
- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/workbench-sources-inspector.js`
  — NO structural change (it already renders `item.statusLabel`/`item.body`/`item.action`,
  `:64-102`); optionally render an `item.via === 'composio'` tag.
- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/hooks/useWorkbenchSourceReadiness.test.mjs`
  — the existing test (`:96-117`) asserts Composio yields exactly one generic row and never
  maps to a family; that assertion **encodes the bug** — replace it. Add fixtures in the
  real probe shape (opaque `tools:['custom-mcp.tools']` → default coverage; `provided_families`
  → exact; authenticated first-party wins over Composio).

Validation:
- `node --test crates/ironclaw_webui_v2_static/static/js/pages/workbench/hooks/useWorkbenchSourceReadiness.test.mjs`
- `node --check` on each edited file; `npm run test:static`.
- Live: re-run the probe; confirm the readiness items now contain `gmail/calendar/drive/
  sheets/notion/slack` at `state:'ready'` `via:'composio'`.
- Rendered: open "What's allowed" inspector → those families show "Ready" (positive tone);
  Auto-source + manual "Email"/"Slack"/"Docs" scope options become selectable (no block
  banner from `manualSourceBlockReason`, `hooks/useWorkbenchStart.js:116-134`).

Risk: medium. The precedence ordering is load-bearing — an authenticated *first-party*
connector must still win over Composio (don't relabel a real Google OAuth as "via
Composio"). The default-set fallback is a tunable honesty call (see open question 1). Keep
the existing Google-503 / needs-setup branches intact for genuinely uncovered families.

Parallelizable: internally **no** — C1→C2 is a hard dependency, and C3/C5 must change in
lockstep with C2's output shape. Treat Layer 1 as one owner. It is the prerequisite for the
Layer 2 inbox run and the Layer 3 "Ready" visuals.

---

### Layer 2 — Live data feeds into the rail & cards
**Goal:** confirm the already-wired feeds render, surface what's genuinely real, and wire the
ONE honest path to "what needs me today" (an agent run through Composio), without inventing
any rows.

Items: **D1, D2, D4, D5, D3** (D3 depends on Layer 1).

Files:
- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-state.js`
  — D4: verify (no wiring change) that the 6 groups populate from real threads
  (`:62-130`) + automations (`:207-294`); empty is honest. D5 (adapter): surface
  `automation.latest_run.summary` as a real `needs-review`/`receipts` row when the field
  exists; fall back to the current generic copy when it does not — **backend-gap G4: runs
  carry no `summary` today**, so this is wired-but-dormant until the field ships.
- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/workbench-page.js`
  — D1: pass through the existing rich `row` fields (`title/detail/badge/icon/href/timestamp`)
  to the card (the render-side richness lands in Layer 3; the data already exists at
  `lib/workbench-state.js:71-84`).
- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/workbench-shell.js`
  — D2 (== L6): render branding from real `currentUser` + provider, not a literal.
- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-plan.js`
  — D3: after Layer 1 maps Gmail/Calendar, the "What needs me today?" chip
  (`WORKBENCH_VISIBLE_SUGGESTIONS`) fills a brief whose run reads inbox+calendar via the
  Composio MCP tools and returns the v13 Readout scene. The suggestion fill + `useWorkbenchStart`
  → `/messages` path is already real; the only change is ensuring the fill text scopes the
  run to Gmail/Calendar reads. **No `GET /inbox`; no client-synthesized counts.**

Validation:
- `node --test` for `workbench-state.test.mjs` and any plan/state tests; `npm run test:static`.
- Live: seed reality by starting a real run from the surface (or the probe's thread feed) and
  confirm a running thread shows in **Working**, an attention gate in **Needs a decision**, a
  completed automation in **Receipts**. With 0 threads/automations the honest result is empty
  groups (Layer 3 makes the empty state graceful).
- D3 acceptance: with Layer 1 done, click "What needs me today?", Ask → a real thread that
  calls `GMAIL_FETCH_EMAILS` / `GOOGLECALENDAR_EVENTS_LIST` and renders the Readout, fed by
  real inbox/calendar.

Risk: medium for D3/D5 (depend on Layer 1 and on a backend field that may not exist yet —
keep dormant fallbacks). Low for D1/D2/D4.

Parallelizable: partially. D2 (`workbench-shell.js`) and D1 (`workbench-page.js`) and D5
(`workbench-state.js`) and D3 (`workbench-plan.js`) touch **disjoint files** — they can be
done by parallel agents. D3 must MERGE after Layer 1. D2 and L6 are the same edit — do it
once (assign to whichever layer ships first; if Layer 3 ships branding, drop D2 here).

---

### Layer 3 — v13 visual fidelity restore
**Goal:** restore the dropped chrome and the rich card rendering so the surface matches v13,
rendering richness only when the real row carries it.

Items: **L1, L4, L6, L7, L23, L19, L20, L14, L16, L17, L-icons, L22.**

Files & ownership (mostly disjoint — parallelizable):
- `components/workbench-shell.js` — **L1** theme toggle (consume the existing
  `useInterfaceTheme()` from `design-system/theme.js`; it already owns `data-theme` +
  localStorage + `toggleTheme` — no new owner, resolves the L1 risk). **L4** Memory nav
  item (gate: alias to Library's Memory filter until the Memory scene L26 exists — do NOT
  ship a dead nav). **L6/D2** branding sub-line "`${displayName} · NEAR AI Cloud`". **L7**
  hide empty dock groups + drop the misleading green is-done dot on empties (mirror v13's
  `if(!list.length)continue`).
- `workbench-page.js` — **L23** collapse stacked dashed empties into ONE all-clear when truly
  nothing is actionable (keep a genuinely-actionable empty visible). **L19** render
  `row.trigger`/`row.detail` as a distinct trigger line with `row.icon` (not shield) and a
  contextual CTA label (`row.cta` || group-derived "Open packet"/"Review batch") instead of
  literal "Open"; degrade to the badge line when no trigger. **L20** blocked-card CTA
  "Reconnect &lt;source&gt;" / "Recover run" + relative-time trigger from the real row.
- `components/workbench-command.js` — **L14** stop hard-disabling Ask on a *transient*
  `providerSetupFailed` alone (keep accent affordance; keep hard blocks — no draft /
  extracting / source-unusable — disabled). **L16** demote the amber "Could not check NEAR
  AI Cloud" full-width alert to a compact inline hint, only when the check genuinely failed.
  **L17** limit primary visible chips to ~4 + More (single row), keep generic copy
  (optionally rename "Find Slack blockers" → "Check Slack blockers"); adjust the
  `.slice(0, 6)` at `:140-141`.
- `design-system/icons.js` (+ `lib/workbench-state.js`) — **L-icons** add `globe`/`slack`/
  `book` glyphs (stroke style, 24 viewBox) OR accept the documented `plug`/`flag`/`file`
  fallback. `moon`/`sun` already exist (L1 unblocked).
- `lib/workbench-state.js` + `workbench-page.js` — **L22** an "Arrived since you last
  checked" group that renders an **honest connect-state** ("Connect Gmail to see what
  arrived") until a real Gmail attention feed exists; after Layer 1 + a Layer 2 run it can
  show the run's real output. **Never seed "2 emails."**
- New style class for the trigger line — there is no `.wb13-trigger`/`.trigger` style yet
  (`.wb13-empty`, `.wb13-card-meta`, `.wb13-send:disabled` exist). Add it in
  `styles/workspace.js` (aggregated by `workbench-styles.js`).

Validation:
- `node --check` each file; `npm run test:static`; `npm run test:design-static` (the harness
  asserts specific strings — add include-assertions for the restored branding, Memory nav,
  theme button, all-clear copy, contextual CTA labels); `npm run lint:static-copy`,
  `lint:static-tokens`; `npm run test:a11y-static` (theme button needs `aria-pressed`; nav
  items need `aria-current`).
- Rendered diff: serve, screenshot light + dark `/workbench`, diff vs
  `/tmp/wb-compare-070449/mock-v13-top.png` / `mock-v13-full.png`. Confirm: theme toggle
  flips, "Abhi · NEAR AI Cloud" sub-line, Memory nav present, Ask is accent-blue (no grey,
  no amber hero banner), one graceful all-clear instead of three dashed boxes, contextual
  CTAs and the trigger line when a real attention row exists.

Risk: low-to-medium. The only real traps: (1) L4 must not ship a dead nav (gate on L26 or
alias to Library); (2) L14/L16 must not hide a *persistent* provider outage — only soften
the transient case; (3) L22 must not seed inbox data.

Parallelizable: **yes** — split by file. `workbench-shell.js`, `workbench-command.js`,
`workbench-page.js`, `icons.js`+`workbench-state.js`, `styles/workspace.js` are disjoint
owners. The one coordination point: branding (L6/D2) is a single edit; the trigger-line
style (new class) and the card render (L19/L20) must land together.

---

### Layer 4 — Validation & rendered diff vs v13
**Goal:** prove the whole surface against the live backend and the v13 target before ship.

Steps:
- `npm run test:static` (all 123 suites) + `npm run test:scripts`.
- `npm run test:design-static` + `npm run lint:static-copy` + `npm run lint:static-tokens`.
- `npm run smoke:webui-static` + `npm run test:a11y-static` + `npm run smoke:gate-enforcement`
  (mirrors the repo's pre-push gate).
- `npm run prepare:webui-static` to regenerate the bundle, then
  `node scripts/probe-workbench-live-wiring.mjs --probe-oauth-start --json` — assert
  Gmail/Calendar/Drive/Notion/Slack now `ready via composio`; providers/models 200.
- Serve + screenshot light & dark; diff vs `mock-v13-top.png` / `mock-v13-full.png`.
  Acceptance checklist: branding, Memory nav, theme toggle, accent Ask, no amber hero
  banner, dense rail (empties hidden), single all-clear, rich decision/blocked cards with
  contextual CTA + trigger line when real data exists, families "Ready via Composio."
- Optional independent pass: `/codex-fanout --local` or `/near-ai-code-review` on the diff.

Risk: low. Parallelizable: no (gate).

---

## 4. Layer dependency summary

```
Layer 1 (connector)  ──unlocks──►  Layer 2 (D3 inbox run)  ──┐
       │                                                      ├──►  Layer 4 (validate)
       └──unlocks──►  Layer 3 (L14/L16 Ask+banner, L22, "Ready" visuals)  ──┘
Layer 2 (D1/D2/D4/D5) and Layer 3 (chrome restores) run in parallel after Layer 1.
```

Ship order for partial value: Layer 1 alone already turns the inspector + source-scope
alive (the operator's literal complaint). Layer 3's chrome restores are visible immediately
even before any real thread/automation exists. Layer 2's D3 is the payoff that makes "what
needs me today" return real inbox/calendar.

---

## 5. Open questions (operator decisions only)

1. **Composio default-coverage set.** Until the gateway enumerates connected toolkits
   (gap C0), Layer 1 falls back to a default family set
   (`gmail,calendar,drive,sheets,notion,slack`). Is that the correct assumed coverage for
   your Composio account, or should the fallback be narrower (only families you've actually
   connected in Composio) to avoid claiming "Ready" for a toolkit you didn't enable?
2. **Memory nav destination (L4).** Ship Memory nav now aliased to Library's Memory filter,
   or hold the nav until the full Memory preference-capture scene (L26, currently never-built)
   is built? Adding nav without a destination is dead UI.
3. **Backend C0 priority.** The fully-exact connector fix needs `/extensions` to expose
   Composio's connected toolkits (`provided_families` or real per-toolkit `tools` ids). Do
   you want that gateway change scheduled now (makes coverage exact, retires the default-set
   honesty caveat), or is the authenticated-and-active default-set fallback acceptable for
   this release?
