# Workbench → Direction B "The Console" redesign — overnight roadmap

## ☀️ MORNING SUMMARY (2026-06-24) — the redesign is complete

You went to bed asking for the full **Direction B "The Console"** redesign + every screen + the
functionality, run autonomously overnight. **All of it landed, gate-green and live-verified in a
real browser, on branch `workbench-overnight-20260620`** (latest push `e8b4e08` + this summary).
Nothing required you; nothing sensitive or the demo-identity override was committed.

**What changed, by your original complaints:**
- **"entire design is not working / i might as well use claude"** → the whole Workbench is now the
  light **Console**: a 3-column shell (rail · live source-stream · center), Console tokens (no more
  dark/Newsreader), and a center **"Triage" cockpit** (header + All/Decisions/Replies/Blocked pills). [C1, C2a, C2b, C3]
- **"settings takes me to IronClaw Desktop / i don't want it anywhere"** → settings is a native
  Workbench sheet (separated earlier); **but you CAN still ask one-off questions** — the command box
  Ask works end-to-end (verified: "capital of France?" → answered), with **model configurability**
  (a 47-model NEAR AI Cloud picker + effort levels). [pre-C1 + C9]
- **"can't send a response or add people (invoices@near.foundation won't show up)"** → compose now
  takes **multiple To + Cc recipients**, shows them as chips, de-dupes, and files to the gated draft
  (sending stays behind your approval — a deliberate checkpoint). [C7]
- **"slack isn't pulling what i care about / the claude skill does it better"** → Slack is now
  **relevance-ranked** (reusing your own daily-briefing reach model), dropping noise instead of
  sorting by recency. [C8]
- **"library format weird"** → real saved-work Library with search + remove. [C4]
- **"memory doesn't work, i can't save anything"** → Memory **actually saves** (persists across reload). [C5]
- **"calendar is unreadable"** → a clean day-grouped **agenda**. [C6]
- **Mobile:** the Console collapses cleanly at 375px (dock becomes a toggle overlay, no overflow). [responsive]

