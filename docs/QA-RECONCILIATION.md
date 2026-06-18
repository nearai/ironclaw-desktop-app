# IronClaw QA — Reconciliation & Testing Notes

_Working reconciliation of the Manual + Automated QA sheet against root-cause diagnosis, shipped fixes, the credit blocker, and live gateway probes. Updated 2026-06-16._

## TL;DR

- **Two QA data sources that look contradictory until you separate them.** The team's manual sheet (testers Josh/Artem/Tat/Matias/MK/Sergey, 6/9→6/16) shows a best-tester pass rate climbing **6% → 79%**. abby's local run looked far worse because it was poisoned by a hard blocker, not by the same bugs.
- **The local blocker was credit exhaustion, now cleared.** `cloud-api.near.ai/v1/chat/completions` was returning **HTTP 402 "Credit limit exceeded, Spent $5.01 / Limit $5.00."** Every model turn failed locally. Credits were re-upped 2026-06-16; chat completions return 200 again.
- **Live probes against the local gateway (credits restored) isolate the real gateway bugs**, separate from the credit issue:
  - Plain answer ("what is 2+2") — works, 21 s.
  - HTTP-tool turn ("check near.ai 200") — **no answer after 120 s** (F1).
  - Web search ("HN for IronClaw/NEAR AI") — returns the model's **chain-of-thought instead of results** (B3).
  - Routine ("every 5 min … DM me in Slack") — **8+ tool calls, no answer, zero routines persisted** (F1 + F5).
- **Four UI bugs already fixed and shipped** this cycle (connect-button stuck after closing OAuth, new chats missing from Recent, Trace Commons error state, onboarding bounce).
- **Six gateway fixes (F1–F7) are landing now** via the parallel session's codex stream; F4 (402 handling) is committed-quality and test-green. The rest are pending one sidecar rebuild.
- **Genuinely blocked, not fixable in this build:** Telegram has no package; Slack is behind a disabled feature flag; outbound delivery (email/Slack send) needs real OAuth.

## Source-of-truth: the two runs reconcile

| | Team manual sheet | abby local run |
|---|---|---|
| Window | 6/9 → 6/16, 6 testers | this session |
| Provider state | credits available | **was 402-blocked**, now restored |
| Connectors | real OAuth (Gmail/Slack/Drive/Sheets) | headless; OAuth not exercised |
| Trend | 6% → 79% best tester | n/a until rebuild |
| What it measures | end-to-end product incl. connectors | gateway behavior in isolation |

The team sheet is the product's real trajectory. The local run is a gateway-isolation harness. They do not contradict; they measure different layers.

## Live probe — before-state (pre-fix sidecar, credits restored)

Harness: `/tmp/qa-live-probe.sh` (create thread → post message → poll `/api/webchat/v2/timeline`). Reproducible; this is the creds-free regression set.

| Probe | QA case | Result | Latency | Root cause |
|-------|---------|--------|---------|-----------|
| `what is 2+2` | answers baseline | **PASS** ("4") | 21 s | — |
| `check near.ai returns 200` | 3B | **HANG** — user msg only, no assistant | >120 s | **F1** — stalls after tool, no recovery into prose |
| `search HN for IronClaw/NEAR AI` | 8B | **CoT-leak** — emits planning ("I have web search via web-access.search / nearai.web_search…") not results | 29 s | **B3** — chain-of-thought finalized as the answer |
| `every 5 min ping near.ai, DM Slack` | 3C | **HANG + no persist** — 8+ tool calls, no assistant, `/automations` count 0 | >120 s | **F1 + F5** — stalls after tools; trigger blocked by approval gate |

This is the gold before-state. Re-run after the rebuild to confirm each flips.

## Live probe — after-state (F4–F7 rebuilt, credits live)

Gateway rebuilt from `a0db6373` (F4) + F5/F6/F7, run standalone on :3000 with the app's env.

| Probe | Before | After | Verdict |
|-------|--------|-------|---------|
| `2+2` | PASS 21s | PASS 12s | unchanged ✓ |
| `check near.ai 200` (3B) | hang, no answer | still hangs | **F1 pending** |
| `search HN` (8B) | CoT-leak | still CoT-leak | **B3 pending** (model-behavior) |
| `every 5 min … DM Slack` (3C) | 8+ tools, no answer, no routine | **coherent answer**: "Slack isn't an available delivery target — connect it first"; routine not created | improved; gated on **B5** (Slack), no longer a silent stall |
| **delivery-free routine** ("every 5 min check near.ai 200, just create it") | n/a | **routine persisted AND fired** — `/automations` 0→2, `last_status: ok`, trigger poller executed it | **F5/F6/F7 CONFIRMED LIVE** |

