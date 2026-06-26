# IronClaw Professional-Life Surface Reset

Date: 2026-06-18

Status: product/design direction, no implementation changes

## Why This Reset Exists

The current UI direction has become too complex for the actual job. The user
who chooses IronClaw instead of Claude Code, Cursor, or a plain chat app is not
primarily buying a prettier chatbot. They are buying a safer connected work
harness for professional life.

The core value proposition is:

1. Connect my important systems safely.
2. Let IronClaw understand what is happening across them.
3. Let me ask natural professional questions.
4. Let IronClaw prepare work, drafts, amendments, tasks, and follow-ups.
5. Never let sensitive action happen without clear permission.
6. Learn how I work so the prepared work gets better over time.

For a lawyer, founder, consultant, operator, investor, or executive assistant,
the app should answer questions like:

- What emails came in that matter?
- Which Slack threads need me?
- What do I owe people today?
- Draft the two easy replies for review.
- Turn the third request into an amendment to the services agreement.
- Check whether the client already sent the file they promised.
- What is waiting on opposing counsel?
- What should I follow up on this afternoon?
- What changed in this matter since yesterday?

This is the product. Chat is just one input method.

## The New Thesis

IronClaw is a connected professional desk.

It watches the user's trusted work systems, turns the mess into reviewable
work, and lets the user approve, edit, send, file, or follow up safely.

The app should feel like:

- a private chief-of-staff desk
- a legal/professional triage room
- a secure connected outbox
- a matter-centered work memory
- a drafting and review station
- a control plane for long-running professional missions

It should not feel like:

- a generic AI chat client
- a coding-agent dashboard
- a logs/settings console
- a provider marketplace
- a complicated productivity cockpit
- a decorative SaaS redesign

## Roadmap Alignment

This reset now incorporates the extracted `NEAR AI Consolidated Roadmap`:

- [near-ai-consolidated-roadmap-extraction-2026-06-18.md](near-ai-consolidated-roadmap-extraction-2026-06-18.md)

The roadmap makes several product constraints explicit:

1. `Slack as the main channel` is scoped and designed. The product is moving
   toward channel-routed agents: one IronClaw app, DMs for the user's personal
   agent, channels for team agents, and shared memory/tools by channel.
2. `Onboarding to channel first approach` says the WebUI exists to authenticate
   the user, connect their channel, and get out of the way. That means the
   desktop app should be the setup, review, memory, and control plane, not a
   bloated destination that tries to own every conversation.
3. `Missions` are a named differentiator. They are not routines or scheduled
   jobs. They are outcome mandates with a goal, budget/resources, definition of
   done, progress, self-assessment, and review points.
4. `Self-learning loops` and `Long-term memory` make the Playbook real: the
   system should persist lessons from corrections, failures, complex sessions,
   communication style, and proven approaches, with user visibility and control.
5. `Permission management`, `Secrets usage with Skills/Tools`, `Admin
   configurable skills/tools`, `Private Spaces`, and `Multi-tenant cross agent
   collaboration` confirm that safe connection and permission boundaries are
   core product surface, not settings afterthoughts.
6. `Reborn` names the actual internal-customer acceptance bundle: Google Suite,
   Slack relay, Notion via MCP, Web UI, Routines, hosted infrastructure, and
   non-engineer polish.

The design consequence: IronClaw Desktop should not compete with Slack or other
channels as the place where all agent conversation happens. It should make
channel work safe, inspectable, correctable, and durable.

## The User Mental Model

The user does not think in routes, tools, providers, agents, logs, or gateway
capabilities.

They think in:

- clients
- matters
- people
- inboxes
- documents
- deadlines
- drafts
- approvals
- follow-ups
- missions
- things they owe
- things they are waiting on

The product should use those nouns.

## The Main Screen

The main screen should be "Today", not "Chat".

The user opens IronClaw and sees a prepared professional brief:

1. Needs Review
2. New Since Last Check
3. Drafts Ready
4. Waiting On Others
5. Ask IronClaw

The ask box is important, but it is not the whole product. It is the command
bar at the bottom or top of a prepared desk.

### First Viewport

At 1440x900, the first viewport should look roughly like this:

```text
+--------------------------------------------------------------------------+
| Today                                           Connected: Mail Slack Docs |
+----------------------+--------------------------------+------------------+
| Matters              | Needs Review                   | Selected Item     |
|                      |                                |                  |
| Acme Services        | [Draft] Reply to Alex          | Source email      |
| Wilson Employment    | [Draft] Amendment request      | Key context       |
| Personal Admin       | [Slack] 4 messages need triage | Draft / action    |
|                      |                                | Approval bar      |
| Sources              | New Since Last Check           |                  |
| Mail                 | 3 important emails             |                  |
| Slack                | 4 Slack threads                |                  |
| Calendar             | 2 upcoming deadlines           |                  |
| Drive                | 1 new document                 |                  |
+----------------------+--------------------------------+------------------+
| Ask IronClaw: What came in from Acme today?                              |
+--------------------------------------------------------------------------+
```

This is intentionally boring in the best way. It is a professional triage
surface, not a hero page and not a chat transcript.

## Primary Surfaces

Reduce the app to six normal-user surfaces.

### 1. Today

Purpose: triage professional life across connected sources.

Shows:

- Needs Review
- Drafts Ready
- New Since Last Check
- Waiting On Others
- Upcoming Deadlines
- Quick Ask

Examples:

- "3 emails need review"
- "4 Slack threads mention Acme"
- "1 document request can become a services amendment"
- "2 deadlines in the next 48 hours"
- "Waiting on Dana for the signed SOW"

Primary action:

- review the top item, or ask IronClaw a question

### 2. Matters

Purpose: organize work by client, matter, project, or professional context.

Shows:

- matter summary
- source messages
- documents
- drafts
- decisions
- deadlines
- receipts
- preferences learned for this matter

Examples:

- Acme Services Agreement
- Wilson Employment Separation
- Fund II Investor Updates
- Personal Admin

Primary action:

- open a matter and continue work with full context

### 3. Review

Purpose: approve, edit, send, export, or file prepared work.

Shows:

- source request
- IronClaw's understanding
- draft response or document change
- source documents used
- risk/sensitivity
- approval bar

Examples:

- email reply
- Slack reply
- contract amendment
- meeting follow-up
- client update
- deadline reminder

Primary action:

- approve, edit, or reject

### 4. Missions

Purpose: manage long-running outcome mandates without turning them into
confusing automations.

Shows:

- mission goal
- definition of done
- current progress
- next planned action
- budget/resources
- review cadence
- risks/blockers
- receipts
- related matters and channels

Examples:

- Keep the Acme matter moving until the amendment is signed.
- Keep my client inbox clear every weekday by 5 PM.
- Monitor competitor pricing and draft a response if it changes.
- Prepare a weekly legal ops summary every Friday.
- Move 100 legacy documents into the new matter structure.

Primary action:

- review progress, adjust boundaries, or approve the next external action

### 5. Connections

Purpose: connect systems safely and understand what IronClaw may do.

Shows:

- Mail
- Slack
- Calendar
- Drive/Docs
- Notion
- practice-management or CRM tools when available
- each connection's read/draft/send permissions

Primary action:

- connect or adjust permission boundaries

### 6. Playbook

Purpose: show and edit what IronClaw has learned about how the user works.

Shows:

- writing preferences
- client-specific instructions
- legal/professional constraints
- approval rules
- known contacts
- default drafting style
- things IronClaw should never do

Primary action:

- edit or delete a learned preference

## The Object Model

The interface should be built around durable professional objects.

### Source Item

An email, Slack message, calendar event, document change, Notion update, or
other inbound signal.

Fields:

- source
- sender/person
- matter/client
- timestamp
- summary
- urgency
- extracted ask
- attachments/documents
- sensitivity

### Triage Item

An interpreted item that may need action.

Fields:

- what happened
- why it matters
- suggested action
- confidence
- source links
- deadline
- owner
- matter

### Draft Packet

A prepared response or work product.

Fields:

- source request
- draft
- assumptions
- sources used
- risk flags
- required approval
- destination
- edit history

### Matter

A durable workspace for a client/project/legal issue.

Fields:

- people
- source items
- documents
- deadlines
- drafts
- decisions
- receipts
- open loops
- learned preferences

### Mission

A long-running outcome IronClaw is responsible for pursuing.

Fields:

- goal
- definition of done
- budget/resources
- review cadence
- allowed actions
- required approvals
- current progress
- next action
- related matter/client/channel
- receipts
- stop condition

### Approval

A decision point before anything leaves the user's trusted space.

Fields:

- action
- destination
- recipients/channel
- what leaves
- why IronClaw recommends it
- source context
- approve/edit/reject

### Receipt

Proof of what IronClaw did.

Fields:

- action
- timestamp
- source
- destination
- approval, if any
- artifact
- undo/follow-up if available

### Playbook Entry

A learned rule or preference.

Fields:

- scope: global, matter, client, contact, document type
- learned from
- confidence
- examples
- editable text
- enabled/disabled

## The Lawyer Workflow

This should be the canonical scenario for design QA.

### Step 1: User Asks About Email

User:

"What emails came in from Acme this morning?"

IronClaw responds in the Today surface, not just as a chat paragraph:

```text
Acme: 3 important emails since 8:00 AM

1. Alex asked for two wording changes to the services agreement.
   Suggested action: draft amendment.

2. Priya asked whether tomorrow's call can move to 3 PM.
   Suggested action: draft quick reply.

3. Finance sent the updated billing contact.
   Suggested action: file to matter, no reply needed.
```

Actions:

- Draft reply
- Draft amendment
- File to matter
- Ignore

### Step 2: User Requests Drafts

User:

"Draft the two responses, and for the agreement request draft the amendment."

IronClaw creates three Review items:

- email reply to Priya
- internal/file note for billing contact, if useful
- amendment draft for services agreement

The screen changes from "chat answer" to "Review queue":

```text
Drafts ready for Acme

[Email reply] Priya - move call to 3 PM
[Amendment] Services Agreement Section 4.2
[Matter note] Updated billing contact
```

Each item opens in the right pane or Review surface.

### Step 3: User Reviews Draft

The draft packet shows:

- original email
- relevant matter context
- draft
- assumptions
- sources used
- approval action

Approval bar:

```text
Approve sending to Priya at Acme?
Leaves: email body only
Attachments: none
Tone: concise, professional

[Edit] [Approve Send] [Reject]
```

For a legal amendment:

```text
Draft amendment to Services Agreement
Sources: Alex email, Services Agreement v5, Acme playbook
Risk: legal document, review required

[Open Redline] [Export DOCX] [Save to Matter]
```

Do not offer "send to counterparty" as the dominant action unless the user has
explicitly asked for that workflow and the destination is clear.

### Step 4: User Asks About Slack

User:

"Check Slack. What came up?"

IronClaw groups by matter and actionability:

```text
Slack since last check

Needs reply
1. Sarah asked whether the Acme amendment should include the new indemnity cap.
2. Jay asked for a status update on Wilson.

Informational
3. Finance posted the updated invoice link.

Task
4. Dana needs the signed SOW uploaded by 5 PM.
```

Actions:

- Draft replies
- Add task
- File to matter
- Mark reviewed

### Step 5: The Harness Learns

After the user edits drafts, IronClaw asks sparingly:

```text
I noticed you changed "happy to" to "I can" in client replies.
Save this as a writing preference?

[Save preference] [Not now]
```

