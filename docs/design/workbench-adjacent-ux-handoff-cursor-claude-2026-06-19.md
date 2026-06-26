# Workbench Adjacent UX Handoff For Cursor And Claude

Date: 2026-06-19

Audience: Cursor/Claude agents building IronClaw Desktop UX screens around the
Workbench direction.

Status: implementation handoff. This document describes product intent, screen
inventory, wiring assumptions, build lanes, validation expectations, and
explicit anti-patterns. It does not change app source.

## Product North Star

IronClaw Desktop is an adaptive personal chief of staff, not a legal redline
tool and not a chat app with connector badges. The user should open the app and
feel that IronClaw understands their professional context, knows what is safe
to use, prepares useful work, asks permission before consequential action, and
keeps receipts.

The product must generalize across:

- legal and document review
- finance and investor/stakeholder updates
- operations and internal coordination
- engineering and product triage
- people, recruiting, and performance prep
- research and synthesis
- growth, sales, customer success, and channel/account work
- executive/staff work and general admin

Those domains are validation coverage, not the visible organizing model. The
default UI should adapt to the person's active work and sources. It should not
ask the user to choose a department, persona, workflow category, or legal matter
type before they can ask.

Core value proposition:

1. Connect trusted sources safely.
2. Ask in normal professional language.
3. Let IronClaw read, draft, compare, summarize, monitor, and prepare artifacts.
4. Show assumptions, sources, limitations, approvals, and receipts.
5. Keep private work private until the user approves an external action.
6. Improve through scoped, reviewable preferences rather than silent memory.

Privacy and safe-connector stance:

- Reads and drafts stay private unless an approved action sends, posts, shares,
  files, schedules, or persists something externally.
- Connector readiness must be proven before the UI claims it.
- Source use must be inspectable: what was used, what was skipped, what was
  blocked, and what is unavailable on this gateway.
- Trust is a concrete UI object: approval packages, receipts, source evidence,
  exported artifacts, logs, and reversible settings. It is not decorative copy.

## Existing References To Read First

- `DESIGN.md`
- `CLAUDE.md`
- `docs/design/current-surface-truth-map.md`
- `docs/design/core-flow-specs.md`
- `docs/design/professional-life-surface-reset-2026-06-18.md`
- `docs/design/desktop-app-design-overhaul-brief-2026-06-18.md`
- `docs/design/cursor-workbench-buildout-instructions-2026-06-19.md`

The long Cursor Workbench handoff remains the detailed Workbench build contract.
This document adds the adjacent-screen map and parallel Cursor/Claude
instructions so the rest of the app grows around that design without collapsing
into a legal-only product.

## Current Wiring Assumptions

Treat these as the baseline until code inspection proves otherwise.

- Workbench is the replacement front door and should stay visible. Do not
  demote it to a QA route.
- Chat remains the runtime. Workbench should adapt over existing thread,
  message, timeline, SSE/socket, gate, and saved-work APIs until a first-class
  Workbench backend exists.
- Onboarding and Settings own model/provider truth. Workbench can show model
  state and request preferences, but should not become a provider console.
- Connections owns connector catalog, setup, readiness, blockers, and lifecycle
  actions. Workbench consumes readiness; it does not invent readiness.
- Work/Artifact surfaces own saved work, generated files, preview, copy, export,
  reload, search, and document-reader states.
- Approval components and gate APIs own external action review. Any new review
  screen must resolve real gates or clearly stage future hooks.
- Automations/monitors are read-only or natural-language-chat-created unless
  real CRUD APIs exist.
- Memory/preferences are proposed and scoped unless durable backend storage is
  proven.
- Logs/debug are support surfaces. They should expose evidence and diagnostics,
  not become the main user experience.

Future backend hooks should be treated as adapters, not new UX concepts:

- global pending approvals and blocked connector feed
- source activity feed and "what changed since last check"
- first-class Workbench work-item/run endpoint
- durable memory/preferences store with audit
- automation/monitor CRUD and delivery destinations
- server-side artifact, thread, receipt, and source search
- complete audit/ledger read API

