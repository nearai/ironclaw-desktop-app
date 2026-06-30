# Cursor Workbench Buildout Instructions

Date: 2026-06-19

## Purpose

This is the handoff for building the rest of the IronClaw Desktop UX around the
Workbench direction without faking functionality or copying a static mockup too
literally.

The product should feel like a private professional workbench: the user asks
across connected tools, IronClaw reads and prepares work, nothing leaves the
machine or an external system without explicit approval, and the system becomes
more useful as it learns scoped preferences.

This is not a legal-only matter desk. Legal workflows are excellent stress
tests, but the surface must support the normal operating functions of a real
business: finance, legal, operations, engineering, product, people, sales,
customer success, marketing, executive/staff work, security/compliance,
research, and general admin. Those functions are validation coverage, not a
menu to print on the surface. The product should not make the user pick a
business function before asking. It should infer, adapt, and stay organized
around the person's active work.

## Source Of Truth

Use these references as a set, not as a winner-takes-all sequence:

1. Latest visual/flow mockup, useful but not complete:
   `/Users/abhishekvaidyanathan/Desktop/private-workbench-v13.html`
2. Prior mockups with functionality that must not be lost:
   `/Users/abhishekvaidyanathan/Desktop/private-workbench-v12.html`
   `/Users/abhishekvaidyanathan/Desktop/private-workbench-v11.html`
   `/Users/abhishekvaidyanathan/Desktop/private-workbench-v10.html`
   `/Users/abhishekvaidyanathan/Desktop/private-workbench-v9.html`
   `/Users/abhishekvaidyanathan/Desktop/private-workbench-v8.html`
3. Current real Workbench replacement surface:
   `crates/ironclaw_webui_v2_static/static/js/pages/workbench/workbench-page.js`
4. Current Workbench v13 style module:
   `crates/ironclaw_webui_v2_static/static/js/pages/workbench/workbench-styles.js`
5. Current Workbench planning and source mapping:
   `crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-plan.js`
6. Current Workbench route/render tests:
   `tests/static/workbench-static.spec.ts`
7. Connection catalog/readiness:
   `crates/ironclaw_webui_v2_static/static/js/pages/extensions/lib/registry-catalog.js`
   `crates/ironclaw_webui_v2_static/static/js/pages/extensions/lib/registry-readiness.js`
8. API client:
   `crates/ironclaw_webui_v2_static/static/js/lib/api.js`
9. Settings/model APIs:
   `crates/ironclaw_webui_v2_static/static/js/pages/settings/lib/settings-api.js`
10. Existing design contracts:
    `docs/design/current-surface-truth-map.md`
    `docs/design/component-grammar.md`
    `docs/design/design-acceptance-plan.md`

Important distinction:

- `private-workbench-v13.html` is the current visual replacement target: dark
  left rail, active-work dock, compact top bar, centered command well, state
  triage, source/boundary drawer, Library, Memory, and document workspace. It
  still needs production honesty where fixture data implies live state.
- `private-workbench-v12.html` has the tighter product shape: command surface,
  work rail, source drill-in, research tabs, packet review, approval modals,
  document view, Library, receipts, and memory. It also over-indexes on
  legal/document work if used alone.
- `private-workbench-v11.html` has the strongest honesty layer: one work-item
  state machine, state-derived rail/triage/Library/receipts, review-gated
  approval, explicit override recording, responsive reflow, and source drill-in.
- `private-workbench-v10.html` is important because it behaves like a live
  product: real triage, source exceptions, document workspace, approval re-arm
  on edit, research workspace, investor workspace, Library, streaming/partial
  failure, and delayed receipt links.
- `private-workbench-v9.html` has the clearest design principle: quiet shell,
  obvious command, artifact gets the room, and approval interrupts only at the
  moment of consequence.
- `private-workbench-v8.html` contains broad product loops that must not be
  dropped: X/account growth with held public actions, competitor watch with
  cadence, due-date/cadence control, source reauth, compact safety rail, broad
  example chips, monitor flows, investor update, research, Slack response, and
  scoped memory suggestion.
- The current in-app Workbench replacement has the real proof points the mockups
  lack: model mode, effort mode, source selection, current route registration,
  Chat runtime handoff, local Work artifact rendering, and a tested send path to
  the existing runtime API.

The build should merge those truths. Do not copy any static mockup as the final
answer. Use v13 for the current first-screen design profile, v12/v11/v10 for
the mature state model, v9 for visual discipline, v8 for generality and breadth,
and the current replacement route for honest runtime wiring.

## Current Implementation Snapshot

As of the `codex/workbench-overhaul-backend-loop` branch, `/workbench` is the
default replacement surface. It should render as the Workbench app shell, not as
a hidden QA route and not as a nested panel inside the legacy Chat-first chrome.

Currently wired:

- V13-style shell proportions: `54px` app rail, `252px` active-work dock,
  `52px` top bar, centered `720px` command column, responsive dock collapse.
- Route/default contract: `/` and `/overview` resolve to `/workbench`, Workbench
  is visible in primary IA, and the Workbench route does not render the legacy
  global sidebar/header around it.
- First-screen copy: "What do you want handled?", "Ask across your connected
  tools...", "Describe the work in plain language...", and the approval boundary
  line "Reads and drafts stay private. External actions need your approval."
- Model, effort, source scope, timing, attachment, and primary Ask controls.
- Chat runtime start through the existing WebChat v2 thread/message APIs.
- State rail and triage from real source readiness, thread state, and saved
  Work items, not hard-coded mock counts.
- Source/boundary drawer backed by `sourceReadinessItems`.
- Document workspace backed by local saved Work artifacts and the shared
  Markdown renderer.
- Library and Memory views with no visible function/department picker.
- V13 Workbench CSS extracted to `workbench-styles.js`; do not re-inline it
  into `workbench-page.js` during future component splits.
- Focused Playwright coverage for direct render, broad persona prompts,
  connector readiness, Chat send wiring, local document artifacts, empty ask
  guard, auth redirect, and mobile overflow/tap targets.

Still staged or intentionally honest:

- No first-class Workbench backend endpoint exists yet.
- Effort/model are request preferences unless a backend adds first-class
  metadata.
- Memory is a scoped preference proposal surface, not durable learning.
- Attachment button is present as UI affordance; real file send behavior remains
  owned by Chat attachment plumbing.
- External actions require the existing approval/gate path; Workbench does not
  execute a separate action backend.

## Before Main Maintainability Gate

The Workbench scaffold must not move to main as one giant route file, a static
mockup clone, a legal-first packet desk, a function picker, or a dummy UX. Before
main, the implementation must pass this maintainability gate while preserving
the product direction: an adaptive personal chief of staff that lets the user
ask naturally across available sources, prepares work, exposes assumptions,
holds external actions for approval, and records receipts.

This gate is required before any "ready for main" claim. If a split cannot be
completed because a backend/API is missing, the code and delivery note must mark
the state as staged or blocked with the missing dependency named. Do not cover a
missing split with optimistic copy, fake fixture data, or a new Workbench-only
runtime.

### Required Split 1: Mega Workbench Page

Split `workbench-page.js` into a thin route shell plus focused components under
`crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/`.

Expected component boundaries:

- composer and natural-language suggestions
- model/effort/source/cadence controls
- active-work rail and triage sections
- source picker and source inspector
- active run / prepared output view
- approval summary/review entry points
- Library, Memory, empty/loading/error states

Validation:

- `/workbench`, `/`, and `/overview` render the intended front door.
- 390px mobile has no horizontal overflow and no overlapping controls.
- Keyboard focus moves through composer, controls, drawers, and primary action.
- The first screen has no department/function picker, persona picker, or
  workflow-template gallery.
- Page-level code no longer owns layout, copy fixtures, request packaging,
  viewer logic, and style text in one file.

### Required Split 2: Scene Registry

Create a Workbench scene/scenario registry for state fixtures and example
coverage. The registry should describe domain-neutral work scenes such as needs
review, blocked, working, ready, scheduled, recent, source blocked, approval
required, artifact ready, monitor/watch, and preference proposal.

Domain metadata can exist for coverage, ranking, QA, and hidden fixtures. It
must not render as default navigation, tabs, cards, or the first interaction.

Validation:

- Fixture coverage spans at least five business domains.
- Legal/document scenes are less than half of visible examples and less than
  half of the scenario corpus.
- Static tests fail if hidden domain labels render as top-level Workbench
  picker/tabs/cards.
- Suggestions use state/action language such as "review", "draft", "prepare",
  "continue", "watch", or "summarize", not visible function names.

### Required Split 3: Request And Model Adapter

Move Workbench-to-Chat request packaging into a pure adapter. It should carry
the user's original wording plus model preference, effort preference, source
scope, cadence/due-date, attachment notes, approval boundaries, assumptions, and
requested output format when inferable.

Model/provider truth remains owned by Settings and Chat. Workbench can surface
preferences and blockers, but it must not invent a provider console, send to a
fake Workbench endpoint, or expose JSON/workflow ids to the user.

Validation:

- Non-empty asks reach the existing Chat send path.
- Tests prove model, effort, source, cadence, attachment notes, assumptions, and
  approval boundaries are included in the packaged request or real backend
  metadata.
- Blocked model/provider state prevents send or shows a clear warning before
  send.
- The visible UI contains no hidden domain taxonomy, JSON, prompt-engineering
  boilerplate, or provider-marketplace framing.

### Required Split 4: Styles

Keep the v13 Workbench CSS in `workbench-styles.js` or smaller style modules
that follow the app's design tokens. Do not re-inline the full style string into
`workbench-page.js` while splitting components.

Validation:

- `npm run lint:static-tokens` and copy lint pass when touched.
- Desktop and mobile screenshots show stable proportions, no text overflow, no
  overlapping controls, and no card-within-card page sections.
- Generated CSS and bundles are not regenerated until source tests pass.
- Visual changes preserve the quiet professional workbench shape, not a giant
  marketing hero or a legal document console.

### Required Split 5: Packet / Work Viewer Model

Create a domain-neutral viewer model for work items, artifacts, approval
packages, source provenance, receipts, related thread/run links, and document
reader states. "Packet" can describe a review package, but it must not become
the product identity.

Legal redlines, MSAs, and document packets are artifact types inside the broader
work model. The default language remains work item, artifact, source, approval,
receipt, monitor, routine, and preference.

Validation:

- Artifact deep links, markdown/text artifacts, file artifacts, missing
  artifacts, related approvals, and receipts have focused tests.
- No raw base64 or dummy live docs render in normal UI.
- Receipts do not appear before backend confirmation or an explicit test
  fixture.
- Work/Library opens real saved work data or an honest empty/unsupported state.

### Required Split 6: Workspace-File Adapter

Add a thin adapter for local workspace files, dropped/imported files, and
attachment extraction metadata. Files should participate in source readiness
without pretending a connector install happened.

The adapter must preserve the private-read/draft boundary and report missing,
unreadable, unsupported, partial, and ready states plainly.

Validation:

- File-to-brief fixtures cover ready, missing, unreadable, unsupported, and
  partial-read states.
- Source inspector copy names file limitations and next action.
- Chat handoff includes attachment/file-readiness notes.
- Raw file content or base64 is not exposed unless the existing supported
  preview/send path requires it.

### Required Split 7: Test Harness

Maintain a focused Workbench harness for pure helper tests, static Playwright
route tests, hidden scenario fixtures, banned-copy contracts, readiness
fixtures, artifact fixtures, and mobile/a11y checks.

Validation:

- Every split above has at least one focused unit/static/render test or a named
  deferral tied to a missing backend/API.
- Broad validation runs only after focused tests pass.
- Screenshot evidence covers desktop and 390px mobile for changed states.
- The harness fails if the product drifts toward legal/document-only examples,
  a visible function directory, fake readiness, or dummy live-work UI.

## Functionality To Preserve From Earlier Versions

Do not lose these capabilities while tightening the design:

- General command well as the center of the product, not a tiny search box.
- Adaptive natural-language suggestions:
  - What needs me?
  - Check Slack.
  - Research something.
  - Prepare an investor update.
  - Watch this weekly.
  - Grow a channel/account.
  - Draft a counter or document only as one example, not the default mode.
- Due date or cadence affordance near the command box.
- Source scope control, including "Auto sources" and source-specific scopes.
- Source health as an exception, local to blocked work.
- Reconnect/reauth flow for a specific source.
- Compact safety/boundary rail or inspector that can stay out of the way until
  a gate/blocker appears.
