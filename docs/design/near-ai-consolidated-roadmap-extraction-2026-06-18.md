# NEAR AI Consolidated Roadmap Extraction

Date: 2026-06-18

Source: Notion page `NEAR AI Consolidated Roadmap` at `https://app.notion.com/p/jasnahcom/36e29a6526bf8077b628da15dd55812a?v=36e29a6526bf80df8023000c60b908c6`.

Extraction mode: read-only in-app browser pass. I opened the roadmap `Timeline` and `List` views, extracted the 36 visible roadmap rows and their status/phase chips, then opened each row page and saved a full-page screenshot plus visible page text.

Assets directory: `docs/design/assets/near-ai-roadmap-2026-06-18/`.

Raw structured extraction: [roadmap-extracted-items.json](assets/near-ai-roadmap-2026-06-18/roadmap-extracted-items.json).

## Overview Screenshots

- Timeline view: [01-roadmap-initial-fullpage.png](assets/near-ai-roadmap-2026-06-18/01-roadmap-initial-fullpage.png)
- List view: [02-roadmap-list-view-fullpage.png](assets/near-ai-roadmap-2026-06-18/02-roadmap-list-view-fullpage.png)

## Phase / Status Summary

| Phase / Status | Count | Roadmap items |
| --- | ---: | --- |
| In development | 4 | Benchmarks in CI; Crabshack w/ TEE; Migrate to Railway; Reborn |
| In design | 2 | Onboarding to channel first approach; Migrate legacy agents to crabshack |
| Scoped & Designed | 11 | Run Benchmarks daily; API to Create agents via Crabshack; Secrets usage with Skills/Tools; Harness improvement feedback loop; Enhance Framework to support “new features” benchmarks; NEAR Foundation must-haves; Clean up old architecture; TEE support for multi-tenancy; Migrate existing agents from agent.near.ai to Reborn; Admin configurable skills/tools; Slack as the main channel |
| Ideation | 7 | Long-term memory; Missions; Multi-tenant cross agent collaboration; Self-learning loops; Security Improvements; Free tier via multi-tenancy; Path from free tier to dedicated agents |
| Not started | 10 | IronClaw - Tools & Channels Roadmap (Ongoing); Bundles / Collections / Loadouts; Rating and voting; Private Spaces; Infra Reliability Improvement; TEE Observability; Native app for screen capturing; Custom build tools; Permission management; User-voice model |
| Won't do | 2 | Slack app; Google App / Certification |

## Full Roadmap Table

| # | Item | Phase / Status | Date | Initiative | Blocked by | Blocking | Tag | Screenshot |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | IronClaw - Tools & Channels Roadmap (Ongoing) | Not started | June 9, 2026 → August 2, 2026 | IronHub |  |  |  | [png](assets/near-ai-roadmap-2026-06-18/01-ironclaw-tools-channels-roadmap-ongoing.png) |
| 2 | Bundles / Collections / Loadouts | Not started | July 4, 2026 → July 17, 2026 | IronHub |  |  |  | [png](assets/near-ai-roadmap-2026-06-18/02-bundles-collections-loadouts.png) |
| 3 | Rating and voting | Not started | July 18, 2026 → July 31, 2026 | IronHub |  |  |  | [png](assets/near-ai-roadmap-2026-06-18/03-rating-and-voting.png) |
| 4 | Private Spaces | Not started | June 12, 2026 → July 3, 2026 | IronHub |  |  |  | [png](assets/near-ai-roadmap-2026-06-18/04-private-spaces.png) |
| 5 | Infra Reliability Improvement | Not started | June 11, 2026 → June 30, 2026 | Infra |  |  |  | [png](assets/near-ai-roadmap-2026-06-18/05-infra-reliability-improvement.png) |
| 6 | TEE Observability | Not started | July 13, 2026 → July 23, 2026 | Infra | TEE support for multi-tenancy |  |  | [png](assets/near-ai-roadmap-2026-06-18/06-tee-observability.png) |
| 7 | Run Benchmarks daily | Scoped & Designed | June 8, 2026 → June 9, 2026 | Benchmarks |  |  |  | [png](assets/near-ai-roadmap-2026-06-18/07-run-benchmarks-daily.png) |
| 8 | Long-term memory | Ideation | July 10, 2026 → July 31, 2026 | IronClaw core | Self-learning loops |  |  | [png](assets/near-ai-roadmap-2026-06-18/08-long-term-memory.png) |
| 9 | Missions | Ideation | June 26, 2026 → July 5, 2026 | IronClaw core |  | Multi-tenant cross agent collaboration | Differentiator | [png](assets/near-ai-roadmap-2026-06-18/09-missions.png) |
| 10 | API to Create agents via Crabshack | Scoped & Designed | June 15, 2026 → June 19, 2026 | Infra |  |  |  | [png](assets/near-ai-roadmap-2026-06-18/10-api-to-create-agents-via-crabshack.png) |
| 11 | Secrets usage with Skills/Tools | Scoped & Designed | June 16, 2026 → June 29, 2026 | IronClaw core | Slack as the main channel |  |  | [png](assets/near-ai-roadmap-2026-06-18/11-secrets-usage-with-skills-tools.png) |
| 12 | Native app for screen capturing | Not started | July 17, 2026 → July 30, 2026 | Managed App |  |  | Differentiator | [png](assets/near-ai-roadmap-2026-06-18/12-native-app-for-screen-capturing.png) |
| 13 | Custom build tools | Not started | July 1, 2026 → July 17, 2026 | IronClaw core |  |  |  | [png](assets/near-ai-roadmap-2026-06-18/13-custom-build-tools.png) |
| 14 | Permission management | Not started | June 26, 2026 → July 21, 2026 | IronClaw core | Admin configurable skills/tools |  | Differentiator | [png](assets/near-ai-roadmap-2026-06-18/14-permission-management.png) |
| 15 | Multi-tenant cross agent collaboration | Ideation | July 6, 2026 → July 26, 2026 | IronClaw core | Missions |  | Differentiator | [png](assets/near-ai-roadmap-2026-06-18/15-multi-tenant-cross-agent-collaboration.png) |
| 16 | User-voice model | Not started | July 5, 2026 → July 16, 2026 | IronClaw core |  |  |  | [png](assets/near-ai-roadmap-2026-06-18/16-user-voice-model.png) |
| 17 | Harness improvement feedback loop | Scoped & Designed | June 15, 2026 → June 30, 2026 | Benchmarks | Benchmarks in CI |  |  | [png](assets/near-ai-roadmap-2026-06-18/17-harness-improvement-feedback-loop.png) |
| 18 | Enhance Framework to support “new features” benchmarks | Scoped & Designed | July 1, 2026 → July 12, 2026 | Benchmarks |  |  |  | [png](assets/near-ai-roadmap-2026-06-18/18-enhance-framework-to-support-new-features-benchmarks.png) |
| 19 | Benchmarks in CI | In development | May 20, 2026 → May 31, 2026 | Benchmarks |  | Harness improvement feedback loop |  | [png](assets/near-ai-roadmap-2026-06-18/19-benchmarks-in-ci.png) |
| 20 | Onboarding to channel first approach | In design | June 16, 2026 → June 27, 2026 | IronClaw core | Slack as the main channel |  |  | [png](assets/near-ai-roadmap-2026-06-18/20-onboarding-to-channel-first-approach.png) |
| 21 | NEAR Foundation must-haves | Scoped & Designed | June 11, 2026 | IronClaw core |  |  |  | [png](assets/near-ai-roadmap-2026-06-18/21-near-foundation-must-haves.png) |
| 22 | Clean up old architecture | Scoped & Designed | June 12, 2026 → June 23, 2026 | IronClaw core | Reborn |  |  | [png](assets/near-ai-roadmap-2026-06-18/22-clean-up-old-architecture.png) |
| 23 | Self-learning loops | Ideation | June 20, 2026 → July 8, 2026 | IronClaw core |  | Long-term memory |  | [png](assets/near-ai-roadmap-2026-06-18/23-self-learning-loops.png) |
| 24 | Slack app | Won't do |  | Managed App |  |  |  | [png](assets/near-ai-roadmap-2026-06-18/24-slack-app.png) |
| 25 | Security Improvements | Ideation | June 22, 2026 → July 16, 2026 | Infra |  |  |  | [png](assets/near-ai-roadmap-2026-06-18/25-security-improvements.png) |
| 26 | TEE support for multi-tenancy | Scoped & Designed | June 24, 2026 → July 10, 2026 | Infra |  | TEE Observability |  | [png](assets/near-ai-roadmap-2026-06-18/26-tee-support-for-multi-tenancy.png) |
| 27 | Free tier via multi-tenancy | Ideation | July 13, 2026 → July 24, 2026 | Infra | Path from free tier to dedicated agents |  |  | [png](assets/near-ai-roadmap-2026-06-18/27-free-tier-via-multi-tenancy.png) |
| 28 | Path from free tier to dedicated agents | Ideation | June 24, 2026 → July 10, 2026 | Infra |  | Free tier via multi-tenancy |  | [png](assets/near-ai-roadmap-2026-06-18/28-path-from-free-tier-to-dedicated-agents.png) |
| 29 | Migrate existing agents from agent.near.ai to Reborn | Scoped & Designed | June 18, 2026 → June 24, 2026 | Infra |  |  |  | [png](assets/near-ai-roadmap-2026-06-18/29-migrate-existing-agents-from-agent-near-ai-to-reborn.png) |
| 30 | Migrate legacy agents to crabshack | In design | June 4, 2026 → June 18, 2026 | Infra | Crabshack w/ TEE |  |  | [png](assets/near-ai-roadmap-2026-06-18/30-migrate-legacy-agents-to-crabshack.png) |
| 31 | Crabshack w/ TEE | In development | May 15, 2026 → June 3, 2026 | Infra |  | Migrate legacy agents to crabshack |  | [png](assets/near-ai-roadmap-2026-06-18/31-crabshack-w-tee.png) |
| 32 | Migrate to Railway | In development | May 15, 2026 → June 2, 2026 | Infra |  |  |  | [png](assets/near-ai-roadmap-2026-06-18/32-migrate-to-railway.png) |
| 33 | Google App / Certification | Won't do |  | Managed App |  |  |  | [png](assets/near-ai-roadmap-2026-06-18/33-google-app-certification.png) |
| 34 | Admin configurable skills/tools | Scoped & Designed | June 6, 2026 → June 20, 2026 | IronClaw core |  | Permission management |  | [png](assets/near-ai-roadmap-2026-06-18/34-admin-configurable-skills-tools.png) |
| 35 | Slack as the main channel | Scoped & Designed | June 7, 2026 → June 15, 2026 | IronClaw core |  | Onboarding to channel first approach; Secrets usage with Skills/Tools |  | [png](assets/near-ai-roadmap-2026-06-18/35-slack-as-the-main-channel.png) |
| 36 | Reborn | In development | May 11, 2026 → June 10, 2026 | IronClaw core |  | Clean up old architecture; NEAR Foundation must-haves |  | [png](assets/near-ai-roadmap-2026-06-18/36-reborn.png) |

