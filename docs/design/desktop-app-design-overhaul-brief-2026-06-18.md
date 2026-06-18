# IronClaw Desktop Design Overhaul Brief

Date: 2026-06-18

Status: planning document, no implementation changes

Audience: product, design, frontend, gateway, QA, and agent contributors working on the desktop app

## Executive Read

The current IronClaw Desktop direction is correct in principle but not yet
convincing in execution. The app should feel like a prepared chief-of-staff
desk: quiet, capable, decisive, and already aware of what matters. Instead,
too much of the surface still reads as a developer shell wrapped around a chat
client. The result is a product that may be more honest than many AI tools, but
does not yet feel desirable, inevitable, or native to the work it claims to do.

This overhaul should not be another broad layer of visual polish. The next pass
must reframe the app around a few durable truths:

1. The front door is not a blank prompt. It is a prepared desk.
2. Chat is an instrument, not the entire product.
3. Agent work must become visible work product, receipts, decisions, and
   follow-ups.
4. Readiness must be proven by the gateway or local contract before the UI
   claims it.
5. The app should feel like a native Mac work instrument, not a generic SaaS
   dashboard, not a lab console, and not a decorative AI landing page.

The design goal is simple to say and hard to fake: when a user opens IronClaw,
they should immediately know what needs them, what IronClaw handled, what is
ready to use, and what can be approved, denied, undone, opened, copied, saved,
or exported.

## Source Material

This brief synthesizes the existing research and design work already in the
repo, especially:

- `DESIGN.md`
- `docs/design/CLAUDE-DESIGN-OVERHAUL-NOTES.md`
- `docs/design/visual-system-spec.md`
- `docs/design/component-grammar.md`
- `docs/design/core-flow-specs.md`
- `docs/design/prepared-desk-ia.md`
- `docs/design/current-surface-truth-map.md`
- `docs/reviews/design-pass-research-synthesis-2026-06-10.md`
- `docs/reviews/design-usability-escalation-2026-06-13.md`
- `docs/reviews/hostile-product-review-2026-06-12.md`
- `docs/reviews/cos-parity-plan-2026-06-14.md`
- `docs/reviews/elite-audit-2026-06-14.md`

It also incorporates the implementation direction that was queued before the
current background-agent work made live UI edits risky: stabilize the main
screen, remove panel collisions, simplify the workbench, protect the composer,
and get screenshot-worthy views without stepping on concurrent design changes.

## Current Problem

### The Product Promise Is Stronger Than The Interface

IronClaw has an unusually good product spine: approval gates, receipts,
generated work product, NEAR AI Cloud as the normal path, local/file honesty,
and exportable artifacts. Those are real assets. But the interface does not yet
make those assets feel like one coherent product.

The main experience still leans toward:

- chat-first framing
- sidebar-heavy app chrome
- generic cards and panels
- readiness badges that compete with each other
- engineering or gateway language
- unclear hierarchy between prompt, work, approvals, and artifacts
- too much surface area exposed before the user has a reason to care

The problem is not that the app lacks features. The problem is that the user
cannot feel, at a glance, that IronClaw is already doing chief-of-staff work.

### The Visual Layer Is Too Generic

The current look has pieces of a design system, but it still risks feeling like
a themed admin console. It needs more taste and less ornament:

- less card piling
- fewer dashboard mosaics
- fewer bordered boxes inside bordered boxes
- tighter typography
- cleaner vertical rhythm
- more confident empty/loading/blocked states
- better use of native Mac conventions
- more restraint around accent color
- real logos and recognizable icons where users need trust
- no decorative blobs, glows, gradients, mascot language, or vague AI sparkle

The target is not "more beautiful" in the abstract. The target is an app that
feels exact, calm, useful, and expensive in the sense that the decisions feel
considered.

### The Reading Experience Is Not Yet Good Enough

The app must be readable before it can be trusted. Several current patterns
make the product harder to understand:

- "Gateway", "operator", "provider", "MCP", "registry", "execution", and
  similar implementation terms leak into user-facing surfaces.
- Empty states explain features instead of preparing the user's next move.
- Status copy sometimes sounds like the app is describing itself rather than
  helping the user act.
- Copy does not consistently distinguish "ready", "checking", "blocked",
  "unavailable on this gateway", and "not connected".
- Labels are sometimes accurate but not humane.

The overhaul needs a copy system as much as a component system.

### Trust Is Present But Scattered

The research repeatedly identifies IronClaw's strongest differentiated assets:
approval gates, action receipts, generated artifacts, and exportable work. But
those assets are scattered across chat, Work, settings, logs, and local state.

The product should gather trust into durable, visible places:

- Needs You: decisions, blocked actions, failed runs, expired auth, connector
  re-auth
- Handled: receipts for what IronClaw did
- Work: artifacts and matter dossiers
- Ledger: queryable proof of agent actions
- Scheduled: what may run later and where it will deliver

Until these are surfaced coherently, IronClaw will feel like a chat app that
occasionally produces good artifacts, not a chief-of-staff desk.

## Design Thesis

IronClaw Desktop is a prepared work desk for a user with an AI chief of staff.
It should not open by asking "What do you want to do?" when it can already show
what moved, what is waiting, and what is ready.

