# Workbench Live Data Wiring (Lane D)

Date: 2026-06-20
Scope: map EACH v13 Workbench region to a real backend source, classify it
(already-wired / needs-adapter / backend-gap), and define the real path to make
the surface ALIVE without fake data. Read-only analysis; cites `file:line`.

Companion: `workbench-backend-wiring-map-2026-06-20.md` (gaps G1-G6).

---

## 0. The core finding

The v13 surface looks alive because every region is seeded with mock work
(`private-workbench-v13.html:480-492` `SEED`): "Counter to Northwind" needs
approval, "2 emails need a reply", "Priya wants to move a call to 3 PM",
"Competitor watch · Fridays 8 AM", etc. None of that is fed by a backend today.

The current build is barren not because the wiring is broken but because the
**real feeds are genuinely thin on this profile** AND because three real,
populatable sources are under-consumed:

1. **Threads** (`GET /api/webchat/v2/threads`) — already wired into the rail via
   `outletThreadsState.threads` (`workbench-page.js:203,295`). On a fresh profile
   there are 0 threads, so every thread-derived group is empty. This is honest,
   not regressed: a real thread that is running / needs-attention / failed / has
   turns DOES populate Working / Needs-a-decision / Blocked / Ready-to-review
   today (`workbench-state.js:62-130`).
2. **Automations** (`GET /api/webchat/v2/automations`) — already wired
   (`workbench-page.js:210-215`, `workbench-state.js:207-294`). Probe shows
   `count: 0` on this profile, so Scheduled / Working / Receipts automation rows
   are empty. Real, just unpopulated.
3. **Composio (custom-mcp)** — `active`, `authenticated: true` (probe
   `extensions[0]`), provides Gmail/Calendar/Drive/Notion **tool calls**, but
   there is **NO read-only data endpoint** that returns unread emails or today's
   calendar. Composio's authenticated toolkits are not even enumerated by any
   route (probe `custom_mcp` exposes only a generic `mcp_custom_api_key` secret).

The "alive" content the operator wants ("what needs me today" = emails awaiting
reply, calendar conflicts) is therefore a **backend gap with a real workaround**:
it can only be produced by an **agent run** that calls the Composio MCP tools
(`GMAIL_FETCH_EMAILS`, `GOOGLECALENDAR_EVENTS_LIST`, etc.) and returns structured
results into a thread. There is no `GET /inbox` and no Composio `GET /toolkits/.../data`
route (confirmed: no `/inbox|/pending|/feed|/approvals|/receipts|/audit` in the
client, and `/automations` + threads are the only feeds).

---

## 1. Region -> source map (the table)