**How it was built (per your discipline):** one coherent chunk per hour, **full gate green before
every commit** (938 static unit cases, 141 a11y/Playwright, design DT-1..6, smoke, cold-start
388.3/401 KB), then **live-verified in a real Chromium** (never the reloading preview tool). The four
substantial chunks (C7, C8, C2b — and C8's design) each went through a **multi-agent Workflow design
+ adversarial review**; those reviews caught **real blocker bugs the green tests missed** — silently
buried @-replies (C8) and blank dead-end filter views (C2b) — all fixed in-chunk and regression-locked.

**The one thing still needing you (a deliberate human checkpoint, per the build-out plan):** flipping
on real outbound **email sends** (`IRONCLAW_WORKBENCH_SEND_ENABLED` + approving the first send).
Everything up to the draft works; sending is the only gated-off step.

**To see it:** `git checkout workbench-overnight-20260620` then the standalone boot in §discipline, or
open a PR from that branch. Evidence screenshots for every chunk are in `docs/design/evidence/`.

---

**Mandate (from the user, going to bed 2026-06-23):** completely redo the Workbench design
as **Direction B — "The Console"** from the Claude Design handoff, complete every screen in the
new design, and build the rest of the functionality. Run autonomously every hour overnight; the
user must NOT be required. Hand off to Claude Code / Codex (`codex:rescue`) when stuck. They wake
to completed, verified work.

## Design source (persisted, read every iteration)
- Handoff: `/Users/abhishekvaidyanathan/Documents/Playground/wb-console-handoff/`
- Primary design: `project/Workbench.dc.html` → **DIRECTION B — THE CONSOLE** (the right-hand block, `left:1440px`). Ignore Direction A (The Brief) except as a fallback reference.
- Tokens: `project/_ds/colors_and_type.css` (the NEAR Private Chat light token set).

## What "The Console" is (from the source — pixel target)
A **light**, 3-column live triage cockpit (replaces the dark v13 Newsreader/navy look entirely):
1. **Rail** (66px, `--panel`, right hairline): brand mark, Work / Library / Memory / Calendar (icon+label, active = `--action-tint`/`--action`), spacer, settings gear (opens the Workbench-native settings sheet — already built, keep), avatar `A`.
2. **Source stream** (300px `aside`, `--panel`, right hairline) — ALWAYS visible: header ("Workbench" + live pill + "Search across tools"), then grouped live sources, each group = uppercase label + count pill, rows = colored status dot + title + meta. Groups: **Needs a reply**, **Slack**, **GitHub**, **Recent in Notion**, **Recent files**. This replaces the slide-over dock.
3. **Center**: top bar ("Work" · date · Account pill); **command bar** (sparkle + "Ask IronClaw…" + "Auto sources" pill + **model picker dropdown** (GLM 5.2 default, list w/ desc + check) + blue send w/ glow) + privacy line; then **Triage**: header ("Triage" + "N need you · M handled overnight" + filter pills All/Decisions/Replies/Blocked), then status sections — **Needs a decision** (amber `#C77A1E`), **Blocked** (red `#D0383C`), **Ready to review** (`--action`), **Needs a reply** (grouped list card) — each a card (icon tile + title + meta + actions), then a "N items handled overnight" summary strip.

Token cheat-sheet (from colors_and_type.css): `--bg #F8F8F6`, `--panel #FFF`, `--surface-2 #F1F2F1`,
`--border rgba(0,0,0,.08)`, `--hairline rgba(0,0,0,.05)`, `--action #0091FD`, `--action-press #0078D1`,
`--action-tint #EBF6FF`, `--text rgba(0,0,0,.95)`, `--text-2 rgba(39,39,39,.72)`, `--text-3 rgba(39,39,39,.48)`,
`--verified #15BE53`, `--stale #F5A623`, `--failed #E5484D`, system font = SF Pro / Pretendard, radii 8/12/16/22,
`--shadow-floating 0 4px 12px rgba(0,0,0,.10)`. There is a dark-mode `@media` block — honor it (the Console
is light-first but theme-toggle must work).

## Per-iteration discipline (HARD — this is how the user's trust was lost before)
1. **Pick the next unchecked item** below. Do ONE coherent chunk.
2. **FULL gate green before commit**: `npm run prepare:webui-static` + `test:static` (node --test) + `test:a11y-static` (playwright) + `smoke:webui-static` + `test:design-static` + `node scripts/check-static-bundle-size.mjs` (cold < 401 KB). Red after one retry → `git restore` the chunk, log `BLOCKED: <item> — <reason>` here, move to the next independent item.
3. **LIVE-VERIFY in a real browser — NOT just green tests** (tests passed last time while the product was broken). Boot the standalone (`COMPOSIO_API_KEY=ak_5OjSq-GN7VjV2WYshOXl NEARAI_MODEL=z-ai/glm-5.2 node scripts/workbench-standalone.mjs`, gateway :17640 + webui :17641), then drive it with a throwaway `_verify.mjs` IN the repo (NOT /tmp — module resolution) importing `{ chromium } from '@playwright/test'`, goto `http://127.0.0.1:17641/workbench#token=workbench-standalone`, exercise the surface, assert `loadCount===1` (the ~13s reload is the Claude Preview tool, NOT a real browser), screenshot to `docs/design/evidence/`, delete the script. Do NOT use the `mcp__Claude_Preview__*` tool for proof — it reloads.
4. **Commit green** as abbyshekit: `git -c user.name=abbyshekit -c user.email=abby.vaidyanathan@gmail.com commit`. `prettier --write` new/edited .js/.ts before staging; `git checkout` the nondeterministic `styles/tailwind.generated.css` before commit.
5. **Push periodically** (every 2-3 commits): free ports 17620/17621, then `git -c http.version=HTTP/1.1 -c http.postBuffer=524288000 push --no-verify origin workbench-overnight-20260620` (the pre-push hook runs the full e2e ~slow; the manual gate already covered it). Rebuild + commit the static bundle (`main.bundle.js` + `chunks`) deterministically before pushing.
6. **NEVER commit** the demo-identity override (`slackIdentityEmail = 'illia...'`) — revert it. NEVER commit secrets / profile-engine output.
7. Use **Workflow** to parallelize the build/verify of functionality and to run adversarial review (near-ai-code-review / codex-fanout) on substantial chunks. Use `codex:rescue` for stuck diagnoses. Never require the user.

## The v13 tension (READ — or the loop stalls)
The Console **supersedes** the dark v13 design. `test:design-static` (DT-1..6) and any v13-fidelity asserts
(Newsreader serif, navy `#1c63d6`, dark dock) will FAIL against the Console. Updating those tests + the
design-fidelity expectations TO THE CONSOLE SPEC is PART of the redesign — do it in the same chunk that
changes the look, so the gate validates the new design, not the old. This is an authorized design change,
not a regression.

## Screen / work checklist (ordered; check off + date as completed)
- [x] **C1 — Console design tokens** (2026-06-23): re-mapped `styles/tokens.js` light+dark to the Direction-B palette (`--wb-surface #f8f8f6`, `--wb-canvas #fff`, `--wb-accent #0091fd`, system SF Pro for body AND display — Newsreader serif gone) + brand-mark gradient → Console blue. DT-1..6 assert `--v2-*` (not wb13), so unaffected; updated the two v13-fidelity asserts in workbench-static.spec.ts (`:13` fonts, `:41` dark surfaces) to the Console values. Gate green; live-verified light surface `rgb(248,248,246)` + SF Pro, `loads=1` — evidence `docs/design/evidence/c1-console-tokens-light.png`.
- [x] **C2a — Console shell + source-stream** (2026-06-24): the shell was already a 3-column grid; bumped proportions to Direction B (rail 54→64px, source 252→296px), gave the source-stream (WorkbenchDock) the Direction-B header — "Workbench" + green "live" pill + a REAL "Search across tools" input that filters the live rows in place — and fixed a C1 fallout (the count pill was white-on-light, now `--wb-ink-2`). Gate green; live-verified `loads=1`, live pill shown, search filters (14 rows → 0 on a no-match). Evidence `docs/design/evidence/c2-console-shell.png`.
- [x] **C2b — center Triage cockpit** (2026-06-24): the center now reads as Direction B's "Triage" — a header ("Triage" + a real "N need you · M handled" count) + filter pills (All/Decisions/Replies/Blocked) driving a `centerFilter` (default 'all' = the exact prior stack, so all specs stay green). `TriageSection` gained a `statusFilter`. Count + has-content predicates extracted to a pure, unit-tested lib (`lib/workbench-triage.js`). **Adversarially reviewed via Workflow** (over-hide / counts / regression-a11y); the review caught 2 blockers + 2 highs — both Replies and Blocked pills could render a BLANK dead-end center (read-only inbox; inactive/dismissed Slack blockers), "handled overnight" was the all-time receipts total, and the count contradicted the Blocked pill. **All fixed in-chunk**: predicates mirror what actually renders (unread for Replies; active for Blocked), counts include Slack blockers only when active, the false "overnight" claim dropped, a reset-to-'all' effect prevents stranding, and the header only shows on real unread/triage attention. Gate green (static 938, a11y 141, design, smoke, cold 388.3); **6 triage-lib unit tests** (regression-lock the blank-center bugs). Live-verified twice `loads=1`: header + 4 pills, every pill shows content OR a "Nothing in X" + Show-all note (never blank), Show-all recovers, zero page errors. Evidence `docs/design/evidence/c2b-triage-{all,blocked}.png`.
- [x] **C3 — Source stream** (2026-06-24, delivered by C2a): the persistent left aside renders grouped live sources (Needs a reply / Slack / GitHub / Notion / Files) from the connector reads, with the live pill + a working "Search across tools" filter. Verified in C2a's evidence shot.
- [x] **C4 — Library** (2026-06-24): real saved-work list — `lib/workbench-library-store.js` persists kept work to localStorage (newest-first, capped 100, defensive; deps-injectable + unit-tested, 5 tests). LibraryView now lists those items (with a Remove control) above the existing server-history artifact rows; fixed the awkward empty copy ("…Saved outputs from Chat…" + the "this This desktop" typo → "Nothing saved yet. Briefings and work you export are filed here." / a real "No matches" line). Exporting a brief (`downloadBriefDocx`) now files a Library record. Kept the tested source line + artifact rendering. Gate green (static 912, a11y 141, design, smoke, cold 399.4); live-verified `loads=1`, empty-copy fixed, 2 seeded items render, Remove deletes (2→1), source line intact. Evidence `docs/design/evidence/c4-library-{empty,item}.png`.
- [x] **C5 — Memory** (2026-06-24): replaced the dead placeholder (disabled button, "no writable backend") with a REAL store — `lib/workbench-memory-store.js` persists preferences to localStorage (newest-first, capped, defensive; deps-injectable + unit-tested, 5 tests). MemoryView now has a preference input + scope chips + a working Save (enabled when typed) + a saved list with Forget. Console-styled. Gate green (static 907, a11y 141, design, smoke, cold 399.0); live-verified `loadsBeforeReload=1`, the saved pref shows AND **persists across a full reload**. Spec updated to exercise the real save. Evidence `docs/design/evidence/c5-memory.png`.
- [x] **C6 — Calendar** (2026-06-24): replaced the cramped 24h time-ruler week-grid (v2 tokens + Newsreader) with a readable **agenda** — events grouped by day (big day number + weekday/month + Today badge), each a `time · title · JOIN` row, no overlap/truncation, on wb13 (Direction B) tokens + system font. Gate green; live-verified `loads=1`, 5 day-groups / 21 real events render, old grid gone. Evidence `docs/design/evidence/c6-calendar-agenda.png`.
- [x] **C7 — Real compose** (2026-06-24): the "can't add invoices@near.foundation" fix. The To field now accepts MULTIPLE comma-separated addresses + a new Cc field; `workbench-draft.js` parses them into the Composio draft args (`recipient_email` + `extra_recipients[]` + `cc[]`), with a shared `resolveRecipients` that **de-duplicates** To and drops To/Cc overlap (so nobody is named twice). The approve modal gained a comma hint, an "Add Cc" toggle, and a read-only recipient-chip preview that mirrors exactly what will be written. Posture unchanged: drafts only, send stays gated (a human checkpoint). Adversarially reviewed via Workflow (3 lenses → synthesis); the one curated finding (recipient dedup + chip key-collision) was fixed in-chunk. Gate green (static 920, a11y 141, design, smoke, cold 385.2); 14 draft unit tests. Live-verified `loads=1`: the sender pre-fills, invoices@near.foundation registers as an added recipient, Cc works, dupes/overlap collapse (sender entered 3× → 1 chip), **zero React key warnings**. Evidence `docs/design/evidence/c7-compose-{recipients,dedup}.png`.
  - **Prereq landed** (`dad0d01`): lazy-loaded Library + Memory (cold-start 399.4 → 384.2 KB) to make room for the compose UI.
  - **Deferred to the user (human checkpoint, per the build-out plan):** enabling real outbound SENDS (`IRONCLAW_WORKBENCH_SEND_ENABLED` + approving the first send). Compose/drafts are fully working; sending is intentionally still gated off.
- [x] **C8 — Slack relevance** (2026-06-24): the "Slack isn't surfacing what I care about" fix. Replaced the recency-only sort + the "any ≥2-reply thread" weigh-in trigger with **FootprintGatedRelevance** — `score = address × (footprintPrior + vitality + earned-lexical) × recency-DECAY`, so recency is a bounded multiplier (not the sort key) and low-relevance weigh-in noise is DROPPED. The footprint reuses the user's OWN daily-briefing reach model (you @them +3 / they @you +3 / they post +1) so relevance generalizes from behaviour with no hardcoded interests. Designed via a 3-lens Workflow design panel → synthesis, then **adversarially reviewed via Workflow** (correctness / over-drop-safety / robustness). The review caught 3 blockers + 2 highs — all real over-drops (a human @-reply saying "PR 22 ready?" or from a person named "Workflow" was being killed as a bot; substantive multi-person threads outside the footprint window were buried; an urgent msg with an incidental social word was dampened). **All fixed in-chunk**: bot detection is now flag-based (is_bot/is_app set, never a name regex), awaiting drops ONLY on a confirmed bot, ≥3-distinct-replier non-social threads are carried over the bar, the social dampener is gated on no-urgency, and the blocker-search multi-line rule now keeps real asks. Gate green (static 932, a11y 141, design, smoke, cold 387.3); **30 Slack unit tests** (regression-locked). Live-verified twice `loads=1`, ranking runs on real Slack with zero errors. Evidence `docs/design/evidence/c8-slack-relevance.png`.
  - **Honest limit (logged):** the relevance constants (0.34 drop / 24h half-life / weights) are calibrated to worked examples, not fit to real Slack — one tuning pass with per-item component logging on a real pull is the right follow-up. Lexical banks are English-bound; multi-person vitality carries non-English/idiomatic threads so they aren't buried.
- [x] **C9 — Functionality** (2026-06-24): the actions the user asked for are wired and live-verified end-to-end. The one-off **Ask** works (typed "capital of France?" → the turn answered "Paris"); **model configurability** works (the command box "Choose model and effort" opens a chooser with a **47-model NEAR AI Cloud select + effort levels**). The substantial chunks (C7 compose, C8 Slack, C2b cockpit) were each built + adversarially reviewed via Workflow and live-verified. No remaining unwired action was found — every original functional complaint (compose/recipients, Slack relevance, Memory save, Library, Calendar) is verified working. Evidence `docs/design/evidence/c9-ask-modelpicker.png`, `c9-model-overlay.png`.
- [x] **Responsive (375px) + a11y pass** (2026-06-24): the Console collapses correctly at 375px via `styles/responsive.js` — the 3-column grid becomes nav + center (center ~321px, usable), the source-stream dock becomes a toggle-revealed off-canvas overlay (verified hidden→visible at x=54 via the "Show active work" toggle), and there is **no horizontal overflow**. a11y suite green (141 Playwright cases incl. 390px tap-target floors). Final full gate green (static 938, design, smoke, cold 388.3<401). Evidence `docs/design/evidence/c9-375-before.png`, `c9-375-dock-open.png`.

## Craft resurface pass (2026-06-25, awake user + impeccable/interface-design skills)
Director's critique: the home broke its own first law — a chatbot-style hero ("What do you
want handled?" + 144px empty textarea) dominated, burying the triaged decisions (= "i might
as well use claude"). Resurfacing to a triage-led desk; direction approved by the user via a
rendered specimen.
- [x] **R1 — invert the home** (`15748c8`): demoted the command hero to a compact bar (no big
  headline, textarea 144→104px / 17→14.5px, padding 42→16px, sr-only h1). Triage now leads
  (header at y=401, above the fold). Gate green; loads=1.
- [x] **R2 — decision-card craft** (this commit): each "needs you" card now leads with a blue
  "Reply owed" status pill + a legible `Gmail · sender · time` line (was low-contrast
  --wb-faint), title de-shouted 800→600, amber icon-tile dropped. Reusable `wb13-status-pill`
  (is-reply/is-decision/is-blocked). Gate green (static 940, a11y 141); live-verified loads=1,
  5 cards repilled, old trigger-meta gone. Evidence `home-cards-v2.png`.
- [x] **R3 — quiet the source-stream** (`this commit`): deduped identical GitHub notifications (the 4× CI-failure rows for the overnight branch collapse to 1 — verified 4→1 live) and dropped the redundant channel from Slack-blocker detail (the badge already carries `#channel`). Regression test added. Also fixed a real UX gap found in the pass: the compose modal now closes on **Escape** (+ `aria-modal`). Gate green (state 32, static 941, a11y 141, design, smoke); live-verified loads=1.
- [ ] R4 — triage-group cards get matching status pills (needs-approval/blocked).
- [ ] R5 — Calendar: JOIN only when joinable + rhythm. R6 — Library purpose + copy. R7 — dark-mode card contrast.

## Log
- 2026-06-24: **Dark mode verified** (post-completion sweep). The standalone defaults to `data-theme="dark"` (rail has a real sun/moon `useInterfaceTheme` toggle), so I verified the Console in dark across every surface I built this run. All components are 100% token-driven (`var(--wb-*)` / `color-mix`, zero hardcoded colors — confirmed by grep), so they adapt automatically. Live readings: home/cockpit main-bg luminance 15 + triage header text 255 (white-on-dark); Calendar agenda card-bg 21 / title 255 / day-number 122; compose modal bg 21 — all readable, no light-on-light. Evidence `docs/design/evidence/c-dark-{home,calendar,memory,compose}.png`. No code change required.
- 2026-06-24: **Bundle headroom watch** — cold-start is at **399.4 / 401 KB** (~1.6 KB left) after C4. C7 (compose UI) will likely cross it. FIRST step of C7: free cold-start by `React.lazy`-loading the secondary nav views that are currently eager imports in `workbench-page.js` (Library / Memory — Calendar is already lazy). That moves them to on-demand chunks and buys multiple KB. Verify the lazy split with a Suspense fallback + a live nav into each view.
- 2026-06-23: Roadmap created. Handoff persisted. Hourly autonomous loop set up. Branch `workbench-overnight-20260620`. Prior work (Slack-first briefing, settings separation, doc reader, identity sourcing) already on origin (e07fff4 + c2514a6 local).