The app should feel like:

- a native Mac command center
- a quiet executive desk
- a durable work ledger
- a serious artifact workspace
- a safe approval cockpit

It should not feel like:

- a generic chatbot
- a provider settings console
- a developer gateway monitor
- a SaaS dashboard demo
- an AI novelty toy
- a static marketing page

## Product Laws

The existing laws remain the right foundation, but the next design pass should
apply them more aggressively.

### 1. Anticipation Over Interrogation

No primary surface should open to a blank prompt if the app has local, gateway,
thread, artifact, automation, or connector state that can prepare a brief.

Design implications:

- The main screen starts with "Needs You", "Handled", and "Ready Work".
- Suggestions are limited and contextual, not generic prompt chips.
- The prompt is present, but not the only thing the screen believes in.
- Returning users should see what changed since they last opened the app.

### 2. Legible Agency

Autonomous or agent-initiated work must be visible, attributed, and reversible
or explicitly irreversible.

Design implications:

- Gold is reserved for IronClaw's hand: generated work, proposed actions,
  receipts, and approval context.
- Every agent action needs a receipt row or ledger entry.
- Approvals must show action, target, data movement, risk, and consequence.
- "Always allow" must remain rare, specific, and revocable.

### 3. One Surface In Focus

Each screen should have one dominant user action. Secondary actions can exist,
but they should not create a wall of equal-weight buttons.

Design implications:

- One blue action per screen or section.
- Buttons should use icons where the command is familiar.
- Settings and Connections should show one next step per card.
- The composer should not compete with a full dashboard of prompt chips.

### 4. Discreet Density

IronClaw should prefer rows, ledgers, gates, compact metrics, and artifact
chips over decorative dashboards.

Design implications:

- Use dense rows for repeating operational objects.
- Use cards only for repeated objects, framed tools, and modals.
- Do not place cards inside cards.
- Avoid giant hero empty states in the product shell.

### 5. Native To The Mac

The app should feel keyboard-first, stable, tactile, and restrained.

Design implications:

- Command palette is discoverable and complete.
- Focus, keyboard traversal, Escape behavior, and restore focus are reliable.
- Modal/popover behavior follows platform expectations.
- Motion is short, functional, and respectful of reduced motion.
- Typography is crisp, compact, and aligned to Mac app norms.

### 6. Honest By Construction

The app must never render capability as ready until the gateway or local
contract proves it.

Design implications:

- No fake connected states.
- No green readiness if the composer says verification pending.
- No connector card implies OAuth/read/write capability without proof.
- No user CRUD or scheduling CRUD controls unless the route exists.
- Every "not available" state names the blocker and the next honest action.

## North-Star Main Screen

The main screen should answer four questions in under 60 seconds:

1. What needs me?
2. What did IronClaw do?
3. What is ready to open, copy, save, or export?
4. What can I ask next?

The screen should not begin with a large generic prompt and a set of broad
suggestions. It should begin as a desk that has been prepared.

### Recommended Main-Screen Structure

Use a three-zone layout on desktop:

1. Left shell: app nav, current account/readiness, recent matters.
2. Center desk: Needs You, Handled, Ready Work, Composer.
3. Right rail or collapsible drawer: artifacts, current matter context,
   connection gaps, and recent receipts.

On smaller widths:

- The right rail collapses into a drawer.
- The left shell becomes a standard drawer.
- Needs You remains first.
- Composer remains reachable without being overlaid or intercepted.

### Main-Screen Priority Order

1. Blocking user decisions
2. Failed or paused work
3. Completed work since last open
4. Saved/generated artifacts
5. Active/scheduled work
6. Recent matters
7. New prompt
8. Generic examples, if nothing else exists

If the app cannot prove any state, it should say that calmly and offer the next
useful action, not fill the screen with pretend activity.

## Information Architecture

### Proposed Top-Level Navigation

Use fewer, clearer surfaces:

- Desk: front door, Needs You, Handled, Ready Work, composer
- Work: saved artifacts, matter dossiers, exports
- Activity: trust ledger, receipts, approvals, agent actions
- Scheduled: recurring or delayed work, read-only until route support exists
- Connections: connected apps, auth, readiness, scopes
- Settings: account, model, app preferences, advanced setup
- Diagnostics: logs and gateway detail, hidden behind advanced/developer mode

Avoid fragmenting the user across "automations", "routines", "logs",
"workspace", "extensions", "providers", and "registry" unless those terms map
to something the user actually intends to do.

### Chat's Role

Chat should remain powerful, but it should not be the app's lobby. It is a
direct conversation instrument for asking, clarifying, and steering work.

Chat should create or update:

- matter state
- approvals
- artifacts
- receipts
- scheduled work
- connection requests
- ledger entries

Important work should not remain buried inside transcript text.

### Work's Role

Work should be more than saved chat output. It should become the durable place
where a matter lives.

Each matter should eventually include:

- objective
- source thread
- files and inputs
- plan or approach
- approvals and boundaries
- generated artifacts
- receipts
- follow-ups
- export history
- unresolved blockers

### Activity's Role

Activity is the trust ledger. It answers: "What did IronClaw do, when, on what,
and with whose approval?"