- Work rail items for non-legal workflows:
  - Channel/account growth awaiting approval.
  - Competitor or market watch.
  - Research brief.
  - Investor or stakeholder update.
  - Slack/email response batch.
- Approval for public/external actions beyond email:
  - Post to Slack.
  - Publish social posts.
  - Follow accounts or take account-growth actions.
  - Start or change a recurring monitor.
  - Share/export a brief.
- Receipts for completed external actions that name what happened and what did
  not happen, for example "0 DMs sent" or "nothing posted."
- Memory suggestion with explicit scope, not silent learning.
- Research flow with Plan, Sources, Findings, Draft/Brief.
- Investor/stakeholder update flow with stale-input resolution.
- Monitor/watch flow with cadence, sources, and approval before delivery.

## Non-Negotiables

1. Do not add fake backend endpoints.
2. Do not show a connector, source, model, or artifact as ready unless current
   app state can prove it.
3. Do not show "Sources connected", "custody record", "trust ledger", or similar
   broad decorative claims.
4. Do not route Workbench sends to a new Workbench-only API. Until a real
   Workbench backend exists, start through the existing Chat runtime:
   `createThread`, `sendMessage`, `fetchTimeline`, `openEventStream`, and gate
   resolution in `lib/api.js`.
5. External actions must use the existing approval/gate model. Sending email,
   posting Slack, sharing docs, filing externally, scheduling delivery, or
   saving durable memory must be held for review.
6. Workbench can include model and effort controls, but provider/model truth
   remains owned by Settings and Chat. Do not invent a provider picker.
7. Effort is currently an execution preference packaged into the request unless
   the backend exposes first-class effort metadata. Tests must prove it reaches
   the Chat send payload.
8. Source selections must map to `CORE_CONNECTIONS` and
   `WORKBENCH_SOURCE_FAMILIES`. Unsupported sources must be disabled, blocked,
   or described honestly.
9. Treat `/workbench` as the replacement product surface. Do not re-hide it as a
   QA route; tests should prove both direct `/workbench` render and default `/`
   redirect behavior.
10. No generated bundle update until source changes pass focused tests. Then run
    the static preparation command used by the repo.
11. Redlines, MSA packets, and legal workflows are stress tests, not the product
    definition. Every design pass must prove the same shell supports research,
    messaging, stakeholder updates, monitoring, and channel/account work.
12. Do not remove functionality that existed in v8-v11 just because v12 omitted
    it. If a capability is not wired yet, represent it as staged or blocked in
    the build plan, not as deleted.

## Product Direction

The front door should answer this user need:

"I want one private place where I can ask what needs me, ask across email,
Slack, docs, web, local files, and future apps, have the assistant prepare the
work, inspect the sources, edit the result, approve what leaves, and keep a
clear record of what happened."

Core loops:

- Ask: "What needs me today?"
- Read: IronClaw checks available sources and says what matters.
- Prepare: IronClaw drafts replies, briefs, plans, docs, posts, monitor
  summaries, stakeholder updates, or research outputs.
- Inspect: the user can open sources, snippets, conflicts, and assumptions.
- Edit: the user can adjust draft text, artifact content, recipients,
  schedules, source choices, or action scope.
- Approve: external action is frozen, summarized, and explicitly approved.
- Record: resulting artifacts and receipts appear in Work/Library.
- Learn: scoped preferences are proposed, not silently saved.

The generic object is a "work item", not a "matter", "redline", "packet", or
"case". A work item can be a readout, reply batch, research brief, monitor,
document draft, social/account plan, investor update, scheduled routine,
approval package, finance review, hiring loop, incident follow-up, product
brief, customer escalation, or operations checklist. Legal work should fit
inside this model rather than defining it.

## Personal Chief Of Staff Principle

The user should not have to choose a function, persona, department, workflow
template, or taxonomy before asking. The surface should adapt to the person:

- What they recently asked IronClaw to do.
- Which sources they connected.
- Which work items are active, blocked, ready, scheduled, or waiting for
  approval.
- Which calendar events, threads, documents, issues, or files are relevant.
- Which scoped preferences they explicitly saved.
- Which patterns IronClaw can suggest for review without silently saving.

The UI should feel like:

"Here is what seems to matter in your world; tell me what to handle next."

Not:

"Pick Finance, Legal, Operations, Engineering, or People."

### Adaptive Surface Rules

- Do not show a row of department/function categories on the default Workbench
  home.
- Do not require the user to select a domain before a command.
- Do not use visible tags like "Finance", "Legal", "Ops", "People", or
  "Engineering" as the organizing principle of the first screen.
- Use plain work-language suggestions:
  - "What needs me today?"
  - "Draft the replies."
  - "Prepare the brief."
  - "Review approvals."
  - "Continue the launch checklist."
  - "Summarize the open blockers."
  - "Turn this file into a memo."
  - "Watch this and brief me Friday."
- Suggestions should be ranked by personal context when available:
  - active approvals first
  - blocked source/work next
  - scheduled commitments next
  - recent work next
  - useful generic prompts last
- Domain labels may exist as hidden metadata, test coverage, filters in advanced
  search, or a later personalization/debug view. They should not be the default
  user-facing chrome.

### No Visible Function Directory Contract

Cursor should treat "finance, legal, operations, engineering, people, sales,
support, marketing, security, research" as a coverage matrix, not as surface
navigation.

The default Workbench must not include:

- Department tabs.
- Function cards.
- Persona pickers.
- Workflow-template galleries.
- Domain-tag chips as the first interaction.
- A left rail organized by business function.
- Suggestions grouped under visible headings like "Legal", "Finance", or
  "Engineering".

The default Workbench can include:

- Active work grouped by state:
  - needs review
  - blocked
  - working
  - ready
  - scheduled
  - recent
- Personal suggestions derived from context:
  - "Reply to the two easy threads."
  - "Prepare the Friday brief."
  - "Continue the launch checklist."
  - "Review the pending send."
  - "Summarize what changed overnight."
- A source picker grouped by source type or readiness, not by business
  function.
- Advanced search/filter affordances that can expose hidden metadata only after
  the user asks for it.

Adaptation should come from the user's connected tools, prior work, saved
preferences, calendar, active approvals, blocked sources, recent artifacts, and
explicit commands. If there is no personal context yet, fall back to a small set
of domain-neutral prompts. Do not compensate by showing every possible business
function.

Implementation tests:

- Add a static contract test that fails if the first screen renders a visible
  department/function picker.
- Add a fixture-level coverage test that still proves at least five hidden
  business domains are supported.
- Add a suggestion-ranking test proving visible suggestions are state/action
  language, not function names.

## Natural Language Asking

This product lives or dies on whether asking feels natural. The composer should
feel closer to talking to a capable chief of staff than configuring a workflow
builder.

### Composer Principles

- The composer is a place to describe work in ordinary language, not a search
  field and not a command-line interface.
- The placeholder should invite complete thoughts:
  "Describe the work in plain language. Paste a thread, drop a file, or give a
  multi-step instruction..."
- The user should be able to type fragments, requests, or messy instructions:
  - "what needs me today"
  - "draft replies to the two easy ones"
  - "turn the third into an amendment"
  - "check slack too"
  - "make this a friday monitor"
  - "use the deck I just dropped"
  - "show me sources before anything goes out"
- The UI should never make the user write prompt-engineering boilerplate.
- The UI should never expose hidden routing syntax, domain tags, JSON, or
  workflow ids.
- The send button label can adapt, but it should stay human:
  - Ask
  - Draft
  - Prepare
  - Research
  - Review
  - Start
  - Schedule
  - Continue
- The user should be able to press Cmd+Enter to send and Escape to close
  popovers/drawers without losing draft text.

### Natural Suggestions

Suggestions are not generic prompt chips. They are small invitations based on
what IronClaw can honestly know.

Suggestion ranking:

1. A real approval or blocked item that needs the user.
2. A source reauth or setup issue blocking current work.
3. Recent unfinished work.
4. Calendar/time-sensitive context when available.
5. Recently saved artifacts or prior asks.
6. Connected-source capability suggestions.
7. Generic starter suggestions only when there is no personal context.

Good suggestion text:

- "Review the Northwind send package"
- "Reconnect Slack and finish the blocker check"
- "Continue the launch checklist"
- "Draft replies to the waiting threads"
- "Prepare a brief from these files"
- "Watch this and brief me Friday"
- "Summarize what changed since yesterday"

Bad suggestion text:

- "Finance"
- "Legal"
- "Run workflow"
- "Use automation"
- "Execute agent"
- "Query sources"
- "MCP registry"
- "Create task object"

### Clarifying Questions

IronClaw should ask clarifying questions only when acting without the answer
would be risky, impossible, or likely wrong. Otherwise it should proceed with a
clear assumption and expose the assumption for review.

Ask a clarifying question for:

- ambiguous external destination
- ambiguous account/source identity
- missing file or thread reference when the request depends on it
- destructive or irreversible action
- unclear approval scope
- multiple plausible recipients
- private/sensitive people, finance, legal, customer, or security context

Do not ask a clarifying question for:

- wording preferences that can be edited later
- source selection when "auto sources" can safely try available sources
- low-risk read-only research
- a first draft that can be revised
- missing details that can be called out as assumptions

Clarifying question copy should be short:

- "Which thread should I use?"
- "Do you want this sent to Dana or just drafted?"
- "Should I include Slack, or keep this to email and docs?"
- "What cadence do you want for the watch?"
- "Is this for your eyes only or a shareable brief?"

### Assumption Display

When IronClaw proceeds with assumptions, show them in plain language near the
draft/run, not as a wall of chain-of-thought:

- "Assuming this is for internal review."
- "Using Gmail, Drive, and public web. Slack is disconnected."
- "Drafting only. Nothing will be sent without approval."
- "Treating Friday as this coming Friday in your local timezone."

### Beautiful Interaction Details

The surface should feel polished because the interactions are calm, precise, and
predictable:

- The command box grows smoothly up to a stable max height, then scrolls.
- Pasted threads/files become readable chips with extraction/readiness state.
- Model, effort, source, and cadence controls sit below or beside the composer
  as quiet controls, never as equal headline content.
- The primary button has enough presence to feel actionable, but the page should
  not become a giant hero prompt.
- Suggestion chips should wrap cleanly, never resize their row on hover, and
  never overflow mobile.
- Sending should show one concise progress state: "Starting", "Reading", or
  "Preparing", depending on stage.
- Returning to Workbench should preserve draft text and selected controls until
  send or explicit clear.
- Keyboard focus should move from composer to source picker to send in a
  predictable order.

### Structured Request Packaging

Until a Workbench backend exists, the composer packages natural language into a
structured Chat request. The visible UI stays natural; the sent content can
include structure.

The packaged request should include:

- user's original wording
- model preference
- effort preference
- selected/auto sources
- cadence or due-date preference
- attachments and file-readiness notes
- approval boundaries
- assumptions
- requested output format when inferable

The packaged request should not include:

- hidden domain taxonomy as a visible user instruction
- fake connector readiness
- fake ability to schedule or send
- internal route ids unless needed for deep linking inside the app

Add tests proving the natural request text and structured preferences both
reach the existing Chat send path.

## Surface Copy Matrix

Use copy that is specific, quiet, and action-shaped. The app should sound like a
capable person preparing work, not like infrastructure narrating itself.

| Surface              | Say                                                                                                     | Avoid                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Workbench home       | "What do you want handled?"                                                                             | "Choose a workflow"                   |
| Composer placeholder | "Describe the work in plain language. Paste a thread, drop a file, or give a multi-step instruction..." | "Enter prompt"                        |
| Empty state          | "Ask across your connected tools, or connect more when you need them."                                  | "No workbench items found"            |
| Needs You            | "2 things need your review"                                                                             | "Approval objects pending"            |
| Blocked source       | "Slack needs a fresh sign-in before this can finish."                                                   | "Token expired"                       |
| Source setup         | "Connect Slack when a task needs messages."                                                             | "Install wasm channel"                |
| Active run           | "Reading Gmail and Drive"                                                                               | "Executing agent step"                |
| Partial run          | "Gmail read fine. Slack is disconnected, so I paused that part."                                        | "Partial failure" without explanation |
| Assumption           | "Assuming this is for internal review."                                                                 | "Inferred domain: operations"         |
| Draft output         | "Draft ready for review"                                                                                | "Generated artifact object"           |
| Approval             | "This sends one email to Dana with the attached draft. Nothing has been sent yet."                      | "Authorize external action"           |
| Receipt              | "Sent to Dana at 9:58 AM. No Slack post was made."                                                      | "Custody record"                      |
| Work Library         | "Saved work"                                                                                            | "Memory ledger"                       |
| Preference           | "Save this preference?"                                                                                 | "Self-learning loop detected"         |
| Model state          | "NEAR AI Cloud is ready"                                                                                | "Provider execution verified"         |
| Settings blocker     | "Model access is not ready. Connect NEAR AI Cloud to start work."                                       | "Gateway model readiness failed"      |

