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

## License

MIT — see [LICENSE](LICENSE).