This surface should be device-scoped if that is all the gateway can prove, with
a clear banner. It should auto-upgrade when server audit routes exist.

### Scheduled's Role

Scheduled is the honest view of future or recurring work. If creation is only
available through agent conversation today, the UI should say so and route the
user to chat. Do not ship fake create/edit/delete controls without route
support.

## Surface Specifications

### 1. Onboarding

Purpose: get the user into a proven NEAR AI Cloud session without provider
sprawl.

Primary user question: "Can IronClaw work for me now?"

Must show:

- NEAR AI Cloud as the normal path
- current sign-in state
- gateway availability
- what is blocked, if blocked
- one primary action
- exact next step after sign-in

Must avoid:

- provider marketplaces
- OpenAI/Anthropic/OpenRouter as normal paths
- raw gateway internals
- permanent setup dashboards
- "ready" labels while verification is pending

Acceptance:

- If NEAR session is proven, onboarding does not reappear.
- If verification is pending, the copy says "checking" or "verification
  pending", not "ready".
- If the gateway is unavailable, the UI says what could not be reached and what
  the user can try.
- The sign-in window wording matches desktop behavior, not browser-only copy.

### 2. Desk

Purpose: the prepared front door.

Primary user question: "What needs my attention?"

Required sections:

- Needs You
- Handled
- Ready Work
- Composer

Optional sections, only when backed by real state:

- Scheduled next run
- Connection required
- Recent matters
- Since you were away

Needs You rows should include:

- type: approval, failed run, auth, connector, blocked export, quota, expired
  permission
- title
- matter/thread
- risk or blocker
- one primary action
- timestamp or age

Handled rows should include:

- gold attribution
- action
- target
- outcome
- timestamp
- source thread or matter
- open/copy/export where relevant

Ready Work should include:

- artifact type
- title or filename
- origin
- preview action
- copy/export/save action
- persistence state

Acceptance:

- A user can locate a pending approval without opening the relevant thread
  first, at least when local state proves it.
- No Needs You row invents missing gate fields.
- Handled receipts are not generic status messages.
- The composer remains usable and is never blocked by rails, overlays, or split
  panes.

### 3. Chat

Purpose: focused conversation and steering.

Primary user question: "Can I ask or clarify something safely?"

Required design direction:

- User messages can use a subtle bubble.
- Assistant output should not look like a generic bubble stack.
- Tool activity collapses to one-line rows by default.
- Generated artifacts are promoted out of the transcript.
- Approvals are compact, explicit, and hard to miss.
- The composer is stable, touch-safe, and keyboard-first.

Must avoid:

- assistant avatars
- "typing" bubbles that imitate consumer chat apps
- chip soup
- raw JSON by default
- full-width diagnostic logs inside the conversation
- burying files and outputs inside long messages

Acceptance:

- Sending, attaching, approving, denying, retrying, copying, exporting, and
  opening artifacts all have visible state.
- Failed send either has a working retry or no retry button.
- Assistant links do not navigate the desktop webview off-shell.
- Loading older history preserves scroll position.
- In-thread find is available with Cmd/Ctrl+F.

### 4. Composer

Purpose: the user's main command input.

Primary user question: "What can I safely send right now?"

Must show:

- input
- attachment controls
- send state
- readable file state
- active model/readiness
- blocked state if the model/gateway cannot accept work

Design direction:

- The composer should be calm, precise, and anchored.
- The send button should be the primary blue action only when sending is valid.
- Attachment chips should show whether IronClaw can read the file.
- The model chip should say the active service plainly, such as NEAR AI Cloud.

Acceptance:

- Send button is not clickable when blocked.
- Attachments do not overflow or cover the input.
- Remove buttons and attachment actions meet touch target requirements.
- Popovers do not trap the user or allow focus to escape behind them.

### 5. Attachments

Purpose: make file handling legible and trustworthy.

Attachment chip states:

- queued
- reading
- readable by model
- preview available
- too large
- unsupported
- failed

For each file, show:

- icon/type
- name
- size
- extraction status
- preview/copy/remove actions as applicable

Acceptance:

- PDF/OCR/DOCX/XLSX/PPTX extraction states are visible.
- "Model can read this file" appears only when text extraction or supported
  handoff is proven.
- Preview while extraction is in progress shows "Reading file..." or equivalent,
  not "No preview available".
- Oversized files provide a useful next action, such as saving to disk.

### 6. Approval Gates

Purpose: stop risky actions until the user explicitly approves.

Primary user question: "What exactly am I allowing?"

Every gate must show:

- action
- target
- what leaves the machine
- destination
- risk
- reversibility or consequence
- Approve
- Deny

Raw parameters:

- available in a collapsed disclosure
- never primary
- never allowed to push approve/deny offscreen on mobile

Acceptance:

- Failed approve/deny requests keep the gate mounted and show inline error.
- Approve/Deny buttons cannot double-submit.
- Unknown tool names are warning/neutral, not green.
- Always-allow is scoped and revocable.
- Cross-thread pending gates appear on Desk when local or server state proves
  them.

### 7. Work Product

Purpose: make generated work durable, inspectable, and exportable.