## Product-Relevant Themes

1. Channel-first is explicit. `Slack as the main channel` is scoped and designed; `Onboarding to channel first approach` says the WebUI exists to authenticate, connect a channel, and get the user to the channel quickly.
2. Reborn is the umbrella platform initiative, with Google Suite, Slack relay, Notion via MCP, Web UI, Routines, and non-engineer polish called out as part of the rebuilt surface.
3. Missions are framed as outcome-oriented long-running work, not cron-style routines: a mandate, budget/resources, definition of done, self-assessment, progress visibility, and spending limits.
4. Self-learning loops and long-term memory are central to the product: durable lessons from corrections, failures, complex sessions, user communication style, reusable approaches, resident short-term memory, and retrievable long-term memory.
5. Permission management, secrets, admin-configurable skills/tools, private spaces, and multi-tenancy all point to a safety/control-plane product, not just a chat surface.
6. Several items reinforce the need for a professional connected desk: Slack channel routing, admin/shared tools, private user tools, Notion/Google/Slack connectors, and user-editable learned preferences.

## Detailed Item Extraction

### 1. IronClaw - Tools & Channels Roadmap (Ongoing)

- Phase / Status: Not started
- Date: June 9, 2026 → August 2, 2026
- Initiative: IronHub
- Notion URL: https://app.notion.com/p/jasnahcom/38229a6526bf80beb54bfc0c69fe0823?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/01-ironclaw-tools-channels-roadmap-ongoing.png](assets/near-ai-roadmap-2026-06-18/01-ironclaw-tools-channels-roadmap-ongoing.png)
- Extracted image references: 1

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Customize layout
IronClaw - Tools & Channels Roadmap (Ongoing)
Blocked by
Empty
Blocking
Empty
Date
June 9, 2026 → August 2, 2026
End Owner
Empty
Initiative
IronHub
Status
Not started
Tag
Empty
Add a property
Comments
Press ‘enter’ to continue with an empty page, or create a template
```

</details>

### 2. Bundles / Collections / Loadouts

- Phase / Status: Not started
- Date: July 4, 2026 → July 17, 2026
- Initiative: IronHub
- Notion URL: https://app.notion.com/p/jasnahcom/Bundles-Collections-Loadouts-38229a6526bf80c8a7e5df4d14114aa2?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/02-bundles-collections-loadouts.png](assets/near-ai-roadmap-2026-06-18/02-bundles-collections-loadouts.png)
- Extracted image references: 1

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Bundles / Collections / Loadouts
Blocked by
Empty
Blocking
Empty
Date
July 4, 2026 → July 17, 2026
End Owner
Empty
Initiative
IronHub
Status
Not started
Tag
Empty
Add a property
Comments
Bundles / Loadouts: packaged roles bundling skills + tools (+ soul when ready), e.g. a paralegal
Collections (skills + tools) exist today, Phase 2
Loadouts add the soul layer when the runtime supports it
Problem Statement
Collections today bundle skills and tools, but they're not yet packaged as deployable roles. A user who wants "a paralegal" still has to assemble the pieces and supply the behavioral layer themselves — there's no single artifact that captures what a role does and how it should act.
For example, a Security Review or Agent Builder collection gives you the right tools and skills, but not the persona, judgment, and operating style that turn a bundle into a role you can drop in and trust.
Bundles/Loadouts close that gap: a packaged role bundling skills + tools + soul, deployable as a unit.
User Stories
As a user, I want to install a packaged role like "paralegal" in one step, so I get the skills, tools, and behavior together instead of assembling them myself.
As an author, I want to publish a loadout as a single unit, so my role is reusable and deployable without setup instructions.
(Future) As a user, I want a loadout to carry its own soul layer, so the agent acts the part.
```

</details>

### 3. Rating and voting

