# Claude Code Overnight Workbench Loop

Date: 2026-06-20

Audience: Claude Code running as an autonomous sidecar for the IronClaw Desktop
Workbench overhaul.

Repo:
`/Users/abhishekvaidyanathan/Documents/Playground/ironclaw-desktop-app-main`

Expected branch: `codex/workbench-overhaul-backend-loop`

## Current Snapshot For The Next Runner

As of the latest sidecar loop on 2026-06-20:

- `workbench-page.js` has been reduced to roughly 439 lines.
- `workbench-styles.js` is now a small aggregator over split modules in
  `crates/ironclaw_webui_v2_static/static/js/pages/workbench/styles/`.
- Composer/control UI lives in `components/workbench-command.js`.
- Model/effort inspector UI lives in `components/workbench-work-mode.js`.
- Saved artifact preview logic has been tightened in
  `lib/workbench-work-items.js`.
- The QA sidecar reported source checks, static suite, regenerated static
  frontend, Workbench Playwright, and a11y passing after a rebuild.

Do not assume this is complete. Treat it as a better starting point for the
overnight loop. The highest-value remaining work is deeper route/component
cleanup, artifact/viewer realism, adjacent onboarding/connections/settings
buildout, backend wiring maps, visual/product critique, screenshots, and final
integration.

## How To Actually Run This Tonight

Use one Claude Code session as the **Coordinator**. Give it the Coordinator
Prompt below and let it run the loop. If your Claude Code setup supports
subagents, the Coordinator should spawn the Worker prompts in the "Worker
Roster" section. If it does not, open separate terminal windows, start Claude
Code in the repo root, and paste one Worker prompt into each terminal.

Preferred launch shape:

1. Coordinator: owns tree safety, priority decisions, integration, broad QA,
   generated bundle sync, screenshots, and final handoff.
2. Worker A: Workbench page/component split.
3. Worker B: artifact/work/document viewer honesty.
4. Worker C: onboarding/connections/settings adjacency.
5. Worker D: tests, a11y, route/render QA, screenshots.
6. Worker E: backend/API contract notes and missing wiring map.
7. Worker F: design critique and visual/product coherence.
8. Worker G: performance, bundle, and static asset hygiene.
9. Worker H: final integration, conflict review, and release-readiness gate.

Do not use separate git worktrees unless the current untracked Workbench source
has been deliberately copied into each worktree. The current scaffold may
include untracked files, and a fresh worktree can silently miss them. For
tonight, shared-repo workers are acceptable only with strict file ownership and
frequent `git status` checks.

### Terminal Start

Run this first:

```bash
cd /Users/abhishekvaidyanathan/Documents/Playground/ironclaw-desktop-app-main
git status --short --branch
git branch --show-current
```

Then start Claude Code in that directory and paste the Coordinator Prompt.

If running manual workers, start one terminal per worker:

```bash
cd /Users/abhishekvaidyanathan/Documents/Playground/ironclaw-desktop-app-main
claude
```

If your Claude Code command is named differently, use your local command. The
important part is that every Claude session starts from the same repo root and
reads this file before acting.

## Coordinator Prompt

Paste this into the main Claude Code session:

```text
You are the Coordinator for the IronClaw Desktop Workbench overnight buildout.

Repo:
/Users/abhishekvaidyanathan/Documents/Playground/ironclaw-desktop-app-main

Branch:
codex/workbench-overhaul-backend-loop

Read this runbook completely before acting:
docs/design/claude-code-overnight-workbench-loop-2026-06-20.md

Mission:
Run an ambitious, multi-lane overnight implementation and validation loop for
the Workbench overhaul. Do not stop after one slice. Preserve unrelated changes,
do not reset the tree, do not commit, do not push. The Workbench must become a
real, generalizable personal chief-of-staff front door, not a static legal/doc
mockup and not a fake UX.

Coordinator responsibilities:
1. Inspect the tree before every loop.
2. Launch or coordinate workers only with disjoint file ownership.
3. Keep a concise progress log in:
   docs/design/workbench-overnight-progress-2026-06-20.md
4. Integrate worker results after reviewing diffs.
5. Run focused tests after each source slice.
6. Run the broad validation battery every 1-2 integration loops.
7. Regenerate static assets only after source tests pass.
8. Capture screenshots outside the repo after visible UI changes.
9. Treat failing route/render tests as blockers until explained.
10. Continue looping until morning, user interruption, or a hard blocker.

First actions:
- Run the Start-Of-Run Orientation commands from the runbook.
- Identify which Worker lanes are already satisfied.
- If subagents are available, launch Workers A-H from the Worker Roster.
- If subagents are not available, proceed yourself through the same lanes in
  priority order and leave clear notes for manually launched workers.

Critical current suspicion:
If Playwright says /v2/?token=workbench-static-token does not redirect to
/v2/workbench, first suspect stale generated static output. Run source syntax
and focused Workbench tests, then npm run prepare:webui-static and
npm run verify:static-frontend. Do not randomly rewrite routing before proving
whether source and generated bundle are in sync.

Never claim completion unless the Definition Of Done in this runbook is true.
```

## Worker Roster

Use these as subagent prompts or paste each into a separate Claude Code
terminal. Each worker must inspect the current tree first, preserve unrelated
changes, and report exact changed paths plus validation.

