# IronClaw Desktop

Thin Tauri v2 + SvelteKit GUI shell for the IronClaw knowledge agent. The agent runs remotely on `abby` or locally as a sidecar binary; this app is the client.

## Prerequisites
- Node 22+
- Rust 1.80+
- Tauri prereqs (Xcode CLI tools on macOS): `xcode-select --install`

## Develop
```bash
npm install
npm run tauri dev
```

## Build
```bash
npm run tauri build
```

## Frontend-only checks
```bash
npm run check
npm run build
```
