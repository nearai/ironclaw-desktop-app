# IronClaw Desktop

A native macOS client for [IronClaw](https://github.com/nearai/ironclaw) — the Rust knowledge agent from NEAR AI. Tauri v2 + SvelteKit. Dark, fast, ~5MB binary footprint (excluding bundled sidecar).

## Why

IronClaw ships with a TUI and a web UI served by its own gateway. This app gives it a polished native shell with macOS conventions: Cmd+K palette, Keychain-backed credentials, native notifications, menu-bar status, sidecar lifecycle managed for you.

## What's inside

- **Chat** — streaming conversations with markdown rendering, code-block copy, retry on failure, draft persistence per thread
- **Knowledge** — browse the workspace doc tree, FTS search, read + write (edit existing, create new)
- **Skills** — list + filter the 30+ bundled skills, view metadata (trust, source, usage hint)
- **Routines** — view scheduled jobs, toggle on/off, trigger manually, inspect run history
- **Logs** — live-tail the gateway via SSE, filter by level + grep, virtualized for 5K+ entries
- **Extensions** — install/activate MCP servers, OAuth providers, channel integrations
- **Settings** — per-profile gateway configs, Keychain-backed tokens, local sidecar lifecycle
- **Cmd+K palette** — fuzzy-search across navigation, threads, skills, routines, docs

## Connection modes

- **Remote** — point the app at any IronClaw gateway (Caddy-fronted prod, SSH tunnel, etc.)
- **Local** — spawn the bundled IronClaw binary as a sidecar. NEAR.AI Cloud by default (no API key needed, OAuth handled by IronClaw). OpenRouter available as an advanced backend.

## Prerequisites

- macOS 12+ (Apple Silicon or Intel)
- Node 22+
- Rust 1.80+
- Xcode Command Line Tools: `xcode-select --install`

## Develop

```bash
npm install
npm run tauri dev
```

First compile takes ~3 min (pulls Tauri, plugin-shell, plugin-updater, plugin-notification, keyring, uuid). Subsequent runs are cached.

## Build

```bash
# Unsigned .app + .dmg for Apple Silicon
npm run tauri build

# Output: src-tauri/target/release/bundle/{macos,dmg}/
```

## Static checks

```bash
npm run check    # svelte-check + TypeScript
npm run build    # vite frontend build (no Tauri compile)
cargo check --manifest-path src-tauri/Cargo.toml
```

## Local sidecar binaries

The bundled IronClaw binaries are downloaded out-of-band (they're large and gitignored):

```bash
bash src-tauri/binaries/download.sh
```

This fetches both `aarch64-apple-darwin` and `x86_64-apple-darwin` from the official IronClaw release.

## Project layout

```
ironclaw-desktop/
├── src/                         # SvelteKit frontend (Svelte 5 runes + TS)
│   ├── routes/                  # one folder per surface
│   └── lib/
│       ├── api/ironclaw.ts      # typed HTTP client
│       ├── stores/              # rune singletons (settings, connection, threads, ...)
│       └── components/          # shared (Toasts, MarkdownView, UpdaterBanner, ...)
├── src-tauri/                   # Rust backend
│   ├── src/
│   │   ├── lib.rs               # Tauri commands + plugin registration
│   │   ├── sidecar.rs           # spawn/stop bundled IronClaw
│   │   ├── keychain.rs          # macOS Keychain wrappers
│   │   └── settings.rs          # JSON settings persistence
│   ├── binaries/                # bundled IronClaw sidecar (gitignored)
│   ├── icons/                   # generated from icons/iconsrc.svg via build_icons.py
│   └── tauri.conf.json
└── .github/workflows/           # CI + release pipeline
```

## Releasing

### One-time setup (signing keypair)

1. Generate the updater signing key:

   ```bash
   bash scripts/generate-updater-key.sh
   ```

   The script writes the keypair to `~/.tauri/ironclaw-updater.key{,.pub}` and refuses to overwrite an existing key.

2. Paste the printed public key into `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`. Commit that change.

3. In the GitHub repo settings, add two Actions secrets:
   - `TAURI_SIGNING_PRIVATE_KEY` — contents of `~/.tauri/ironclaw-updater.key` (already base64-encoded by Tauri). Copy with `cat ~/.tauri/ironclaw-updater.key | pbcopy`.
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — empty by default (the generator uses no password). If you re-run the generator with a password later, update this secret.

Until the pubkey is committed and both secrets are set, the workflow builds **unsigned** updater artifacts. Builds still succeed; auto-update verification will fail until signing is wired.

### Cutting a release

1. Bump the version across all three files at once:

   ```bash
   bash scripts/bump-version.sh 0.1.3
   ```

   This updates `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`. All three must agree.

2. Update `CHANGELOG.md` with what changed.

3. Commit + tag:

   ```bash
   git commit -am "v0.1.3"
   git tag v0.1.3
   git push && git push --tags
   ```

4. The `release` workflow (`.github/workflows/release.yml`) builds both arches (`aarch64-apple-darwin` and `x86_64-apple-darwin`), signs the updater artifacts when secrets are present, and creates a GitHub release with the `.dmg`, `.app.tar.gz`, and `.app.tar.gz.sig` files attached.

5. Tauri auto-generates the `latest.json` updater manifest and attaches it to the release. The app polls `https://github.com/abbyshekit/ironclaw-desktop/releases/latest/download/latest.json` on startup.

### Sanity-checking a release locally before tagging

```bash
npm run tauri build
```

Produces unsigned `.app` + `.dmg` at `src-tauri/target/release/bundle/`. Mount the DMG, drag to Applications, right-click → Open (first launch only — Gatekeeper warns about unsigned apps).

## License

MIT — see [LICENSE](LICENSE).