### Worker A: Component Split And Route Thinness

```text
You are Worker A: Workbench component split.

Repo:
/Users/abhishekvaidyanathan/Documents/Playground/ironclaw-desktop-app-main

Read:
- docs/design/claude-code-overnight-workbench-loop-2026-06-20.md
- crates/ironclaw_webui_v2_static/static/js/pages/workbench/workbench-page.js
- crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/
- tests/static/workbench-static.spec.ts

Ownership:
- crates/ironclaw_webui_v2_static/static/js/pages/workbench/workbench-page.js
- new component files under
  crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/

Do not edit:
- workbench-styles.js or styles/ modules
- useWorkbenchStart.js
- useWorkbenchSourceReadiness.js
- generated bundles/chunks
- docs, unless adding a short progress note requested by Coordinator

Mission:
Make workbench-page.js a thinner route shell. Extract one focused component per
loop, preserving behavior and visible copy. Best candidates: CommandSurface,
SourceScopePicker/EffortSegment/model inspector, timing/source drawer,
work-mode tabs, or top-level WorkbenchHome composition.

Rules:
- No visual redesign in this lane.
- No copy changes unless required by tests.
- Keep props explicit and small.
- Prefer pure presentational components and small helper modules.
- Re-run tests after each extraction.

Validation:
find crates/ironclaw_webui_v2_static/static/js/pages/workbench -name '*.js' -print0 | xargs -0 -n1 node --check
node --test crates/ironclaw_webui_v2_static/static/js/pages/workbench/hooks/*.test.mjs crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/*.test.mjs crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/*.test.mjs
npx playwright test --config playwright.static.config.ts tests/static/workbench-static.spec.ts --grep "direct route|suggestions|model|source" --reporter=line

Report:
- before/after line count for workbench-page.js
- changed paths
- commands and pass/fail counts
- next extraction candidate
```

### Worker B: Artifact, Work, And Document Viewer Honesty

```text
You are Worker B: Work/artifact/document viewer honesty.

Repo:
/Users/abhishekvaidyanathan/Documents/Playground/ironclaw-desktop-app-main

Read:
- docs/design/claude-code-overnight-workbench-loop-2026-06-20.md
- crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-work-items.js
- crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/workbench-packet.js
- crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/workbench-library.js
- tests/static/workbench-static.spec.ts
- tests/static/workbench-static-fixtures.ts

Ownership:
- crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-work-items.js
- crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/workbench-packet.js
- crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/workbench-library.js
- focused tests for those helpers/components

Do not edit:
- route registration
- model/start hook
- source readiness hook
- generated bundles/chunks

Mission:
Prove the document/workspace area can live-render honestly from current data.
It may show saved Markdown/text/file artifacts, imported/attached files, related
Chat/Work handoff links, missing-artifact empty states, and approval/receipt
states when real data exists. It must not show fake document bodies, fake
redlines, fake receipts, or dummy live docs.

Build toward:
- saved artifact preview model for text, markdown, file-like payload, missing
  artifact, related handoff, and unavailable preview
- no base64-as-readable-document behavior
- neutral work-item language instead of legal-first packet identity
- tests that fail if fake live docs appear

Validation:
node --test crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-work-items.test.mjs crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/workbench-packet.test.mjs
npx playwright test --config playwright.static.config.ts tests/static/workbench-static.spec.ts --grep "document|artifact|Library|handoff|receipt" --reporter=line

Report:
- changed paths
- exact data states supported
- unsupported states and required backend contracts
- commands and pass/fail counts
```

### Worker C: Onboarding, Connections, Settings, And Adjacent UX

```text
You are Worker C: adjacent UX buildout.

Repo:
/Users/abhishekvaidyanathan/Documents/Playground/ironclaw-desktop-app-main

Read:
- docs/design/claude-code-overnight-workbench-loop-2026-06-20.md
- docs/design/workbench-adjacent-ux-handoff-cursor-claude-2026-06-19.md
- crates/ironclaw_webui_v2_static/static/js/pages/extensions/
- crates/ironclaw_webui_v2_static/static/js/pages/settings/
- crates/ironclaw_webui_v2_static/static/js/app/routes.js
- tests/static/frontdoor-static.spec.ts
- tests/static/connectors-static.spec.ts
- tests/static/a11y-static.spec.ts

Ownership:
- adjacent onboarding/frontdoor/connections/settings files only after inspecting
  current diffs
- tests for those screens
- docs only if a backend/API dependency blocks implementation

Do not edit:
- Workbench route internals unless Coordinator explicitly asks
- generated bundles/chunks

Mission:
Make the surrounding app ready for Workbench without duplicating Workbench or
inventing fake setup state. NEAR AI Cloud/model access belongs in setup/settings
truth. Connections owns connector readiness. Workbench consumes those states.

Target improvements:
- onboarding copy and route flow that gets the user to first useful ask
- honest "start with what is ready" state
- connection setup/readiness labels aligned with Workbench source inspector
- settings model/provider surfaces aligned with real catalog labels
- no top-level provider marketplace theater

Validation:
node --test crates/ironclaw_webui_v2_static/static/js/app/routes.test.mjs crates/ironclaw_webui_v2_static/static/js/pages/extensions/components/registry-tab.test.mjs
npx playwright test --config playwright.static.config.ts tests/static/frontdoor-static.spec.ts tests/static/connectors-static.spec.ts tests/static/workbench-static.spec.ts --reporter=line
npm run test:a11y-static -- tests/static/a11y-static.spec.ts

Report:
- changed paths
- Workbench assumptions proven or deferred
- commands and pass/fail counts
```