Primary user question: "Where is the thing IronClaw made?"

Required objects:

- artifact chip
- artifact preview
- save/copy/export controls
- source thread/matter link
- persistence state
- export format list

Work should eventually become Matter Dossier:

- Ask
- Plan
- Approvals
- Receipts
- Outputs
- Sources
- Next steps

Acceptance:

- Generated files do not remain buried inside message text.
- Saved Work is reachable beyond the first page or first 30 items.
- Search covers title and body where local text is available.
- Export/cancel states are honest.
- Rendered preview and exported output match as closely as the format allows.

### 8. Activity / Trust Ledger

Purpose: provide queryable proof of agent actions.

Primary user question: "What did IronClaw do?"

Ledger row fields:

- action
- target
- thread/matter
- approval status
- outbound data
- destination
- timestamp
- artifact link
- risk
- source/proof

Design direction:

- Dense table or row ledger, not a dashboard.
- Gold attribution for agent action.
- Filters for risk, decision, date, destination, matter.
- Search over visible local ledger content.

Acceptance:

- Device-scoped data is labeled as device-scoped.
- No row claims server audit completeness until a server audit route exists.
- Unknown fields show "Not specified" or equivalent, not guessed data.
- Rows deep-link to their origin.

### 9. Connections

Purpose: make app connectivity truthful and actionable.

Primary user question: "What can IronClaw access or do?"

Connector card fields:

- logo or recognizable icon
- app name
- connected account, if proven
- read/write scope
- last checked
- blocker, if blocked
- one next action

Must avoid:

- fake connected states from generic success responses
- raw provider strategy language
- cards with no recovery action
- broad "registry" language in user-facing labels

Acceptance:

- OAuth/readiness proof is backed by response body or capability probe.
- Unknown strategy cards route to Connections with a user sentence.
- Slack or other connectors do not say connected unless proof exists.
- Disabled anchor actions are real disabled buttons or non-clickable links.

### 10. Settings

Purpose: configure the app without turning the product into a provider console.

Primary user question: "What can I change safely?"

Structure:

- Account
- NEAR AI Cloud
- Preferences
- Connections summary
- Advanced

Design direction:

- NEAR AI Cloud normal path stays prominent.
- API-key or provider fallback paths are quiet and advanced.
- Unwritable settings use an honest not-writable state.
- Raw gateway details live in Advanced/Diagnostics.

Acceptance:

- Stubbed user creation does not render a working form.
- Verification states match the composer.
- Settings copy uses product language, not backend language.
- Partial/unavailable features state the route or capability gap in human terms.

### 11. Scheduled

Purpose: show delayed or recurring work honestly.

Primary user question: "What will IronClaw do later?"

Must show:

- schedule
- next run
- last run
- destination
- status
- origin thread
- creation limitation if UI trigger CRUD is unavailable

Acceptance:

- If creation is only supported through chat/agent tools, the page says that.
- No create/edit/delete controls appear without backend routes.
- Empty state says no scheduled work yet, not "all systems ready".
- Last-run status uses gold attribution only when it reflects agent action.

### 12. Diagnostics / Logs

Purpose: help debug without making normal users live in diagnostics.

Design direction:

- Move logs behind advanced/developer affordance if possible.
- Use native confirmation modals for destructive actions.
- Make row layouts mobile-safe.
- Avoid exposing diagnostics as equal-weight navigation to Desk/Work.

Acceptance:

- Logs do not overflow at mobile widths.
- Clear actions use the shared confirm dialog.
- Error states separate user-actionable issues from developer detail.

## Visual System Direction

### Mood

The target mood is "serious Mac work instrument."

Attributes:

- calm
- exact
- dense
- quiet
- native
- prepared
- accountable

Not attributes:

- playful
- magical
- decorative
- dashboardy
- futuristic for its own sake
- generic SaaS
- crypto-console
- developer terminal

### Color

Use a restrained dark neutral foundation. The app should not be dominated by
purple, blue gradients, beige, orange/brown, or glowing decorative effects.

Semantic rules:

- Blue is the user's hand: primary actions, focus, selected state, links.
- Gold is the agent's hand: generated work, proposals, receipts, approval
  context.
- Green is success only when completion is proven.
- Yellow/amber is caution, pending, or needs review.
- Red/pink is danger, failure, or destructive consequence.

Rules:

- One dominant blue action per screen.
- Gold is never decoration.
- Do not use color as the only state cue.
- Do not mix raw Tailwind color fragments with semantic app tokens.
- Avoid opacity aliases that are not guaranteed to compile into real CSS.

### Typography

Use Inter Variable with system fallbacks.

Recommended scale:

- Display: 28px / 600
- Title: 20px / 600
- Section: 16px / 600
- Body: 14px / 450
- Label: 12px / 500
- Micro caps: 11px / 600

Rules:

- No negative letter spacing.
- Do not scale font sizes by viewport width.
- Use tabular figures for numbers, timestamps, counts, and metrics.
- Keep labels short.
- Reserve hero-scale type for true hero moments, not panels or settings pages.

### Geometry

Recommended radius:

- Controls: 6px
- Cards and panels: 12px
- Shells and modals: 16px maximum
- Full circles only for true circular icons or avatars

