# Workbench → Direction B "The Console" redesign — overnight roadmap

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
- [ ] **C2 — Console shell + Work/Triage home**: re-lay the Workbench home to the 3-column Console (rail + persistent source-stream + center command-bar + status-grouped Triage). The briefing data already exists (buildBriefing / synthesizeBriefing) — render it in the Console's Triage + source-stream shape. Keep the gear → native settings sheet.
- [ ] **C3 — Source stream**: the persistent left aside — grouped live sources (Needs a reply / Slack / GitHub / Notion / Files) from the existing connector reads, with search.
- [ ] **C4 — Library** (new design + actually works): real saved-work list (client-persisted via localStorage if no server route); Console styling.
- [ ] **C5 — Memory** (new design + actually saves): persist preferences to localStorage (a real writable store) so "save" works; Console styling.
- [ ] **C6 — Calendar** (readable): replace the cramped 24h week-grid with a readable agenda/day list in the Console style.
- [ ] **C7 — Real compose**: To/Cc, add/edit recipients, loop people in; an approved send path within the gated-write posture (drafts always; sends behind approval + the send flag). The "can't add invoices@near.foundation / can't send" fix.
- [ ] **C8 — Slack relevance**: rank the deep-read items to the user's domain (match the Claude daily-briefing skill's selectivity); drop noise.
- [ ] **C9 — Functionality (Workflow)**: wire the remaining actions end-to-end; adversarial-review each substantial PR; live-verify.
- [ ] Responsive (375px) + a11y pass on the Console; final full gate; push; morning summary at the top of this file.

## Log
- 2026-06-23: Roadmap created. Handoff persisted. Hourly autonomous loop set up. Branch `workbench-overnight-20260620`. Prior work (Slack-first briefing, settings separation, doc reader, identity sourcing) already on origin (e07fff4 + c2514a6 local).