Net: F4 (committed), F5/F6/F7 (committed + verified end-to-end: create → persist → schedule → fire → ok). The routine-creation cluster works once the schedule has no external delivery dependency. 3C-style "DM me in Slack" routines remain gated on B5 (connect Slack) — and the model now says so plainly instead of stalling.

## Fix → case mapping

### Shipped this cycle (static UI, committed)
| Fix | Symptom | Files |
|-----|---------|-------|
| cancelable NEAR sign-in | connect button dead after closing OAuth window | `useProviderLogin.js`, `provider-login-status.js` |
| `["threads"]` invalidation | new chats absent from Recent | `useChat.js` |
| Trace Commons 403/404 → calm empty state | "Trace Commons doesn't work" | `useTraceCredits.js`, `trace-commons-tab.js` |
| front door owns first-run setup | onboarding redirect bounce | `gateway-layout.js`, `empty-state.js` |

### Gateway fixes landing now (one sidecar rebuild)
| Fix | Fixes cases | What it does | State |
|-----|-------------|--------------|-------|
| **F4** | 2D, 5C, 6C, any out-of-credits | 402 → fast non-retryable terminal failure (`model_credits_exhausted`); frontend shows "out of credits" bubble instead of a multi-minute hang | **committed `f6e2707a` + pushed** (tests green) |
| **F5** | 1C,2E,3C,4D,6D,7C,8C | exempt `builtin.trigger_create/remove` from the local-dev approval gate so routines persist | **committed `a0db6373` + pushed + VERIFIED LIVE** (routine persists + fires) |
| **F6** | 1C,2E,7C | accept plain-literal cron seconds (`30 */5 * * * *`); cadence guard remains | **committed `a0db6373` + pushed** (triggers tests green) |
| **F7** | 1C,7C,8C | trigger `timezone` optional (default UTC) — no clarifying round-trip for "every N minutes" | **committed `a0db6373` + pushed + VERIFIED LIVE** (UTC default works) |
| **F1** | 1A,2A–2C,3A,3B,4A,4B,8A + 3C | recover a stalled tool-only turn into a prose answer instead of `driver_protocol_violation` | **pending** — decouple in `loop_exit.rs` (NOT the resolver flag-flip, which changes the profile identity hash); verify on 3B |
| **F3** | 5C, 6C | stop reply-admission from eating a real one-line answer that names a `__`-tool | **pending** — rewrites a reject test; verify after |

### Blocked (not fixable in this build)
| ID | Cases | Reason / unblock |
|----|-------|------------------|
| **B1** | all model turns | **was** credit exhaustion — RESOLVED 2026-06-16 by top-up. F2/F4 make any future occurrence fast + visible. |
| **B2** | 4A, 4B | model stalls after `extension_search` on connect, sometimes hallucinates success ("4B PASS(hallucination)"). Needs a connect-flow section in the system prompt + F1. |
| **B3** | 8B | auto-router picked a non-tool-calling model; CoT leaked as answer. Pin a tool-capable model or `tool_choice=required` for explicit search. |
| **B4** | 1A–1C, all Slack | Telegram has no package; Slack is behind disabled `slack-v2-host-beta`. Connector must be built/enabled. |
| **B5** | 1C, 3C, 6D, deliveries | outbound delivery (DM/email send) needs real Slack OAuth + a populated delivery-target registry. Decouple create from delivery so routines still persist with a "won't deliver until Slack connected" note. |

## Per-case disposition (latest team signal)