### Worker D: QA Captain, Render Proof, And Screenshot Evidence

```text
You are Worker D: QA captain.

Repo:
/Users/abhishekvaidyanathan/Documents/Playground/ironclaw-desktop-app-main

Read:
- docs/design/claude-code-overnight-workbench-loop-2026-06-20.md
- tests/static/workbench-static.spec.ts
- tests/static/workbench-static-fixtures.ts
- playwright.static.config.ts
- scripts/serve-webui-static.mjs
- scripts/prepare-webui-static.mjs

Ownership:
- tests/static/workbench-static.spec.ts only for test harness corrections
- tests/static/workbench-static-fixtures.ts only for mocks/fixtures
- no product source edits unless Coordinator asks

Mission:
Continuously prove the Workbench works in source, generated bundle, route,
render, accessibility, keyboard, desktop, and mobile states. Capture screenshots
outside the repo.

Required states:
- direct /v2/workbench render
- /v2/?token redirect/default route to /v2/workbench
- first screen at 1440x960
- model/effort inspector expanded with real catalog-backed labels
- Ask flow start into Chat runtime
- model switch failure blocks send and preserves draft
- source/boundary inspector
- document/artifact workspace from saved Work
- mobile 390px no horizontal overflow
- a11y static spec

Core commands:
find crates/ironclaw_webui_v2_static/static/js/pages/workbench -name '*.js' -print0 | xargs -0 -n1 node --check
node --test crates/ironclaw_webui_v2_static/static/js/pages/workbench/hooks/*.test.mjs crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/*.test.mjs crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/*.test.mjs crates/ironclaw_webui_v2_static/static/js/app/routes.test.mjs scripts/probe-new-sidecar-acceptance.test.mjs
node scripts/probe-workbench-live-wiring.mjs --probe-oauth-start --json
npx playwright test --config playwright.static.config.ts tests/static/workbench-static.spec.ts --reporter=line
npm run test:a11y-static -- tests/static/a11y-static.spec.ts
npm run prepare:webui-static
npm run verify:static-frontend

If /v2/?token stays at /v2/?token instead of redirecting, immediately check
whether source and generated bundle are stale. Run prepare:webui-static and
verify:static-frontend after source tests pass before filing a route bug.

Report:
- exact command matrix
- pass/fail counts
- first failing assertion with file/line
- screenshot directory outside repo
- whether the issue blocks main
```

### Worker E: Backend Contract And Wiring Assumptions

```text
You are Worker E: backend/API contract mapper.

Repo:
/Users/abhishekvaidyanathan/Documents/Playground/ironclaw-desktop-app-main

Read:
- docs/design/claude-code-overnight-workbench-loop-2026-06-20.md
- crates/ironclaw_webui_v2_static/static/js/lib/api.js
- crates/ironclaw_webui_v2_static/static/js/pages/chat/
- crates/ironclaw_webui_v2_static/static/js/pages/settings/lib/
- crates/ironclaw_webui_v2_static/static/js/pages/extensions/lib/
- scripts/probe-new-sidecar-acceptance.mjs
- scripts/smoke-gate-enforcement.mjs

Ownership:
- docs/design/workbench-backend-wiring-map-2026-06-20.md
- focused probe tests only if a tiny safe assertion improves coverage

Do not edit:
- Workbench UI unless Coordinator asks
- generated bundles/chunks

Mission:
Produce the missing backend wiring map needed to make the Workbench real. Do
not invent endpoints. Map current APIs, current UI assumptions, required
future endpoints, failure modes, and test/probe coverage.

Must cover:
- model/provider list and active model set
- Chat thread/message runtime start
- connector registry/readiness
- local file/attachment extraction
- saved Work/artifact read paths
- approvals/gates and external-action resolution
- receipts/audit/provenance
- memory/preference proposal and durable storage gap
- monitor/automation CRUD gap
- global pending work/source changed feed gap

Output:
docs/design/workbench-backend-wiring-map-2026-06-20.md

Report:
- APIs proven current
- APIs missing or staged
- exact frontend adapter that should consume each future endpoint
- tests/probes that currently guard the behavior
```

### Worker F: Design Critic And Product Coherence