Microcopy rules:

- Lead with the user consequence, not the system mechanism.
- Use "nothing sent yet" where the user might worry about external action.
- Use "I" or "IronClaw" sparingly; prefer direct outcomes.
- Use implementation terms only in developer/admin surfaces.
- Avoid over-personifying learning. Say "Save this preference?" not "I learned
  how you work."
- Keep labels short enough to fit mobile without dynamic shrinking.

## Internal Coverage Corpus

The same Workbench shell must work across business functions. Treat each domain
below as internal validation coverage, not as default UI IA. The user should see
natural work suggestions and active work, while tests and fixtures prove the
shell handles broad business work.

The shared primitives are:

- Work item: what the user wants handled.
- Sources: where IronClaw is allowed to look.
- Artifact/output: what IronClaw prepares.
- Approval boundary: what cannot happen without explicit approval.
- Receipt: what happened, where, when, and what did not happen.
- Preference: a scoped behavior the user can explicitly save.

### Finance

Example asks:

- "What changed in the finance model since last week?"
- "Prepare a cash runway note for the board."
- "Find invoices that need approval and draft replies."
- "Compare actuals against the Q3 plan and flag surprises."

Likely sources:

- Sheets, Drive, Gmail, Slack, calendar, local files, accounting exports when
  available.

Likely outputs:

- Board note, variance summary, invoice approval list, budget question list,
  cash runway explanation.

Approval boundaries:

- Sending vendor/customer emails.
- Approving invoices or payments.
- Changing a spreadsheet or finance system.
- Sharing board materials.

### Legal

Example asks:

- "Draft the Northwind counter and show the key terms before I approve."
- "Summarize the issues in this services agreement."
- "Prepare an amendment from this email thread."
- "Show me open contract asks by urgency."

Likely sources:

- Gmail, Drive, Notion, Slack, local files, contract folders.

Likely outputs:

- Issue list, contract summary, amendment draft, negotiation email, source-backed
  position memo.

Approval boundaries:

- Sending external legal communications.
- Sharing documents.
- Filing or saving durable legal preferences.
- Finalizing redlines.

### Operations

Example asks:

- "What operational blockers came up today?"
- "Prepare the vendor onboarding checklist from email and Slack."
- "Find process gaps from the last three support escalations."
- "Set up a weekly launch readiness check."

Likely sources:

- Slack, Gmail, Notion, Drive, calendar, GitHub/issues when relevant.

Likely outputs:

- Blocker list, checklist, launch readiness brief, owner/action table, recurring
  monitor.

Approval boundaries:

- Assigning tasks externally.
- Posting status updates.
- Changing cadence.
- Updating shared systems.

### Engineering

Example asks:

- "Summarize what changed in the repo and draft release notes."
- "Find high-priority GitHub issues that need triage."
- "Prepare an incident follow-up from Slack and GitHub."
- "Compare this PR against the product requirement."

Likely sources:

- GitHub, Slack, Notion, Drive, local workspace files, web docs.

Likely outputs:

- Release notes, issue triage, incident summary, implementation plan, PR review
  brief.

Approval boundaries:

- Commenting on issues/PRs.
- Opening or closing issues.
- Posting incident updates.
- Changing repo state.

### Product And Design

Example asks:

- "Turn these customer notes into a product brief."
- "Compare these competitor flows and draft recommendations."
- "Summarize feedback themes from Slack, calls, and support threads."
- "Prepare a design review packet for the team."

Likely sources:

- Notion, Drive, Slack, Gmail, web, local files, screenshots/artifacts.

Likely outputs:

- Product brief, research synthesis, competitor comparison, review agenda,
  decision log.

Approval boundaries:

- Sharing recommendations externally.
- Updating roadmap docs.
- Posting announcements.

### People And Recruiting

Example asks:

- "Prepare my interview packet for tomorrow."
- "Summarize candidate feedback and draft follow-ups."
- "Find people issues that need a response this week."
- "Draft an offer approval note from comp bands and interview feedback."

Likely sources:

- Calendar, Gmail, Drive, Notion, Slack, ATS exports if available.

Likely outputs:

- Interview brief, feedback synthesis, follow-up drafts, offer rationale,
  manager action list.

Approval boundaries:

- Sending candidate or employee messages.
- Sharing sensitive people data.
- Updating HR/ATS records.
- Saving durable preferences about people decisions.

### Sales And GTM

Example asks:

- "What deals need me today?"
- "Draft follow-ups for these five accounts."
- "Prepare a launch plan for this audience."
- "Find 50 relevant accounts to follow and ask before taking action."

Likely sources:

- Gmail, Slack, calendar, sheets/CRM exports, web, social sources when connected,
  Notion/Drive.

Likely outputs:

- Deal brief, account plan, follow-up drafts, launch plan, target account list,
  message batch.

Approval boundaries:

- Sending customer/prospect messages.
- Posting publicly.
- Following/engaging from an account.
- Updating CRM.

### Customer Success And Support

Example asks:

- "Find customer threads that need a response."
- "Draft replies for unresolved escalations."
- "Summarize the top support themes this week."
- "Prepare a renewal risk brief for this account."

Likely sources:

- Gmail, Slack, support exports when available, Notion, Drive, web, calendar.

Likely outputs:

- Response drafts, escalation brief, theme report, renewal risk memo, account
  timeline.

Approval boundaries:

- Sending customer responses.
- Posting in customer channels.
- Updating account records.
- Sharing sensitive customer details.

### Marketing And Comms

Example asks:

- "Draft a launch announcement from this product brief."
- "Monitor competitor launches and brief me Friday."
- "Prepare five posts and hold them for approval."
- "Summarize press mentions this week."

Likely sources:

- Notion, Drive, Slack, web, calendar, social sources when connected.

Likely outputs:

- Announcement draft, content calendar, post batch, market brief, comms plan.

Approval boundaries:

- Publishing posts.
- Sending announcements.
- Starting/changing public monitors.
- Sharing embargoed or sensitive details.

### Executive And Staff Work

Example asks:

- "What needs my attention across email, Slack, and calendar?"
- "Prepare my board packet."
- "Draft the weekly company update."
- "Tell me what I can ignore."

Likely sources:

- Gmail, Slack, calendar, Drive, Notion, Sheets, web.

Likely outputs:

- Attention readout, board prep, update draft, priority list, delegation plan.

Approval boundaries:

- Sending company updates.
- Sharing board materials.
- Delegating or assigning tasks.
- Saving durable working preferences.

### Security And Compliance

Example asks:

- "Summarize security questionnaires that need answers."
- "Prepare a vendor risk brief from docs and web evidence."
- "Find compliance asks due this week."
- "Draft a response but show the sources before anything leaves."

Likely sources:

- Gmail, Drive, Notion, Slack, web, local files, GitHub when relevant.

Likely outputs:

- Questionnaire draft, risk brief, compliance checklist, evidence table,
  response package.

Approval boundaries:

- Sending security/compliance answers.
- Sharing evidence packs.
- Updating compliance systems.
- Making claims without source review.

## Domain-Neutral Data Model

Design and code should converge on this model even if the first implementation
stores only part of it:

- `id`
- `title`
- `domain`: `finance`, `legal`, `operations`, `engineering`, `product`,
  `people`, `sales`, `customer_success`, `marketing`, `executive`,
  `security_compliance`, or `general`
- `objective`
- `status`: `draft`, `reading`, `working`, `blocked`, `needs_review`,
  `needs_approval`, `scheduled`, `done`, `failed`, `cancelled`
- `sourceIds`
- `sourceStates`
- `artifacts`
- `approvalBoundaries`
- `receipts`
- `cadence`
- `dueAt`
- `owner`
- `confidence`
- `openQuestions`
- `nextAction`

The UI should not require the user to choose a domain before asking. Domain can
be inferred lightly for grouping, filtering, examples, and testing, but the
command box remains the primary interface.
Domain is hidden metadata by default, not a visible taxonomy.

## Domain-Neutral Naming

Default nouns:

- Work
- Work item
- Source
- Artifact
- Draft
- Brief
- Reply batch
- Review package
- Approval
- Receipt
- Preference
- Routine
- Monitor
- Run

Domain-specific nouns are allowed only inside domain-specific content:

- Legal: redline, amendment, counter, agreement, client.
- Finance: runway, variance, invoice, forecast.
- Engineering: issue, PR, release, incident.
- People: candidate, interview, offer, feedback.
- Sales/GTM: account, deal, sequence, launch.
- Support: escalation, customer thread, renewal risk.

Do not make domain-specific nouns global nav labels, top-level tabs, or
permanent chrome.

## Information Architecture

### Primary App Shape

Workbench is the main operating surface on this branch. Chat remains available,
but as the runtime/thread-detail surface Workbench hands work to.

- `/workbench`: default replacement surface and primary operating view.
- `/chat`: current proven runtime and thread reader.
- `/work`: saved artifacts and generated work reader.
- `/automations`: existing scheduled-work viewer.
- `/extensions/registry`: connector setup and readiness.
- `/settings/inference`: model setup and active model ownership.

Do not expose unfinished `workspace`, `projects`, `jobs`, `routines`, or
`missions` routes unless they become honest screens with tests.

### Workbench Screen Regions

Use a dense, professional layout:

- Narrow app rail: global destinations.
- Work rail: active items grouped by state, not generic navigation.
- Main work surface: command box, readout, run, packet, research, or library.
- Inspector drawer: source details, blocker details, package detail, or
  connector detail.
- Approval modal: only for held external actions.

Avoid card soup. Cards are acceptable for repeated work items, source rows,
approval gates, and modals. Page sections should feel like surfaces and lists,
not stacked marketing cards.

## Visual Direction

Aim for the polish of apps like Slack, Notion, Claude, Linear, and high-quality
macOS productivity software:

- Quiet, fast, information-dense.
- Clear active state and hierarchy.
- Low-radius controls, consistent border rhythm, restrained shadows.
- Plain copy with specific nouns.
- Serious color use: accent for action, warning only for real blockers, success
  only for proven completion.
- Serif can be used sparingly for Workbench page headings if it helps, but do
  not make the product feel editorial or legal-magazine-like.
- The command box must be large enough to support multi-step work. It should
  feel central, not like a search bar.
- Model/source/effort controls should be close to the command box but visually
  secondary.
- Inspector/source evidence should feel like a precise evidence panel: exact
  snippets, source status, confidence, and why-used notes.
- The design must not make the whole product read as a contract/redline app.
  Document review can be excellent, but it should be one mode among many.
- Avoid making "smart docket" the primary concept. It is useful as a triage or
  scheduled-work section, not the main surface.

Copy bans:

- "The custody record"
- "Trust ledger"
- "Sources connected"
- "Receipts, artifacts, memory" as a headline
- Generic "AI workspace" filler
- "Ask me anything" as the primary product promise
- Over-legal labels like "matter desk" for the general surface
- "Redline workspace" as a generic tab name
- "Client" or "matter" as default nouns outside legal-specific examples

Preferred copy patterns:

- "What do you want handled?"
- "Reads and drafts stay private. External actions ask first."
- "Source unavailable"
- "Held for your approval"
- "Draft ready"
- "Open source"
- "Review package"
- "Save preference?"
- "Use in this request"
- "Reconnect Slack"
- "Review action"
- "Start watch"
- "Adjust cadence"
- "Open brief"
- "Prepare replies"

## Current Proven Runtime Wiring

Use the existing API client in `static/js/lib/api.js`:

- `createThread({ clientActionId, requestedThreadId })`
- `listThreads({ limit, cursor })`
- `sendMessage({ threadId, content, attachments, timezone, clientActionId })`
- `fetchTimeline({ threadId, limit, cursor, signal })`
- `openEventStream({ threadId, afterCursor })`
- `openEventSocket({ threadId })`
- `cancelRun({ threadId, runId, reason, clientActionId })`
- `resolveGate({ threadId, runId, gateRef, resolution, always, credentialRef })`
- `setupExtension(extensionName, { action, payload })`
- `gatewayStatus()`

