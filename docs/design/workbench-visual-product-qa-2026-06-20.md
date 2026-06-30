# Workbench Visual / Product QA

Date: 2026-06-20
Reviewer: Worker F (design critic / product coherence), read-only pass.

## Verdict

The backend honesty is good. State rail, source readiness, model catalog,
artifact preview, and banned-copy are all real or honestly empty
(`workbench-state.js`, `useWorkbenchSourceReadiness.js`, `workbench-work-items.js`).
Nothing here is fake-receipt or fake-connector territory.

The product *coherence* is improving but not good enough yet. Loop 9 removed the
worst first-visit issue: the blank home no longer permanently mounts the empty
review console or local-files drawer. Loop 10 made the saved-work viewer labels
type-aware (`Summary`, `Reply`, `Context`, `Research`, `File`, fallback
`Output`) instead of fixed `Artifact / Draft / Sources` packet chrome. Loop 11
removed the redundant top-bar source shield, demoted non-writable Memory out of
primary Workbench nav, and made the source inspector a live readiness panel
instead of static boundary theater. Loop 12/13 fixed the biggest visual-system
regression: Workbench now has app-grade font tokens, no Georgia/Times command
or packet chrome, a scoped dark theme, and a mobile composer that no longer
shows immediate browser resize/scroll artifacts. The saved-work body layouts
still need artifact-type-specific structure before the product can feel
generalizable across legal, finance, ops, engineering, people, and research.

Severity legend: blocker = must fix before main; high = fix this loop; medium /
low = polish.

---

## 1. (RESOLVED IN LOOP 9) Empty document/review console is permanently mounted on the home screen

`workbench-page.js:106-124` `HomeView` always renders `WorkPacketPreview`
unconditionally. With zero saved work (new user, or any returning user with no
artifacts), `buildPacketModel([])` returns `title: 'Workspace viewer'`,
`stateLabel: 'No saved artifact yet'` (`workbench-packet.js:58,94`) and the user
sees a full 5-tab console — Overview / Artifact / Draft / Sources / Activity
(`workbench-packet.js:13-19`) — with every tab empty ("No saved artifact
content is available yet", "No response draft or notes are saved", "Sources will
populate from...", "No activity receipts are saved").

This is the single biggest miss against intent. v9's governing rule is "the
shell is quiet; the command is obvious; the artifact gets the room; approval
interrupts only at the moment of consequence" (v9 lines 13-14). v13's home
renders ONLY command + state-ranked triage (v13 `renderHome`, lines 581-600);
the packet/document workspace is a *separate scene* reached by opening a work
item (v13 `renderPacket`), never mounted empty on home. The current build
inverts this: a returning user with no work lands on command box → mostly-empty
triage groups → a permanently-present empty document/review desk → an empty
"Local files" drawer. That is exactly the "tired, boring, legal-indexed" surface
the user is unhappy about.

Correction (preserves honesty): in `HomeView`, only render `WorkPacketPreview`
when there is a real reviewable artifact (`buildPacketModel(savedItems).hasArtifact`),
or when a started-work scene exists. Otherwise render nothing there, or a single
quiet empty line. The packet console belongs behind a work-item open, matching
v13. Block main.

Resolution: Loop 9 made `HomeView` render `WorkPacketPreview` only when saved
items contain a real reviewable artifact (`firstArtifact(item)`). Browser proof
under `/tmp/ironclaw-workbench-iab-2026-06-20T03-04-loop9/` shows a blank
Workbench home with `workbench-document-workspace` count `0` on desktop and
mobile. Static route tests also assert the blank home has no packet workspace,
while seeded saved-work tests still render the real artifact review surface.

## 2. (PARTIALLY RESOLVED IN LOOPS 9-10) Saved-work viewer is less legal, but still too packet-shaped

The packet shell's tab metaphor — "Artifact / Draft / Sources / Activity" with a
"vN" version badge (`workbench-packet.js:148-174`), a "Review checklist" gated on
"Artifact reviewed / Draft reviewed" (`workbench-packet.js:216-252`), an "appbar"
that says "View Chat handoff", and an `ApprovalModal` with a "Saved snapshot - vN"
frozen-package `dl` (`workbench-packet.js:448-539`) — is a near-direct port of
v13's Northwind MSA redline packet (v13 `renderPacket`/`tabContent`, lines
672-758: liability cap, net 45, §4.1/§12.2/§13.4 clauses, "Open redline
workspace"). The nouns were neutralized to "Artifact/Draft", but the *shape* is
still a single-document send-review console. The runbook is explicit: legal/
redline is one stress test, "Do not make this a legal-only app" and "Do not make
'smart docket' the primary concept" (runbook Non-Negotiables 1; cursor instr.
lines 1083-1096). A research brief, a reply batch, a monitor plan, or a runway
note do not fit a "v6 frozen snapshot + review-before-send" console, yet that is
the only artifact surface on home.