```text
You are Worker F: design critic and product coherence reviewer.

Repo:
/Users/abhishekvaidyanathan/Documents/Playground/ironclaw-desktop-app-main

Read:
- docs/design/claude-code-overnight-workbench-loop-2026-06-20.md
- docs/design/cursor-workbench-buildout-instructions-2026-06-19.md
- docs/design/workbench-adjacent-ux-handoff-cursor-claude-2026-06-19.md
- /Users/abhishekvaidyanathan/Desktop/private-workbench-v13.html if present
- /Users/abhishekvaidyanathan/Desktop/private-workbench-v12.html if present
- /Users/abhishekvaidyanathan/Desktop/private-workbench-v11.html if present
- /Users/abhishekvaidyanathan/Desktop/private-workbench-v10.html if present
- /Users/abhishekvaidyanathan/Desktop/private-workbench-v9.html if present
- /Users/abhishekvaidyanathan/Desktop/private-workbench-v8.html if present

Ownership:
- docs/design/workbench-visual-product-qa-2026-06-20.md
- tests/static/workbench-static.spec.ts only for banned-copy or visual contract
  assertions if Coordinator approves

Do not edit:
- production Workbench UI source unless Coordinator explicitly asks
- generated bundles/chunks

Mission:
Act as the harsh design/product reviewer. The user is unhappy with tired,
boring, overly complex, legal-indexed surfaces. Identify where the current
Workbench implementation still misses the intended product: adaptive personal
chief of staff, large natural-language command, real model configurability,
source/boundary honesty, useful document/work viewer, and elite-app polish.

Review dimensions:
- first viewport clarity and hierarchy
- command box size, affordance, attachment/source/model controls
- whether examples are broad enough but not a visible function menu
- whether source/boundary drawer is useful without overbearing trust theater
- whether active work dock helps or distracts
- whether document/workspace area is real and generalizable
- whether copy sounds professional, precise, and non-cringe
- whether the visual system feels like a serious product, not a mockup board
- whether the UI can live-render from current APIs without dummy promises

Output:
docs/design/workbench-visual-product-qa-2026-06-20.md

Report:
- top 10 design/product issues, ordered by severity
- exact UI/file/test references where possible
- suggested corrections that preserve backend honesty
- which issues should block main
```

### Worker G: Performance, Bundle, And Static Hygiene

```text
You are Worker G: performance and static asset hygiene.

Repo:
/Users/abhishekvaidyanathan/Documents/Playground/ironclaw-desktop-app-main

Read:
- docs/design/claude-code-overnight-workbench-loop-2026-06-20.md
- scripts/prepare-webui-static.mjs
- scripts/verify-static-frontend-contract.mjs
- scripts/check-static-bundle-size.mjs
- package.json
- current git status

Ownership:
- build/test scripts only if a tiny targeted fix is required
- docs/design/workbench-static-hygiene-2026-06-20.md if source changes are not
  needed

Do not edit:
- Workbench product source unless Coordinator asks
- generated chunks by hand

Mission:
Keep generated static output consistent and prevent the Workbench overhaul from
landing with stale bundle, broken chunk references, excessive bundle churn, or
unclear generated-file state.

Tasks:
- Run source checks before generation.
- Run npm run prepare:webui-static.
- Run npm run verify:static-frontend.
- Run npm run check:static-bundle if practical.
- Inspect git status before and after generation.
- Confirm deleted old chunks and added new chunks are paired generated output.
- If Playwright render tests use stale bundle, identify and document it.

Validation:
find crates/ironclaw_webui_v2_static/static/js/pages/workbench -name '*.js' -print0 | xargs -0 -n1 node --check
npm run prepare:webui-static
npm run verify:static-frontend
npm run check:static-bundle

Report:
- commands and pass/fail
- generated files changed
- stale bundle symptoms found or cleared
- whether static output is safe to stage later
```

### Worker H: Final Integration And Release-Readiness Gate

```text
You are Worker H: final integration and release-readiness gate.

Repo:
/Users/abhishekvaidyanathan/Documents/Playground/ironclaw-desktop-app-main

Read:
- docs/design/claude-code-overnight-workbench-loop-2026-06-20.md
- docs/design/workbench-overnight-progress-2026-06-20.md if present
- all Worker reports created tonight
- git status and diff

Ownership:
- docs/design/workbench-overnight-final-handoff-2026-06-20.md
- no production edits unless Coordinator asks

Mission:
At the end of the night or before a human handoff, audit the whole dirty tree
for integration risk. Do not claim ready if it is not ready. Produce a concise
but rigorous handoff that says what changed, what passed, what failed, what is
staged, and what must be done next.

Must include:
- current branch and git status summary
- changed/untracked source files
- generated static files summary
- line counts for largest Workbench files
- test matrix with exact commands and pass/fail counts
- screenshot directory paths
- known blockers
- missing backend/API dependencies
- whether it is safe to bring Workbench scaffold into main
- recommended next 5 tasks

Validation to run if time permits:
find crates/ironclaw_webui_v2_static/static/js/pages/workbench -name '*.js' -print0 | xargs -0 -n1 node --check
node --test crates/ironclaw_webui_v2_static/static/js/pages/workbench/hooks/*.test.mjs crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/*.test.mjs crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/*.test.mjs crates/ironclaw_webui_v2_static/static/js/app/routes.test.mjs scripts/probe-new-sidecar-acceptance.test.mjs
node scripts/probe-workbench-live-wiring.mjs --probe-oauth-start --json
npx playwright test --config playwright.static.config.ts tests/static/workbench-static.spec.ts --reporter=line
npm run test:a11y-static -- tests/static/a11y-static.spec.ts
npm run prepare:webui-static
npm run verify:static-frontend

Output:
docs/design/workbench-overnight-final-handoff-2026-06-20.md
```

## Coordination Cadence

The Coordinator should run a visible loop every 45-90 minutes:

1. Poll worker status or read their latest notes.
2. Run `git status --short --branch`.
3. Review diffs for any completed worker before integrating mentally.
4. Run focused tests covering touched files.
5. Append a short entry to
   `docs/design/workbench-overnight-progress-2026-06-20.md`.
6. Decide the next lane and keep going.

Use this progress entry format:

```text
## Loop N - YYYY-MM-DD HH:MM local

Active workers:
- A:
- B:
- C:
- D:
- E:
- F:
- G:
- H:

Integrated changes:
- 

Validation:
- command -> result

Screenshots:
- 

Current blockers:
- 

Next actions:
- 
```

## Shared-Repo Collision Protocol

Because the current scaffold contains untracked files, workers may share one
repo instead of separate worktrees. That is allowed only with these rules:

1. Every worker declares ownership before editing.
2. Every worker runs `git status --short --branch` before editing.
3. Every worker re-reads a file immediately before modifying it.
4. No worker runs `git reset`, `git checkout --`, `git clean`, or deletes
   generated chunks by hand.
5. If two workers need the same file, the Coordinator chooses the order.
6. Generated static output is owned by Worker G or Coordinator only.
7. Docs may be edited by multiple workers only when each worker owns a distinct
   doc file.
8. If a test fails in a file owned by another worker, report it first rather
   than rewriting that worker's lane.

## Stale Bundle Triage

The Workbench source may pass unit tests while Playwright sees the old app if
`main.bundle.js` or chunks are stale. Symptoms:

- `/v2/?token=workbench-static-token` stays at `/v2/?token=...` instead of
  landing on `/v2/workbench`
- `workbench-page` test id is missing even though source contains it
- composer controls are missing after source/component extraction
- tests fail across many first-screen locators at once

Triage order:

```bash
find crates/ironclaw_webui_v2_static/static/js/pages/workbench -name '*.js' -print0 | xargs -0 -n1 node --check
node --test crates/ironclaw_webui_v2_static/static/js/pages/workbench/hooks/*.test.mjs crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/*.test.mjs crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/*.test.mjs
npm run prepare:webui-static
npm run verify:static-frontend
npx playwright test --config playwright.static.config.ts tests/static/workbench-static.spec.ts --reporter=line
```

Only investigate route code after this sequence fails with generated output in
sync.

## Copy-Paste Prompt For Claude Code

You are an autonomous Claude Code sidecar helping finish the IronClaw Desktop
Workbench overhaul overnight. Work in the existing repo, preserve all unrelated
or user-authored changes, do not reset the tree, do not commit unless explicitly
asked, and keep looping through implementation plus validation until the user
stops you or a hard blocker is reached.

The goal is not to polish a static mockup. The goal is to replace the app's
front door with a real, generalizable personal chief-of-staff surface:

- the user asks in normal professional language
- IronClaw reads available connected sources and local/workspace context
- it prepares useful work across legal, finance, operations, engineering,
  people, research, growth, sales, customer success, and executive admin
- it shows model, effort, source scope, assumptions, boundaries, artifacts, and
  receipts honestly
- it does not send, post, share, file, schedule, or persist consequential
  external actions without approval
- it adapts to the person and their work without forcing a department/function
  picker onto the first screen

Stay on the Workbench branch. Before every edit, inspect the current tree and
re-read the files you plan to modify. Multiple agents may be working at once.
If a file has changed since you last read it, re-read it and adapt; do not
revert or overwrite.

## Non-Negotiables

1. Do not make this a legal-only app. Legal/document work is one stress test,
   not the product identity.
2. Do not add visible function/persona/department pickers to the first screen.
   Finance/legal/ops/etc. are coverage dimensions, not primary navigation.
3. Do not show fake live documents, dummy document bodies, lorem ipsum, fake
   receipts, fake approvals, fake source-readiness, or fake connector counts.
4. Do not use wording like "custody record", "trust ledger", "Sources
   connected", or "answer label" in the user-visible Workbench surface.
5. Do not use fake model modes as model names. Model selection must come from
   real provider/catalog state where available. Effort is separate from model.
6. Do not add a Workbench-only backend endpoint unless the repo already has it.
   Workbench currently starts work through the existing Chat/runtime path.
7. Do not hide missing backend functionality behind optimistic copy. If a
   backend/API is missing, represent the UI as staged, empty, unavailable, or
   requiring setup.
8. Do not make top-bar connector badges the primary trust object. Source state
   belongs in a scoped control/inspector and in work-specific evidence.
9. Do not update generated bundles until source tests pass. After source
   changes are stable, run `npm run prepare:webui-static` and
   `npm run verify:static-frontend` together.
10. Do not commit, push, or open a PR unless the user explicitly asks.

## Current Source Of Truth

Read these first in each fresh session:

1. `docs/design/cursor-workbench-buildout-instructions-2026-06-19.md`
2. `docs/design/workbench-adjacent-ux-handoff-cursor-claude-2026-06-19.md`
3. `crates/ironclaw_webui_v2_static/static/js/pages/workbench/workbench-page.js`
4. `crates/ironclaw_webui_v2_static/static/js/pages/workbench/workbench-styles.js`
5. `crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-plan.js`
6. `crates/ironclaw_webui_v2_static/static/js/pages/workbench/hooks/useWorkbenchStart.js`
7. `crates/ironclaw_webui_v2_static/static/js/pages/workbench/hooks/useWorkbenchSourceReadiness.js`
8. `tests/static/workbench-static.spec.ts`
9. `tests/static/workbench-static-fixtures.ts`