| v13 region (file:line) | What v13 shows (mock) | Real source today | Classification | Real path / adapter |
|---|---|---|---|---|
| **Branding line** "Abhi · NEAR AI Cloud" (`v13:508`) | static label | `currentUser` (outlet) + active provider `nearai` from `GET /llm/providers` (probe `llm.active.provider_id="nearai"`) | **regression-restore** (current build dropped it; data is real) | render `currentUser.display` + provider label in `WorkbenchDock` header (`components/workbench-shell.js`) — no new endpoint |
| **Needs approval** group (`v13:494,510-512`) | "Counter to Northwind", "Grow X" | (a) live in-thread gates via `thread-attention-details.js` → `threadAttentionRows` (`workbench-state.js:62-87`, groupId `needs-approval`); (b) `savedItems[].openApprovals` (`workbench-state.js:138-155`) — but `openApprovals` is always `[]` (`work-product-save.js:111`) | **needs-adapter** (live-gate path real but only for threads THIS browser opened) + **backend-gap** (cross-thread) | short term: real gates already populate this when a run hits an approval. Long term: `GET /approvals` (gap G2) → new `lib/approvals-feed-api.js` |
| **Needs a decision** main cards w/ trigger line (`v13:556-565`) | rich card: title, copy, `${I.mail} Dana replied at 8:04 AM…`, "Open packet" | `threadAttentionRows` already yields `title/detail/badge/icon/href` from the live gate (`workbench-state.js:71-84`, fed by `threadAttentionDetailFromGate` `thread-attention-details.js:44-84`). The "trigger" line (what email/event caused it) is NOT carried. | **needs-adapter** (richer card) + **backend-gap** (trigger provenance) | render the existing `row.detail` + `row.badge` in `TriageCard` (already done `workbench-page.js:74-103`). Add an optional `row.trigger` only when a gate carries source provenance; until the gate event includes it, omit (no fake trigger). |
| **Blocked** group (`v13:494,566-570`) | "Slack sign-in expired", "Reconnect Slack" | (a) failed threads → `threadAttentionRows` groupId `blocked` badge "Needs recovery" (`workbench-state.js:73,77`); (b) `sourceReadiness` rows in `needs-reconnect` state → `sourceRows` groupId `blocked` (`workbench-state.js:38-52`); (c) failed automations (`workbench-state.js:234-253`) | **already-wired** (all three are real) | none for data. Slack specifically is a Lane C connector gap: `/channels/connectable` returns `count:0` (probe), so a Slack reconnect row can only appear if Composio advertises Slack |
| **Working** group (`v13:494,510-512`) | "TEE vendor research · Comparing top 3" | running threads → `runningThreadRows` (`workbench-state.js:89-106`); running automations (`workbench-state.js:218-232`); installing/connecting sources (`sourceRows` `in-progress`) | **already-wired** | none. Populates the moment a run is active. |
| **Ready to review** group (`v13:494`) | "Investor update · Draft ready · 14 recipients" | (a) recent threads w/ turns → `recentThreadRows` (`workbench-state.js:108-130`); (b) saved artifacts → `savedWorkRows` artifact branch (`workbench-state.js:190-202`) | **already-wired** (local) + **backend-gap** (durable Work read = G1) | recent-thread path is fully real. Saved-work is localStorage only (`work-product-save.js:230-247`); cross-device needs `GET /work` (G1) |
| **Scheduled** group (`v13:494`) | "Competitor watch · Fridays 8 AM · next in 2 days" | active automations → `automationRows` scheduled branch (`workbench-state.js:255-270`); `savedItems[].watches` (`workbench-state.js:157-173`, always `[]`) | **already-wired** (automations) | automation read is real (probe `count:0` here). The "Watch this weekly" suggestion can't CREATE one — `POST /automations` is gap G4. Reading existing ones works. |
| **Recent receipts** group (`v13:489,514-515`) | "Filed Acme NDA · Saved to Drive" | (a) completed automations → `automationRows` receipt branch status `ok` (`workbench-state.js:272-291`); (b) `savedItems[].receipts` derived from tool-activity transcript at save time (`work-product-save.js:37-56,108`) | **needs-adapter** (automation receipts real) + **backend-gap** (external-action audit = G5) | automation-completion receipts are real now. Durable "what was actually sent/posted/filed" needs `GET /receipts` keyed off resolved gates (G5) → new `lib/receipts-api.js` |
| **"Arrived since you last checked" / "2 emails need a reply"** (`v13:575-579`) | "Priya wants to move a call to 3 PM", "Finance updated billing contact", "6 other emails handled" | **NONE** — no read-only Gmail feed. Composio is authenticated but the only way to read inbox is an agent run calling `GMAIL_FETCH_EMAILS` via MCP | **backend-gap** (no `GET /inbox`); **real path = agent run** | see §2. Run a scoped "what needs me today" agent turn through Composio; surface its structured output as triage rows. NOT a synchronous feed. |
| **Calendar conflicts** (implied by "move a call to 3 PM") | mock | **NONE** — Composio `GOOGLECALENDAR_EVENTS_LIST` only via agent run | **backend-gap**; real path = agent run | same as above via calendar MCP tool |
| **Command "What needs me today?" chip** (`v13:592`) | fills composer | already wired: fills draft, Ask → real thread/run (`workbench-plan.js` suggestion fill; `useWorkbenchStart` → `/threads`+`/messages`) | **already-wired** | this is the honest entry point for the "alive" content — it starts a real run that reads Gmail/Calendar via Composio |
| **"What's allowed" custody inspector** (`v13:604-611`) | "Can read: Gmail, Drive; Slack — sign-in expired" | `sourceReadiness` from `useWorkbenchSourceReadiness` (real install/auth state) | **needs-adapter** (Composio family-map) | the readiness states are real but mis-mapped: Composio-served Gmail shows "auth_required" because `sourceMatchesFamily` (`registry-readiness.js:31-56`) never matches the active `custom-mcp` toolkits. Lane C fix. |
| **Memory nav item** (`v13:433`) | nav present | n/a (navigation only) | **regression-restore** | current build removed Memory from nav (`workbench-shell.js`). Restoring nav is fine; the Memory PAGE write is still gap G3 (honest disabled mock). |