Correction: do not surface the packet console on home at all (see #1). When it
*is* shown for a real saved item, the artifact viewer should be artifact-type
aware (brief / reply batch / monitor / document) per cursor instr. Screen G and
Work Package 6, not a fixed document-review packet. Block main.

Resolution so far: Loop 9 removed the legal/document packet shape from the blank
home, so the default first visit is now command + triage instead of command +
empty review packet + files drawer. Loop 10 then made the saved-work viewer's
visible labels type-aware instead of fixed packet chrome: renewal summary work
renders `Summary v6`, `Reply`, and `Context`; roadmap extraction work renders
`Research`; file payloads render `File`; unknown saved work falls back to
`Output`. Browser proof lives under
`/tmp/ironclaw-workbench-iab-2026-06-20T03-13-loop10/`.

Remaining: the body layout is still one saved-work frame with tabs and a handoff
bar. That is acceptable as a wiring scaffold, but not final product quality until
the body adapts by artifact type and use case: reply batches should compare
multiple drafts/recipients, research should show claims/evidence/citations,
monitors should show cadence and trigger logic, finance/ops briefs should show
numbers and source dates, and engineering work should show files/tests/build
status. Do not regress to a visible function directory on the command surface;
the type-aware viewer should emerge from what the user actually asked IronClaw
to do.

## 3. (RESOLVED IN LOOP 12/13) Visual system fell short of v13: system-serif fallback, no Inter, no dark mode

v13 loads Newsreader (headings), Inter (body), JetBrains Mono and sets the whole
tonal system on those (v13 lines 9, 30). The implementation:

- Headings use `font-family: Georgia, "Times New Roman", serif`
  (`styles/command.js:4`, `styles/packet.js:10,56,130,316,361`,
  `styles/overlays.js:135,168`). Georgia/Times is the generic system serif that
  makes a product read as a Word document / legal memo — the precise
  "editorial / legal-magazine" feel the runbook warns against (cursor instr.
  lines 1073-1074, 1083). Body text inherits the app default, not Inter.
- No dark theme. The token block is light-only (`styles/tokens.js`), and the
  test pins `.wb13-main` to `rgb(247, 248, 246)`
  (`workbench-static.spec.ts:89`). v13 ships a full `[data-theme="dark"]`
  palette (v13 lines 35-43) and the org design default is "dark mode,
  navy/black backgrounds, cyan/gold accents" (CLAUDE.md). The product currently
  cannot honor either v13's dark variant or the house design language.

Correction: load the same web fonts as v13 (or a closer Newsreader/Inter
fallback chain) and re-introduce a `[data-theme="dark"]` token set scoped to
`.wb13`. Dark mode is a token-table addition; it does not touch backend honesty.
The fixed light-background test assertion should be relaxed to allow theming.
High — this is most of the "feels like a mockup, not a serious product" gap.

Resolution: Loop 12/13 added Workbench-owned `--wb-font-body`,
`--wb-font-display`, and `--wb-font-mono` tokens; replaced Georgia / Times in the
command, packet, approval, and file surfaces; and added a scoped
`[data-theme="dark"] .wb13` token table. Static guards now assert the font tokens,
dark selector, absence of `Georgia` / `Times New Roman`, and the dark route
backgrounds. Fresh rendered proof lives under
`/tmp/ironclaw-workbench-iab-2026-06-20T04-18-loop13/`; light and dark captures
show the same Workbench composition with real `GLM 5.1 FP8` model labeling and
no console errors.

## 4. (RESOLVED IN LOOP 7) Suggestion copy regressed to terse, robotic labels

Original finding: visible chips were "What needs me today?", "Summarize what changed.", "Check
Slack blockers.", "Research TEE vendors.", "Prepare investor update.", "Turn a
file into a memo." (`workbench-plan.js:62-118`). These are clipped imperative
fragments with trailing periods. v13/v8 use fuller, human invitations: "Draft
the Northwind counter and show me the key terms before I approve", "Research
privacy-preserving TEE vendors for fintech and give me a shortlist by tomorrow"
(v13 lines 593-595; v8 lines 389-398), and the chip *label* is short while the
*filled* text is a complete thought (v13 `data-fill` vs button text). The current
build fills the composer with the same clipped label it shows (`fill(suggestion.label)`,
`workbench-command.js:146-148,304-314`), so clicking a chip drops a terse
fragment into the box. Cursor instr. "Natural Suggestions" wants invitations
based on what IronClaw can honestly know, and warns against bad text being
generic (lines 519-555). Trailing periods on button labels are an AI-tell and
read as a checklist, not a chief-of-staff.

Correction: split chip `label` (short) from `fill` (a complete natural
instruction) as v13 does, drop the trailing periods on the visible labels, and
warm the phrasing. Pure copy/data change in `workbench-plan.js`. High.

Resolution: Loop 7 split suggestion `label` from `fill`. Visible chips now stay
compact (`Catch me up`, `Find Slack blockers`, `Research TEE vendors`, etc.)
while clicks fill complete natural-language requests with source/approval
boundaries. Static browser coverage now verifies that `Research TEE vendors`
fills the full privacy-preserving TEE research instruction rather than the chip
label.

## 5. (RESOLVED IN LOOPS 5-6) Started-work scene was a static status board

Original finding: after Ask, `WorkbenchSceneWorkspace` rendered a summary + three fixed "action
rows" + a two-panel grid whose left panel is hard-wired to "No runtime artifact
yet." with "This workspace is a status surface until real outputs arrive."
(`workbench-scenes.js:60-99`; `workbench-scenes-registry.js` `actionRows`). It
never reads the live thread timeline. v10/v11 are called out specifically because
they "behave like a live product: real triage, ... streaming/partial failure"
(cursor instr. lines 71-77); v13's readout/blocked scenes stream real source
pills ("Gmail · reading" → "Gmail · read 8 emails", v13 lines 614-650). The
current scene is three canned rows ("Map audience privately", "Hold public
actions", etc.) plus a "Preferences sent" echo of what the user just chose. It
adds visual weight and a second "Open live thread" CTA without telling the user
anything the composer didn't already. It reads as filler.

Correction: either make the scene a thin read-only adapter over the Chat
timeline (cursor instr. Screen D / Work Package 4: `fetchTimeline`,
`openEventStream`), or collapse it to a single quiet "Started in Chat — continue
there" line. Do not ship a static status board pretending to be a run view.
High. Honest path is the timeline adapter; the collapse is the safe interim.

Resolution: Loop 5 replaced the placeholder with a `fetchTimeline`-backed preview
that shows `Waiting on the live thread.`, `Runtime accepted the request.`, or the
latest assistant reply. Loop 6 kept the route render green after the packet model
split. Remaining issue: the three fixed scene rows are still generic scaffolding;
they are less harmful now that the live timeline preview is present, but should
eventually derive from real run/tool activity.

## 6. (PARTIALLY RESOLVED IN LOOPS 8 AND 13) Command surface is below v13 affordance: weak primary action, cramped controls, fixed serif greet

Original finding: the well is fine (128px, 17px text — `styles/command.js`),
but the primary button label never adapted beyond "Ask"/"Starting"
(`workbench-command.js:140`), whereas both v13 and the spec call for an action
label that changes by request type — Ask / Draft / Research / Prepare / Review
(cursor instr. lines 507-515, 1260). The control bar packs scope select + mode
button + attach + cadence + send into one absolutely-positioned row inside the textarea
(`workbench-command.js:224-277`); on the narrow 252px-dock desktop this is tight,
and the `min-height:44px` controls inside an absolutely-positioned `.wb13-wbar`
risk crowding the 128px well. v13 keeps the bar lighter (`wbtn` 32px, v13 line
110). The greeting is a fixed 26px Georgia serif with no real hierarchy against
the sub.

Correction: derive the send label from the inferred scene (the registry already
classifies research/growth/monitor/investor — reuse `inferWorkbenchScene`).
Lighten the in-well control bar. Tie greet to the real font stack from #3.
Medium.

Resolution so far: Loop 8 added `commandActionLabel(brief)` and the button now
adapts to `Ask`, `Review`, `Research`, `Plan`, `Watch`, or `Prepare` based on
the internal scene inference. Browser proof under
`/tmp/ironclaw-workbench-iab-2026-06-20T02-56/` shows the live-proxied Workbench
surface rendering NEAR AI model label `GLM 5.1 FP8`, then switching the primary
action to `Prepare` for an investor-update request and `Review` for an
agreement-counter request. Loop 13 then removed the browser resize affordance
from the main command textarea, raised the prompt baseline size, and gave mobile
enough composer height for wrapped source/model/attach/cadence/send controls.
The 390px rendered proof under
`/tmp/ironclaw-workbench-iab-2026-06-20T04-18-loop13/02-mobile-dark-current-home.png`
shows no inner resize strip and no horizontal overflow; computed QA recorded
textarea scroll/client height `318 / 318`, send height `44`, and model text
`GLM 5.1 FP8`.

Remaining: the control bar is merely serviceable, not elite. It should
eventually become more deliberate: clearer model/effort configuration, better
cadence affordance, and a more polished attachment/source rhythm. Do not turn
this into a visible function directory; the surface still needs to adapt from
the user's ask.

## 7. (RESOLVED IN LOOP 11) Source/boundary inspector is static boilerplate "trust theater", not request-scoped evidence

`SourcesInspector` (`workbench-page.js:126-201`) lists the live readiness pills
(good) but then hard-codes two decorative blocks — "Can do privately:
Summarize, compare, draft / Prepare artifacts" and "Needs your approval: Send,
post, share... / Save durable memory." These are generic capability claims that
render identically for every request, every time. The runbook wants the source
inspector to be "a precise evidence panel: exact snippets, source status,
confidence, and why-used notes" (cursor instr. lines 1079-1080, 1230-1237), and
warns against "overbearing trust theater" (Worker F brief). Two always-on
"here's what I'm allowed to do" blocks with shield icons are exactly that
theater. They also restate the composer boundary line ("External actions need
your approval") that is already directly above (`workbench-command.js:281-285`),
violating the density rule.

Correction: keep the live "Can read if available" readiness list; drop or
heavily shrink the two static capability blocks, or replace them with real
per-request evidence (what was read / why / confidence) once timeline data is
wired. Medium.

Resolution: Loop 11 extracted the inspector to
`components/workbench-sources-inspector.js` and removed the static `Can do
privately` / `Needs your approval` blocks. The panel now shows source readiness
rows and setup/reconnect actions, plus one concise approval note. Browser proof
under `/tmp/ironclaw-workbench-iab-2026-06-20T03-31-loop11/` shows the updated
inspector.

## 8. (RESOLVED IN LOOP 11) Top bar carries a redundant shield "boundary" object the runbook says not to make primary

`WorkbenchTop` puts a standalone shield icon-button ("Show allowed sources",
`workbench-shell.js:140-147`) in the top chrome, in addition to the composer's
"What's allowed" link (`workbench-command.js:284`) and the source scope picker.
Non-negotiable 8: "Do not make top-bar connector badges the primary trust
object. Source state belongs in a scoped control/inspector"; adjacent handoff:
"connector badges do not appear in the Workbench hero/top bar unless they are
actionable source controls or blockers" (handoff lines 271-272). A permanent
top-bar shield with no count and no blocker is decorative trust chrome.

Correction: remove the top-bar shield button; the composer "What's allowed"
link and the scope picker already own this. Surface a top affordance only when a
source is actually blocked. Medium.

Resolution: Loop 11 removed the top-bar `Show allowed sources` shield. Source
readiness now opens from the composer `What's allowed` control, next to the
source picker and approval boundary line. Static route coverage asserts the
top-bar shield count is `0`.

## 9. (RESOLVED IN LOOP 11) Memory is presented as a primary nav destination for a feature that cannot save

The left rail promotes "Memory" to a top-three primary destination alongside
Work and Library (`workbench-shell.js:36-44`), but the Memory view is a
prototype whose only button is `disabled` with "Preference saving is shown as a
review pattern only until a writable memory backend is available"
(`workbench-memory.js:54-60`). Cursor instr. Library section: "Do not show
'memory' as a first-class category unless scoped preferences have real data"
(lines 1419-1421); adjacent handoff Screen 9 requires durable/staged truth.
Giving a non-functional, can-never-save surface equal nav weight to the two
working views is incoherent and invites the user to a dead end.

Correction: demote Memory out of primary nav until it can persist; surface the
"Save a preference?" pattern inline at the moment IronClaw proposes one, not as a
standing destination. Medium (nav/copy change).

Resolution: Loop 11 removed the primary `Memory` nav button while the feature has
no writable preference backend. The prototype component remains in the tree for
future wiring, but the Workbench no longer presents it as a first-class
destination. Static route and mobile coverage assert Memory is absent from the
primary Workbench nav.

## 10. (RESOLVED IN LOOP 9) "Local files" drawer is a third stacked panel that deepens home clutter

`HomeView` also always renders `WorkbenchWorkspaceFiles`
(`workbench-page.js:119`), a collapsible "Local files" drawer
(`workbench-files.js:150-163`). Combined with the always-on packet console (#1)
and scene board (#5), home can stack command → triage → scene board → document
console → files drawer. That is "card soup / panel soup" — the runbook says page
sections should feel like surfaces and lists, not stacked panels (cursor instr.
lines 1057-1061). The files browser is a Connections/attachment concern, not a
permanent home section.

Correction: fold local-file attachment into the composer attach flow (it already
exists via `attachmentsState.addFiles`) and remove the standing home drawer, or
move it behind the source scope picker. Low, but compounds #1 and #5 into the
overall "too many panels" complaint.

Resolution: Loop 9 moved the local-files drawer behind an explicit source choice.
`WorkbenchWorkspaceFiles` now renders only when the user selects `Local files`
from the Workbench source scope. Browser proof shows `workbench-workspace-files`
count `0` on blank desktop/mobile home, then count `1` after selecting Local
files. Static tests still prove readable workspace files can attach, list errors
stay honest, content errors do not expose attach, and binary files remain
download-only.

---

## What is genuinely right (do not regress)

- State rail / triage derive from real threads, saved work, and source
  readiness with honest empty states (`workbench-state.js`); no fake counts.
- Source readiness is real and per-state (Ready / Needs reconnect / Blocked by
  setup / Available / Readable), asserted in tests (`workbench-static.spec.ts:199-216`).
- Model selection uses the real provider catalog (GLM/GPT/Gemini labels), effort
  is separate, model switch failure preserves the draft (`useWorkbenchStart.js`).
- No base64-as-document; file artifacts get honest "open in Work" empty state
  (`workbench-work-items.js`, `workbench-packet.js:282-298`).
- Banned copy is absent and contract-tested ("custody record", "trust ledger",
  "Sources connected", "Deep work", "Redline" all gone from visible UI).
- Composer placeholder, boundary line, and "Auto sources" scope match the
  approved Surface Copy Matrix.

## Blocking summary

- Block main: #2 remaining saved-artifact packet rigidity.
- Fix this loop: #3 (fonts + dark mode) and the remaining #6 typography/control
  density issues.
- Polish: #7-#9.