Rules:

- Cards should not contain other cards.
- Page sections should not look like floating cards.
- Repeated objects may be cards if the card frame clarifies the object.
- Dense rows are preferred for ledgers, lists, approvals, logs, and scheduled
  work.

### Layout

Desktop:

- left nav width is stable
- center surface has a readable max width where text matters
- operational surfaces use full-height layouts with fixed composer or footer
  only when hit testing remains safe
- right rail is optional and collapsible

Mobile/small windows:

- no overlapping rails
- no hidden composer
- no clipped first content
- safe-area insets honored
- touch targets remain at least 44px for primary/destructive/close actions

### Motion

Motion should clarify state change, not entertain.

Use motion for:

- opening drawers
- focusing gates
- moving from receipt to artifact
- showing progress between checking/ready/blocked

Avoid:

- shimmer as content
- indefinite spinners without text
- decorative ambient movement
- large page transitions

Always respect reduced motion.

## Component Grammar

### Artifact Chip

Purpose: make generated or attached work visible and portable.

Fields:

- file type icon
- title or filename
- source
- state
- preview
- copy
- export
- save

States:

- generated
- saved to Work
- exportable
- preview unavailable
- too large for local storage
- source not captured

### Approval Gate

Purpose: present one risky decision with full context.

Fields:

- action
- target
- destination
- data movement
- risk
- consequence
- approve
- deny
- raw parameters disclosure

Tone:

- compact
- explicit
- not alarmist
- never vague

### Receipt Row

Purpose: prove that IronClaw did something.

Fields:

- gold agent marker
- verb
- target
- result
- timestamp
- origin
- artifact/action link

Examples:

- "IronClaw drafted Q3 vendor summary from 4 files."
- "IronClaw prepared a Slack message. Waiting for approval."
- "IronClaw saved the compliance brief to Work."

### Tool Row

Purpose: keep runtime activity legible without flooding chat.

Default:

- one line
- verb, target, status
- expand for details

Avoid:

- long raw logs
- JSON by default
- animated status clutter

### Connector Card

Purpose: show app readiness and one next action.

Fields:

- app logo/icon
- account
- capability
- last checked
- blocker
- action

Rules:

- "Connected" requires proof.
- "Can read" and "can write" are separate.
- Unknown strategy gets a recovery action, not implementation copy.

### Model Chip

Purpose: show model/session readiness without provider sprawl.

Fields:

- NEAR AI Cloud
- model id when useful
- checking/ready/blocked
- manage setup

Rules:

- No non-NEAR providers in the normal path.
- Advanced fallbacks stay in Settings.
- State must match the composer and Desk.

### File Preview Drawer

Purpose: inspect source or output without losing the flow.

Fields:

- metadata
- preview
- extraction/rendering state
- copy/export/save
- source link

Rules:

- Fit mobile.
- Do not render "No preview available" while still reading.
- Always give a next useful action when preview is unavailable.

### Blocked Callout

Purpose: explain one blocker and one next action.

Pattern:

- What is blocked
- Why it is blocked
- What the user can do
- Whether IronClaw will retry automatically

Avoid:

- fake progress
- backend jargon
- multiple primary actions

## Copy System

### Voice

IronClaw copy should be:

- brief
- direct
- specific
- accountable
- non-cute
- non-performative

It should not sound like:

- marketing copy
- a developer console
- a chatbot persona
- a system status page
- a blockchain wallet dashboard

### Vocabulary

Prefer:

- "you"
- "your workspace"
- "IronClaw"
- "NEAR AI Cloud"
- "Connections"
- "Scheduled"
- "Work"
- "Needs You"
- "Handled"
- "Ready Work"
- "Activity"
- "not available on this gateway yet" only when route/capability is truly the
  blocker

Avoid in normal UI:

- operator
- gateway v2
- MCP
- provider marketplace
- execution loop
- registry
- route
- provider
- TEE
- sidecar
- WebUI
- success: true
- raw auth strategy names

### Copy Rewrite Examples

| Current Style | Better Direction |
| --- | --- |
| Gateway ready | NEAR AI Cloud is ready |
| Operator approval required | Review this action |
| Provider configured | Connected to NEAR AI Cloud |
| The WebUI has no renderer for this connector | Finish connecting this in Connections |
| Execution failed | IronClaw could not finish this run |
| No provider available | Sign in to NEAR AI Cloud to start |
| Success | Connected as abhi@example.com |
| Nothing here yet | No work is waiting on you |
| Automations | Scheduled |
| Extensions registry | Connections |

### State Copy Patterns

Ready:

- "Ready"
- "Ready to send"
- "Connected as [account]"
- "Saved to Work"

Checking:

- "Checking NEAR AI Cloud..."
- "Reading file..."
- "Verifying connection..."

Blocked:

- "Sign in to NEAR AI Cloud to send."
- "Reconnect Slack to approve this message."
- "This gateway does not support direct scheduling yet."

Failed:

- "IronClaw could not send this."
- "The approval did not go through. Try again."
- "This file is too large for Work. Save it to disk instead."

Unavailable:

- "Not available on this gateway yet."
- "Server-side audit history is not available yet. Showing actions recorded on
  this device."