Build current UI states so they can swap from local/device-derived data to
backend data without changing the visible object model.

## Before Main Maintainability Gate

The current Workbench scaffold must not move to main as a mega page, static
mockup clone, legal-first packet desk, function picker, or dummy UX. Before main,
the implementation must be split into clear modules that preserve the adaptive
personal chief-of-staff direction: one natural-language desk that reads
available sources, prepares work, exposes assumptions, holds external actions
for approval, and records receipts.

This is a required implementation gate, not a polish backlog. If any item below
is missing, the merge note must name it as a blocker or an explicit deferred
backend/API dependency; it must not be hidden behind optimistic UI copy.

Required splits and validation:

1. Mega Workbench page split
   - Implement the route page as a thin shell over focused components for the
     composer, source/model controls, state rail, source inspector, active run,
     approval summary, Library, Memory, and empty/error states.
   - Keep page-level state minimal and adapter-shaped. Do not let one file own
     the full layout, copy corpus, mock state, request packaging, viewer logic,
     and styles.
   - Validation: direct `/workbench`, `/`, and `/overview` render tests stay
     green; 390px mobile has no horizontal overflow; keyboard focus can move
     through composer, controls, drawers, and primary action; no visible
     department/function picker appears on the first screen.

2. Scene registry
   - Move scenario/example/state fixtures into a registry that describes
     domain-neutral work scenes: needs review, blocked, working, ready,
     scheduled, recent, source blocked, approval required, artifact ready,
     monitor/watch, and preference proposal.
   - Domain metadata may exist for coverage, ranking, and tests, but it must not
     become default navigation or first-screen chrome.
   - Validation: fixture coverage spans at least five business domains; legal
     and document scenes are less than half of visible examples and less than
     half of scenario fixtures; static tests fail if registry domain labels
     render as first-screen picker/tabs/cards.

3. Request/model adapter
   - Put Workbench-to-Chat packaging in a pure adapter that carries the user's
     original wording plus model, effort, source scope, cadence/due-date,
     attachment notes, approval boundaries, assumptions, and requested output
     format when inferable.
   - Model/provider truth must come from Settings/Chat state. Workbench may show
     preference controls, but must not invent a provider console or route sends
     to a new Workbench-only runtime.
   - Validation: tests prove non-empty asks reach the existing Chat send path
     with model/effort/source/cadence preferences; blocked model state prevents
     send or warns clearly; no fake endpoint, hidden domain taxonomy, JSON, or
     prompt-engineering instruction leaks into the visible UI.

4. Styles split
   - Keep Workbench visual rules in the extracted style module or component
     styles that follow the app's design tokens. Do not re-inline the full v13
     CSS string into the route page during component splits.
   - Validation: token/copy lint passes where applicable; desktop and mobile
     screenshots show stable layout, no overlapping controls, no text overflow,
     no card-within-card page sections, and no generated CSS/bundle update until
     source tests pass.

5. Packet/work viewer model
   - Create a domain-neutral viewer model for work items, artifacts, approval
     packages, source provenance, receipts, and related thread/run links.
     "Packet" can be a review shape, not the product identity.
   - Legal redlines, MSAs, and document packets must be artifact types inside
     the broader work model, not the default Workbench language.
   - Validation: artifact deep links, markdown/text artifacts, file artifacts,
     missing artifacts, related approvals, and receipts have focused tests; no
     raw base64 or dummy live docs appear; receipts do not render before a real
     approval response or explicit test fixture.

6. Workspace-file adapter
   - Add a thin adapter for local workspace files, dropped/imported files, and
     attachment extraction metadata so files participate in source readiness
     without pretending a connector install happened.
   - File handling must preserve the private-read/draft boundary and report
     missing, unreadable, unsupported, partial, and ready states honestly.
   - Validation: file-to-brief and missing/unreadable-file fixtures prove source
     inspector copy, attachment notes, and Chat handoff packaging; raw file
     content/base64 is not exposed unless the existing supported preview/send
     path requires it.