- Phase / Status: Not started
- Date: July 18, 2026 → July 31, 2026
- Initiative: IronHub
- Notion URL: https://app.notion.com/p/jasnahcom/Rating-and-voting-38229a6526bf8039963afa49d7046fa0?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/03-rating-and-voting.png](assets/near-ai-roadmap-2026-06-18/03-rating-and-voting.png)
- Extracted image references: 1

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Rating and voting
Blocked by
Empty
Blocking
Empty
Date
July 18, 2026 → July 31, 2026
End Owner
Empty
Initiative
IronHub
Status
Not started
Tag
Empty
Add a property
Comments
Problem Statement
IronHub discovery relies on curation — Staff Picks and Collections — with no community signal for quality. Users can see security boundaries before installation, but nothing tells them whether a skill actually works, and authors get no feedback loop. Curation is hard to scale.

Rating and voting turn: the community highlights what works, so that users know what to install, and authors learn what to refine.
User Stories
As a user, I want to rate or upvote a skill I've installed, so others can benefit from my experience and the best work surfaces beyond Staff Picks.
As a user browsing the marketplace, I want to sort and filter by rating alongside the existing trigger/action counts, so I can quickly pick a proven skill when several overlap.
As an author, I want to see how my published skills are rated, so I know what's working and what to improve.
```

</details>

### 4. Private Spaces

- Phase / Status: Not started
- Date: June 12, 2026 → July 3, 2026
- Initiative: IronHub
- Notion URL: https://app.notion.com/p/jasnahcom/Private-Spaces-38229a6526bf803c9cb7dc2d720caac9?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/04-private-spaces.png](assets/near-ai-roadmap-2026-06-18/04-private-spaces.png)
- Extracted image references: 1

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Private Spaces
Blocked by
Empty
Blocking
Empty
Date
June 12, 2026 → July 3, 2026
End Owner
Empty
Initiative
IronHub
Status
Not started
Tag
Empty
Add a property
Comments
Problem Statement
Organization-specific skills and tools have no shared home scoped to the org. Today, users would have to share the skills and tools through internal channels or publish them publicly. There's no way to share them with a specific org/group.
For example, NEAR Foundation has specific tools that all NEAR Foundation employees can benefit from.
An Org-scoped hub turns individual effort into compounding team capability: internal skills and tools become discoverable and reusable across NF without ever leaving the boundary.
User Stories
(Needs details) As an IronHub user(?), I want to create a shared space so that my team can share internal tools and skills.
As a user, I want to publish a skill that's visible to my whole org but not the public, so the team can reuse it without exposing internal tooling.
Notes
Current implementation relies on GitHub organizations for group membership. That needs to be updated so that people without GitHub access can access the private space and the groups could be managed outside organization.
```

</details>

### 5. Infra Reliability Improvement

- Phase / Status: Not started
- Date: June 11, 2026 → June 30, 2026
- Initiative: Infra
- Notion URL: https://app.notion.com/p/jasnahcom/Infra-Reliability-Improvement-38029a6526bf8024b66afa79f378b8e7?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/05-infra-reliability-improvement.png](assets/near-ai-roadmap-2026-06-18/05-infra-reliability-improvement.png)
- Extracted image references: 1

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Infra Reliability Improvement
Blocked by
Empty
Blocking
Empty
Date
June 11, 2026 → June 30, 2026
End Owner
Empty
Initiative
Infra
Status
Not started
Tag
Empty
Add a property
Comments
Continuous investment including
Address critical infra reliability issues (self revealed via metrics, user reports, etc)
Migrate away from unstable infra service such as CloudRun
Improve platform synchronization/alignment issue between Chat-API and CrabShack such as session and key management
```

</details>

### 6. TEE Observability

- Phase / Status: Not started
- Date: July 13, 2026 → July 23, 2026
- Initiative: Infra
- Blocked by: TEE support for multi-tenancy
- Notion URL: https://app.notion.com/p/jasnahcom/TEE-Observability-38029a6526bf809c9259e426bb8a8c3b?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/06-tee-observability.png](assets/near-ai-roadmap-2026-06-18/06-tee-observability.png)
- Extracted image references: 1

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
TEE Observability
Blocked by
TEE support for multi-tenancy
Blocking
Empty
Date
July 13, 2026 → July 23, 2026
End Owner
Empty
Initiative
Infra
Status
Not started
Tag
Empty
Add a property
Comments
Make sure we can export necessary logging and metric data from TEE without compromising privacy of residents
```

</details>

### 7. Run Benchmarks daily

- Phase / Status: Scoped & Designed
- Date: June 8, 2026 → June 9, 2026
- End Owner: Pranav Raja
- Initiative: Benchmarks
- Notion URL: https://app.notion.com/p/jasnahcom/Run-Benchmarks-daily-37929a6526bf803f9d79e7b83d77306c?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/07-run-benchmarks-daily.png](assets/near-ai-roadmap-2026-06-18/07-run-benchmarks-daily.png)
- Extracted image references: 2

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Run Benchmarks daily
Blocked by
Empty
Blocking
Empty
Date
June 8, 2026 → June 9, 2026
End Owner
Pranav Raja
Initiative
Benchmarks
Status
Scoped & Designed
Tag
Empty
Add a property
Comments
Run the main benchmarks daily to evaluate the quality of the product
```

</details>

### 8. Long-term memory

- Phase / Status: Ideation
- Date: July 10, 2026 → July 31, 2026
- Initiative: IronClaw core
- Blocked by: Self-learning loops
- Notion URL: https://app.notion.com/p/jasnahcom/Long-term-memory-37929a6526bf8060ae47ea982bb4392a?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/08-long-term-memory.png](assets/near-ai-roadmap-2026-06-18/08-long-term-memory.png)
- Extracted image references: 1

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Long-term memory
Blocked by
Self-learning loops
Blocking
Empty
Date
July 10, 2026 → July 31, 2026
End Owner
Empty
Initiative
IronClaw core
Status
Ideation
Tag
Empty
Add a property
Comments
The context window is a fixed per-turn budget: every resident token costs money and latency on every inference. But an agent that compounds over months accumulates far more than any window can hold — so we split memory by access pattern:
Short-term (resident). A small, hard-capped block in the prompt: the facts needed on every turn — user identity, communication style, active project, standing corrections.
Long-term (retrievable). Everything else — full history, past threads, resolved problems — lives on disk, unbounded, pulled in only when relevant via search.
How Hermes AI does it: a hard-capped MEMORY.md and USER.md (~1,300 tokens total) injected into the prompt as short-term memory, alongside full conversation history in SQLite that the agent searches on demand (FTS5, no LLM cost) as long-term recall.
```

</details>

### 9. Missions