Use Settings APIs in `pages/settings/lib/settings-api.js`:

- `fetchLlmProviders()`
- `listLlmProviderModels(payload)`
- `setActiveLlm(payload)`
- `testLlmProviderConnection(payload)`
- `startNearaiLogin(payload)`
- `completeNearaiWalletLogin(payload)`
- `fetchExtensions()`
- `fetchExtensionRegistry()`

Saved work is currently local/static-side:

- `readSavedWorkItems`
- `saveAssistantResponseToWork`
- `saveGeneratedFileArtifactToWork`
- `workArtifactHref`
- existing `/work?item=...&artifact=...` deep links

If a proposed screen cannot be backed by these, mark it blocked or staged.

## Model And Effort Controls

Workbench needs model configurability, but it must not become a fake model
control.

Recommended UI:

- Primary model chip: active provider/model from `fetchLlmProviders`.
- Secondary action: "Change model" linking to `/settings/inference` or opening
  the existing provider/model popover if a reusable Chat component exists.
- Work mode dropdown:
  - "Active chat model" means use current Settings/Chat model.
  - "Fast pass" means prefer a quick first answer and ask before expensive
    research.
  - "Deep work" means inspect sources and compare conflicts before answering.
- Effort segmented control:
  - "Standard"
  - "Careful"
  - "Background"

Implementation rule:

- If the backend has no first-class effort/model override for messages, include
  these preferences in the structured Workbench request content as the current
  replacement implementation does.
- Keep tests that prove the structured content reaches
  `/api/webchat/v2/threads/:threadId/messages`.
- Do not imply that "Fast" or "Deep" selects a separate provider unless it
  actually does.

## Source And Connector Model

Use the current catalog as the only source of truth:

- Gmail: `gmail`
- Calendar: `google-calendar`
- Drive: `google-drive`
- Sheets: `google-sheets`
- Notion: `notion`
- Slack: `slack`
- Telegram: `telegram`
- GitHub: `github`
- Web: `web-http`
- Routines: `routines`
- Local workspace: `workspace`

Workbench source groups:

- Email -> Gmail
- Calendar -> Google Calendar
- Messages -> Slack, Telegram
- Docs -> Drive, Notion
- Sheets -> Google Sheets
- Code -> GitHub
- Web -> Web & HTTP
- Local files -> Workspace files
- Schedule -> Routines

Source selector behavior:

- Default to "Auto sources" but show what "auto" means for the request after
  the user types.
- If a source is ready, allow inclusion.
- If a source is available but not connected, show "Connect" and route to the
  connector setup path.
- If a source is blocked, show the exact blocker and one next action.
- If a catalog is unavailable, say that plainly and do not show fake readiness.

The source inspector from v12 is good. Build it using real readiness states:

- Read
- Reading
- Partial
- Skipped
- Blocked
- Needs reconnect
- Catalog unavailable

Each source detail should include:

- Source name.
- Readiness state.
- Snippets used if present in timeline/tool output.
- Why it was used.
- Confidence or limitation.
- Action: include/exclude/reconnect/open setup/open source.

## Baseline Screen Buildout Checklist

This checklist captures the minimum screen set. The later
`Screen-Level Functional Specification` is the detailed build contract.

### 1. Workbench Home

Build from the full reference set, corrected with current replacement controls.
The home must feel like a personal chief-of-staff desk. It should adapt to what
this person is doing, not expose a static business-function directory.

Required:

- Large command composer.
- Model chip/control.
- Effort segmented control.
- Source scope selector.
- Due date/cadence affordance. If no runtime support exists, it should package
  into the structured request rather than pretending to schedule directly.
- Attachment button if current Chat attachment plumbing can be reused. If not,
  leave disabled with honest title/copy.
- Primary button with action label that changes based on request type:
  "Ask", "Draft", "Research", "Start", or "Review plan".
- A "Needs you" section showing only proven or mocked-in-test states. Do not
  invent real inbox contents in production.
- Active work rail grouped by:
  - Needs approval
  - Blocked
  - Working
  - Ready to review
  - Recent
- Recent saved work from `readSavedWorkItems`.
- Clear empty states when no live data exists.

Required examples:

- Keep the first-row examples broad:
  - What needs me today?
  - Check messages.
  - Prepare a brief.
  - Review approvals.
- Put personalized or contextual examples behind "More", without visible
  department labels:
  - Prepare a runway note.
  - Draft a counter or amendment.
  - Make a launch checklist.
  - Summarize open issues.
  - Prepare an interview packet.
  - Draft account follow-ups.
  - Prepare escalation replies.
  - Watch competitor launches.
  - Draft questionnaire answers.

The first useful screen must not visibly list business functions. The underlying
test fixtures and example corpus must cover broad functions, but the UI should
phrase them as natural actions the user might ask for.

Behavior:

- Empty send stays on Workbench with a visible error.
- Non-empty send creates or hands off to Chat exactly as currently tested.
- The draft content must include task, model preference, effort preference,
  source preference, cadence/due-date preference when set, and approval
  boundaries.
- Typing a non-legal request must not route to a legal/document packet by
  default.

### 2. Active Run View

This is the "what is IronClaw doing?" screen. It can initially be a view over a
Chat thread/timeline.

Required tabs:

- Plan
- Sources
- Findings or Readout
- Draft/Artifact/Output
- Activity

Use these states:

- Starting
- Reading sources
- Drafting
- Needs approval
- Blocked
- Ready to review
- Done
- Cancelled
- Failed

Data:

- Pull messages/tool activity from `fetchTimeline`.
- Use SSE via `openEventStream` where the current Chat hooks already do.
- If you cannot reuse the Chat hooks safely, start with a read-only thread view
  and link "Continue in Chat".
- Do not create a second runtime state machine unless it is a thin adapter over
  Chat timeline events.
- The run view must support these output types without renaming the screen:
  - reply batch
  - research brief
  - document draft
  - social/account action plan
  - monitor/watch setup
  - stakeholder update

### 3. Approval And Review Packets

The Northwind packet in v12 is a good example of a review package, but do not
make "packet" mean only "redline plus email." The general pattern is: summarize
the proposed external consequence, let the user inspect the artifact/output,
then freeze the exact action for approval.

The review package shape:

- Summary of what changed.
- Source-backed key decisions.
- Artifact/output tab.
- Email, Slack, social, schedule, share, or message draft tab when relevant.
- Evidence tab.
- Activity tab.
- Review checklist.
- Frozen approval package.

Production rules:

- Reuse existing gate cards and `resolveGate`.
- If there is no real gate event, do not show an active "Approve and send"
  button that implies it can execute.
- Every approval package must name:
  - Action
  - Target
  - Destination
  - Attached data/artifact/output
  - Reversibility
  - Version or content being approved
- Editing draft text or document content must re-arm approval.
- For social/account growth, approval must name exact posts, accounts/actions,
  and what is not being done, such as no DMs.
- For monitors/routines, approval must name cadence, sources, destination, and
  how to pause/change it.
- For Slack/email reply batches, approval must support per-item review, not only
  one giant approve button.

### 4. Work And Document Viewer

Do not build a fake redline editor as the main promise. Build a real artifact
viewer first. Redlines should be a document-specific mode inside the broader
artifact viewer.

Required:

- Open saved artifacts through `/work?item=...&artifact=...`.
- Show markdown/text artifacts in a readable document pane.
- For generated files, use existing file artifact preview/export behavior.
- Add a Workbench-side preview drawer only if it uses the same artifact data.
- For document comparison/redline UI, stage as a tab that can show current
  artifact text and source labels. If there is no real DOCX diff data, label it
  "Draft view" rather than "Redline".
- Support non-document artifacts:
  - research brief
  - reply batch
  - stakeholder update
  - monitor plan
  - social/content plan
  - receipt

Future-ready interface:

- `artifactId`
- `itemId`
- `threadId`
- `version`
- `content_format`
- `mime_type`
- `provenance`
- `approval_status`

### 5. Library

The v12 Library concept is useful, but rename and simplify it.

Preferred label: "Work Library" or just "Work".

Required:

- Search saved work items and artifacts.
- Filter by:
  - Work product
  - File
  - Receipt
  - Preference
  - Scheduled
  - Research
  - Replies
  - Monitors
- Use local saved work for now.
- Do not show "memory" as a first-class category unless scoped preferences have
  real data.
- Receipts should come from real tool activity, gate approvals, or saved work
  receipts. If absent, show an empty state.

### 6. Memory And Self-Learning Loops

Self-learning is important, but must be user-controlled.

Build a "Save preference?" pattern:

- Explain what IronClaw noticed.
- Show the examples that support the proposed preference.
- Ask for scope:
  - Personal
  - Workspace
  - This source
  - This client/project
  - This workflow
- Require explicit save.
- Provide edit/reject.
- Store nothing durable until a real storage path exists. If no backend exists,
  keep as disabled/prototype or local test-only state.

Never claim IronClaw has learned something permanently unless it has.

### 7. Onboarding

Onboarding should be channel-first after model setup:

1. Connect NEAR AI Cloud.
2. Explain private workbench promise in one screen:
   - Ask across sources.
   - Prepare drafts/artifacts.
   - Approve external actions.
3. Let the user connect first useful sources:
   - Gmail
   - Slack
   - Drive
   - Notion
   - Calendar
   - Local files/workspace if available
4. Show "Start with what is ready" instead of forcing every connector.
5. Land in Workbench or Chat depending on Workbench release readiness.

Implementation constraints:

- Keep current first-run NEAR AI Cloud auth logic and tests.
- Reuse `onboarding-page.js`, `ProviderLoginStatus`,
  `useProviderManagementActions`, and `useProviderLogin`.
- Do not regress the current onboarding tests that enforce real auth readiness,
  44px tap targets, and copy bans.
- Connector setup should link into `/extensions/registry`, not duplicate the
  whole setup flow unless a reusable connector setup component exists.

### 8. Connections

Build connection screens around work outcomes, not app inventory.

Required:

- Core source setup strip:
  - Email
  - Calendar
  - Messages
  - Docs
  - Web
  - Files
  - Schedule
- Each row/card must show:
  - Ready, Available, Needs setup, Needs reconnect, Blocked, In progress.
  - One next action.
  - Exact blocker.
- Keep registry browse for advanced app installation.
- Keep the acceptance workflows area, but phrase it as "Work loops these apps
  unlock", not as a decorative showcase.

Use:

- `CORE_CONNECTIONS`
- `WORKBENCH_SOURCE_FAMILIES`
- `sourceReadiness`
- `workflowCatalogStatus`
- `connectorSetupGuidance`
- `registryConnectButtonState`
- `setupExtension`

### 9. Settings And Model Setup

Required:

- Settings remains the owner of active provider/model.
- Workbench can show a compact active model panel but must link to Settings for
  changes until a shared model picker is safely extracted.
- Keep NEAR AI Cloud as the normal desktop path.
- Keep advanced/custom provider sprawl out of the main Workbench surface.

Tests must cover:

- Active model shown from provider snapshot.
- Blocked model setup state disables send or routes to setup.
- Model mode preference is included in Workbench request.

### 10. Automations And Routines

The "smart docket" idea is useful but secondary. It should not dominate the
home surface.

Build it as:

- A small "Scheduled" or "Routines" section in the rail when items exist.
- A detail screen for recurring checks and prep work.
- A cadence chip/control in the composer that can package requested cadence into
  the Chat request now and become first-class later.
- A creation path that starts as a Workbench request:
  "Every weekday at 8, check Gmail, Slack, and calendar and tell me what needs
  me."
- A monitor/watch review package for:
  - sources
  - cadence
  - destination
  - what can run silently
  - what requires approval

Do not expose a full routine builder until the backend supports creating,
editing, pausing, and deleting routines through proven APIs.

### 11. Generic Professional Workflows

Use these scenarios to validate the surface is truly generalizable:

| Domain           | Scenario                                                                      | Expected output                          | Approval boundary                                                  |
| ---------------- | ----------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| Executive        | "What needs me today across email, Slack, and calendar?"                      | Priority readout with what can wait      | No sends, posts, or delegation without approval                    |
| Finance          | "Prepare a runway note from the finance model and latest KPI sheet."          | Board-ready note with source table       | No sharing board materials or editing sheets without approval      |
| Legal            | "Draft the Northwind counter and show key terms before I approve."            | Review package with document/email draft | No external send or final redline without approval                 |
| Operations       | "Make a launch readiness checklist from Slack, Notion, and open blockers."    | Owner/action checklist                   | No task assignment or status post without approval                 |
| Engineering      | "Summarize the release risk from GitHub issues and Slack."                    | Release-risk brief and issue list        | No GitHub comments, issue changes, or Slack posts without approval |
| Product          | "Turn customer notes into a product brief."                                   | Product brief and evidence table         | No roadmap/doc updates without approval                            |
| People           | "Prepare my interview packet for tomorrow."                                   | Candidate/interview brief                | No candidate/employee messages or HR updates without approval      |
| Sales/GTM        | "Draft follow-ups for five accounts and rank deal urgency."                   | Account follow-up batch                  | No customer/prospect sends or CRM updates without approval         |
| Customer Success | "Find unresolved escalations and draft customer replies."                     | Escalation reply batch                   | No customer replies without approval                               |
| Marketing        | "Watch competitor launches and brief me every Friday."                        | Monitor plan and first brief             | No publishing, posting, or scheduled delivery without approval     |
| Security         | "Draft answers to this security questionnaire from docs and prior responses." | Source-backed response package           | No claims sent externally without approval                         |
| Research         | "Compare three vendors using public docs and my Drive notes."                 | Comparison brief with confidence         | No vendor outreach or sharing without approval                     |
| Channel Growth   | "Find 50 relevant accounts, draft five posts, and hold actions for review."   | Account list and post batch              | No follows, posts, likes, DMs, or public action without approval   |

Each scenario should show:

- Sources considered.
- What was read.
- What was skipped or blocked.
- Draft/artifact.
- Approval boundary for external action.
- Saved work/receipt if completed.

Each scenario must keep the same Workbench shell. Do not create separate
vertical-specific home screens for legal, finance, operations, engineering,
people, sales, support, marketing, research, or social work.

Add a regression test or static contract test that fails if all visible
Workbench examples are legal/document examples.

Add a second regression test or static contract that checks the scenario corpus
or seed fixture includes at least five hidden domain categories from:

- finance
- legal
- operations
- engineering
- product
- people
- sales
- customer success
- marketing
- executive
- security/compliance
- research
- general admin

Add a third regression test or static contract that checks the default
Workbench home does not render those domain names as a top-level picker or
department menu.

## Screen-Level Functional Specification

This section is the build contract. Cursor should treat it as more authoritative
than static mockup layout details when they conflict.

### A. First Run And Onboarding

Purpose:

- Get a new user from "nothing connected" to "I can ask IronClaw to handle real
  work" without turning onboarding into provider setup theater.

Primary user promise:

- "Connect model access, connect the sources you want, then start from what is
  ready."

Visible content:

- One concise promise: ask across sources, prepare work, approve external
  actions.
- NEAR AI Cloud sign-in as the first model-access step.
- Source setup preview after model access:
  - email
  - calendar
  - messages
  - docs/knowledge
  - local files
  - web
- "Start with what is ready" as an escape hatch.
- Exact blocked state when model or source setup cannot proceed.

Controls:

- Continue with NEAR AI Cloud.
- Continue with Google where supported.
- Continue with NEAR Wallet where supported.
- Open Connections.
- Skip source setup for now.

States:

- checking provider.
- model access blocked.
- model access available.
- model access ready.
- source catalog unavailable.
- source setup available.
- source setup in progress.
- ready to start.

Current wiring:

- `onboarding-page.js`
- `fetchLlmProviders`
- `startNearaiLogin`
- `completeNearaiWalletLogin`
- `setActiveLlm`
- `/extensions/registry` for source setup.

Copy rules:

- Do not say "choose a model provider" as the normal first-run task.
- Do not say "sources connected" unless readiness is proven.
- Do not explain every feature. Show the next useful step.

Tests:

- Existing onboarding auth readiness tests remain green.
- READY badge is gated on real auth.
- Secondary auth actions remain 44px or larger.
- Copy does not include banned phrases.
- Skip lands on the current honest start surface.
- Source setup links route to existing Connections/registry surfaces.

### B. Workbench Home / Personal Desk

Purpose:

- Be the first useful screen after setup and the main place a returning user
  sees what needs attention, what is in motion, and what they can ask next.

Primary user promise:

- "Here is what seems to matter; tell IronClaw what to handle."

Visible content:

- Natural-language composer.
- Contextual suggestions ranked by personal state.
- Needs You section:
  - approvals
  - blocked sources
  - failed runs
  - stale inputs
  - external actions waiting for review
- Working section:
  - reading
  - drafting
  - watching
  - scheduled
- Ready section:
  - drafts
  - briefs
  - reply batches
  - artifacts
- Recent section:
  - saved work
  - recent threads
  - receipts.

Controls:

- Composer text area.
- Attach file.
- Source scope.
- Model mode.
- Effort mode.
- Cadence/due date.
- Send/Ask/Prepare/Start button.
- Open item.
- Continue in Chat.
- Clear draft.

States:

- no token redirects to welcome.
- loading context.
- no personal context yet.
- ready with suggestions.
- source blocked.
- model blocked.
- draft validation error.
- sending/starting.
- handoff complete.

Current wiring:

- `/workbench` is the default replacement route.
- `/` and `/overview` redirect to `/workbench`.
- Workbench renders outside the legacy global sidebar/header shell.
- `buildWorkbenchChatDraft`
- `setDraft(NEW_DRAFT_KEY, draft)`
- `navigate('/chat')`
- `readSavedWorkItems`
- `fetchLlmProviders` for model truth when added.
- `fetchExtensions` and `fetchExtensionRegistry` for source truth when added.

Deferred wiring:

- Real global pending approvals.
- Real "what changed since last check" aggregator.
- First-class Workbench backend.
- Durable personalization.

Copy examples:

- Placeholder: "Describe the work in plain language. Paste a thread, drop a
  file, or give a multi-step instruction..."
- Empty state: "Ask across your connected tools, or connect more tools when
  you need them."
- Blocked model: "Model access is not ready. Connect NEAR AI Cloud before
  starting work."
- Blocked source: "Slack needs reconnecting before this request can use it."

Tests:

- Direct route renders.
- Hidden nav remains hidden.
- Composer is large enough for multi-step work.
- Empty send stays put with error.
- Non-empty send reaches Chat composer.
- Chat send posts to `/api/webchat/v2/threads/:id/messages`.
- Natural request and structured preferences are included.
- No business-function picker appears.
- Legal/document examples are not the majority of the scenario corpus.
- 390px viewport has no horizontal overflow.

### C. Work Rail / Needs You

Purpose:

- Let the user scan active work by state without turning the product into a
  dashboard of fake metrics.

Visible content:

- Needs approval.
- Blocked.
- Working.
- Ready to review.
- Scheduled or watching.
- Recent receipts.

Controls:

- Open work item.
- Reconnect source when that is the only blocker.
- Review approval package.
- Continue in Chat.
- Pause/cancel only when a real run/automation id exists.

States:

- empty.
- loading.
- populated.
- item selected.
- item stale.
- source blocked.
- action held.

Current wiring:

- Saved work items from local saved-work helpers.
- Chat threads when available.
- Extension readiness for blocked source rows.

Deferred wiring:

- Real global approvals.
- Real active run index.
- Real scheduled-work write operations.

Tests:

- Rows are keyboard reachable.
- Section labels are state labels, not department labels.
- Reconnect row routes to the exact setup path.
- No fake counts.

### D. Active Work / Run Workspace

Purpose:

- Show what IronClaw is doing or has prepared for one work item, while keeping
  the user able to inspect, edit, approve, or continue in Chat.

Visible content:

- Work title and plain status.
- Assumptions.
- Source state strip.
- Tabs:
  - Plan
  - Sources
  - Findings/Readout
  - Output
  - Activity
- Primary output pane:
  - reply batch
  - brief
  - document draft
  - monitor plan
  - account plan
  - checklist
  - receipt.

Controls:

- Continue in Chat.
- Open source.
- Open artifact.
- Save to Work when current Chat save exists.
- Review approval.
- Edit draft content where local editing is honest.
- Cancel run only with real run id.

States:

- starting.
- reading.
- partial source failure.
- drafting.
- waiting for review.
- blocked.
- needs approval.
- done.
- failed.
- cancelled.

Current wiring:

- `createThread`
- `sendMessage`
- `fetchTimeline`
- `openEventStream`
- `openEventSocket`
- `cancelRun`
- saved work helpers.

Implementation guidance:

- Build as an adapter over the existing Chat runtime. Do not invent an
  independent run engine.
- If timeline data is insufficient, show what is known and provide "Continue in
  Chat" rather than inventing activity.
- Activity rows should summarize tool/action events, not expose raw JSON.

Tests:

- Timeline messages populate activity.
- Tool activity maps to source/activity rows.
- SSE unavailable state does not break render.
- Continue in Chat preserves thread context.
- Cancel button is absent/disabled without a run id.

### E. Source Picker And Source Inspector

Purpose:

- Make source use visible, controllable, and honest without forcing the user to
  manage connector plumbing.

Visible content:

- Auto sources.
- Email.
- Calendar.
- Messages.
- Docs/knowledge.
- Web.
- Local files.
- Schedule/routines when relevant.
- Source detail drawer:
  - state
  - snippets/evidence
  - why used
  - limitations
  - next action.

Controls:

- Include/exclude source for this request.
- Open source setup.
- Reconnect source.
- Open underlying artifact/thread when a real link exists.
- Copy snippet when a snippet exists.

States:

- ready.
- available.
- unavailable.
- needs setup.
- needs reconnect.
- reading.
- read.
- partial.
- skipped.
- blocked.
- catalog unavailable.

Current wiring:

- `CORE_CONNECTIONS`
- `WORKBENCH_SOURCE_FAMILIES`
- `sourceReadiness`
- `workflowCatalogStatus`
- `connectorSetupGuidance`
- `registryConnectButtonState`
- `setupExtension`

Tests:

- Gmail Google-client blocker links to Google setup.
- Notion needs-token shows setup, not ready.
- Slack error shows reconnect.
- Built-in web/workspace do not require install.
- Empty catalog does not claim readiness.
- Source drawer is keyboard reachable and closable with Escape.

### F. Review And Approval Package

Purpose:

- Let the user inspect exactly what will happen before anything leaves or
  changes an external system.

Visible content:

- Plain action title.
- Frozen package summary.
- Destination/target.
- What leaves the workspace.
- Artifact/output preview.
- Reversibility.
- Source/evidence summary.
- Checklist of required review steps.
- Approval consequence copy.

Controls:

- Approve.
- Deny/Hold.
- Edit draft.
- Review missing item.
- Override only where product policy allows, with reason.
- Resolve gate through existing API when real gate exists.

States:

- ready for review.
- missing required review.
- stale input.
- edited/re-armed.
- approval pending.
- approved.
- denied.
- backend error.

Current wiring:

- Existing approval/auth gate components.
- `resolveGate`
- `submitManualToken` for credential gates when applicable.
- Chat timeline gate events.

Rules:

- No active "Approve and send" button without a real gate or test-mocked gate.
- Editing any approved content re-arms approval.
- Approval package must name what will not happen when relevant.
- "Always allow" is rare, specific, and revocable.

Tests:

- Approval cannot be completed before required review unless override is shown
  and reason is captured.
- Edited output re-arms approval.
- Gate resolve uses current API path.
- Package names action, destination, data movement, and reversibility.
- No external action receipt appears before approval response.

### G. Artifact / Work Viewer

Purpose:

- Make generated work usable outside chat.

Visible content:

- Artifact title.
- Source/provenance.
- Status.
- Content preview.
- Attachments/generated files.
- Related thread/work item.
- Receipts and approvals tied to the artifact.

Controls:

- Open.
- Copy.
- Export/save where existing artifact flow supports it.
- Continue in Chat.
- Search within artifact.
- Version selector only when real versions exist.

States:

- text/markdown artifact.
- generated file artifact.
- extraction unavailable.
- file preview unavailable.
- saved.
- missing artifact.
- malformed artifact.

Current wiring:

- `/work?item=...&artifact=...`
- `readSavedWorkItems`
- `saveAssistantResponseToWork`
- `saveGeneratedFileArtifactToWork`
- generated-file artifact helpers.

Tests:

- Deep links do not produce `/v2/v2`.
- Missing artifact shows honest empty state.
- File artifacts do not show raw base64 as body.
- Export/copy controls are present only when supported.

