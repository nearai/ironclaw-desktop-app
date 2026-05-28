# Autonomous build session — status snapshot

Captured at the end of the ~3-hour autonomous build window the lead
delegated. This is the "what landed, what's pending, what's broken"
sheet — read this first when you come back.

## What shipped (eight tags)

| Tag | Highlights |
|---|---|
| **v0.2.10** | First public release of the v0.2.x trail |
| **v0.2.11** | Chat attachments — PDF/DOCX/XLSX/PPTX/CSV/TXT/MD/JSON (was image-only) |
| **v0.2.12** | R49 lazy-load routes, R50 TTS, R52 chat tabs, R53 Mermaid/Plotly/KaTeX, R55 Omnibar, R60 Spotlight, R62 IDB cache, R63 vibrancy, R65 skill editor, R69 editable bubbles |
| **v0.2.13** | R73 review P0 security batch — XSS sanitization on the three renderers, dev-shim backdoor patched, TTS length cap, Omnibar SvelteKit `goto`, ChatTabs nested-button fix, R51 voice answer mode |
| **v0.2.14** | R54 thread sync long-poll, R58 replay UI, R59 replay wire, R64 mini-mode, R79 reply-thread wire, R82 generative widgets, bundle budget bumped 110→1500 KB for Plotly lazy chunk |
| **v0.2.15** | R77+R78 Dashboard + tiles, R83 model presence strip on Council |
| **v0.2.16** | R67 /imagine slash command, R80 reply-thread UI panel, R81 streams route |
| **v0.2.17** | R61 Apple Notes export, chat-tabs Cmd+W close + Cmd+1..9 jump |

365/365 vitest passing at HEAD. 0 svelte-check errors. Cargo check
clean.

## What's still in flight

- **R66 Python REPL block runner** — codex agent dispatched at end of
  session, brief at `docs/codex-tasks/66-python-repl.md`. Should land
  shortly after session end. Check `.codex-worktrees/r66/` and run
  the cherry-pick + push cycle when it finishes.
- **R56 sub-agent dispatch wire** — BLOCKED. The gateway endpoint
  `/api/v1/tasks` returned 404 against baremetal3 v0.29 on probe.
  Either land the endpoint upstream OR ship a graceful "not
  supported" fallback in the client. R57 (sub-agent UI) is gated on
  this.

## Known issues / follow-ups

### From the v0.2.12 elite review (`R73` output)

**Resolved** (P0):
- ✅ XSS via Mermaid (DOMPurify on output)
- ✅ XSS via KaTeX (sanitize + trust:false + strict:'ignore')
- ✅ XSS via Plotly (recursive sanitize, drop javascript: URIs)
- ✅ Dev shim refuses to install when `protocol === 'tauri:'`

**Resolved** (P1):
- ✅ Omnibar uses SvelteKit `goto` (no full-page reloads)
- ✅ TTS length cap (4 KB)
- ✅ ChatTabs nested-button fix

**Still outstanding** (P1 — reviewer flagged but not yet addressed):
- **Cmd+Space ↔ macOS Spotlight collision** — review claimed conflict.
  Inside the app window, our handler wins because the focused app
  consumes the keydown before the OS routes to Spotlight. Verify
  in the rebuilt `.app`; if it actually conflicts in production,
  swap to Cmd+J or Cmd+Shift+Space and update docs.
- **`reveal_in_finder` takes arbitrary path from JS** — restrict to
  paths under `app_data_dir`.
- **`http:default` capability allows `https://**`** — lock to
  `127.0.0.1:*` + the configured remote.
- **Spotlight index has no aggregate size cap** — add LRU sweep at
  ~100 MB.
- **`+page.svelte` is now ~3900 LOC, `settings/+page.svelte` ~4000** —
  decompose. Not blocking ship; tech debt.
- **20+ stores + 20+ components have no test coverage** — see review
  for the list.

### Operational

- **GH Actions still blocked on billing** (R76, unchanged through
  the session). Fix at github.com/settings/billing then delete +
  re-push the tags to trigger signed-DMG release builds:
  `git tag -d v0.2.17 && git push origin :refs/tags/v0.2.17 &&`
  `git tag v0.2.17 && git push origin v0.2.17`
- **The bundled `.app` is still v0.2.10** at
  `~/openclaw-knowledge/ironclaw-desktop/src-tauri/target/release/bundle/macos/IronClaw.app`.
  Run `npm run tauri build` to get v0.2.17 with all new features
  including Dashboard, replay bar, mini-mode, voice answer, etc.

## What's pending (by priority for next session)

1. **R66 Python REPL** — let the codex agent finish, cherry-pick.
2. **R56 unblock** — either land `/api/v1/tasks` upstream OR document
   the client-side fallback path so R57 can ship.
3. **R71 a11y v2 audit** — scan-only pass over the eight new
   surfaces shipped this session.
4. **R72 E2E expansion** — at least one Playwright spec per
   v0.2.13–v0.2.17 surface (omnibar, replay, dashboard, mini, voice,
   editable bubble, skill editor, streams, reply-thread).
5. **R84 spatial canvas (tldraw)** — the only Wave 3+ feature not
   yet attempted.
6. **The "Cmd+Space conflict" check** — verify by hand once the .app
   is rebuilt; either close the review thread or swap shortcut.
7. **`reveal_in_finder` + `http:default` capability tightening** —
   small Rust changes, P1 security debt.

## Where things live

- Roadmap + waves: `docs/ROADMAP-ELITE.md`
- Workspace OS architectural shift (Dashboard / Streams / etc.): `docs/WORKSPACE-OS.md`
- Lane discipline + file ownership: `docs/SWIMMING-LANES.md`
- Codex task briefs: `docs/codex-tasks/`
- Parallel dispatcher: `scripts/codex-dispatch.sh`
- This status doc: `docs/AUTONOMOUS-SESSION-STATUS.md` (you're reading it)

## Stack snapshot

- Tauri v2.2 + macos-private-api + window-vibrancy 0.5
- SvelteKit 2.x + Svelte 5 runes (`$state`, `$derived`, `$effect`)
- TailwindCSS 3
- TypeScript ~5.x (strict)
- Vitest 4.x (365 tests)
- Rust 1.80+ (cargo check clean)
- Gateway: IronClaw v0.29 on baremetal3.agents.near.ai via SSH tunnel `18789`

## Tunable knobs to try first when something looks broken

1. `npm run check && npm run test` — full local CI gate (fastest)
2. `bash scripts/check-bundle-size.sh` — bundle budget
3. `cargo check --manifest-path src-tauri/Cargo.toml` — Rust health
4. `npm run tauri build` — produce a fresh `.app` (5-10 min)

If launching the `.app` shows "Disconnected": (a) verify SSH tunnel
is up (`pgrep ssh.*18789`), (b) check
`~/Library/Application Support/com.openclaw.ironclaw-desktop/settings.json`
points at `http://127.0.0.1:18789`, (c) check
`tokens/gateway-token_default.token` has the 64-char bearer.

## Worktrees state

```
.codex-worktrees/
  r66/    ← in flight (Python REPL)
.claude-worktrees/
  r77/    ← merged, can remove
```

Cleanup command for stale entries:
```
git worktree prune
git branch -D $(git branch --list 'codex/r6*' 'claude/r7*' | xargs)
```

Session ended at v0.2.17.