- Phase / Status: Ideation
- Date: June 26, 2026 → July 5, 2026
- Initiative: IronClaw core
- Blocking: Multi-tenant cross agent collaboration
- Tag: Differentiator
- Notion URL: https://app.notion.com/p/jasnahcom/Missions-37829a6526bf80c2a8bdc8902da53b40?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/09-missions.png](assets/near-ai-roadmap-2026-06-18/09-missions.png)
- Extracted image references: 1

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Missions
Blocked by
Empty
Blocking
Multi-tenant cross agent collaboration
Date
June 26, 2026 → July 5, 2026
End Owner
Empty
Initiative
IronClaw core
Status
Ideation
Tag
Differentiator
Add a property
Comments
Problem and Inspiration
Routines are tasks that run on a schedule. Missions are a mechanism for achieving a specific goal: a long-running process focused on outcomes, self-assessing progress, and deciding what to do next.
The model is hiring an employee for a mandate ("grow my following," "keep the queue clear") rather than scheduling a cron job. A Mission carries a goal + definition of done + budget/resources. A mission deploys routines and executes one-off tasks, runs for days, indefinitely, or until a terminal state.
This is the shift from tool SaaS to outcome SaaS: state the outcome, not the steps.
Examples
Grow my Twitter followers to 10K — open-ended growth goal pursued proactively; nothing external prompts it, so it runs on a heartbeat and decides its own tactics.
Get 5 of these 100 target accounts to follow me — targeted outreach with a concrete success list; mix of judgment and irreversible public actions.
Weekly sub-goals within a mission — e.g. "10K followers this week, then 5 celebrity follows next" — showing a mission can carry shifting targets over time.
Reply to all Crisp customer messages — keep the support queue cleared, drafting or sending replies within an SLA. Reactive: wakes on inbound messages.
Migrate our docs from Confluence to Notion — finite project with a real terminal state; the mission ends when it's done.
Watch competitor pricing, alert me, and draft a response — standing monitor that never completes; low-action, high-value. Can be done via a routine.
Preliminary User Stories
As a user, I want to hand an agent a goal like "Grow my Twitter followers to 10K" so that I stop managing the work myself and just review outcomes.
As a user, I want to set a mission's success criteria and budget up front so that it pursues the goal within limits I control, without checking with me on every step.
As a user, I want to see what a mission is doing, how it's progressing toward its goal, and what it's spent so that I can trust it's working and not silently burning money or going off track.
```

</details>

### 10. API to Create agents via Crabshack

- Phase / Status: Scoped & Designed
- Date: June 15, 2026 → June 19, 2026
- Initiative: Infra
- Notion URL: https://app.notion.com/p/jasnahcom/API-to-Create-agents-via-Crabshack-37329a6526bf80699206e311eff8ff6c?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/10-api-to-create-agents-via-crabshack.png](assets/near-ai-roadmap-2026-06-18/10-api-to-create-agents-via-crabshack.png)
- Extracted image references: 1

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
API to Create agents via Crabshack
Blocked by
Empty
Blocking
Empty
Date
June 15, 2026 → June 19, 2026
End Owner
Empty
Initiative
Infra
Status
Scoped & Designed
Tag
Empty
Add a property
Comments
API for Agent Hosting - Product Brief
```

</details>

### 11. Secrets usage with Skills/Tools

- Phase / Status: Scoped & Designed
- Date: June 16, 2026 → June 29, 2026
- Initiative: IronClaw core
- Blocked by: Slack as the main channel
- Notion URL: https://app.notion.com/p/jasnahcom/Secrets-usage-with-Skills-Tools-36f29a6526bf806bac54f6dc3634ac13?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/11-secrets-usage-with-skills-tools.png](assets/near-ai-roadmap-2026-06-18/11-secrets-usage-with-skills-tools.png)
- Extracted image references: 2

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Secrets usage with Skills/Tools
Blocked by
Slack as the main channel
Blocking
Empty
Date
June 16, 2026 → June 29, 2026
End Owner
Empty
Initiative
IronClaw core
Status
Scoped & Designed
Tag
Empty
Add a property
Comments
Problem
When a user asks the agent to hit a third-party API through the generic http tool ("send a message in Crisp", "look up a Stripe customer") — in Slack, the web UI, or any channel — it fails. Three closed doors:
The agent can't read its own credentials. By design it can only confirm a secret exists, never read the value (secrets_tools.rs).
It can't inject auth manually. The http tool blocks manual Authorization headers for any host with a registered credential mapping (http.rs:544-565) — and where no mapping exists, the agent has no value to insert anyway.
Note: even if you paste credentials into the vault, you still can't get the agent to use them.
Benchmarks
https://github.com/nearai/benchmarks/pull/55

User Story
As a Slack user, I want to configure a service like Crisp over http straight from a DM, including auth and credentials, so that I can use it in the future.
If possible, the credentials are posted via Slack without going through an LLM.
As a Slack user, I want to call a service like Crisp over http straight from a DM, so that I get a real result back.
Design for Channel experience
Three options to share credentials in Slack/Telegram:
```

</details>

### 12. Native app for screen capturing

- Phase / Status: Not started
- Date: July 17, 2026 → July 30, 2026
- Initiative: Managed App
- Tag: Differentiator
- Notion URL: https://app.notion.com/p/jasnahcom/Native-app-for-screen-capturing-36e29a6526bf8029a72ee4836c01b60d?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/12-native-app-for-screen-capturing.png](assets/near-ai-roadmap-2026-06-18/12-native-app-for-screen-capturing.png)
- Extracted image references: 1

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Native app for screen capturing
Blocked by
Empty
Blocking
Empty
Date
July 17, 2026 → July 30, 2026
End Owner
Empty
Initiative
Managed App
Status
Not started
Tag
Differentiator
Add a property
Comments
IronClaw must provide a native desktop application that enables screen capture as an input and observation channel for the agent. The app should support on-demand screenshots, continuous screen observation (with explicit user control), and region-scoped capture, feeding visual context into the agent's reasoning pipeline alongside text and voice inputs. Requirements include: cross-platform support (macOS, Windows), low-overhead capture, user-controlled start/stop and privacy indicators, selective masking of sensitive regions or applications, and secure transport of captured data.
The app must integrate with the existing agent interface (no parallel control surface) and support both interactive workflows (user shows the agent something) and autonomous observation (agent monitors a defined surface as part of a running workflow).
```

</details>

### 13. Custom build tools

- Phase / Status: Not started
- Date: July 1, 2026 → July 17, 2026
- Initiative: IronClaw core
- Notion URL: https://app.notion.com/p/jasnahcom/Custom-build-tools-36e29a6526bf80b48306e15daad54fa7?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/13-custom-build-tools.png](assets/near-ai-roadmap-2026-06-18/13-custom-build-tools.png)
- Extracted image references: 1

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Custom build tools
Blocked by
Empty
Blocking
Empty
Date
July 1, 2026 → July 17, 2026
End Owner
Empty
Initiative
IronClaw core
Status
Not started
Tag
Empty
Add a property
Comments
Today, building a custom tool to extend IronClaw is an expert exercise. Even a focused integration (e.g., "let IronClaw read my Crisp chats") takes a day for someone with Rust experience and
is effectively impossible for anyone else: it requires installing developer toolchains, hand-writing several hundred lines of code, learning undocumented file conventions, managing secrets through a
raw admin API, restarting the app, and iterating through silent failure modes. None of that is surfaced in chat or the web UI. As a result, real user needs stay blocked — IronClaw can be extended, but
only by the small subset of users who happen to be software engineers willing to spend hours debugging.
```

</details>

### 14. Permission management

- Phase / Status: Not started
- Date: June 26, 2026 → July 21, 2026
- Initiative: IronClaw core
- Blocked by: Admin configurable skills/tools
- Tag: Differentiator
- Notion URL: https://app.notion.com/p/jasnahcom/Permission-management-36e29a6526bf8042b417f0f2f7da5c0c?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/14-permission-management.png](assets/near-ai-roadmap-2026-06-18/14-permission-management.png)
- Extracted image references: 2

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Permission management
Blocked by
Admin configurable skills/tools
Blocking
Empty
Date
June 26, 2026 → July 21, 2026
End Owner
Empty
Initiative
IronClaw core
Status
Not started
Tag
Differentiator
Add a property
Comments
Main user story: As a user, I want to configure the agent’s permissions and tools access using natural language, so that I can manage my agent via a channel.
Trust Without Friction - Product Brief/Vision
```

</details>

### 15. Multi-tenant cross agent collaboration