7. Test harness
   - Maintain a focused Workbench harness for pure helper tests, static
     Playwright route tests, hidden scenario fixtures, banned-copy contracts,
     readiness fixtures, artifact fixtures, and mobile/a11y checks.
   - Validation: every split above has at least one focused unit/static/render
     test or a named deferral tied to a missing backend/API; broad validation
     runs only after focused tests pass; screenshot evidence covers desktop and
     390px mobile for the changed states.

## Screen Inventory And Contracts

### 1. Onboarding

Purpose: get the user from first launch to first useful ask without provider
setup theater.

Must show:

- one concise promise: connect model access, connect sources when useful, and
  approve external actions before anything leaves
- NEAR AI Cloud as the default model-access path
- source setup preview after model access: email, calendar, messages,
  docs/knowledge, local files, web
- "start with what is ready" escape hatch
- exact blocked states when model access, source catalog, or auth is unavailable

Current hooks:

- `fetchLlmProviders`
- NEAR AI login/wallet helpers
- `setActiveLlm`
- extensions registry/setup routes

Future hooks:

- richer source recommendations based on user role or imported workspace state
- workspace/account policy checks
- channel-first setup when Slack or other primary channels are supported

Validation:

- onboarding auth readiness tests still pass
- no "choose your provider marketplace" framing
- no "sources connected" label unless readiness is proven
- skip lands on Workbench or the current honest start surface

### 2. Connectors

Purpose: connect useful sources safely without looking like an app store or a
badge collection.

Must show:

- source families by user language: Email, Calendar, Messages,
  Docs/Knowledge, Files, Web, Schedule
- readiness state: ready, available, needs setup, needs reconnect, unavailable,
  catalog unavailable
- one next action per source
- exact blockers, such as missing Google OAuth client, missing token, expired
  auth, unsupported lifecycle route, or gateway unavailable

Current hooks:

- `fetchExtensions`
- `fetchExtensionRegistry`
- registry catalog/readiness helpers
- setup/activation lifecycle where available
- Google OAuth settings link

Future hooks:

- account-level readiness proof
- connector capability manifest
- per-source permissions and data-scope policies
- connector health/activity feed

Validation:

- lifecycle calls use canonical connector names, not display-only catalog refs
- cards never imply a connector is ready from a logo alone
- connector badges do not appear in the Workbench hero/top bar unless they are
  actionable source controls or blockers

### 3. Source Readiness

Purpose: let Workbench and adjacent screens explain which sources can be used
for the current ask.

Must show:

- Auto sources
- included/excluded source scopes
- ready/blocked/skipped/unavailable/read/partial states
- source inspector with why used, what was read, limitations, next action, and
  source links only when real

Current hooks:

- Workbench source families
- connector readiness helpers
- local files and web as built-in/non-install source families where supported
- attachment extraction metadata

Future hooks:

- source-level retrieval traces
- source snippets and provenance
- global source activity since last seen
- per-source privacy permissions

Validation:

- blocked source copy names the blocker and one next action
- empty catalog produces reduced claims, not fake defaults
- source inspector is keyboard accessible and closable

### 4. Workbench / Home

Purpose: be the first useful desk: what needs me, what is working, what is
ready, and what should I ask next?

Must show:

- natural-language composer, large enough for multi-step professional asks
- contextual suggestions from real state or static safe examples
- Needs You: approvals, blockers, failed runs, stale inputs, external actions
  waiting for review
- Working: reading, drafting, watching, scheduled
- Ready: drafts, briefs, reply batches, artifacts
- Recent: saved work, recent threads, receipts
- source/model/effort controls that reflect current truth

Current hooks:

- Workbench route and local state
- Chat draft handoff and existing message send path
- saved work helpers
- thread state where available
- connector readiness
- Settings/model state when wired

Future hooks:

- global "what changed since last check"
- global pending approvals
- first-class Workbench run/work-item backend
- durable personalization and ranking

Validation:

- direct `/workbench` render works
- `/` and `/overview` keep routing to the intended front door where applicable
- non-empty ask reaches existing Chat runtime
- no department/function picker on the default surface
- legal/document examples are less than half of visible examples and less than
  half of scenario fixtures

### 5. Chat / Live Thread

Purpose: remain the live runtime, transcript, and detailed intervention space,
without being the whole product lobby.

Must show:

- user ask, assistant work, tool/activity rows, approval gates, generated
  artifacts, source snippets, and message history
- clear transition from Workbench ask into Chat thread
- live run states without raw JSON as the normal display
- "continue in Workbench" or artifact/work links where useful

Current hooks:

- `createThread`
- `sendMessage`
- `fetchTimeline`
- SSE/socket event stream
- gate events and resolution
- attachment extraction and previews

Future hooks:

- richer timeline event classes
- server-side message search
- global thread/work-item relation
- cross-thread pending gate stream

Validation:

- Workbench handoff preserves user text, source scope, model/effort preferences,
  attachments where supported, and cadence/due-date preferences
- SSE unavailable does not break thread render
- assistant output becomes artifacts/receipts where appropriate, not endless
  prose blocks

### 6. Work / Artifact Viewer / Document Viewer

Purpose: make prepared work usable outside chat.

Must show:

- artifact title, type, status, provenance, source thread/work item, related
  approvals/receipts, and preview
- content for markdown/text artifacts
- file artifact state without showing raw base64
- document-reader state for generated or imported docs where supported
- copy/export/save/open controls only when real

Current hooks:

- `/work?item=...&artifact=...`
- saved work helpers
- generated-file artifact helpers
- export/copy flows
- markdown renderer and attachment/file preview support

Future hooks:

- version history
- server-side artifact search
- document diff/redline editor
- cross-artifact provenance and source citations

Validation:

- deep links do not produce duplicate route prefixes
- missing artifact is honest
- dummy live docs are forbidden; a doc viewer needs real saved/imported content
  or an explicit empty/unsupported state
- legal redline is one artifact type, not the default Work page identity

### 7. Approvals / Review

Purpose: let the user inspect and decide before anything leaves the workspace
or mutates an external system.

Must show:

- action
- destination/target
- what leaves or changes
- source/evidence summary
- artifact/output preview
- reversibility and consequence
- approval, deny/hold, edit, and override only where policy/API supports it

Current hooks:

- existing approval/auth gate components
- `resolveGate`
- credential/auth gate helpers
- timeline gate events

Future hooks:

- global approval inbox
- cross-thread Needs You feed
- policy-backed "always allow" management
- audit ledger read API

Validation:

- no active "approve and send/post/share/file" button without a real gate or
  test-mocked gate
- editing approved content re-arms review
- no receipt appears before approval response
- every approval package names action, target, data movement, and consequence

### 8. Settings / Model / Provider

Purpose: own model access truth quietly.

Must show:

- NEAR AI Cloud state
- active model id when known
- model/provider blockers
- advanced provider controls only where already supported
- return path to Workbench

Current hooks:

- `fetchLlmProviders`
- `listLlmProviderModels`
- `setActiveLlm`
- `testLlmProviderConnection`
- NEAR login helpers

Future hooks:

- policy-managed provider availability
- organization-level model controls
- model capability manifest for Workbench routing

Validation:

- Workbench model chip reflects Settings truth
- blocked model prevents send or clearly warns before send
- normal user path does not become an API-key marketplace

### 9. Memory / Preferences

Purpose: make IronClaw more useful without opaque or creepy personalization.

Must show:

- proposed preference
- why IronClaw noticed it
- examples/evidence
- scope selector
- save/edit/reject controls
- durable/staged state truth

Current hooks:

- Workbench memory/proposed preference surface if present
- local staged state only unless durable storage is proven

Future hooks:

- durable preference store
- memory audit/read/delete API
- scoped preferences by source, person, work item, channel, or workspace

Validation:

- nothing saves silently
- save is disabled until scope is clear
- sensitive people/legal/finance/security preferences require explicit review
- no durable-memory claim without backend proof

### 10. Automations / Monitors

Purpose: support recurring work and watch loops without pretending CRUD exists.

Must show:

- scheduled work, watches, monitors, last run, next run, delivery destination,
  and approval boundary
- creation through natural-language request when direct CRUD is absent
- pause/resume/edit controls only when real APIs exist

Current hooks:

- existing read-only automation list where available
- Chat packaging for cadence/monitor asks
- saved work or thread links

Future hooks:

- automation CRUD
- monitor management
- destination/channel selection
- delivery approvals and run history

Validation:

- no fake edit/pause/resume/delete controls
- cadence preference reaches request payload when sent from Workbench
- delivery approval is explicit before external delivery

### 11. Logs / Debug

Purpose: expose evidence for support, QA, and advanced diagnostics without
turning the main product into a developer console.

Must show:

- request/run ids
- connector/setup errors
- gate/audit evidence where safe
- source readiness diagnostics
- exportable diagnostics where supported

Current hooks:

- existing logs/debug routes and local/runtime events
- API errors and route status

Future hooks:

- server audit log read API
- trace viewer
- connector health timeline
- support bundle export

Validation:

- no sensitive content is exposed by default beyond what the route is meant to
  show
- user-facing Workbench/Home does not rely on logs/debug language
- logs are linked from error details or support states, not advertised as a
  primary workflow

## Cursor / Claude Sub-Build Plan

Use disjoint ownership. Agents may read broadly, but each agent should write
only its assigned files and tests. Preserve other-agent work. Do not regenerate
bundles or generated CSS until source tests pass.

### Lane A: Onboarding, Settings, Provider Truth

Owner: one Cursor/Claude agent.

Scope:

- onboarding model-access flow
- NEAR AI Cloud copy and blocked states
- Settings model/provider state
- Workbench model chip contract only if touching the shared model adapter is
  unavoidable

Do not touch:

- Workbench layout/components except model-state adapter boundaries
- Connections registry internals except links
- Work/Artifact viewer

Validation:

- onboarding auth readiness tests
- Settings/provider focused tests
- static copy lint for banned provider-marketplace framing
- screenshot of first-run ready, blocked, and skip states

### Lane B: Connections And Source Readiness

Owner: one Cursor/Claude agent.

Scope:

- Connections source family cards
- connector catalog/readiness helpers
- source blocked/ready/available copy
- source inspector data adapter consumed by Workbench

Do not touch:

- Chat runtime
- approval resolution
- artifact export
- Workbench hero/top layout except rendering actionable source controls

Validation:

- registry/readiness unit tests
- Playwright source setup/blocker tests
- keyboard accessibility for source inspector
- proof that connector badges are absent from hero/top unless actionable

### Lane C: Workbench Home And Ask Handoff

Owner: one Cursor/Claude agent.

Scope:

- Workbench home, composer, state rail, suggestions, source/model/effort UI
- request packaging to existing Chat runtime
- hidden scenario corpus and domain coverage tests

Do not touch:

- Chat message rendering internals beyond documented draft handoff
- artifact export internals
- Settings provider management

Validation:

- Workbench focused unit tests
- Playwright direct route, empty ask, non-empty ask, mobile overflow
- test that no business-function picker appears
- test that visible examples are not legal/document-majority

### Lane D: Chat Runtime Adapter And Live Thread

Owner: one Cursor/Claude agent.

Scope:

- Workbench-to-Chat handoff correctness
- timeline/SSE/socket rendering adapters
- activity rows, tool summaries, source snippets where data exists
- continue/open links between Chat and Workbench

Do not touch:

- onboarding
- connector setup lifecycle
- Work artifact export implementation

Validation:

- message send and timeline tests
- SSE unavailable/failure states
- no raw JSON as main visible assistant output
- thread reload with Workbench-origin ask

### Lane E: Work, Artifact, Document Viewer

Owner: one Cursor/Claude agent.

Scope:

- Work library/search
- artifact viewer and document viewer states
- generated-file display, preview, copy, export controls
- artifact provenance and related approvals/receipts

Do not touch:

- approval gate resolution except rendering linked state
- connector lifecycle
- Workbench composer

Validation:

- artifact deep-link tests
- generated file/base64 regression tests
- copy/export parse tests where existing harness supports them
- screenshot of markdown artifact, file artifact, missing artifact

### Lane F: Approvals, Review, Receipts, Ledger

Owner: one Cursor/Claude agent.

Scope:

- review package UI
- approval gate integration
- receipt rows and local/device ledger states
- Needs You adapter for real or locally provable pending gates

Do not touch:

- provider setup
- connector setup lifecycle
- artifact editor internals beyond preview links

Validation:

- gate resolve tests
- edit re-arms approval test
- no pre-approval receipt test
- approval package names action, destination, outbound data, and consequence

### Lane G: Memory, Automations, Logs

Owner: one Cursor/Claude agent.

Scope:

- scoped preference proposal/review UI
- scheduled work/monitor read-only surfaces
- cadence request packaging
- logs/debug diagnostic routing and safe support copy

Do not touch:

- Workbench core composer except cadence/monitor preference handoff
- Connections registry lifecycle
- model/provider setup

Validation:

- preference scope required before save
- no durable-memory claim without backend proof
- no fake automation CRUD controls
- logs/debug copy does not leak into main Workbench language

## Cross-Lane Validation Commands

Run focused tests for touched areas first. Then run the broad checks expected by
the repo when the touched surface justifies them:

```sh
node --test crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-plan.test.mjs
npx playwright test --config playwright.static.config.ts tests/static/workbench-static.spec.ts
npm run test:static
npm run test:a11y-static
npm run check:static-bundle
npm run lint:static-copy
npm run lint:static-tokens
npm run test:design-static
npm run smoke:webui-static
npm run smoke:gate-enforcement
npm run verify:static-frontend
git diff --check
```

For UI work, capture desktop and 390px mobile screenshots. Include screenshots
for at least:

- onboarding ready and blocked
- Workbench home
- Workbench source inspector
- Workbench active run / prepared output
- Chat live thread with Workbench-origin ask
- approval/review package
- Work/artifact viewer
- Connections blocked and ready states
- Settings model/provider state
- memory/preference proposal
- scheduled work or monitor read-only state
- logs/debug support state when changed

## Explicit Do-Not-Do List

- Do not create fake backend endpoints.
- Do not use fake text that implies real work happened. Placeholder examples
  must be obviously examples, and live surfaces must use real data or honest
  empty/blocked states.
- Do not put function lists, department tabs, persona pickers, or workflow
  galleries on the main surface.
- Do not make legal, redlines, MSAs, cases, matters, or document packets the
  default product language. Legal is one stress test.
- Do not show dummy live docs. Document viewers need real imported/generated
  content, fixtures in tests, or honest unsupported/empty states.
- Do not put connector badges in the hero/top area unless they are actionable
  controls or blockers for the current ask.
- Do not claim connectors, sources, models, memory, receipts, artifacts,
  monitors, or approvals are ready without current app state or test fixtures
  proving it.
- Do not route Workbench to a new runtime while Chat owns execution.
- Do not show raw JSON, raw base64, or prompt-engineering instructions as the
  normal user-facing product.
- Do not add automation edit/pause/resume/delete controls without real APIs.
- Do not silently save preferences or sensitive memory.
- Do not make Logs/Debug the main route for normal users.
- Do not regenerate generated bundles before source changes and focused tests
  are green.

## Delivery Note For Each Agent

Every Cursor/Claude sub-build should end with:

- files changed
- tests run and results
- screenshots captured, with paths
- what is genuinely wired today
- what is staged behind missing backend hooks
- explicit confirmation that visible examples and tests are not over-indexed to
  legal/document work
- explicit confirmation that the default UI remains an adaptive personal chief
  of staff surface, not a department directory