`P/F` = pass/fail tally across all team runs. Dispositions: WORKS · FLAKY · FIX-PENDING(F#) · BLOCKED(B#) · CREDS (needs real OAuth to E2E).

| Case | Title | Team P/F | Disposition |
|------|-------|----------|-------------|
| 1A | connect Telegram | 0/2 | BLOCKED(B4) |
| 1B | summarize NEAR news → Telegram | 0/2 | BLOCKED(B4) |
| 1C | in 3 min, Telegram digest | 0/2 | BLOCKED(B4) + FIX-PENDING(F5,F7) |
| 2A | connect Gmail | 15/4 | WORKS · CREDS |
| 2B | connect Calendar | 16/3 | WORKS · CREDS |
| 2C | connect Drive | 16/3 | WORKS · CREDS |
| 2D | meeting prep from Docs + news | 6/11 | FIX-PENDING(F1,F4) · CREDS |
| 2E | routine: 30-min meeting email | 5/8 | FIX-PENDING(F5,F6,F7) |
| 2F | email actually sent | 1/9 | BLOCKED(B5) |
| 3A | connect Slack | 11/2 | WORKS\* · CREDS (\*Slack flag) |
| 3B | check near.ai 200 | 11/3 | FIX-PENDING(F1) — reproduced hang |
| 3C | routine: 5-min ping → Slack DM | 4/10 | FIX-PENDING(F5,F6,F7) + BLOCKED(B5) |
| 3D | Slack msg from routine | 2/10 | BLOCKED(B5) |
| 4A | connect Gmail | 13/4 | WORKS · CREDS |
| 4B | connect GitHub | 3/12 | FLAKY/BLOCKED(B2) |
| 4C | list my repos | 8/6 | FLAKY(B2) · CREDS |
| 4D | routine: 5-min GitHub issues → Slack | 2/11 | FIX-PENDING(F5,F6,F7) + BLOCKED(B5) |
| 4E | Slack msg on new release | 1/10 | BLOCKED(B5) |
| 5A | connect Slack | 12/2 | WORKS\* · CREDS |
| 5B | connect Drive | 12/3 | WORKS · CREDS |
| 5C | use Strategy doc as KB | 3/7 | FIX-PENDING(F1,F3) · CREDS |
| 5D | Slack DM strategy Q | 2/7 | BLOCKED(B4,B5) |
| 6A | connect Gmail | 13/3 | WORKS · CREDS |
| 6B | connect Sheets | 9/7 | FLAKY · CREDS |
| 6C | emails → Sheet ABC | 6/7 | FIX-PENDING(F1,F3) · CREDS |
| 6D | routine: 30-min inbox → Sheet | 2/7 | FIX-PENDING(F5,F6,F7) |
| 6E | rows appear in Sheet | 2/6 | BLOCKED(B5) |
| 7A | connect Slack DM | 4/6 | FLAKY/BLOCKED(B4) |
| 7B | connect Sheets | 7/6 | FLAKY · CREDS |
| 7C | routine: bug: → Sheet row | 0/8 | FIX-PENDING(F5,F6,F7) + BLOCKED(B4,B5) |
| 7D | send bug: in Slack | 1/8 | BLOCKED(B4,B5) |
| 7E | row added to sheet | 0/8 | BLOCKED(B5) |
| 8A | connect Slack | 12/2 | WORKS\* · CREDS |
| 8B | search HN | 8/4 | FIX-PENDING(B3) — reproduced CoT-leak |
| 8C | routine: hourly HN → Slack | 2/9 | FIX-PENDING(F5,F6,F7) + BLOCKED(B5) |
| 8D | Slack msg on HN match | 1/7 | BLOCKED(B5) |

Pattern: **connect flows work** (Gmail/Calendar/Drive solidly; Slack/GitHub/Sheets flaky), **answers are F1/F3/F4**, **routine creation is F5/F6/F7**, **delivery is B5**, **Telegram is B4**.

## Retest protocol

### Creds-free (run after every sidecar rebuild — no OAuth needed)
`bash /tmp/qa-live-probe.sh` against the running gateway. Pass criteria after the fix-batch lands:
- **3B** returns an HTTP-status answer (no >120 s hang). — F1
- **3C** persists a routine: `/api/webchat/v2/automations` count > 0. — F5/F6/F7
- **402 fast-fail**: with an out-of-credits key, a tool turn fails in <10 s with `model_credits_exhausted` and a timeline failure bubble (not a multi-minute hang). — F4
- one-line tool-result answer is admitted, not rejected. — F3 (unit: `cargo test -p ironclaw_agent_loop reply_admission`)
- cron `30 */5 * * * *` parses (unit: `cargo test -p ironclaw_triggers`). — F6/F7

### Creds-required (team E2E, real OAuth)
Connect flows (2A–2C, 3A, 4A/4B, 5A/5B, 6A/6B, 7A/7B, 8A), grounded answers (2D, 5C, 6C), and any delivery leg (2F, 3D, 4E, 6E, 7E, 8D). These cannot be auto-verified headless; the team sheet is the signal.

## Coordination caveat

A second Claude session (`ab239988`) is concurrently applying the gateway fix-batch **and** rebuilding the macOS app against the same `/tmp/ironclaw-mono` tree. This is outside the documented swim lanes (which cover the v0.3.0 desktop roadmap, not the monorepo gateway crates). Per the repo's "Do Not Touch concurrent work" rule, this session stays off the gateway crates to avoid clobbering in-flight edits. One driver should own the gateway fix + rebuild; the other verifies.

## Status

- **Landed + pushed** to `origin/desktop/consolidate-into-monorepo`: F4 (`f6e2707a`), F5/F6/F7 (`a0db6373`). Sidecar rebuilt from source; F5/F6/F7 verified live (routine create → persist → fire).
- **Next:** F1 (stalled-turn recovery, via `loop_exit.rs` decouple) + F3 (one-line reply admission) — both need a rebuild + live re-probe of 3B. B3 (8B CoT-leak) is model-behavior: pin a tool-capable model or `tool_choice=required`.
- **Separate build tasks, not QA fixes:** Telegram package (B4), Slack connector + delivery-target registry (B5). 3C/4D/6D/7C/8C "deliver to Slack" routines stay gated on B5 until Slack connects — the routine engine itself is fixed.
- **Blocked on user:** nothing — credits restored.