Useful visual references, if present:

- `/Users/abhishekvaidyanathan/Desktop/private-workbench-v13.html`
- `/Users/abhishekvaidyanathan/Desktop/private-workbench-v12.html`
- `/Users/abhishekvaidyanathan/Desktop/private-workbench-v11.html`
- `/Users/abhishekvaidyanathan/Desktop/private-workbench-v10.html`
- `/Users/abhishekvaidyanathan/Desktop/private-workbench-v9.html`
- `/Users/abhishekvaidyanathan/Desktop/private-workbench-v8.html`

Use v13 as the latest visual profile, v12/v11/v10 for state/workflow maturity,
v9 for visual discipline, v8 for generality and breadth, and the current route
for runtime honesty.

## Start-Of-Run Orientation

Run these from the repo root and record the results in your own working notes:

```bash
pwd
git status --short --branch
git branch --show-current
git diff --name-only
find crates/ironclaw_webui_v2_static/static/js/pages/workbench -maxdepth 3 -type f | sort
wc -l crates/ironclaw_webui_v2_static/static/js/pages/workbench/workbench-page.js crates/ironclaw_webui_v2_static/static/js/pages/workbench/workbench-styles.js tests/static/workbench-static.spec.ts tests/static/workbench-static-fixtures.ts 2>/dev/null
rg -n "Deep work|custody record|trust ledger|Sources connected|answer label|dummy|lorem|fake|redline|MSA|matter" crates/ironclaw_webui_v2_static/static/js/pages/workbench tests/static docs/design 2>/dev/null
```

If you are not on `codex/workbench-overhaul-backend-loop`, stop and report.
Do not switch branches automatically if the tree is dirty.

## The Overnight Loop

Repeat this loop until morning, until the user stops you, or until a hard
blocker repeats after three serious attempts.

### Loop Shape

1. Orient
   - Run `git status --short --branch`.
   - Re-run the banned-copy scan.
   - Re-check Workbench file sizes.
   - Read the files you will edit.

2. Pick one lane
   - Choose the highest-priority lane below that is not already satisfied.
   - Keep the write set narrow.
   - Do not edit files owned by another active agent if you know one is working
     there.

3. Implement one meaningful slice
   - Prefer small, shippable changes.
   - Preserve visible behavior unless the task is explicitly a UX correction.
   - Keep code adapter-shaped and testable.

4. Validate locally
   - Run syntax checks on touched JS.
   - Run focused unit/static tests for the changed slice.
   - If focused tests pass, run broader Workbench Playwright.
   - If source changed and broad tests pass, regenerate static assets and verify
     the static frontend contract.

5. Capture proof
   - Capture screenshots outside the repo when you changed visible UI.
   - Record exact commands and pass/fail counts.
   - Record remaining risks or staged backend dependencies.

6. Continue
   - Do not stop just because one slice passes.
   - Move to the next lane.

### Hard Stop Conditions

Stop and report only if one of these occurs:

- branch or repo state is ambiguous and continuing would risk deleting or
  overwriting user work
- the app requires credentials or external OAuth that you cannot complete
- the same blocking test failure remains after three distinct fix attempts
- generated bundle output cannot be made consistent with source after
  `prepare:webui-static` and `verify:static-frontend`
- a required backend endpoint does not exist and the correct next step is a
  documented backend contract rather than more UI simulation

When you stop, include exact command output summaries, files touched, and the
next concrete unblock.

## Priority Lanes

Work these in order, but skip a lane if another agent clearly owns it or if it
is already complete and tested.

### Lane 1: Maintainability Split

Goal: the Workbench route must not be one giant route file and one giant style
blob.

Current targets:

- Keep `workbench-page.js` thin; it is already roughly 439 lines after the
  first component split, so future work should avoid growing it back into a
  route mega-file.
- Preserve the split style-module structure behind the `WORKBENCH_STYLE`
  export. Do not re-inline CSS into the route or component files.
- `workbench-packet.js` is also large; only split it after the page/style split
  is stable.

Safe component boundaries:

- command composer and controls
- model/effort/source/cadence inspector
- source/boundary drawer
- active work dock and state rail
- document/artifact workspace
- Library and Memory
- empty/error/loading states

Rules:

- Do not change visible copy while doing mechanical splits.
- Do not re-inline CSS into route/component files.
- Do not move request packaging back into the page.
- Keep imports relative and consistent with the existing static JS style.

Validation:

```bash
node --check crates/ironclaw_webui_v2_static/static/js/pages/workbench/workbench-page.js
find crates/ironclaw_webui_v2_static/static/js/pages/workbench -name '*.js' -print0 | xargs -0 -n1 node --check
node --test crates/ironclaw_webui_v2_static/static/js/pages/workbench/hooks/*.test.mjs crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/*.test.mjs crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/*.test.mjs
```

### Lane 2: Real Model And Effort Wiring

Goal: Workbench model selection must reflect NEAR AI Cloud/provider catalog
state, and effort must remain separate.

Inspect:

- `useWorkbenchStart.js`
- settings API helpers
- Workbench static mocks
- tests around model catalog, active model, blocked model switch, and Chat send