Or, quietly records a low-confidence suggestion in Playbook:

```text
Drafting pattern observed
For Acme, prefer short direct replies and avoid warm filler.
Confidence: low
```

The user can edit or delete it.

## What The Surface Should Not Do

Do not make the user choose among dozens of app sections before work exists.

Avoid:

- giant chat-first landing
- dashboard cards for their own sake
- a separate "workspace" that feels like a file browser
- visible logs as normal navigation
- raw automations/routines terminology
- provider/model settings as a top-level concern
- "agent activity" streams that do not map to user decisions
- multiple panels competing with the composer
- generated artifacts buried inside transcripts
- fake proactivity with empty widgets

If a surface does not help the user review, draft, approve, file, search, or
connect professional work, it should be hidden or moved to advanced settings.

## Safe Connections As The Core Value Prop

Connections should be a first-class product surface, but not a marketplace.

The user should see permission boundaries in human terms:

```text
Mail
Connected as abhi@example.com
Can read: inbox, sent mail, labels
Can prepare: draft replies
Requires approval: sending, forwarding, attachments

[Manage]
```

```text
Slack
Connected to Jasnah workspace
Can read: selected channels
Can prepare: replies and summaries
Requires approval: posting messages

[Choose channels]
```

```text
Drive
Connected
Can read: selected folders
Can create: draft documents in IronClaw
Requires approval: sharing, moving, deleting

[Manage folders]
```

This is more important than a fancy chat window. It tells the user why IronClaw
is different: it can touch real work safely.

## Trust And Safety Model

The product should make the safety model obvious without sounding defensive.

### Read Is Different From Draft Is Different From Send

Every connection should separate:

- can read
- can summarize
- can draft
- can save/file
- can send/post/share
- can delete/change permissions

Sending, posting, sharing, deleting, permission changes, and external filing
require explicit approval.

### Approval Copy

Approvals should say:

- what will happen
- where it will happen
- who will see it
- what content leaves
- what source context was used

Example:

```text
Send this email to Priya Shah?

To: priya@acme.com
Subject: Re: Tomorrow's call
Leaves: email body only
Attachments: none
Based on: Priya's 9:14 AM email, your calendar

[Edit] [Send] [Do not send]
```

### Professional Privacy

For legal/professional users, confidentiality is not an edge case. It is the
product.

The UI should make these concepts inspectable:

- source system
- matter assignment
- recipients
- attachments
- external destination
- retention/persistence
- learned preference scope
- ability to delete learned memory

## Learning Without Creepiness

The app should learn from the user's edits and approvals, but the learning
surface must be explicit and controllable.

Good learning:

- "For Acme, keep replies short and direct."
- "You usually ask for a source clause before drafting amendments."
- "You prefer DOCX redlines for contract edits."
- "Never send client-facing Slack replies without review."

Bad learning:

- opaque personalization
- hidden memory
- broad personality claims
- "I know how you think"
- preferences that cannot be edited or deleted

The Playbook should make learning feel like leverage, not surveillance.

## Copy Direction

Use professional work language.

Prefer:

- Today
- Needs Review
- Drafts Ready
- Waiting On
- Matters
- Connections
- Playbook
- Review
- Approve Send
- Save to Matter
- File without reply
- Ask IronClaw

Avoid:

- gateway
- operator
- provider
- MCP
- execution
- routines
- automations, unless re-labeled as Scheduled
- tools
- artifact, except where the object really is a generated file
- agent activity, unless it is a receipt

## Visual Direction

The surface should become calmer and simpler.

### Layout

Use a three-pane professional app layout:

- left: matters and sources
- center: triage/review list
- right: selected item detail

But keep it quiet:

- no nested cards
- no decorative gradients
- no giant hero prompts
- no busy widget grid
- no animated novelty

### Rows Over Cards

Most professional work should be rows:

- triage rows
- draft rows
- receipt rows
- matter rows
- connection rows

