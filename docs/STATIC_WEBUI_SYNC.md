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

## Preview Vs Desktop Runtime

`npm run dev:webui-static` is a browser preview of the shared static WebUI. It
does not start the Tauri shell, does not spawn the bundled Reborn sidecar, and
does not provide the native auth bridge used by NEAR AI Cloud sign-in. If you
open `/v2/welcome` from that preview without a gateway already running behind
`IRONCLAW_GATEWAY_ORIGIN`, the sign-in buttons should remain disabled.

Use the desktop runtime for product/auth verification:

```bash
npm run tauri dev
```

Use the static server for deterministic UI checks:

```bash
npm run dev:webui-static
npm run smoke:webui-static
```

Do not claim live OAuth, connector execution, or sidecar behavior from a
browser-only static preview.

## Source Of Truth

- Reborn source repo:
  `/path/to/ironclaw`
- Reborn branch to compare:
  `origin/main`
- Reborn static source:
  `crates/ironclaw_webui_v2_static/static`
- Desktop packaged copy:
  `crates/ironclaw_webui_v2_static/static`

## Safe Sync Procedure

Do not overwrite the desktop static tree while either repo has unrelated dirty
work. Desktop currently carries product fixes for packaged bootstrap, model
readiness, connector truthfulness, chat attachments, and export controls. Those
must either be upstreamed to Reborn first or intentionally reconciled.

Use a clean Reborn worktree for comparison:

```bash
git -C /path/to/ironclaw fetch origin main
git -C /path/to/ironclaw worktree add --detach /tmp/ironclaw-main-clean origin/main
diff -qr -x main.bundle.js -x tailwind.generated.css -x vendor \
  /tmp/ironclaw-main-clean/crates/ironclaw_webui_v2_static/static \
  crates/ironclaw_webui_v2_static/static
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

As of `origin/main` commit
`0a4d1cf82f038f996ca0c115c43bea1bfaf60525`, the desktop repo carries a
productized fork of the Reborn static UI while release CI builds the
`ironclaw-reborn` sidecar from the live mainline.

The latest reconciled Reborn main changes include the read-only WebChat v2
filesystem viewer (`/api/webchat/v2/fs/*`) and first-class project/membership
routes (`/api/webchat/v2/projects*`). Desktop now wires the workspace page to
the real read-only filesystem routes and the sidecar acceptance gate verifies
filesystem mounts plus a disposable project create/detail/members round trip.
The upstream static `projects-api.js` is still intentionally stubbed, so the
desktop projects page stays a static placeholder until Reborn ships a real
static project client.

Automations are also reconciled with the Reborn run-history and delivery
defaults shape: desktop now requests recent runs with `run_limit`, surfaces
scheduler state, running/failure filters, latest/current run status,
success-rate summaries, thread links, and the outbound final-reply target
controls backed by `/api/webchat/v2/outbound/*`. The Reborn empty-state prompt
launcher, localized run-summary buckets, visible refresh spinner, and badge
copy semantics are also carried over.

The latest chat/sidebar reconciliation also includes explicit pinned threads,
per-conversation draft persistence, thread deletion with Reborn busy-error
copy, lazy-loaded locale packs, live tool/gate activity ordering, operator log
viewer support, project-file preview/download chips, OAuth auth-gate
unavailable handling, skill-install validation clearing, the settings search
surface, the NEAR default-provider activation fix, and the extension
natural-height/action-state polish. Chat attachments intentionally remain on
the desktop extraction pipeline: it sends Reborn v2 attachment wire payloads,
but keeps local OCR/document extraction and durable transcript manifests so
large PDFs/DOCX/XLSX files are model-readable without raw giant uploads.

Comparison against a clean detached main worktree still shows substantial
non-generated static differences because desktop has packaged-bootstrap,
native-save, OCR/document-extraction, model-readiness, and product-design
guardrails that are not a straight upstream mirror. This lane stays YELLOW
until those desktop deltas are upstreamed or reconciled file by file.

Known intentional non-ports from Reborn main:

- `lib/onboarding-gate.js`: desktop keeps Chat as the front door and does not
  redirect first-run users into provider setup before the product shell renders.
- Browser attachment staging split-outs (`useAttachmentConfig`, `attachments`):
  desktop uses the stronger local extraction path described above. The shared
  chip/preview behavior that matters at runtime is ported in desktop-native
  form, using the native save dialog rather than browser anchor downloads.
- `project-widgets.js`: upstream `projects-api.js` remains TODO/stubbed, so
  desktop keeps the Projects route hidden until the static project client is
  real.
- Unmounted split components/tests such as `settings-toolbar.js`,
  `extensions-tabs.js`, and some component-only upstream tests are not runtime
  gaps in the desktop package.

## Guardrail

Run:

```bash
npm run verify:static-frontend
```

This fails if Tauri stops packaging the static Reborn WebUI, if the local static
entry points are missing, if the static page depends on external browser/CDN
assets, or if the generated bundle is stale.