Required behavior:

- The compact model control may show `Auto` before catalog state is loaded.
- The expanded inspector should show actual catalog labels from mocked/real API
  responses, for example GLM/GPT/Gemini/Opus-class labels when those are
  returned.
- Selecting a model should attempt to set the active model before starting Chat
  work.
- If model activation fails, Chat send must not happen and the user's draft
  must be preserved.
- Effort options may be `Standard`, `Careful`, and `Background`, but must never
  masquerade as model names.

Validation:

```bash
node --test crates/ironclaw_webui_v2_static/static/js/pages/workbench/hooks/useWorkbenchStart.test.mjs crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-plan.test.mjs
npx playwright test --config playwright.static.config.ts tests/static/workbench-static.spec.ts --grep "model|Chat send|failure" --reporter=line
```

### Lane 3: Honest Source And Boundary Model

Goal: source readiness is real enough to trust and quiet enough not to clutter
the top of the app.

Inspect:

- `useWorkbenchSourceReadiness.js`
- `registry-catalog.js`
- `registry-readiness.js`
- Workbench source inspector tests

Required behavior:

- `Auto sources` is a request scope, not a promise that everything is connected.
- The UI should say what is ready, blocked, local-only, unavailable, or requires
  setup.
- Source detail should wrap cleanly in the dock and inspector.
- Top bar should not show a generic "sources connected" count.
- Workbench should package source assumptions into the Chat draft/metadata
  without leaking prompt-engineering boilerplate into the visible UI.

Validation:

```bash
node --test crates/ironclaw_webui_v2_static/static/js/pages/workbench/hooks/useWorkbenchSourceReadiness.test.mjs crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-plan.test.mjs
npx playwright test --config playwright.static.config.ts tests/static/workbench-static.spec.ts --grep "source|boundar|connector|readiness" --reporter=line
```

### Lane 4: Live Work, Artifact, And Document Viewer

Goal: Workbench should show actual saved work/artifacts or honest empty states.
No fake live docs.

Inspect:

- `workbench-work-items.js`
- `workbench-library.js`
- `workbench-packet.js`
- saved work helpers in Chat/Work surfaces
- local document fixtures in Workbench static tests

Required behavior:

- The generic object is a work item, artifact, approval package, source note,
  receipt, or related Chat handoff.
- A document viewer may render actual saved Markdown/text artifacts, imported
  files, or existing supported previews.
- Missing artifacts should show an honest unavailable state with a link to the
  related Chat/Work item when possible.
- Redline/document comparison can be a future artifact tab only when backed by
  real artifact data.
- Do not render raw base64 or synthetic document paragraphs as normal UI.

Validation:

```bash
node --test crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-work-items.test.mjs crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/workbench-packet.test.mjs
npx playwright test --config playwright.static.config.ts tests/static/workbench-static.spec.ts --grep "document|artifact|Library|handoff|receipt" --reporter=line
```

### Lane 5: Generalizable Scenario Coverage

Goal: the product remains usable by any professional function without printing
a function menu on the surface.

Inspect:

- `workbench-plan.js`
- `workbench-scenes-registry.js`
- `workbench-persona-fixtures.json`
- banned-copy/static tests

Required coverage:

- executive/admin triage
- finance/investor/board prep
- legal/document review as one domain only
- operations/project coordination
- engineering/product incident or release work
- people/recruiting/interview prep
- sales/customer success follow-up
- research/synthesis
- marketing/growth/channel monitoring
- security/compliance questionnaires or evidence packs

Visible examples should use action language:

- "What needs me today?"
- "Summarize what changed."
- "Check Slack blockers."
- "Research TEE vendors."
- "Prepare investor update."
- "Turn a file into a memo."
- "Watch this weekly."

Avoid visible department labels and avoid legal-only terms on the first screen.

Validation:

```bash
node --test crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-scenes-registry.test.mjs crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-plan.test.mjs
npx playwright test --config playwright.static.config.ts tests/static/workbench-static.spec.ts --grep "suggestions|function picker|persona|legal" --reporter=line
```

### Lane 6: Onboarding, Connections, And Settings Readiness

Goal: adjacent screens should support the Workbench without duplicating its
surface or inventing fake provider/setup state.

Do this only after the core Workbench route remains green.

Inspect:

- routes and sidebar/nav registration
- onboarding/frontdoor static tests
- connections registry screen and tests
- settings inference/model APIs

Required behavior:

- Onboarding should make NEAR AI Cloud/model access understandable without
  turning the Workbench into a provider console.
- Connections should own connector setup, blockers, lifecycle, and readiness.
- Workbench should deep-link to setup only when a source actually needs setup.
- Settings should remain the durable place for model/provider configuration.

Validation:

```bash
node --test crates/ironclaw_webui_v2_static/static/js/app/routes.test.mjs crates/ironclaw_webui_v2_static/static/js/pages/extensions/components/registry-tab.test.mjs
npx playwright test --config playwright.static.config.ts tests/static/frontdoor-static.spec.ts tests/static/connectors-static.spec.ts tests/static/workbench-static.spec.ts --reporter=line
```

### Lane 7: Render, Accessibility, And Responsive QA

Goal: prove the app works in theory and in pixels before claiming progress.