Cards are reserved for:

- draft packet preview
- approval decision
- connector permission summary
- modal/drawer content

### Color

- Blue: user action, such as Review, Send, Approve, Connect.
- Gold: IronClaw prepared this, inferred this, or handled this.
- Amber: review/caution.
- Red: destructive or failed.
- Green: proven completion only.

### Density

The app should be dense enough for real work. A lawyer with 12 matters and 80
messages cannot live in a spacious toy interface.

Use:

- 14px body text
- compact rows
- clear timestamps
- matter chips
- source icons
- stable columns

Avoid:

- oversized headings inside tools
- paragraph-heavy empty states
- card grids where lists would scan better

## Concrete UI Components

### Triage Row

```text
[Mail] Acme - Alex Morgan                     10:14 AM
Asked for two wording changes to services agreement.
Suggested: draft amendment
[Review] [File]
```

### Draft Row

```text
[Draft] Reply to Priya about call time        Acme
Ready for review. No attachments.
[Open]
```

### Matter Row

```text
Acme Services Agreement
3 new items, 2 drafts ready, waiting on Alex
```

### Approval Bar

```text
Send to Priya Shah?
Leaves: email body only. No attachments.
[Edit] [Send] [Do not send]
```

### Source Stack

```text
Sources used
1. Priya email, 9:14 AM
2. Calendar availability, tomorrow
3. Acme matter playbook
```

### Learned Preference

```text
Acme writing preference
Keep client replies short and direct. Avoid warm filler.
Learned from 4 edits.
[Edit] [Disable]
```

### Mission Row

```text
[Mission] Keep Acme amendment moving             Review due today
Progress: draft ready, waiting on your approval before sending to Alex.
[Open] [Pause]
```

## Minimum Lovable Product Surface

If we strip everything unnecessary, the first excellent version needs only:

1. Connect Mail, Slack, Calendar, Drive/Docs, Notion.
2. Today surface that groups new items by matter and action.
3. Ask box that can query connected context.
4. Review queue for drafts and proposed actions.
5. Matter page with source messages, documents, decisions, drafts.
6. Mission page for long-running outcomes, progress, budgets, and review
   points.
7. Approval bar before anything leaves the workspace.
8. Playbook for learned preferences and rules.

Everything else is secondary.

Logs, diagnostics, advanced settings, model/provider detail, raw tool activity,
bundle state, and implementation names should disappear from normal operation.

## Design Acceptance Scenario

Before calling the redesign good, run this scenario end to end:

1. User connects Mail and Slack with read/draft permissions.
2. User asks: "What came in from Acme today?"
3. IronClaw shows three email items grouped under Acme.
4. User says: "Draft replies for the first two. The third should become an
   amendment."
5. IronClaw creates two email draft packets and one amendment packet.
6. User opens the first draft, edits it, and approves sending.
7. IronClaw shows exactly what leaves and who receives it.
8. User asks: "Check Slack too."
9. IronClaw shows four Slack items grouped into needs reply, informational,
   and task.
10. User approves one Slack reply and files the others to the matter.
11. User says: "Keep the Acme amendment moving until it is signed."
12. IronClaw creates a Mission with a goal, review cadence, allowed actions,
   and approval boundaries.
13. IronClaw suggests a learned preference based on the user's edit.
14. User can see and edit that preference in Playbook.

If the UI cannot make this flow feel obvious, the design is not right.

## The Hard Product Opinion

The current design effort should stop optimizing the wrong abstraction.

The abstraction is not:

- chat
- agent run
- tool call
- workspace
- provider
- automation
- log

The abstraction is:

- professional signal comes in
- IronClaw understands it
- IronClaw prepares work
- user reviews the work
- user approves what leaves
- IronClaw files the receipt
- IronClaw advances longer-running missions inside explicit boundaries
- the system learns the user's way

That is the surface.

Everything else should serve that loop or get out of the way.