### H. Work Library / Search

Purpose:

- Let the user find prepared work, receipts, artifacts, monitors, and saved
  preferences without treating it as a mystical memory ledger.

Visible content:

- Search input.
- Recent work.
- Saved artifacts.
- Receipts.
- Scheduled/monitored work.
- Preferences only when real.

Controls:

- Search.
- Filter by item type, not department.
- Open item.
- Open artifact.
- Continue related thread.

States:

- no saved work.
- search empty.
- results.
- stale/local-only data.
- unsupported receipt data.

Current wiring:

- Local saved work helpers.
- Chat thread links.
- Artifact links.

Tests:

- Search matches title and artifact body where supported.
- Empty search state is plain.
- Filters do not expose department taxonomy as default IA.
- Receipt rows come from real saved/tool data or are absent.

### I. Connections

Purpose:

- Help the user connect the sources needed for work without looking like an app
  marketplace.

Visible content:

- Source families by plain use:
  - Email
  - Calendar
  - Messages
  - Docs/knowledge
  - Files
  - Web
  - Schedule.
- Ready/available/blocked state.
- One next action per source.
- Work loops unlocked by available sources, phrased as examples not categories.

Controls:

- Connect.
- Reconnect.
- Open setup.
- Open Google setup.
- Retry.
- View advanced registry.

States:

- catalog unavailable.
- available.
- needs setup.
- waiting in browser.
- activating.
- ready.
- error.

Current wiring:

- `fetchExtensions`
- `fetchExtensionRegistry`
- registry readiness helpers.
- `setupExtension`
- `googleOauthSettingsHref`

Tests:

- One next action per card.
- Exact blocker copy.
- Google blockers route to settings.
- Catalog refs are not used as lifecycle names when a bare name is required.

### J. Settings / Model And Effort

Purpose:

- Own model truth without making the Workbench feel like a provider console.

Visible content:

- Active NEAR AI Cloud state.
- Active model id when known.
- Blocker if provider/model cannot run.
- Advanced provider management only where already supported.

Controls:

- Change active model.
- Test connection.
- Manage NEAR credential/login.
- Return to Workbench.

States:

- checking.
- ready.
- credential missing.
- list-models failed.
- active selection changed.

Current wiring:

- `fetchLlmProviders`
- `listLlmProviderModels`
- `setActiveLlm`
- `testLlmProviderConnection`
- NEAR login helpers.

Tests:

- Workbench model chip reflects Settings truth.
- Blocked model prevents or warns before send.
- Changing model remains Settings-owned.
- Workbench effort remains a request preference unless backend metadata exists.

### K. Scheduled Work / Monitors / Routines

Purpose:

- Support repeated work without exposing raw automation machinery.

Visible content:

- Active scheduled work.
- Watches/monitors.
- Last run or next run.
- Delivery destination.
- What can run silently.
- What will ask before acting.

Controls:

- Open.
- Pause only when API exists.
- Resume only when API exists.
- Edit cadence only when API exists.
- Create by natural-language request when full CRUD is not available.

States:

- no scheduled work.
- scheduled.
- running.
- paused.
- blocked source.
- awaiting approval before delivery.

Current wiring:

- Existing read-only automations list.
- Chat request packaging for new cadence asks.

Deferred wiring:

- Real routine CRUD.
- Real monitor management.

Tests:

- No fake edit/pause controls without API.
- Cadence preference is packaged into request.
- Delivery approval is explicit.

### L. Preferences / Self-Learning

Purpose:

- Let IronClaw get better without making personalization opaque or creepy.

Visible content:

- Proposed preference.
- Why IronClaw noticed it.
- Examples.
- Scope selector.
- Save/edit/reject.
- Where to manage it later, if a real settings surface exists.

Controls:

- Save preference.
- Edit wording.
- Reject.
- Choose scope.

States:

- proposed.
- missing scope.
- saved locally/test-only.
- saved durably when backend exists.
- rejected.

Rules:

- Nothing is saved silently.
- Preference suggestions must be scoped.
- Do not infer sensitive people/legal/finance/security preferences without a
  clear review step.
- If no durable store exists, the UI must say or behave as staged/test-only.

Tests:

- Save disabled until scope is chosen.
- Reject removes suggestion.
- No durable-memory claim without backend proof.
- Copy avoids "I learned you" style broad claims.

### M. Empty, Loading, Error, And Offline States

Purpose:

- Keep the product trustworthy when data is missing.

Rules:

- Empty states should propose the next useful action, not describe the feature.
- Loading states should name what is being checked.
- Blocked states should name exact blocker and one next action.
- Offline/catalog-unavailable states should reduce claims, not render fake
  defaults.
- Errors should preserve the user's draft/request.

Tests:

- No blank route.
- No uncaught console errors.
- Error state keeps typed draft.
- Blocked copy has blocker and next action.

### N. Responsive And Accessibility Requirements

Required behavior:

- 390px mobile has no horizontal overflow.
- Primary controls are at least 44px tall.
- Drawers and modals restore focus.
- Escape closes popovers/drawers/modals.
- Tab order follows the visual order.
- Source rows and work rows are keyboard openable.
- Buttons have accessible names.
- Reduced motion disables nonessential animation.
- Text never overlaps controls at desktop or mobile widths.

Tests:

- Existing a11y/static tests pass.
- Workbench-specific Playwright checks cover mobile overflow and tap targets.
- Screenshot QA includes desktop and mobile.

## End-To-End Natural-Language Flow Fixtures

These fixtures are the product and QA spine. They are not visible navigation.
Use them to prove the Workbench can adapt to different people's work without
printing a business-function menu on the surface.

Every fixture must use the same shell:

- Composer.
- Model/effort/source controls.
- Assumptions.
- Source strip or inspector.
- Work rail.
- Artifact/readout area.
- Approval package when anything leaves the app.
- Receipt when an external action completes.

Every fixture must avoid:

- Function pickers.
- Domain cards.
- Workflow ids.
- JSON instructions.
- Prompt-engineering labels.
- Legal/redline defaults unless the user actually asked for document/legal
  work.

### Fixture 1: Morning Attention Readout

Natural user language:

```text
what needs me today
```

Expected interpretation:

- Read available personal-professional sources: Gmail, Slack, Calendar, Drive,
  Notion, and saved work if ready.
- If a source is not connected, continue with available connected tools and show the
  blocker locally.
- Rank by urgency, consequence, waiting people, due dates, and explicit user
  preferences.

Visible UI:

- Heading: "What do you want handled?"
- Composer keeps the user's exact wording.
- Source strip shows ready, reading, skipped, or blocked sources.
- Work rail shows state groups, not departments.
- Output is an attention readout:
  - "Needs a reply"
  - "Can wait"
  - "Worth preparing"
  - "Blocked by source"

Clarifying question only if:

- No model/provider is ready.
- No source can be read.
- The user asks for an external action but destination is ambiguous.

Approval boundary:

- No replies, posts, assignments, or calendar changes happen from this readout.
- Follow-up buttons may prepare drafts, but they do not send.

Screens touched:

- Workbench home.
- Active run.
- Source inspector.
- Work rail.
- Saved work entry.

Current wiring:

- Start through existing Chat thread creation and message send.
- Timeline/tool events populate run activity where available.
- Source readiness comes from connector catalog/readiness.

Tests:

- The first screen does not render department/function tabs.
- The request sent to Chat includes original text, model, effort, sources, and
  approval boundaries.
- A disconnected Slack fixture still returns Gmail/Calendar results with an
  honest Slack blocker.

### Fixture 2: Draft The Easy Replies And Prepare One Artifact

Natural user language:

```text
draft replies to the two easy emails and turn the third into the requested amendment
```

Expected interpretation:

- Resolve "two easy emails" and "third" from the current attention readout or
  selected work item.
- Prepare reply drafts and one editable artifact.
- Show assumptions if the references are inferable.

Visible UI:

- Composer shows a contextual continuation marker such as "Continuing from
  today's readout."
- Output has a reply batch and an artifact tab.
- The artifact viewer is a real work/document viewer area, not a tiny card.
- Each draft has source evidence and editable text.

Clarifying question only if:

- "Third" cannot be mapped to a source thread.
- The requested artifact requires a file format the app cannot produce yet.

Approval boundary:

- Sending any reply requires a review package.
- Saving/exporting the artifact requires a clear destination and approval.

Tests:

- The app does not assume legal work unless the source thread asks for an
  amendment.
- Editing a draft re-arms approval.
- Approval copy says what sends, to whom, and that nothing has been sent yet.

### Fixture 3: Slack Follow-Up With A Blocked Source

Natural user language:

```text
check slack too and draft responses for anything urgent
```

Expected interpretation:

- Use Slack only if it is connected and readable.
- If Slack is disconnected, show "Slack needs a fresh sign-in before this can
  finish" and continue with other sources only if relevant.

Visible UI:

- Source inspector opens with Slack marked "needs reconnect."
- Work rail item status is "Blocked" or "Partially ready", not a generic error.
- Reconnect action routes to the existing setup path.

Approval boundary:

- No Slack post or message is sent without explicit review.

Tests:

- Slack error state is keyboard reachable.
- Reconnect CTA points to the existing registry/setup path.
- No source is shown as connected because it appears in the catalog.

### Fixture 4: File-To-Brief

Natural user language:

```text
use the deck I just dropped and turn it into a board memo
```

Expected interpretation:

- Attach the dropped file if current attachment plumbing exists.
- If attachments are not wired in Workbench yet, show the disabled state and
  route through the real Chat attachment path or mark the missing API.
- Prepare a memo artifact with source references.

Visible UI:

- Attachment chip with filename, size, and readiness.
- Output tab with editable memo.
- Sources tab showing the deck and any additional connected context used.

Approval boundary:

- No sharing, emailing, or exporting board materials without approval.

Tests:

- Disabled attachment state is honest if plumbing is missing.
- Generated artifact preview does not show raw base64.
- Work reader opens from saved work.

### Fixture 5: Finance Or Metrics Note Without A Finance Surface

Natural user language:

```text
prepare a runway note from the latest model and flag stale numbers
```

Expected interpretation:

- Infer likely Sheets/Drive/Gmail sources if connected.
- Ask which file only if there are multiple plausible models and no recent
  context.
- Produce a concise note with stale-input warnings.

Visible UI:

- No "Finance" tab.
- Suggested continuation may say "Review stale inputs" or "Draft board note."
- Source inspector shows model file, KPI sheet, and skipped sources.

Approval boundary:

- No spreadsheet edits, payment approvals, or sharing board materials without
  approval.

Tests:

- Domain metadata can record `finance`, but visible home chrome does not show
  Finance as a category.
- Stale source state appears as limitation/assumption, not as fake certainty.

### Fixture 6: Engineering Release Risk Without An Engineering Surface

Natural user language:

```text
summarize release risk from github and the launch thread
```

Expected interpretation:

- Use GitHub and Slack only if ready.
- Prepare a risk brief with issues, blockers, owners, and confidence.

Visible UI:

- Source strip says "GitHub", "Slack", and any blocked state.
- Output reads as a release-risk brief, not a legal packet.
- Work rail state is "Ready to review" or "Blocked."

Approval boundary:

- No GitHub comments, issue state changes, or Slack posts without review.

Tests:

- Non-legal request does not route to document/redline-specific UI.
- Tool/timeline events appear in Activity where available.

### Fixture 7: Interview Packet With Sensitive Data

Natural user language:

```text
prep my interview packet for tomorrow
```

Expected interpretation:

- Use Calendar to identify interviews if connected.
- Use Gmail/Drive/Notion only as allowed.
- Prepare a packet with schedule, candidate context, evaluation prompts, and
  open questions.

Visible UI:

- If multiple interviews exist, ask which one.
- Sensitive details appear in the artifact area, not in notification-like cards.
- Memory suggestion is explicit and scoped, for example "Save preference:
  include role scorecard when preparing interview packets?"

Approval boundary:

- No candidate/employee messages and no HR/ATS updates without review.
- No silent durable memory about people decisions.

Tests:

- Sensitive work does not leak into broad receipts or visible nav labels.
- Memory save is explicit and scoped.

### Fixture 8: Customer Escalation Replies

Natural user language:

```text
find unresolved escalations and draft replies
```

Expected interpretation:

- Search connected email, Slack, support exports if available, and saved work.
- Prepare a ranked escalation list and reply drafts.

Visible UI:

- Needs-review group shows one row per reply batch or escalation.
- Source inspector exposes thread snippets and confidence.
- Draft view supports edit, regenerate, and approve.

Approval boundary:

- No customer reply, customer-channel post, or account update without approval.

Tests:

- Replies are held for review.
- Approval summary names each recipient/destination.
- Receipts name what happened and what did not happen.

### Fixture 9: Security Questionnaire

Natural user language:

```text
draft answers to this security questionnaire and show sources before anything leaves
```

Expected interpretation:

- Attach/read questionnaire if possible.
- Use Drive/Notion/prior responses/web docs as available.
- Produce source-backed answers with confidence and gaps.

Visible UI:

- Sources tab is prominent because the user asked for it.
- Output includes answer cells/sections and evidence.
- Gaps are marked plainly.

Approval boundary:

- No external claims are sent without explicit review.
- Gaps cannot be hidden inside polished copy.

Tests:

- "show sources" opens or emphasizes source inspector.
- Approval modal includes data movement and destination.

### Fixture 10: Recurring Monitor Or Routine

Natural user language:

```text
watch competitor launches and brief me every friday
```

Expected interpretation:

- Prepare a monitor plan with sources, cadence, output format, and delivery
  destination.
- Because routine APIs may not exist yet, package cadence into Chat and mark
  real creation as staged unless backend support is proven.

Visible UI:

- Cadence chip says "Every Friday" once parsed.
- Work rail state is "Review plan" or "Scheduled" only if real scheduling
  exists.
- Routines section appears only when routines exist or are in review.

Approval boundary:

- Starting, changing, or delivering a recurring monitor requires approval unless
  a proven backend policy says otherwise.

Tests:

- No fake scheduled state without API proof.
- Cadence is included in the Chat request payload.

### Fixture 11: Account Or Channel Growth With Public Actions Held

Natural user language:

```text
find 50 relevant accounts, draft five posts, and hold every action for review
```

Expected interpretation:

- Research public web/social sources only if available.
- Prepare an account list and post batch.
- Treat follows, likes, DMs, public posts, and scheduled publishing as external
  actions.

Visible UI:

- Output is a research/action package, not a social-media dashboard.
- Approval package lists every public action category as held.
- Receipt, if approved, says exactly what happened and includes "0 DMs sent" if
  applicable.

Approval boundary:

- No follows, likes, DMs, posts, scheduled posts, or public profile changes
  without explicit approval.

Tests:

- Account-growth asks do not expose a marketing/function picker.
- Approval summary includes "nothing posted yet" before approval.

### Fixture 12: General Deep Research

Natural user language:

```text
research the best approach to rolling this out to professional services firms
```

Expected interpretation:

- Use web and any selected internal docs.
- Ask scope only if the request is too broad for a useful first pass.
- Produce plan, sources, findings, recommendation, and next actions.

Visible UI:

- Tabs: Plan, Sources, Findings, Brief.
- Work rail can show "Working" then "Ready to review."
- Suggestions after completion are action-shaped:
  - "Turn this into a memo."
  - "Draft outreach."
  - "Watch this market."

Approval boundary:

- No outreach, publishing, or sharing without review.

Tests:

- Research flow works without legal/doc assumptions.
- Source list distinguishes public web from connected private sources.

## Implementation Phases For Cursor

### Phase 0: Protect The Current State

Before editing:

```sh
git status --short
npm run test:static -- tests/static/workbench-static.spec.ts
node --test crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-plan.test.mjs
```

Rules:

- Do not revert unrelated dirty files.
- Do not delete current Workbench tests.
- Do not hide or demote Workbench from primary nav.
- Do not regenerate `main.bundle.js` until source tests pass.

### Phase 1: Extract Workbench Primitives

Create focused components under:

`crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/`

Suggested files:

- Already extracted: `workbench-styles.js` owns the v13 CSS string consumed by
  `workbench-page.js`.
- `workbench-composer.js`
- `workbench-model-controls.js`
- `workbench-source-picker.js`
- `workbench-source-inspector.js`
- `workbench-rail.js`
- `workbench-run-view.js`
- `workbench-approval-summary.js`
- `workbench-library.js`
- `workbench-empty-states.js`

Keep pure mapping helpers in:

`crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/`

Suggested helpers:

- `workbench-route-state.js`
- `workbench-source-readiness.js`
- `workbench-thread-adapter.js`
- `workbench-copy.js`

Add node tests for helper logic.

### Phase 2: Upgrade Workbench Home

Build the Workbench home from the `Screen-Level Functional Specification`:
natural-language composer, adaptive personal suggestions, honest model/effort
and source controls, real Chat handoff, and no visible department/function
picker.

Required tests:

- Direct `/v2/workbench?token=...` route renders.
- Hidden nav remains hidden.
- Command box is visible and large.
- Model control renders from current options.
- Effort control renders.
- Source controls render and map to current source/capability ids.
- Empty send does not navigate.
- Non-empty send hands off to Chat.
- Chat send posts structured Workbench content to the existing messages API.
- 390px viewport has no horizontal overflow.
- All primary controls are at least 44px tall.

### Phase 3: Source Readiness And Connector CTA

Use registry readiness to power Workbench source states.

Required tests:

- Gmail blocked by Google client id links to `/settings/inference#google-oauth`.
- Notion `needs-token` shows setup, not ready.
- Slack error shows reconnect.
- Built-in web and workspace show available/readable without install.
- Empty registry does not claim sources are connected.
- Source selector disabled/blocked states are keyboard reachable.

### Phase 4: Active Run Over Chat Thread

Build a read-only Workbench run view over the existing Chat runtime.

Required tests:

- Workbench creates/opens a Chat thread.
- Timeline messages populate the run activity area.
- Tool activity rows appear as source/activity rows.
- SSE fallback does not throw if stream is unavailable.
- "Continue in Chat" deep links to the thread.
- Cancel uses existing cancel API only when a run id exists.

### Phase 5: Work/Artifact Viewer Integration

Required tests:

- Recent saved work link points to `/v2/work?item=...&artifact=...`, without
  `/v2/v2`.
- Workbench artifact preview opens from local saved work.
- Empty saved work shows honest empty state.
- Generated file artifacts do not show raw base64 as the visible body.

### Phase 6: Onboarding And Connections Buildout

Required tests:

- Existing onboarding tests still pass.
- Onboarding copy points to private workbench, sources, and approvals.
- NEAR AI ready badge remains gated on real auth, not pre-auth configured.
- Connector step uses current registry readiness.
- "Skip for now" lands on the current real starting route.
- "Connect source" routes to registry/setup without duplicating fake OAuth.

### Phase 7: Visual QA And Bundle

Run:

```sh
node --test crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-plan.test.mjs
npx playwright test --config playwright.static.config.ts tests/static/workbench-static.spec.ts
npm run test:static
npm run test:a11y-static
npm run check:static-bundle
npm run lint:static-copy
npm run smoke:webui-static
git diff --check
```

Only after source tests pass, regenerate the static bundle using the repo's
existing static preparation command. Then rerun the focused Workbench Playwright
spec and `npm run smoke:webui-static`.

## Cursor Work Packages

These work packages are separable enough for Cursor to implement and validate
without stepping on unrelated agent work. Keep each package small, tested, and
reviewable.

### Work Package 0: Baseline Proof And Guardrails

Primary files:

- `tests/static/workbench-static.spec.ts`
- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-plan.test.mjs`
- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/workbench-page.js`

Do:

- Record current route behavior for `/v2/workbench` and `/v2/`.
- Confirm Workbench is the default replacement surface and not nested in the
  legacy Chat shell.
- Add failing tests before visible taxonomy or fake readiness can creep in.
- Preserve current Chat send handoff.

Do not:

- Regenerate bundles.
- Touch unrelated design sidecar files.
- Add a mock backend.

Acceptance:

- Existing Workbench tests pass before and after the package.
- A test fails if visible first-screen chrome includes a department/function
  picker.
- A test fails if all visible suggestions are legal/document examples.

### Work Package 1: Natural Composer And Request Packaging

Primary files:

- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/workbench-composer.js`
- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/workbench-model-controls.js`
- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-request.js`
- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/workbench-page.js`
- `tests/static/workbench-static.spec.ts`

Build:

- Large, calm composer with the approved placeholder.
- Adaptive primary action label.
- Model chip/control from current Settings/Chat state.
- Effort segmented control.
- Source scope selector.
- Cadence/due-date chip that packages preference without pretending to schedule.
- Attachment button only if real plumbing exists; otherwise disabled with honest
  title/copy.
- Request packaging that includes original wording, model, effort, source scope,
  cadence, assumptions, attachments, and approval boundaries.

Visible behavior:

- The user types ordinary language.
- The app never asks for JSON, workflow ids, routing syntax, or prompt
  boilerplate.
- The first action is always to ask/prepare/research/review, not to choose a
  function.

Acceptance:

- Empty send stays on Workbench and shows a focused error.
- Non-empty send reaches existing Chat message API in tests.
- Payload includes model/effort/source/cadence preferences.
- 390px viewport has no horizontal overflow.
- Primary controls meet tap target requirements.

### Work Package 2: Adaptive Suggestions And Work Rail

Primary files:

- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/workbench-rail.js`
- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/workbench-suggestions.js`
- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-suggestions.js`
- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-work-items.js`
- `tests/static/workbench-static.spec.ts`

Build:

- Suggestion ranking from active approvals, blocked work, scheduled work, recent
  work, saved preferences, and fallback prompts.
- Work rail grouped by state, not department.
- Recent saved work from the existing saved-work helpers.
- Empty state that invites asking or connecting sources.

Visible behavior:

- Suggestions sound like actions:
  - "Review the pending send."
  - "Summarize what changed overnight."
  - "Prepare the Friday brief."
  - "Continue the launch checklist."
- Suggestions do not appear as "Finance", "Legal", "Engineering", or similar
  category cards.

Acceptance:

- Suggestion fixture with mixed hidden domains renders action-language labels.
- Work rail renders needs-review, blocked, working, ready, scheduled, and recent
  states.
- Empty state has no fake inbox/work contents.

### Work Package 3: Source Readiness And Inspector

Primary files:

- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/workbench-source-picker.js`
- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/workbench-source-inspector.js`
- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-source-readiness.js`
- `crates/ironclaw_webui_v2_static/static/js/pages/extensions/lib/registry-catalog.js`
- `crates/ironclaw_webui_v2_static/static/js/pages/extensions/lib/registry-readiness.js`
- `tests/static/workbench-static.spec.ts`

Build:

- Source picker powered by real connector/readiness state.
- Source inspector with states: read, reading, partial, skipped, blocked, needs
  reconnect, catalog unavailable.
- Include/exclude source controls.
- Reconnect/setup CTAs through existing registry/setup paths.

Visible behavior:

- A blocked source is local to the relevant task.
- The top of the app does not say "sources connected."
- Sources are grouped by readiness/type, not by the user's business function.

Acceptance:

- Gmail/Google config blocker routes to real settings/setup.
- Slack reconnect state is honest.
- Notion token-needed state is honest.
- Built-in web/workspace readiness does not require fake install state.

### Work Package 4: Active Run View Over Chat

Primary files:

- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/workbench-run-view.js`
- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-thread-adapter.js`
- `crates/ironclaw_webui_v2_static/static/js/lib/api.js`
- `tests/static/workbench-static.spec.ts`

Build:

- Read-only run workspace over existing Chat threads/timeline.
- Tabs: Plan, Sources, Findings/Readout, Draft/Artifact/Output, Activity.
- Assumption strip.
- Source strip.
- Continue in Chat action.
- Cancel only when a real run id exists.

Visible behavior:

- "Reading Gmail and Drive" style progress.
- Partial failures explain what worked and what did not.
- Chat remains the runtime; Workbench is the professional workspace view.

Acceptance:

- Timeline messages populate Activity.
- Tool activity can populate Sources/Activity rows when available.
- SSE unavailable state does not crash.
- Continue in Chat deep link opens the thread.

### Work Package 5: Review And Approval Packages

Primary files:

- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/workbench-approval-summary.js`
- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-approval.js`
- `crates/ironclaw_webui_v2_static/static/js/lib/api.js`
- `tests/static/workbench-static.spec.ts`

Build:

- Approval summary for frozen action, destination, recipients, data movement,
  source evidence, assumptions, and "nothing sent yet."
- Edit/regenerate/re-arm behavior.
- Gate resolution through existing API only.
- Receipts that name what happened and what did not happen.

Visible behavior:

- No "custody record" wording.
- No generic "authorize external action" copy when the user needs plain
  consequence copy.
- Approval appears at consequence, not as permanent decorative chrome.

Acceptance:

- Editing a draft invalidates prior approval.
- Approval tests cover email, Slack post, sharing/export, scheduled monitor, and
  public/account-growth actions.
- Receipts do not claim action before backend confirmation or explicit test
  simulation.

### Work Package 6: Artifact And Work Viewer

Primary files:

- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/workbench-artifact-viewer.js`
- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/workbench-library.js`
- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-artifacts.js`
- Existing Work reader modules under `crates/ironclaw_webui_v2_static/static/js/pages/work/`
- `tests/static/workbench-static.spec.ts`