---

## 2. Making "what needs me today" alive — the only honest path

There is no inbox endpoint. Composio provides Gmail/Calendar **tools**, callable
only inside an agent run. So the alive triage content must come from a run, not a
poll. Two honest patterns, in order of fidelity:

**Pattern A — on-demand (ship first, zero backend work).**
The "What needs me today?" chip (`v13:592`, wired via `workbench-plan.js`
suggestion fill + `useWorkbenchStart`) already starts a real run. With Composio's
Gmail/Calendar toolkits authenticated and (after Lane C) selectable as sources,
that run calls `GMAIL_FETCH_EMAILS` (filter `is:unread newer_than:1d`) and
`GOOGLECALENDAR_EVENTS_LIST` (today) and returns a real readout — exactly the
v13 "Readout" scene (`renderReadout` `v13:614-631`: "3 emails came in. 2 still
need you."). This is real data, no fake rows, no new endpoint. The home triage
stays honest/empty until the user (or a schedule) asks.

**Pattern B — scheduled briefing (real, needs G4 write).**
A `POST /automations` that runs "summarize what needs me" on a cadence and writes
its structured result somewhere the rail can read. The automation READ
(`/automations`) and its completion receipt are already consumable
(`workbench-state.js:255-291`); the missing piece is (a) creating the automation
(G4) and (b) a place to read its latest structured output for the triage cards.
The cleanest target is an automation `latest_run` summary field surfaced as a
`needs-review`/`receipts` row — already partially modeled
(`workbench-state.js:272-291`), just needs the run to carry a `summary`.

**What must NOT happen:** synthesizing "2 emails need a reply" client-side, or
rendering a placeholder count. If no run has read the inbox, the triage shows the
honest all-clear ("Nothing needs you right now. Ask above to start something." —
this exact copy already exists `v13:580`).

---

## 3. Adapter inventory (what code consumes what)

| Source | Adapter (file:line) | Rail consumer | State today |
|---|---|---|---|
| Threads | `useThreads()` → `listThreads` `lib/api.js:410`; outlet `gateway-layout.js` | `buildWorkbenchStateRail({threads})` `workbench-state.js:344-354` | wired |
| Thread live-state (running/attention/failed) | `useThreadStates` `lib/thread-state.js`; `useThreadAttentionDetails` `lib/thread-attention-details.js:169` | `threadAttentionRows`/`runningThreadRows`/`recentThreadRows` `workbench-state.js:62-130` | wired (browser-local persistence) |
| Automations | `listAutomations` `lib/automations-api.js:3`; `useQuery` `workbench-page.js:210` | `automationRows` `workbench-state.js:207` | wired (read-only) |
| Saved work | `readSavedWorkSnapshot` `work-product-save.js:234` (localStorage) | `savedWorkRows` `workbench-state.js:132` | wired (local only; G1 for durable) |
| Source readiness | `useWorkbenchSourceReadiness` → `sourceReadinessItems` `registry-readiness.js:387` | `sourceRows` `workbench-state.js:38` | wired (Composio family-map broken — Lane C) |
| Gmail/Calendar data | **none** (Composio tools via run only) | n/a | **backend-gap** |
| Approvals (cross-thread) | **none** (G2) | n/a | **backend-gap** |
| Receipts/audit | **none** (G5) | n/a | **backend-gap** |

---

## 4. Bottom line for the build

- The rail's 6 groups, the triage cards, and the branding are all **real-data
  capable today** for threads + automations + saved work + source readiness. The
  regression was visual (cards stripped to one-line "source" rows, branding
  removed, Memory nav removed), NOT a data-feed loss. Restore the rich v13 card
  rendering and the existing real rows will fill it.
- The genuinely missing feed is **Gmail/Calendar "what needs me"**. It is a
  backend gap with ONE honest path: an agent run through the already-authenticated
  Composio MCP. Wire the "What needs me today?" / Ask path (already present) and,
  after Lane C maps Composio toolkits to the Gmail/Calendar families, that run
  reads real inbox/calendar and renders the real Readout scene.
- Do not add `GET /inbox`, optimistic approval lists, or client-synthesized
  counts. Each true gap (G1 Work read, G2 approvals, G4 automation create, G5
  receipts) stays empty/honest until its named adapter + route ship.