## Data Truth And Readiness

### Readiness Ladder

Use one consistent ladder across Desk, Chat, Settings, and Connections:

1. unavailable
2. checking
3. blocked
4. connected but limited
5. ready
6. working
7. complete
8. failed

Each state must have:

- a visual treatment
- copy
- accessibility label
- allowed actions
- forbidden actions
- proof source

### Proof Sources

Acceptable proof sources:

- gateway capability response
- authenticated session response
- connector response body with account/scope proof
- local extraction result
- timeline event
- approval event
- saved artifact record
- automation run record
- local ledger record, labeled as local

Unacceptable proof sources:

- HTTP 2xx alone when body says success false or lacks account proof
- optimistic local state after failed request
- hardcoded "ready" copy
- a stubbed API returning todo/success false
- inferred fields for approval gates
- route existence assumed from UI intent

### Honest Fallbacks

Where the gateway cannot yet support the ideal product, ship honest surfaces:

- read-only Scheduled instead of fake scheduling CRUD
- device-scoped Ledger instead of complete audit log
- loaded-thread search instead of fake server search
- chat-based schedule request instead of direct schedule form
- local saved Work with storage limits instead of pretending cloud persistence

## Interaction Model

### Keyboard

Required:

- Cmd/Ctrl+K command palette
- Cmd/Ctrl+F in-thread find
- Escape closes modal/popover/drawer
- Tab order stays inside open modal/dialog
- focus restores to trigger
- approval buttons reachable and announced
- composer shortcut does not conflict with browser/system behavior

### Pointer And Hit Testing

The composer is sacred. Nothing should intercept its clicks unless a modal is
intentionally open.

Avoid:

- absolute panels layered over composer hit areas
- split panes that cover the send button
- invisible overlays after drawer close
- popovers clipped by parent overflow
- buttons inside links

### Mobile And Small Windows

Requirements:

- 44px touch targets for primary, destructive, close, remove, send, approve,
  deny, and menu actions
- no horizontal overflow for logs, ledger, settings, or connector rows
- safe-area top/bottom padding
- top content not clipped by centered scroll containers
- composer visible and tappable
- drawers close on navigation

### Accessibility

Required:

- named dialogs
- correct combobox/listbox semantics for command palette
- popover focus trap/restore where role=dialog is used
- role=alert for errors
- persistent live region for toasts
- `dir=rtl` for Arabic if Arabic remains available
- color-independent state indicators
- reduced-motion compliance

## Immediate Screenshot-Readiness Fixes

These are the fixes I would prioritize before capturing final screenshots of
the new design, once the background agents stop touching the same files.

### 1. Protect The Composer

Problem: recent layout/workbench changes risk panels or rails intercepting
clicks meant for the composer and send button.

Design requirement:

- Composer sits above ordinary layout layers.
- Rails/drawers never overlap active hit targets.
- Any overlay that blocks the composer must be visibly modal and dismissible.

Acceptance:

- Click and keyboard send work at desktop and mobile widths.
- Attachment menu opens and closes without leaving an invisible blocker.
- The send button can be targeted reliably in Playwright.

### 2. Stabilize The Main Desk

Problem: the main screen needs to look intentional before screenshots. If the
first viewport is a card pile, a generic prompt page, or a cramped split-pane
view, the design will keep feeling wrong.

Design requirement:

- Needs You first.
- Handled and Ready Work visible without scrolling on common desktop heights.
- Composer present but not dominating.
- Right rail collapses cleanly.

Acceptance:

- 1440x900 screenshot communicates the product promise in one glance.
- 1280x800 remains usable.
- 390x844 mobile screenshot has no overlap and preserves hierarchy.

### 3. Remove Card-On-Card Density

Problem: nested framed surfaces make the app feel heavier and more generic.

Design requirement:

- Page sections are unframed or banded.
- Repeated objects can be framed.
- Modals/drawers can be framed.
- Avoid cards inside cards.

Acceptance:

- Main screen can be scanned vertically.
- No more than one frame surrounds a given repeated object.
- Borders are used to clarify, not decorate.

### 4. Rationalize The Workbench/Rail

Problem: a workbench rail can be valuable, but if it behaves like a second app
inside chat it confuses the main action.

Design requirement:

- The rail is for artifacts, current matter, and recent receipts.
- It collapses cleanly.
- It does not duplicate Desk.
- It never owns primary navigation.

Acceptance:

- Rail closed: chat/desk still complete.
- Rail open: artifact preview and receipt context are useful.
- Mobile: rail becomes a drawer, not a squeezed column.

### 5. Align Readiness Copy

Problem: the same screen can show a positive "ready" brief and a caution
"verification pending" chip.

Design requirement:

- A single readiness source feeds Desk, Composer, Settings, and Onboarding.
- Positive readiness appears only when verified.

Acceptance:

- No contradictory green/amber states on the same screen.
- Copy names the same service the same way everywhere.
- Blocked send state is obvious.

## Implementation Plan

### Phase 0: Freeze, Inventory, And Screenshot Baseline

Goal: avoid agent collisions and capture the actual starting point.

Actions:

