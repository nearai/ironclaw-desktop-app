# Static WebUI Sync

IronClaw Desktop packages the Reborn static WebUI directly through Tauri.
The shipped desktop surface is:

```text
crates/ironclaw_webui_v2_static/static
```

`src-tauri/tauri.conf.json` must keep:

```json
{
  "build": {
    "frontendDist": "../crates/ironclaw_webui_v2_static/static",
    "devUrl": "http://localhost:1420/index.html",
    "beforeDevCommand": "npm run dev:webui-static",
    "beforeBuildCommand": "npm run prepare:webui-static"
  }
}
```

The legacy `src/` SvelteKit tree is not the packaged desktop UI. Svelte tests
can still be useful for legacy/reference behavior, but they are not proof that
the shipped app works.

## Source Of Truth

- Reborn source repo:
  `/Users/abhishekvaidyanathan/Documents/Playground/ironclaw`
- Reborn branch to compare:
  `origin/reborn-integration`
- Reborn static source:
  `crates/ironclaw_webui_v2_static/static`
- Desktop packaged copy:
  `/Users/abhishekvaidyanathan/openclaw-knowledge/ironclaw-desktop/crates/ironclaw_webui_v2_static/static`

## Safe Sync Procedure

Do not overwrite the desktop static tree while either repo has unrelated dirty
work. Desktop currently carries product fixes for packaged bootstrap, model
readiness, connector truthfulness, chat attachments, and export controls. Those
must either be upstreamed to Reborn first or intentionally reconciled.

Use a clean Reborn worktree for comparison:

```bash
git -C /Users/abhishekvaidyanathan/Documents/Playground/ironclaw fetch origin reborn-integration
git -C /Users/abhishekvaidyanathan/Documents/Playground/ironclaw worktree add --detach /tmp/ironclaw-reborn-integration-clean origin/reborn-integration
diff -qr -x main.bundle.js -x tailwind.generated.css -x vendor \
  /tmp/ironclaw-reborn-integration-clean/crates/ironclaw_webui_v2_static/static \
  /Users/abhishekvaidyanathan/openclaw-knowledge/ironclaw-desktop/crates/ironclaw_webui_v2_static/static
```

After any static sync or reconciliation:

```bash
npm run verify:static-frontend
npm run prepare:webui-static
npm run smoke:webui-static
npm run tauri -- build --bundles app
npm run smoke:packaged
```

## Current Sync Status

As of `origin/reborn-integration` commit
`26eac9f31a38788cab5065fc46bae32334bb4a18`, the desktop repo does not have a
remote `reborn-integration` branch. The adjacent Reborn repo has that branch,
but its local worktree is dirty and behind the fetched remote.

Comparison against a clean detached Reborn worktree found 191 non-generated
static differences, excluding `main.bundle.js`, `tailwind.generated.css`, and
`vendor/`. This lane is RED until desktop static deltas are upstreamed or
reconciled file by file.

## Guardrail

Run:

```bash
npm run verify:static-frontend
```

This fails if Tauri stops packaging the static Reborn WebUI, if the local static
entry points are missing, if the static page depends on external browser/CDN
assets, or if the generated bundle is stale.