Build:

- Real artifact/reader area that can hold briefs, reply batches, memos, lists,
  research, evidence tables, and review packages.
- Work Library/search entry points using existing saved work.
- Link format `/v2/work?item=...&artifact=...`, avoiding `/v2/v2`.
- Honest empty and unsupported-format states.

Visible behavior:

- Redlines/document editing is one possible artifact type, not the central
  metaphor.
- Research, release risk, interview packet, customer replies, and monitor plans
  all have plausible artifact layouts.

Acceptance:

- Saved work opens in reader.
- Empty saved work is honest.
- Raw encoded file data is never visible as the artifact body.

### Work Package 7: Onboarding And Connections

Primary files:

- Existing onboarding modules under `crates/ironclaw_webui_v2_static/static/js/pages/onboarding/`
- Existing Extensions/registry modules under `crates/ironclaw_webui_v2_static/static/js/pages/extensions/`
- `crates/ironclaw_webui_v2_static/static/js/pages/settings/lib/settings-api.js`
- Existing onboarding/static tests.

Build:

- Onboarding that explains private work, model readiness, source connection,
  approval before external action, and Workbench as an adaptive desk.
- Connection setup powered by real registry readiness.
- Blocked model/source states that route to setup.

Visible behavior:

- No fake connected-source count.
- No source shelf in the top chrome unless something needs attention.
- No "pick your department" onboarding step.

Acceptance:

- Existing auth-readiness tests still pass.
- NEAR AI ready state is not shown before auth is proven.
- "Skip for now" lands on a real route.

### Work Package 8: Scenario Coverage Fixtures

Primary files:

- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-scenarios.js`
- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-scenarios.test.mjs`
- `tests/static/workbench-static.spec.ts`

Build:

- Hidden fixture corpus for the twelve end-to-end flows above.
- Fixture metadata for hidden domain, sources, expected artifact type,
  approval boundary, and blocked-source behavior.
- No direct rendering of hidden domain labels on the default home.

Acceptance:

- Corpus covers at least five hidden domains.
- Legal/document examples are less than half of the corpus.
- Each fixture maps to the same domain-neutral work item model.
- A static test fails if fixture domain names are rendered as first-screen
  category labels.

### Work Package 9: Visual QA And Screenshot Pack

Primary files:

- `tests/static/workbench-static.spec.ts`
- Screenshot output under `docs/screenshots/workbench-buildout-2026-06-19/`

Build:

- Desktop and mobile screenshot states.
- Source inspector open.
- Active run with assumptions/source strip/output.
- Approval package with "nothing sent yet."
- Connections/setup state.
- Onboarding state.
- Work reader state.

Acceptance:

- Screenshots are captured from an allowed preview route.
- No horizontal overflow at 390px.
- No clipped composer text, hidden buttons, or overlapped panels.
- Console errors are zero or documented with a real existing issue.

### Work Package 10: Copy Contract

Primary files:

- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-copy.js`
- `tests/static/workbench-copy.test.mjs`
- `npm run lint:static-copy` configuration if applicable.

Build:

- Centralize Workbench microcopy where practical.
- Ban or flag known-bad terms:
  - custody record
  - trust ledger
  - self-learning loop detected
  - choose workflow
  - prompt engineering
  - inferred domain
  - sources connected
- Prefer the Surface Copy Matrix.

Acceptance:

- Copy tests fail on banned visible strings.
- Required strings fit mobile controls.
- Error/blocker text leads with user consequence.

## Screenshot Requirements

Capture at minimum:

- Workbench home, desktop.
- Workbench home, 390px mobile.
- Workbench home with natural-language composer populated and adaptive
  suggestions visible.
- Workbench source inspector open.
- Workbench active run showing assumptions, source strip, and output tab.
- Approval package showing frozen action, destination, data movement, and
  "nothing sent yet" copy.
- Chat handoff composer populated.
- Chat send request mocked/proven in Playwright.
- Connections source setup with one ready and one blocked source.
- Onboarding first-run model setup.
- Work reader opened from a saved Workbench artifact.

Save screenshots to a predictable folder, for example:

`docs/screenshots/workbench-buildout-2026-06-19/`

Do not call the design ready if screenshots cannot be captured.

## Acceptance Criteria

The build is acceptable only when:

- The Before Main Maintainability Gate is complete or every incomplete split is
  explicitly marked as a blocked/deferred backend/API dependency.
- It can render `/workbench` directly in the static app.
- It has no console errors on the Workbench route.
- It has no horizontal overflow at 390px.
- Workbench send reaches the existing `/threads/:id/messages` API in tests.
- Model and effort preferences are included in the sent request or sent as real
  backend metadata if the backend supports that by then.
- Source controls map to current connector ids and readiness.
- Disconnected/blocked sources are honest and actionable.
- The Workbench route remains the default replacement surface.
- Onboarding still passes current auth-readiness tests.
- Work/Library opens actual saved work data instead of dummy cards.
- Approval UX never implies an external action has happened until the backend
  confirms it or a mocked test explicitly simulates it.
- Copy avoids the banned phrases listed above.
- The composer placeholder, suggestion labels, clarification copy, assumption
  copy, source blocker copy, approval copy, and receipt copy follow the Surface
  Copy Matrix.
- Natural-language asks are accepted as written, then packaged with structured
  model/effort/source/cadence preferences for Chat.
- The interface never asks the user to write JSON, choose a workflow id, or
  prompt-engineer around product limitations.
- The underlying scenario corpus covers at least five business functions.
- The default Workbench surface does not list business functions as a picker,
  menu, or department taxonomy.
- Legal/document scenarios are less than half of the underlying example corpus.
- Default UI nouns are domain-neutral: work item, source, artifact, approval,
  receipt, routine, monitor, preference.
- Domain-specific workflows all use the same shell and state model.
- Suggestions adapt to personal context when available and fall back to
  domain-neutral action prompts when no context exists.
- Every screen in the Screen-Level Functional Specification has at least one
  focused source/unit/render test or an explicit documented deferral with the
  missing backend/API named.

## Cursor Prompt

Use this as the exact assignment:

```text
You are Cursor working in the IronClaw Desktop repo at:
/Users/abhishekvaidyanathan/Documents/Playground/ironclaw-desktop-app-main

Goal:
Build out the Workbench UX and adjacent screens so the product starts to match
the private professional workbench direction. It must be generalizable across
finance, legal, operations, engineering, product, people, sales/GTM, customer
success, marketing, executive/staff work, security/compliance, research, and
general admin, but those functions are internal validation coverage. The
default surface should feel like a personal chief of staff adapting to the
individual user's work, not a department directory. The way users ask should be
natural, calm, and beautiful: ordinary language in, clear prepared work out,
with assumptions and approvals shown plainly. Use v13 for the current
first-screen design profile, v12/v11/v10 for mature state shape and live
behavior, v9 for visual discipline, v8 for broad workflows, and the current real
Workbench replacement route for model/effort/source controls and runtime
handoff.

Hard constraints:
- Do not create fake backend endpoints.
- Do not re-hide `/workbench` or demote it back to a QA-only route.
- Do not claim connectors, sources, models, receipts, memory, or artifacts are
  ready unless current app state proves it.
- Do not build a legal/redline-first product. Legal is one domain in a general
  business workbench.
- Do not show a business-function picker on the default surface. Personal
  suggestions and active work matter more than taxonomy.
- Do not show department tabs, function cards, persona pickers, or workflow
  template galleries as the first-screen organizing model.
- Do not ship command-line, workflow-builder, JSON, or prompt-engineering copy
  in the normal Workbench surface.
- The hidden scenario corpus must span at least five business functions, and
  legal/doc examples must be less than half of it.
- Do not regress onboarding auth readiness.
- Do not regenerate main.bundle.js or generated CSS until source tests pass.
- Preserve unrelated dirty work. Do not revert user or other-agent changes.

Primary files to study first:
- docs/design/cursor-workbench-buildout-instructions-2026-06-19.md
- /Users/abhishekvaidyanathan/Desktop/private-workbench-v13.html
- /Users/abhishekvaidyanathan/Desktop/private-workbench-v12.html
- /Users/abhishekvaidyanathan/Desktop/private-workbench-v11.html
- /Users/abhishekvaidyanathan/Desktop/private-workbench-v10.html
- /Users/abhishekvaidyanathan/Desktop/private-workbench-v9.html
- /Users/abhishekvaidyanathan/Desktop/private-workbench-v8.html
- crates/ironclaw_webui_v2_static/static/js/pages/workbench/workbench-page.js
- crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-plan.js
- tests/static/workbench-static.spec.ts
- crates/ironclaw_webui_v2_static/static/js/pages/extensions/lib/registry-catalog.js
- crates/ironclaw_webui_v2_static/static/js/pages/extensions/lib/registry-readiness.js
- crates/ironclaw_webui_v2_static/static/js/lib/api.js
- crates/ironclaw_webui_v2_static/static/js/pages/settings/lib/settings-api.js

Implementation path:
1. Complete the Before Main Maintainability Gate: split the mega Workbench page,
   scene registry, request/model adapter, styles, packet/work viewer model,
   workspace-file adapter, and test harness before claiming the scaffold is
   ready for main.
2. Upgrade the Workbench home composer using the Natural Language Asking,
   Surface Copy Matrix, and Screen-Level Functional Specification sections,
   plus v12/v11's stronger state model, v9's quiet shell, v8's broad workflow
   set, and current replacement model/effort/source controls.
3. Wire source readiness to the existing connector catalog/readiness model.
4. Build a Workbench run view as an adapter over existing Chat threads and
   timeline events. Do not invent a second runtime.
5. Integrate saved Work artifacts through the current Work reader links and
   local saved-work helpers.
6. Extend onboarding/Connections only through real NEAR AI, registry, and setup
   APIs.
7. Preserve non-legal workflows: research, Slack/email batches, stakeholder
   updates, monitors, channel/account growth, finance notes, engineering triage,
   people/interview prep, customer escalations, and security/compliance
   packages. Redlines are only one workflow.
8. Implement against the End-To-End Natural-Language Flow Fixtures. The
   fixtures are hidden coverage and QA cases, not visible navigation.
9. Follow the Cursor Work Packages so each buildout has file targets, tests,
   and acceptance gates.
10. Add domain coverage tests so the Workbench cannot drift back to a
   legal/document-only product, and add a UI contract that the default surface
   does not expose a department/function picker.
11. Add screen-level tests matching the Screen-Level Functional Specification.
   Each screen must be tested or explicitly marked deferred with the missing API
   named.
12. Add tests first or alongside implementation. Keep tests specific and
   behavior-oriented.

Validation commands:
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

Deliverable:
- Source changes with focused tests.
- A short summary listing what is genuinely wired, what remains staged/blocked,
  and screenshot paths for desktop/mobile/rendered states.
- Explicit note confirming that the visible Workbench examples and tests are not
  over-indexed to redlines/legal work, the scenario corpus covers at least five
  business functions, and the default UI remains a personal/adaptive chief of
  staff surface rather than a department directory.
- Explicit note confirming the composer and suggestions use natural language,
  not workflow ids, JSON, or prompt-engineering instructions.
```

## Known Gaps To Mark Honestly

- There is no first-class Workbench backend endpoint yet.
- Effort is a request preference unless backend metadata support exists.
- Durable memory/self-learning storage is not proven here.
- Live Gmail/Slack/Notion/Drive OAuth success must be proven separately in the
  packaged desktop app.
- Real DOCX redline editing is not available from the current Workbench
  replacement.
- Library receipts are only as real as the current saved work/tool activity data.

Do not paper over these gaps. The product will feel more trustworthy if the UI
states are plain about what is real today and what is waiting on wiring.