- Pause broad UI edits or work on a branch/worktree dedicated to the overhaul.
- Capture screenshots of current main screen, chat with messages, approval
  gate, Work, Connections, Settings, mobile main, and mobile chat.
- Record console errors and layout overlaps.
- Run existing static smoke/design/a11y checks.
- List which files are actively owned by other agents.

Deliverables:

- screenshot contact sheet
- issue map
- ownership map
- "do not touch" list

Acceptance:

- No accidental edits to generated bundles or agent-owned files.
- Baseline screenshots exist before changes.

### Phase 1: Foundation Cleanup

Goal: make the shell and visual system coherent before changing product flow.

Actions:

- Tighten typography scale and spacing.
- Remove negative letter spacing if present.
- Normalize radius, borders, and semantic colors.
- Remove decorative gradients/glows/blobs.
- Audit card nesting.
- Ensure CSS aliases used by JS actually exist in generated/static CSS.
- Establish tokens for Desk, Work, Activity, Gate, Receipt, Artifact, Blocked.

Deliverables:

- updated visual tokens
- cleaned shell components
- design-system contract tests for key classes

Acceptance:

- No unmapped status/alias classes in shipped JS.
- One accent-blue primary action per main surface.
- Gold appears only on agent/provenance surfaces.

### Phase 2: Prepared Desk

Goal: make the main screen the product's strongest first impression.

Actions:

- Build Desk around Needs You, Handled, Ready Work, and Composer.
- Feed with proven local/gateway state.
- Add honest empty states.
- Add "since you were away" only where last-seen and source records support it.
- Add cross-thread pending gates where local state proves them.

Deliverables:

- desktop Desk layout
- mobile Desk layout
- empty/loading/blocked states
- screenshot matrix

Acceptance:

- Cold open answers what needs the user.
- Returning user sees meaningful recent activity when available.
- Nothing is invented to make the desk look busy.

### Phase 3: Chat And Composer

Goal: make conversation feel like an instrument for work, not a consumer chat
clone.

Actions:

- Simplify assistant message presentation.
- Collapse tool steps by default.
- Replace typing bubble idioms with quiet working rows.
- Stabilize composer hit testing.
- Improve attachment chips and extraction states.
- Add in-thread find.
- Ensure failed-send retry is either working or hidden.

Deliverables:

- improved chat transcript grammar
- composer state matrix
- attachment preview/drawer states
- find-in-thread interaction

Acceptance:

- Send, attach, preview, approve, deny, copy, export, and retry have reliable
  states.
- Chat screenshots show work surfaces, not a bubble wall.

### Phase 4: Work Product And Matter Dossiers

Goal: make outputs durable and inspectable.

Actions:

- Promote artifacts into chips/rail/drawer.
- Improve Work search and pagination.
- Fill existing dossier fields from timeline/gates/tool activity where possible.
- Add source chips only when source events exist.
- Make export/cancel/too-large states honest.

Deliverables:

- artifact rail/drawer
- Matter Dossier view
- Work search improvements
- export proof screenshots

Acceptance:

- A generated artifact can be found, previewed, saved, copied, and exported.
- Work items do not disappear because of arbitrary list limits.
- Dossier sections do not hallucinate missing data.

### Phase 5: Activity And Scheduled

Goal: surface trust and proactivity without fake autonomy.

Actions:

- Add or refine device-scoped Activity ledger.
- Promote read-only automations into Scheduled if list routes exist.
- Add honest gateway-gap banners for audit, scheduling CRUD, and server search.
- Link receipts back to origin threads and artifacts.

Deliverables:

- Activity ledger
- Scheduled read-only view
- gateway-gap copy

Acceptance:

- Ledger never claims server completeness without a server route.
- Scheduled never shows create/edit/delete unless routes exist.
- Receipts are searchable/filterable enough for trust review.

### Phase 6: Connections And Settings

Goal: reduce setup anxiety and provider-console feeling.

Actions:

- Rename and simplify connection surfaces.
- Use real logos/icons.
- Make each connector card show one next action.
- Hide advanced provider/API-key fallbacks.
- Gate unwritable/stubbed settings honestly.
- Align NEAR AI Cloud readiness copy everywhere.

Deliverables:

- Connections card grammar
- simplified Settings IA
- blocked/unavailable copy set

Acceptance:

- User knows what is connected and what IronClaw can do with it.
- No fake connected or fake user-management form.
- Settings no longer competes with the main product.

### Phase 7: Verification And Polish

Goal: make screenshots and tests prove the design.

Actions:

- Run desktop and mobile screenshot matrix.
- Run static smoke tests.
- Run a11y checks for shell, Desk, Chat, gates, popovers, settings.
- Run keyboard-path checks.
- Check text overflow and hit targets.
- Check color/token usage.
- Review copy against banned vocabulary.

Deliverables:

- screenshot contact sheet
- QA checklist results
- remaining issue list

Acceptance:

- Main screen, chat, approval gate, Work, Connections, Settings, and mobile
  views are screenshot-worthy.
- No major overlap, clipping, invisible overlay, or contradictory readiness.

## Screenshot Matrix

Capture these before sign-off:

Desktop:

- 1440x900 Desk, signed in, no pending work
- 1440x900 Desk, Needs You + Handled + Ready Work populated
- 1440x900 Chat with assistant answer, tool rows, and artifact
- 1440x900 Approval gate
- 1440x900 Attachment preview/extraction
- 1440x900 Work item / artifact preview
- 1440x900 Matter Dossier
- 1440x900 Connections with connected, blocked, and unavailable cards
- 1440x900 Settings NEAR AI Cloud
- 1440x900 Scheduled read-only
- 1440x900 Activity ledger

Compact desktop:

- 1280x800 Desk
- 1280x800 Chat with rail open
- 1280x800 Work

Mobile:

- 390x844 Desk
- 390x844 Chat/composer
- 390x844 Approval gate
- 390x844 Attachment chips
- 390x844 Work preview
- 390x844 Connections

Interaction screenshots:

- command palette open
- model popover open
- connector menu open
- file preview drawer open
- error toast/alert
- blocked callout

Screenshot acceptance:

- no overlapped text
- no clipped primary actions
- no invisible overlays
- no card-on-card pileups
- no more than one dominant blue action
- gold only where IronClaw acted or proposed action
- all visible copy uses product language

## Design QA Checklist

### Product Clarity

- The first screen answers what needs the user.
- The app does not open to a blank prompt when useful state exists.
- Generated work is promoted out of chat.
- Approvals are visible before risky actions.
- Receipts are visible after agent actions.
- Work can be found after it is saved.

### Honesty

- No fake connected states.
- No fake ready states.
- No fake create/edit/delete controls.
- No inferred approval fields.
- No success toast on canceled save.
- Device-scoped data is labeled device-scoped.
- Missing gateway capability is stated as unavailable, not simulated.

### Visual

- Typography is tight and readable.
- No negative letter spacing.
- No decorative gradients/blobs/glows.
- No nested cards.
- Accent blue is controlled.
- Gold is reserved for agent agency.
- Density feels operational, not cramped.

### Copy

- No "operator" in normal UI.
- No "gateway v2" in normal UI.
- No "provider marketplace" in normal UI.
- No raw implementation strategy language.
- State copy names the blocker and next action.
- Empty states are quiet and useful.

### Interaction

- Composer can always be clicked/tapped when no modal is open.
- Popovers trap/restore focus when dialog-like.
- Escape closes overlays.
- Drawer closes on navigation.
- Cmd/Ctrl+K works.
- Cmd/Ctrl+F works inside thread.
- Approve/Deny cannot double-submit.

### Accessibility

- Dialogs have names.
- Menus have keyboard behavior.
- Command palette has combobox/listbox semantics.
- Error toasts use assertive live regions.
- Arabic uses RTL if shipped.
- Hit targets meet 44px where required.
- Reduced motion is honored.

### Responsive

- 390px width has no horizontal overflow.
- Composer avoids bottom safe-area obstruction.
- Sidebar/header respect top safe area.
- Logs/ledger tables stack or scroll intentionally.
- Right rail collapses into drawer.

## Priority Backlog

### P0: Must Fix Before Design Screenshots Matter

- Composer hit testing and overlay collisions
- contradictory readiness states
- main Desk hierarchy
- nested card pileups
- approval gate reliability states
- assistant link safety
- fake connected/stubbed settings controls
- mobile clipping and 44px touch issues on destructive/primary actions

### P1: Core Overhaul

- Prepared Desk
- artifact rail/drawer
- receipt row grammar
- one-line tool rows
- Work search/reachability
- in-thread find
- Connections card truth
- Settings simplification
- Scheduled read-only surface
- Activity ledger

### P2: Differentiators

- Matter Dossier
- server-sensed "since you were away"
- cross-thread Needs You with server stream when available
- server audit read route
- server conversation/work search
- durable memory route
- direct scheduling CRUD

## Backend And Gateway Asks

The design can be honest with current constraints, but the ideal product needs
gateway support.

Needed routes/capabilities:

- automation trigger CRUD for direct Scheduled create/edit/delete
- audit-read endpoint for complete Trust Ledger
- server-side conversation and artifact search
- durable memory/matter route
- connector activity feed or server activity history
- default outbound delivery target provider for scheduled work
- persisted summary artifact reader

Until these exist, the UI should ship honest local/device-scoped variants and
clear gateway-gap copy.

## Non-Goals

This overhaul should not:

- reintroduce provider sprawl into the normal path
- make a landing/marketing page inside the app
- invent readiness to make screenshots look alive
- bury work inside chat transcripts
- use decorative AI theming
- expose logs and diagnostics as first-class user workflows
- rebuild the design by editing generated bundles directly
- hand-roll visual complexity while background agents are modifying the same
  files

## Final Design Bar

The redesign is successful when IronClaw Desktop feels like a serious assistant
that already prepared the desk before the user arrived.

The user should not have to decode the app. They should not wonder whether the
model is ready, whether a connector is real, whether a file was read, whether a
message will leave the machine, whether an approval succeeded, where an output
went, or what IronClaw did while they were away.

The interface should make the answer visible.

If the app can prove it, show it clearly. If it cannot prove it, say so
calmly. If the user needs to decide, put that decision at the top.