Required checks:

- desktop first viewport at 1440x960
- model/effort inspector expanded
- post-Ask runtime-start state
- model-switch failure state
- mobile at roughly 390px wide with no horizontal overflow
- keyboard focus through composer, controls, drawer, tabs, and primary action
- no framework overlay, blank page, console/page errors, or clipped text

Core command:

```bash
npx playwright test --config playwright.static.config.ts tests/static/workbench-static.spec.ts --reporter=line
npm run test:a11y-static -- tests/static/a11y-static.spec.ts
```

Use this temporary screenshot script only for proof artifacts. Save it outside
the repo:

```bash
export SHOT_DIR="/tmp/ironclaw-workbench-overnight-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$SHOT_DIR"
PORT=1473 npm run dev:webui-static > "$SHOT_DIR/server.log" 2>&1 &
SERVER_PID=$!
sleep 3
node <<'NODE'
const { chromium } = require('playwright');
const path = require('node:path');
const out = process.env.SHOT_DIR;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const issues = [];
  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) issues.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => issues.push(`pageerror: ${err.message}`));
  await page.goto('http://127.0.0.1:1473/v2/workbench?token=workbench-static-token');
  await page.screenshot({ path: path.join(out, '01-workbench-main-1440x960.png'), fullPage: false });
  const model = page.getByRole('button', { name: 'Choose model and effort' });
  if (await model.count()) {
    await model.click();
    await page.screenshot({ path: path.join(out, '02-model-effort-expanded-1440x960.png'), fullPage: false });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:1473/v2/workbench?token=workbench-static-token');
  await page.screenshot({ path: path.join(out, '03-workbench-mobile-390x844.png'), fullPage: false });
  console.log(JSON.stringify({ out, issues }, null, 2));
  await browser.close();
})();
NODE
kill "$SERVER_PID" || true
```

If the static route needs mocks beyond the app bootstrap, prefer the existing
Playwright test harness screenshots over inventing new live-data assumptions.

### Lane 8: Generated Static Assets

Goal: keep shipped static output consistent once source is green.

Only run this after source-level tests and Workbench Playwright pass:

```bash
npm run prepare:webui-static
npm run verify:static-frontend
```

Generated chunk files may change names. Treat deleted old chunks and added new
chunks as a single generated asset set. Do not delete generated output by hand.

## Broad Validation Battery

Run this after each major slice or before handing off:

```bash
find crates/ironclaw_webui_v2_static/static/js/pages/workbench -name '*.js' -print0 | xargs -0 -n1 node --check
node --test crates/ironclaw_webui_v2_static/static/js/pages/workbench/hooks/*.test.mjs crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/*.test.mjs crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/*.test.mjs crates/ironclaw_webui_v2_static/static/js/app/routes.test.mjs scripts/probe-new-sidecar-acceptance.test.mjs
npx playwright test --config playwright.static.config.ts tests/static/workbench-static.spec.ts --reporter=line
npm run test:a11y-static -- tests/static/a11y-static.spec.ts
npm run prepare:webui-static
npm run verify:static-frontend
```

If broad validation is too slow for every iteration, run focused tests after
each small change and run the broad battery every second or third loop.

## Banned Visible Copy And UX Smells

Scan for these after every visible UI edit:

```bash
rg -n "Deep work|custody record|trust ledger|Sources connected|answer label|dummy|lorem|fake live|redline-first|matter desk|packet desk" crates/ironclaw_webui_v2_static/static/js/pages/workbench tests/static docs/design 2>/dev/null
```

Notes:

- Some banned terms may appear in tests or docs as negative assertions. That is
  allowed if the test proves the term is absent from the visible UI.
- Legal terms may appear in hidden scenario coverage or internal matchers.
  They should not dominate first-screen examples or product identity.

## Reporting Format After Each Loop

Use this exact shape in your running notes/final handoff:

```text
Loop N - YYYY-MM-DD HH:MM local
Lane:
Changed paths:
What changed:
Validation:
- command -> result
Screenshots:
- /tmp/path/file.png
Open risks:
Next lane:
```

If you add a progress log in the repo, use:

`docs/design/workbench-overnight-progress-2026-06-20.md`

Keep it concise. Do not paste huge command logs into repo docs.

## Definition Of Done For Overnight Progress

Do not claim the Workbench overhaul is done unless all of this is true:

- `/`, `/overview`, and `/workbench` route to the Workbench replacement surface.
- The first screen is generalizable and prompt-first.
- There is no first-screen function/persona/department picker.
- Model selection uses real provider/catalog labels where available.
- Effort is separate from model.
- Empty ask is blocked.
- Model activation failure prevents Chat send and preserves the draft.
- Chat runtime start path is tested.
- Source readiness is honest and inspectable.
- Local attachments/file states are honest.
- Library/Work/document viewers render actual saved artifacts or honest empty
  states, not fake documents.
- External actions are approval-gated or staged as missing backend dependency.
- Mobile 390px has no horizontal overflow.
- Keyboard and a11y checks pass.
- Static generated assets verify.
- Screenshots exist for desktop, inspector-expanded, post-Ask, failure, and
  mobile states.
- Remaining missing backend/API surfaces are explicitly listed.

If only some of those are true, report it as progress, not completion.
