# Legal Use Case — Reality Map (verified, 2026-06-21)

Direct answer to "does it work for **my** legal use case (review contracts, draft, Gmail/Calendar/Notion, approvals)?", grounded in code I verified this session — not vibes. Pairs with the [audit](workbench-legal-audit-2026-06-21.md) (verdict YELLOW) and the [sign-off runbook](legal-signoff-runbook.md).

## What actually works (verified)
1. **Legal ask is recognized + framed.** `inferWorkbenchScene` matches `msa|contract|redline|agreement|amendment|terms` → the `legal` scene with explicit **approval boundaries** ("sending external legal communications requires explicit approval"). The Ask packages domain + sources + approval boundaries into the work draft (`buildWorkbenchChatDraft`). **45/45 framing tests green** (scenes-registry + plan + work-items + state).
2. **Your connectors read live legal data.** Gmail, Calendar, Drive, Docs, Notion, Slack, GitHub — 8 accounts connected via Composio; **14/14** live-connector suite passes on the current (credential-pinned) binary.
3. **The agent can use those connectors for reads** (`connected-sources.read`, read-only — it cannot send/delete/mutate; enforced multi-layer).
4. **Drafts work, sends are gated, deletes forbidden.** Gmail draft creates a real reviewable draft; sends require an explicit capability flag (off by default) + approval; deletes are always forbidden. The write-gate decision is now a pure, unit-tested helper (4 kinds × send_enabled).
5. **Security is sound for connecting your real accounts.** NEAR AI credential is pinned to NEAR hosts (can't be exfiltrated to a redirected host); keys never logged or sent to the browser; agent reads are read-only.
6. **Contract-review / drafting skills are now installable in-app** (skills UI wired to the v2 backend).
7. **A stale model gives an actionable error** ("pick another in Settings/Inference") instead of a raw failure.

## What's gapped (honest)
1. **Execution is a Chat agent turn, not a fully-built native Work surface.** The Workbench *frames* the legal work (scene, sources, approval boundaries) deterministically, but the actual review/drafting runs as an agent turn. Single/few-step asks ("summarize this email", "draft a reply", "what are the key terms") are reliable. A **heavy one-shot legal review** (read MSA → cite every clause → counsel questions → redline, all in one turn) can over-tool-call / not converge with the current model (the model-bound convergence limit). Break a big review into steps for now.
2. **The richer "structured Work" contract is aspirational.** [practical-work-scenario-corpus.md](practical-work-scenario-corpus.md) specifies a typed Work item with missing-context blockers (e.g., "blocked on governing law"), a dossier, and watches — but its claimed fixtures (`src/lib/util/workflow-scenarios.ts`) **do not exist** in this checkout. What's implemented is the simpler scene + approval-boundary framing above, not the full dossier/blocker/watch contract.
3. **No in-app tool-permission governance** (per-tool ask/allow/disable for email-send, calendar-write, file access). It's a from-scratch security feature (the runtime override store doesn't exist yet) — the guardrail a cautious lawyer most wants, still to build.
4. **Connector reads are default-on with no per-turn consent.** Once connected, any agent turn can read your mailbox/calendar. Fine for convenience; for privileged material you may want a consent/ask gate (not built yet).
5. **Not yet proven on your live accounts.** Everything above is verified against the staged binary + connected test accounts; the end-to-end GUI round-trip with *your* NEAR sign-in is the runbook's Part B (your run).

## Bottom line
For **everyday legal chief-of-staff tasks** — triage the inbox, surface what needs a decision, pull a contract from Drive, draft a reply or a counter with the key terms, hold every send for your approval — the foundation works and is safe to connect your accounts to. For **heavy autonomous multi-step review** and **fine-grained per-tool governance**, there are real gaps (execution convergence, tool-permission UI, consent). Run the runbook's Part B to confirm on your accounts; that plus shipping #12 moves this from YELLOW to GREEN.