- Phase / Status: Ideation
- Date: July 6, 2026 → July 26, 2026
- Initiative: IronClaw core
- Blocked by: Missions
- Tag: Differentiator
- Notion URL: https://app.notion.com/p/jasnahcom/Multi-tenant-cross-agent-collaboration-36e29a6526bf8039b69fc48e16d5cbb7?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/15-multi-tenant-cross-agent-collaboration.png](assets/near-ai-roadmap-2026-06-18/15-multi-tenant-cross-agent-collaboration.png)
- Extracted image references: 1

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Multi-tenant cross agent collaboration
Blocked by
Missions
Blocking
Empty
Date
July 6, 2026 → July 26, 2026
End Owner
Empty
Initiative
IronClaw core
Status
Ideation
Tag
Differentiator
Add a property
Comments
Main User Story: As a user, I want my agent to collaborate with my colleagues’ agents so that we can work on joint projects.
IronClaw must enable agents belonging to different users to collaborate within an organization without leaking private context across tenant boundaries. Each agent retains isolated memory, credentials, and tool permissions; cross-agent interaction happens only through explicit, auditable channels with a defined security context passthrough model. Admins retain visibility into cross-agent activity, and isolation is enforced within the TEE boundary rather than by policy alone.
```

</details>

### 16. User-voice model

- Phase / Status: Not started
- Date: July 5, 2026 → July 16, 2026
- Initiative: IronClaw core
- Notion URL: https://app.notion.com/p/jasnahcom/User-voice-model-36e29a6526bf80049af1f1de049292f3?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/16-user-voice-model.png](assets/near-ai-roadmap-2026-06-18/16-user-voice-model.png)
- Extracted image references: 1

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
User-voice model
Blocked by
Empty
Blocking
Empty
Date
July 5, 2026 → July 16, 2026
End Owner
Empty
Initiative
IronClaw core
Status
Not started
Tag
Empty
Add a property
Comments
IronClaw must support voice as a first-class input modality. Users should be able to issue instructions, define workflows, and interact with their agent via spoken input, with audio transcribed and routed through the same intent-handling pipeline as text. Requirements include low-latency capture, accurate transcription across accents and ambient conditions, speaker context preservation across multi-turn interactions, and parity with text input for all agent capabilities (tool calls, workflow definition, approvals). Voice input must operate within the TEE boundary to preserve the platform's privacy guarantees
```

</details>

### 17. Harness improvement feedback loop

- Phase / Status: Scoped & Designed
- Date: June 15, 2026 → June 30, 2026
- Initiative: Benchmarks
- Blocked by: Benchmarks in CI
- Notion URL: https://app.notion.com/p/jasnahcom/Harness-improvement-feedback-loop-36e29a6526bf808d8734fb5570553e98?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/17-harness-improvement-feedback-loop.png](assets/near-ai-roadmap-2026-06-18/17-harness-improvement-feedback-loop.png)
- Extracted image references: 1

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Harness improvement feedback loop
Blocked by
Benchmarks in CI
Blocking
Empty
Date
June 15, 2026 → June 30, 2026
End Owner
Empty
Initiative
Benchmarks
Status
Scoped & Designed
Tag
Empty
Add a property
Comments
Use benchmark results to drive systematic, measurable improvements to the agent harness — prompts, tool definitions, scaffolding, and retry logic.
The benchmark harness must produce structured, actionable output that feeds directly into product development. Each run should surface categorized failure modes (tool-call errors, context saturation, planning regressions, integration gaps), track regressions across versions, and expose results in a format that can be triaged into product priorities. Results must be persisted and queryable over time so trends — not just point-in-time scores — inform roadmap decisions. The harness is not complete until its output can be reviewed in a regular cadence and mapped to concrete changes in IronClaw primitives, integrations, or agent loop architecture.
```

</details>

### 18. Enhance Framework to support “new features” benchmarks

- Phase / Status: Scoped & Designed
- Date: July 1, 2026 → July 12, 2026
- End Owner: Pranav Raja
- Initiative: Benchmarks
- Notion URL: https://app.notion.com/p/jasnahcom/Enhance-Framework-to-support-new-features-benchmarks-36e29a6526bf80bfadfaf763cb2ab6a3?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/18-enhance-framework-to-support-new-features-benchmarks.png](assets/near-ai-roadmap-2026-06-18/18-enhance-framework-to-support-new-features-benchmarks.png)
- Extracted image references: 2

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Enhance Framework to support “new features” benchmarks
Blocked by
Empty
Blocking
Empty
Date
July 1, 2026 → July 12, 2026
End Owner
Pranav Raja
Initiative
Benchmarks
Status
Scoped & Designed
Tag
Empty
Add a property
Comments
Self-learning loops, permissions and secret management require the frame work improvements to full implement benchmarks:
Secret management: https://github.com/nearai/benchmarks/issues/59​
Self-learning loops: https://github.com/nearai/benchmarks/issues/62​
Memory: https://github.com/nearai/benchmarks/issues/63​
Improve the quality of benchmarks:
Mock main tool calls: https://github.com/nearai/benchmarks/issues/61​
```

</details>

### 19. Benchmarks in CI

- Phase / Status: In development
- Date: May 20, 2026 → May 31, 2026
- End Owner: Pranav Raja
- Initiative: Benchmarks
- Blocking: Harness improvement feedback loop
- Notion URL: https://app.notion.com/p/jasnahcom/Benchmarks-in-CI-36e29a6526bf8074bf40d4a19d271734?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/19-benchmarks-in-ci.png](assets/near-ai-roadmap-2026-06-18/19-benchmarks-in-ci.png)
- Extracted image references: 2

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Benchmarks in CI
Blocked by
Empty
Blocking
Harness improvement feedback loop
Date
May 20, 2026 → May 31, 2026
End Owner
Pranav Raja
Initiative
Benchmarks
Status
In development
Tag
Empty
Add a property
Comments
Run the agent benchmark suite on every CI build so regressions in agent capability — tool selection, multi-step reasoning, end-to-end workflow completion — get caught before they ship. Closes the gap between "code compiles" and "agent still works," and provides the signal the harness improvement loop needs to operate.
```

</details>

### 20. Onboarding to channel first approach

- Phase / Status: In design
- Date: June 16, 2026 → June 27, 2026
- Initiative: IronClaw core
- Blocked by: Slack as the main channel
- Notion URL: https://app.notion.com/p/jasnahcom/Onboarding-to-channel-first-approach-36e29a6526bf80a5a5fdf07e8ffe1396?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/20-onboarding-to-channel-first-approach.png](assets/near-ai-roadmap-2026-06-18/20-onboarding-to-channel-first-approach.png)
- Extracted image references: 2

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Onboarding to channel first approach
Blocked by
Slack as the main channel
Blocking
Empty
Date
June 16, 2026 → June 27, 2026
End Owner
Empty
Initiative
IronClaw core
Status
In design
Tag
Empty
Add a property
Comments
Problem statement
IronClaw's value is realized in the channel: Slack or Telegram is where the agent lives and where continuous, conversational work happens. But a channel can't be the entry point: a brand-new user can't authenticate, connect integrations, or be provisioned from inside Slack. The WebUI exists to get the user to the channel asap: authenticate the user, connect their channel, then get out of the way.
User Flow
Details are pending design exploration
```

</details>

### 21. NEAR Foundation must-haves

