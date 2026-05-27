# Sidecar binaries

IronClaw v0.29.0 prebuilt macOS binaries are bundled here for the Local
Sidecar mode. They are **not** committed to git (see `.gitignore`).

To re-fetch before a `npm run tauri build`:

```bash
./download.sh           # downloads both arches, verifies sha256, renames
```

Tauri's `bundle.externalBin` setting in `tauri.conf.json` references
`binaries/ironclaw` and resolves the per-target file at bundle time using
the Rust target triple suffix (`-aarch64-apple-darwin` /
`-x86_64-apple-darwin`).

Sidecar `sandbox_daemon-*-apple-darwin` is shipped alongside for skills
that opt in to the WASM sandbox.