- Phase / Status: Scoped & Designed
- Date: June 11, 2026
- End Owner: Firat Sertgoz
- Initiative: IronClaw core
- Notion comments count: 2
- Notion URL: https://app.notion.com/p/jasnahcom/NEAR-Foundation-must-haves-36e29a6526bf80b3b02ef6d4fbd3f47f?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/21-near-foundation-must-haves.png](assets/near-ai-roadmap-2026-06-18/21-near-foundation-must-haves.png)
- Extracted image references: 3

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
NEAR Foundation must-haves
Blocked by
Blocking
Empty
Date
June 11, 2026
End Owner
Firat Sertgoz
Initiative
IronClaw core
Status
Scoped & Designed
Tag
Empty
Add a property
Comments
D
daniel
Jun 1
hey, my suggestion is that integrations with Google, Slack, Notion, and future systems like GitHub or Confluence should not be hardcoded into Ironclaw or treated as core capabilities.
Instead, we should rely on generic integration standards such as MCP, CLI tools, or skills. This keeps the architecture simpler and more flexible, while allowing users to connect whatever data sources best fit their needs.
More importantly, the industry is clearly moving toward agent-friendly interfaces like MCP and CLI. Rather than building deep, custom integrations ourselves, we should align with that trend and leverage these standards whenever possible.
e.g. for google we can use https://github.com/googleworkspace/cli , notion has mcp which we don’t need to adapt on demand, for slack there are community cli tools (or we can write one)
Firat Sertgoz
Jun 1
but these are not hardcoded, these are extensions that we provide users so that they activate if they want.
notion is an MCP, Gsuite is WASM because it provides us the best isolation/security guarantees.

I agree that we should move towards CLIs in general. I have a plan for this which we already started implementing with sandboxed runtimes but probably will land that towards the end of the week if everything goes well with NF launch.
👍
1
Must-haves that should be covered by Reborn:
Google Suite (Gmail, Calendar, Drive, Sheets, Docs)
Slack: I can talk to my agent via Slack (Slack relay)
Notion (via MCP)
Web UI with Google OAuth
Routines
3
Hosted
Railway - Supabase start → Crabshack migrate
Nice-to-haves:
Slack
Personal agent gets context from all Slack channels
Team agent
Skills
Admin creates skills that are available to everyone
(lower priority) Get skills from IronHub
Propagate tools by admin (
Multi-tenancy and permissions - product brief)
The bundle of must-haves that have to land for NEAR Foundation's internal rollout to be real. Per the page's own list: Google Suite (Gmail, Calendar, Drive), Slack relay, Notion via MCP, Web UI, and Routines — with Slack tool, IronHub skills, and admin-propagated tools as nice-to-haves. This is the acceptance criteria for "Reborn is shippable inside NEAR Foundation."
IronHub roadmap:
Internal-only space (Org isolation): NF-built skills and tools shared only inside NF, members invited by git auth, behaves like an Org space
Partly built on the partner dashboard (Railway)
Rating and voting: upvote the useful skills and tools, downvote the weak ones
Bundles / Loadouts: packaged roles bundling skills + tools (+ soul when ready), e.g. a paralegal
Collections (skills + tools) exist today, Phase 2
Loadouts add the soul layer when the runtime supports it
More added as user feedback comes in
```

</details>

### 22. Clean up old architecture

- Phase / Status: Scoped & Designed
- Date: June 12, 2026 → June 23, 2026
- Initiative: IronClaw core
- Blocked by: Reborn
- Notion URL: https://app.notion.com/p/jasnahcom/Clean-up-old-architecture-36e29a6526bf805fb2e9ff4da450683d?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/22-clean-up-old-architecture.png](assets/near-ai-roadmap-2026-06-18/22-clean-up-old-architecture.png)
- Extracted image references: 1

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Clean up old architecture
Blocked by
Reborn
Blocking
Empty
Date
June 12, 2026 → June 23, 2026
End Owner
Empty
Initiative
IronClaw core
Status
Scoped & Designed
Tag
Empty
Add a property
Comments
Delete the legacy code paths, services, and configuration that the migration to Reborn and Crabshack make obsolete. Pure tech-debt reduction: shrinks the surface area engineers have to reason about, removes a class of "which system runs this?" ambiguity, and unblocks future changes that would otherwise have to be made in two places.
```

</details>

### 23. Self-learning loops

- Phase / Status: Ideation
- Date: June 20, 2026 → July 8, 2026
- Initiative: IronClaw core
- Blocking: Long-term memory
- Notion URL: https://app.notion.com/p/jasnahcom/Self-learning-loops-36e29a6526bf8083af81d838c140d619?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/23-self-learning-loops.png](assets/near-ai-roadmap-2026-06-18/23-self-learning-loops.png)
- Extracted image references: 3

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Self-learning loops
Blocked by
Empty
Blocking
Long-term memory
Date
June 20, 2026 → July 8, 2026
End Owner
Empty
Initiative
IronClaw core
Status
Ideation
Tag
Empty
Add a property
Comments
Problem Statement
IronClaw's agents execute workflows but don't durably get better at them. Improvements either evaporate at session end or require a human in the loop.
For example, after a long conversation, the user needs to ask IronClaw to create a skill from it, but if the user forgets, the knowledge is gone. The same is true when an agent recovers from a failure or gets corrected: nothing persists unless someone asks.
Self-learning is what separates an agent that resets to zero every session from one that compounds, and it's becoming table stakes (Hermes ships it as a headline feature and courts our migration audience).
Benchmarks
https://github.com/nearai/benchmarks/pull/60
User Stories
As a user, after a long working session, I want the agent to save what it figured out on its own, so I don't have to remember to ask — and the next session starts where the last one left off.
As a user, when I correct the agent or it recovers from a failure, I want the working path to stick, so the same mistake doesn't recur, and I never give the same feedback twice.
As a user, I want the agent to learn my communication style and preferences, so over time, it matches how I work without me having to restate them.
As a user, I want the agent to recognize work it's done before and reuse the proven approach, instead of re-deriving it from scratch each time.
Design Ideas
Learn from errors
Learning Skill
Attachment - Hermes AI self-learning
Skill creation — skill_manage tool lets the agent autonomously write/edit/delete its own SKILL.md files; auto-triggers on complex tasks (5+ tool calls), error recovery, user corrections, or novel workflows.
Bounded memory — hard-capped MEMORY.md and USER.md the agent curates itself, persisting preferences, environment facts, and lessons learned across sessions.
Session search — unbounded conversation history in SQLite with FTS5 full-text search, letting the agent recall past threads on demand.
The Curator — background GC that ages skills (active → stale → archived) and consolidates near-duplicates so the learned library doesn't bloat.
Self-improvement nudges — periodic prompts pushing the agent to persist what it learned and model the user across sessions.
```

</details>

### 24. Slack app

- Phase / Status: Won't do
- Initiative: Managed App
- Notion comments count: 1
- Notion URL: https://app.notion.com/p/jasnahcom/Slack-app-36e29a6526bf806d84d5eb35b2f8cd45?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/24-slack-app.png](assets/near-ai-roadmap-2026-06-18/24-slack-app.png)
- Extracted image references: 1

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Slack app
Blocked by
Empty
Blocking
Empty
Date
Empty
End Owner
Empty
Initiative
Managed App
Status
Won't do
Tag
Empty
Add a property
Comments
S
Sergey Astretsov
Jun 3
Won’t do today:
Google & Slack apps - Overview
The official IronClaw Slack app, packaged for distribution through the Slack App Directory. Distinct from the relay: the relay is the message-routing mechanism; the app is the installable, brand-faced product surface that any Slack workspace can add. This is what external customers will install.
```

</details>

### 25. Security Improvements

- Phase / Status: Ideation
- Date: June 22, 2026 → July 16, 2026
- Initiative: Infra
- Notion URL: https://app.notion.com/p/jasnahcom/Security-Improvements-36e29a6526bf80a195c3e7fa7b591a2e?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/25-security-improvements.png](assets/near-ai-roadmap-2026-06-18/25-security-improvements.png)
- Extracted image references: 1

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Security Improvements
Blocked by
Empty
Blocking
Empty
Date
June 22, 2026 → July 16, 2026
End Owner
Empty
Initiative
Infra
Status
Ideation
Tag
Empty
Add a property
Comments
Main projects:
Cookie management
Key management
A focused pass of platform hardening: auth flows, secrets handling, sandboxing, audit logging, and the rough edges that always exist around a fast-moving agent runtime. Not a single feature — a list of targeted fixes that together raise the security floor enough to credibly sell into organizations with real compliance requirements.
```

</details>

### 26. TEE support for multi-tenancy

- Phase / Status: Scoped & Designed
- Date: June 24, 2026 → July 10, 2026
- Initiative: Infra
- Blocking: TEE Observability
- Notion URL: https://app.notion.com/p/jasnahcom/TEE-support-for-multi-tenancy-36e29a6526bf80729f4ad6052f0ac68e?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/26-tee-support-for-multi-tenancy.png](assets/near-ai-roadmap-2026-06-18/26-tee-support-for-multi-tenancy.png)
- Extracted image references: 1

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
TEE support for multi-tenancy
Blocked by
Empty
Blocking
TEE Observability
Date
June 24, 2026 → July 10, 2026
End Owner
Empty
Initiative
Infra
Status
Scoped & Designed
Tag
Empty
Add a property
Comments
Per-tenant isolation enforced at the hardware level via Trusted Execution Environments. Multiple users and orgs can share infrastructure efficiently while their data, memory, and credentials remain provably inaccessible to one another and to the platform operator. This is the architectural primitive that lets the free tier exist (see "Free tier via multi-tenancy") and is the differentiator the product leans on with privacy-sensitive buyers.
```

</details>

### 27. Free tier via multi-tenancy

- Phase / Status: Ideation
- Date: July 13, 2026 → July 24, 2026
- Initiative: Infra
- Blocked by: Path from free tier to dedicated agents
- Notion URL: https://app.notion.com/p/jasnahcom/Free-tier-via-multi-tenancy-36e29a6526bf80f596d1fca3b88c8e86?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/27-free-tier-via-multi-tenancy.png](assets/near-ai-roadmap-2026-06-18/27-free-tier-via-multi-tenancy.png)
- Extracted image references: 1

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Free tier via multi-tenancy
Blocked by
Path from free tier to dedicated agents
Blocking
Empty
Date
July 13, 2026 → July 24, 2026
End Owner
Empty
Initiative
Infra
Status
Ideation
Tag
Empty
Add a property
Comments
Use the multi-tenant architecture (and the TEE isolation that backs it) to offer a free tier where many users share infrastructure efficiently — making "try IronClaw" a one-click experience without giving up on the privacy guarantee. The growth-loop entry point: free-tier users come in, validate the value, and have a clear path to a dedicated agent when they need more.
```

</details>

### 28. Path from free tier to dedicated agents

- Phase / Status: Ideation
- Date: June 24, 2026 → July 10, 2026
- Initiative: Infra
- Blocking: Free tier via multi-tenancy
- Notion URL: https://app.notion.com/p/jasnahcom/Path-from-free-tier-to-dedicated-agents-36e29a6526bf807cb261e535b5f5860a?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/28-path-from-free-tier-to-dedicated-agents.png](assets/near-ai-roadmap-2026-06-18/28-path-from-free-tier-to-dedicated-agents.png)
- Extracted image references: 1

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Path from free tier to dedicated agents
Blocked by
Empty
Blocking
Free tier via multi-tenancy
Date
June 24, 2026 → July 10, 2026
End Owner
Empty
Initiative
Infra
Status
Ideation
Tag
Empty
Add a property
Comments
Define the product and billing journey from the shared free tier (multi-tenant, lower limits) to a dedicated agent instance (isolated resources, higher limits, paid). Covers the upgrade UX, what carries over, what changes about the user's agent, and the gates and signals that surface the upgrade at the right time.
```

</details>

### 29. Migrate existing agents from agent.near.ai to Reborn

- Phase / Status: Scoped & Designed
- Date: June 18, 2026 → June 24, 2026
- Initiative: Infra
- Notion URL: https://app.notion.com/p/jasnahcom/Migrate-existing-agents-from-agent-near-ai-to-Reborn-36e29a6526bf80278c40c7c1b7843f0a?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/29-migrate-existing-agents-from-agent-near-ai-to-reborn.png](assets/near-ai-roadmap-2026-06-18/29-migrate-existing-agents-from-agent-near-ai-to-reborn.png)
- Extracted image references: 1

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Migrate existing agents from agent.near.ai to Reborn
Blocked by
Empty
Blocking
Empty
Date
June 18, 2026 → June 24, 2026
End Owner
Empty
Initiative
Infra
Status
Scoped & Designed
Tag
Empty
Add a property
Comments
Port the live agents currently running on agent.near.ai over to the new Reborn surface. This is the cutover step that retires the legacy entry point and consolidates every existing user, agent, and integration onto a single platform so further work doesn't have to be done twice.
```

</details>

### 30. Migrate legacy agents to crabshack

- Phase / Status: In design
- Date: June 4, 2026 → June 18, 2026
- Initiative: Infra
- Blocked by: Crabshack w/ TEE
- Notion URL: https://app.notion.com/p/jasnahcom/Migrate-legacy-agents-to-crabshack-36e29a6526bf80e8b0a6fbdd3d3cca95?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/30-migrate-legacy-agents-to-crabshack.png](assets/near-ai-roadmap-2026-06-18/30-migrate-legacy-agents-to-crabshack.png)
- Extracted image references: 1

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Migrate legacy agents to crabshack
Blocked by
Crabshack w/ TEE
Blocking
Empty
Date
June 4, 2026 → June 18, 2026
End Owner
Empty
Initiative
Infra
Status
In design
Tag
Empty
Add a property
Comments
Port the legacy agent code paths onto the Crabshack runtime so every agent — old and new — executes through one path. Unblocks the "clean up old architecture" cleanup, consolidates the observability and security story, and removes the maintenance tax of running two execution stacks side by side.
```

</details>

### 31. Crabshack w/ TEE

- Phase / Status: In development
- Date: May 15, 2026 → June 3, 2026
- Initiative: Infra
- Blocking: Migrate legacy agents to crabshack
- Notion URL: https://app.notion.com/p/jasnahcom/Crabshack-w-TEE-36e29a6526bf80c6a073f84aa4abba16?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/31-crabshack-w-tee.png](assets/near-ai-roadmap-2026-06-18/31-crabshack-w-tee.png)
- Extracted image references: 3

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Crabshack w/ TEE
Blocked by
Empty
Blocking
Migrate legacy agents to crabshack
Date
May 15, 2026 → June 3, 2026
End Owner
Empty
Initiative
Infra
Status
In development
Tag
Empty
Add a property
Comments
Issue #7
nearai/nearone-agent-hosting
Connect to GitHub to update
Run the Crabshack agent execution runtime inside a hardware-backed Trusted Execution Environment. Brings the new runtime under the same privacy guarantee that defines the rest of the platform — agent code and the data it touches stay isolated from the host and from other tenants — and is the precondition for migrating legacy agents onto Crabshack.
```

</details>

### 32. Migrate to Railway

- Phase / Status: In development
- Date: May 15, 2026 → June 2, 2026
- Initiative: Infra
- Notion URL: https://app.notion.com/p/jasnahcom/Migrate-to-Railway-36e29a6526bf800cabd7eec3dc3f268e?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/32-migrate-to-railway.png](assets/near-ai-roadmap-2026-06-18/32-migrate-to-railway.png)
- Extracted image references: 3

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Migrate to Railway
Blocked by
Empty
Blocking
Empty
Date
May 15, 2026 → June 2, 2026
End Owner
Empty
Initiative
Infra
Status
In development
Tag
Empty
Add a property
Comments
Issue #27
nearai/nearone-agent-hosting
Connect to GitHub to update
Move IronClaw's deployment infrastructure onto Railway as the hosting platform. Replaces the current host with a managed setup that's faster to deploy to, easier to roll back, and simpler to operate for the small team — freeing engineering time from infra work so it can go into the product surface.
```

</details>

### 33. Google App / Certification

- Phase / Status: Won't do
- Initiative: Managed App
- Notion comments count: 1
- Notion URL: https://app.notion.com/p/jasnahcom/Google-App-Certification-36e29a6526bf80a58826e5f4430e199e?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/33-google-app-certification.png](assets/near-ai-roadmap-2026-06-18/33-google-app-certification.png)
- Extracted image references: 1

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Google App / Certification
Blocked by
Empty
Blocking
Empty
Date
Empty
End Owner
Empty
Initiative
Managed App
Status
Won't do
Tag
Empty
Add a property
Comments
S
Sergey Astretsov
Jun 3
Won’t do today:
Google & Slack apps - Overview
Get IronClaw verified and listed as a Google Workspace third-party app, so users can connect Gmail, Calendar, and Drive without their admin having to grant a special override. Removes the single biggest friction point in onboarding Google-shop teams and is a prerequisite for any self-serve motion that touches Google data.
```

</details>

### 34. Admin configurable skills/tools

- Phase / Status: Scoped & Designed
- Date: June 6, 2026 → June 20, 2026
- Initiative: IronClaw core
- Blocking: Permission management
- Notion URL: https://app.notion.com/p/jasnahcom/Admin-configurable-skills-tools-36e29a6526bf80408720fa4c6c636df6?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/34-admin-configurable-skills-tools.png](assets/near-ai-roadmap-2026-06-18/34-admin-configurable-skills-tools.png)
- Extracted image references: 2

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Admin configurable skills/tools
Blocked by
Empty
Blocking
Permission management
Date
June 6, 2026 → June 20, 2026
End Owner
Empty
Initiative
IronClaw core
Status
Scoped & Designed
Tag
Empty
Add a property
Comments
Problem Statement
A company runs a single multi-tenant IronClaw instance. Admins configure shared tools and skills (built-in or custom), so users start productive without per-user setup. Users access those shared tools but may need to authenticate individually (e.g., a shared Slack app where each user connects their own account). Users can also add their own private tools and skills on top.
Benchmark
We need to extend the benchmark framework to include non-LLM interactions of the agent, like saving secrets: https://github.com/nearai/benchmarks/issues/59​
User Stories
As an admin, I can add built-in tools and skills and make them available to all users.
An admin can configure a tool (e.g., a single Slack app), and users inherit that configuration.
As an admin, I can create and publish custom tools/skills to all users.
(Already available today) As a user, I can add my own private tools and skills.
(Out of scope) As a user, I can modify admin-created skills and tools.
For the initial phase, we won’t support it.
Open question: how per-user auth binds to an admin-configured tool (per-user OAuth token, credential injection into the shared tool config).
Inspiration
Multi-tenancy and permissions - product brief
User Flow (for discussion)
```

</details>

### 35. Slack as the main channel

- Phase / Status: Scoped & Designed
- Date: June 7, 2026 → June 15, 2026
- End Owner: Firat Sertgoz
- Initiative: IronClaw core
- Blocking: Onboarding to channel first approach; Secrets usage with Skills/Tools
- Notion URL: https://app.notion.com/p/jasnahcom/Slack-as-the-main-channel-36e29a6526bf8063b148c05ff5d36f16?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/35-slack-as-the-main-channel.png](assets/near-ai-roadmap-2026-06-18/35-slack-as-the-main-channel.png)
- Extracted image references: 6

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Slack as the main channel
Blocked by
Empty
Blocking
Onboarding to channel first approach
Secrets usage with Skills/Tools
Date
June 7, 2026 → June 15, 2026
End Owner
Firat Sertgoz
Initiative
IronClaw core
Status
Scoped & Designed
Tag
Empty
Add a property
Comments
Problem Statement
Users need to interact with IronClaw through Slack as a channel-first surface. There should be a way for both your personal agent and your team agents to work in Slack—where a member can reach their personal agent and the right team agent, each with the right memory and tools, without heavy per-team setup or a confusing tangle of bots.
Benchmarks/Success criteria
https://github.com/nearai/benchmarks/pull/54
User Stories
As an admin, I install one Slack app and map channels to agents (no separate app per team).
As a member, I DM IronClaw to reach my personal agent, so that I can discuss personal topics.
As an admin, I can assign agents to specific channels (#hr, #finance), so that the organization has team-level agents in Slack.
As a member, I @-mention IronClaw in #product, and the Product agent replies with its own tools and memory.
Phase 2 (Deferred)
(Deferred) As a user, I claim a team channel (e.g., #product) unless it's already claimed for an agent, so that I can create a team-level agent.
(Deferred) As a member, the team agent answers routine pings on my behalf with attribution.
Designs
User Flow
Background
Two ways to map Slack onto IronClaw agents:
Option A — one app per team. A separate Slack app per team agent (IronClaw Eng, IronClaw Product…). Distinct bot per team, stronger token-level isolation—but a new app to create, approve, and maintain for every team, and users face many bots.
Option B — one app, channel-routed. One IronClaw app; the channel determines the agent (DMs → personal agent; #product → Product agent w/ GitHub, Linear, Chir inbox; #hr → HR agent w/ Greenhouse, Gmail, Drive). One bot, simpler setup, config-based isolation.
We're going with Option B as a simpler setup, and a channel-bound context makes shared memory cleaner.
```

</details>

### 36. Reborn

- Phase / Status: In development
- Date: May 11, 2026 → June 10, 2026
- End Owner: Firat Sertgoz
- Initiative: IronClaw core
- Blocking: Clean up old architecture; NEAR Foundation must-haves
- Notion URL: https://app.notion.com/p/jasnahcom/Reborn-36e29a6526bf8042b267c52a1dab02cd?pvs=25
- Screenshot: [assets/near-ai-roadmap-2026-06-18/36-reborn.png](assets/near-ai-roadmap-2026-06-18/36-reborn.png)
- Extracted image references: 2

<details>
<summary>Extracted visible page text</summary>

```text
Add icon
Add cover
Add verification
Customize layout
Reborn
Blocked by
Empty
Blocking
Clean up old architecture
NEAR Foundation must-haves
Date
May 11, 2026 → June 10, 2026
End Owner
Firat Sertgoz
Initiative
IronClaw core
Status
In development
Tag
Empty
Add a property
Comments
The relaunched IronClaw product surface — the rebuilt platform that NEAR Foundation will run on as the first internal customer. Reborn is the umbrella initiative that brings together the core agent experience (Web UI, Routines), the connector set required for day-to-day work (Google Suite, Slack relay, Notion via MCP), and the polish needed for non-engineer adoption. Several other roadmap items either block on Reborn or extend it.
```

</details>
