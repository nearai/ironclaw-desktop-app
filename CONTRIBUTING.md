# Contributing

Thanks for digging in. This document covers local setup, the workflow
for shipping a change, the CI gates you'll hit, the conventions the
codebase actually follows (not just aspires to), and the recipes for
the most common contributions: adding an API call, adding a surface,
and adding an icon.

For the why-and-how of the architecture, see
[`ARCHITECTURE.md`](ARCHITECTURE.md). Read that first if you don't
already have the lay of the land.

**Where the UI lives.** The shipped desktop UI is the React static
WebUI under `crates/ironclaw_webui_v2_static/static/js` — React 19 +
[`htm`](https://github.com/developit/htm) (JSX-free tagged templates),
`react-router`, `@tanstack/react-query`, and Tailwind, bundled by
**esbuild** (`scripts/prepare-webui-static.mjs`). Tauri packages that
`static/` directory directly (`tauri.conf.json` `frontendDist` +
`beforeBuildCommand: prepare:webui-static`). There is no separate
frontend build step and no TypeScript compile for the UI — the source
is plain `.js` modules. (The old SvelteKit `src/` tree was retired; if
a doc, comment, or script still references it, that's a bug.)

---

## Local dev setup

### Prerequisites

- macOS 12+ (Apple Silicon or Intel)
- Node 22 (matches the version pinned in CI)
- Rust 1.80+ (`rustup default stable`)
- Xcode Command Line Tools: `xcode-select --install`

### Install

```bash
git clone <your-fork-url>
cd ironclaw-desktop
npm install
```

### Run

Two modes, and the difference matters:

```bash
npm run tauri dev          # the real app: Tauri shell + sidecar + native auth
npm run dev:webui-static   # UI-only preview: serves the static bundle, NO sidecar
```

`npm run tauri dev` is the only thing that signs in, spawns the bundled
sidecar, and exercises the native bridge. First compile takes ~3 min
(Tauri, plugin-shell, plugin-updater, plugin-notification, keyring,
uuid, tokio); subsequent Rust changes hot-rebuild in 5–10s.

`npm run dev:webui-static` (`scripts/serve-webui-static.mjs`) re-runs
the esbuild + Tailwind build and serves the static WebUI for UI work
and smoke tests. It has no gateway behind it, so NEAR AI Cloud sign-in
buttons are expected to stay disabled — **do not** use a bare browser
tab as proof that auth works. After a source change, the serve harness
rebuilds; if you're iterating manually, re-run `npm run prepare:webui-static`.

### Sidecar binaries

The bundled IronClaw binaries are large (~100 MB per arch) and
gitignored. Local dev does not require them — you can develop the UI
against `dev:webui-static`, or against a remote gateway with no sidecar
at all. To work on the local-sidecar code paths:

```bash
bash src-tauri/binaries/download.sh
```

This pulls both `aarch64-apple-darwin` and `x86_64-apple-darwin` from
the official IronClaw release and verifies SHA-256s.

### Useful env vars

```bash
# Tail the sidecar's stdout/stderr in the dev console
RUST_LOG=ironclaw_sidecar=info,ironclaw_tray=info npm run tauri dev

# Bump Rust log noise without re-running tauri build
RUST_LOG=ironclaw_desktop_lib=debug npm run tauri dev
```

### Connecting to a gateway

The first launch drops you in the onboarding wizard. The fast paths:

- **Remote**: enter a base URL and a bearer token. The bearer goes
  straight into the Keychain, never localStorage.
- **Local**: NEAR AI Cloud is the normal desktop model path — sign in
  once and the gateway handles continuity. Advanced provider/key setup
  lives in **Settings → Inference**, not first-run onboarding.

### Token storage and the file fallback (v0.2.8+)

Gateway bearer tokens primarily live in the macOS Keychain (service
`com.openclaw.ironclaw-desktop`, account `gateway-token:<profile-id>`).
The Rust side also writes a redundant **file fallback** at:

```
~/Library/Application Support/com.openclaw.ironclaw-desktop/tokens/
  gateway-token_<profile-id>.token   (mode 0600)
```

Why both? Every `cargo build --release` produces a binary with a fresh
ad-hoc code signature. macOS Keychain ACL grants are signature-bound,
so the new binary triggers a fresh `Always Allow` prompt on first
read. That prompt may surface behind the app window or never appear in
a headless dev loop, and the synchronous `keyring::Entry::get_password()`
call hangs indefinitely waiting for the user response — wedging the
entire Tauri IPC dispatcher (no fetches, no UI updates, just a
spinning "Disconnected" status).

`src-tauri/src/keychain.rs:get_secret` runs the keychain read on a
worker thread with a **2-second timeout**. On timeout it falls through
to the file fallback. Writes mirror to both stores so a future build
can read from either.

This fallback is **load-bearing for dev workflows** and not removable
without re-introducing the wedge. A real Developer ID signed build
gets a stable signature, so the ACL grant survives rebuilds and the
fallback becomes a no-op — but we still keep the timeout because the
hang failure mode also surfaces in CI sandboxes and headless tests.

If you ever see "Disconnected" forever on a fresh build:

1. `RUST_LOG=info` the binary directly and look for
   `READ TIMEOUT [gateway-token:default]`.
2. Stage your token with `bash scripts/stage-token.sh default <token>`.
3. Relaunch; status flips to green within 2s.

---

## Workflow

### Making a feature change

The repository is a thin native shell over the IronClaw gateway. Most
feature work falls into one of four buckets:

| Bucket                                     | Where the code goes                                                                 |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| New gateway call to surface                | shared endpoint in `static/js/lib/api.js`, or a feature wrapper in `pages/<feature>/lib/<feature>-api.js` + a `.test.mjs` |
| New UI surface (top-level route)           | `pages/<feature>/<feature>-page.js` + register in `app/routes.js`                   |
| New component / hook                       | `pages/<feature>/components/` or `/hooks/`; cross-surface ones in `components/`, `hooks/`, or `design-system/` |
| New privileged operation (FS / shell / OS) | new `#[tauri::command]` in `src-tauri/src/`                                          |

Whichever bucket you're in, the sequence is the same:

1. Make the smallest change that's testable.
2. Write the test first if the change is in an api module, a hook, or a
   pure utility (`node:test`, file named `<name>.test.mjs` next to the
   source). Rendered/interaction behavior is covered by the Playwright
   specs under `tests/static/`. Don't write a test whose only assertion
   is the shape of a mocked call — that tests the mock.
3. Rebuild and run the static gate locally until it passes — at least
   `npm run prepare:webui-static`, `npm run test:static`, and
   `npm run smoke:webui-static` (the full PR gate is in
   `.github/workflows/check.yml`).
4. If you touched Rust, run `cargo check --manifest-path
   src-tauri/Cargo.toml` and `cargo clippy --manifest-path
   src-tauri/Cargo.toml -- -D warnings`.
5. Push and open a PR.

> The committed `main.bundle.js` + `tailwind.generated.css` are build
> artifacts. Run `npm run prepare:webui-static` and commit the
> regenerated files with any UI source change, or the bundle gate and
> smoke will disagree with your source.

---

## CI gates

| Workflow          | Trigger           | Hard-fails on                                                                                                                                                                                          |
| ----------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check.yml`       | PR + push to main | `verify:static-frontend`, `check:static-bundle`, `lint:static-tokens`, `lint:static-copy`, `test:design-static`, `smoke:webui-static`, `smoke:gate-enforcement`, `test:a11y-static`, `test:static`, `test:scripts`, `cargo check` / `cargo test` |
| `check.yml`       | PR + push to main | `cargo clippy` (currently `continue-on-error: true`; warn-don't-block)                                                                                                                                |
| `style-guard.yml` | PR                | Hardcoded accent hex outside the allowlist (see `scripts/style-guard.sh`)                                                                                                                             |
| `release.yml`     | tag `v*`          | Full `tauri build` for both arches; signs updater artifacts if secrets present                                                                                                                       |

The same chain runs as the `pre-push` hook (`simple-git-hooks`), and
`pre-commit` runs `prettier --check` on staged `*.{ts,js}` (`lint-staged`).

The clippy step is currently `continue-on-error`. Don't make it
worse — every PR that adds new clippy findings is one step further
from flipping it back to a hard fail.

Use the `accent-cyan` / `accent-signal` Tailwind classes or the
`--v2-accent` CSS variable for accents. A hardcoded hex silently breaks
the per-profile tint override for that surface; `style-guard.sh` is the
gate that catches it.

---

## Conventions

### File layout & naming

- **UI source is plain `.js`** under `crates/ironclaw_webui_v2_static/static/js`,
  authored with `htm` templates (`import { React, html } from '<…>/lib/html.js'`),
  not JSX. There is no per-file compile — esbuild bundles the tree.
- **Pages** live at `pages/<feature>/<feature>-page.js` and export a
  PascalCase component (`ExtensionsPage`). A feature owns its
  `components/`, `hooks/`, and `lib/` subfolders.
- **Components** are kebab-case files exporting PascalCase functions
  (`extension-card.js` → `ExtensionCard`). Cross-surface primitives live
  in `design-system/` (`button.js`, `card.js`, `input.js`, `icons.js`,
  `modal.js`); cross-surface app components in `components/`.
- **Hooks** are `useXxx.js` (camelCase export), under a feature's
  `hooks/` or the shared `hooks/`. Data fetching/mutation goes through
  `@tanstack/react-query` (`useQuery` / `useMutation`); see
  `pages/extensions/hooks/useExtensions.js` for the template.
- **API calls**: shared endpoints in `lib/api.js`, feature-specific
  wrappers in `pages/<feature>/lib/<feature>-api.js`. Functions are
  camelCase (`fetchExtensions`, `setupExtension`, `listThreads`).
- **Quotes**: single quotes in `.js` (the Prettier gate enforces it).
  `.test.mjs` files are not in the lint-staged glob — keep them
  single-quoted anyway, and write quote-agnostic assertions
  (`/t\(['"]…['"]\)/`) if you assert on source text.
- **i18n**: never hardcode user-facing copy. Add the key to
  `i18n/en.js` AND all 11 locale packs (`{de,es,fr,hi,ja,ko,pt-BR,uk,zh-CN,ar}.js`),
  then bump the `englishKeys.length` lock in `i18n/i18n-completeness.test.mjs`
  by the number of new English keys. The lock is a guard, not sacred —
  extend it deliberately when an honest-state message genuinely needs copy.

### JavaScript

- No build-time types — defend at the wire boundary instead. Every field
  off the gateway is read with optional chaining + a `??` fallback
  (`raw?.thing?.id ?? null`), so a gateway rename can't crash the UI.
- Keep the consumer-facing shape stable; map wire field names at the
  boundary, not throughout the component tree.

### Rust

- `unwrap()` and `expect()` are fine in tests, never in production
  paths. Tauri commands return `Result<T, String>` — stringify the
  error with `.map_err(|e| format!("..."))`.
- New modules go in `src-tauri/src/<name>.rs` and get a `mod <name>;`
  declaration in `lib.rs`.
- Run `cargo clippy` before opening a PR. Don't add new findings
  even though the gate is currently soft.

### Comments

The codebase leans heavily on top-of-file module doc comments
explaining *why* the module exists and what its responsibilities
are. Match that style — a new file should open with a comment that
tells a future contributor (or your future self) what they're
looking at without scrolling.

---

## Testing

Two tiers, both gated:

- **`node:test` unit suites** — files named `<name>.test.mjs` next to
  the source, run by `npm run test:static`. Use these for pure
  functions, api wire-shape mappings, hook logic, and component
  contracts. `jsdom` is available for DOM-y assertions (see
  `markdown-renderer.test.mjs`).
- **Playwright rendered/a11y specs** — `tests/static/*.spec.ts`, run by
  `npm run test:a11y-static` against the served static WebUI. Use these
  for real render behavior, interaction flows, and the axe-core a11y
  sweep. The big end-to-end UI smoke is `scripts/smoke-webui-static.mjs`
  (`npm run smoke:webui-static`); design-token contracts run via
  `npm run test:design-static`.

### What's worth testing

- **Pure functions and wire-shape mappings.** Every defensive parse that
  fixed a real bug should have a regression `.test.mjs`.
- **Hook + action logic.** Mock the api module, drive the hook's public
  surface, assert on the returned state.
- **Component contracts and rendered behavior.** Prefer a `tests/static/`
  Playwright spec for anything that depends on real rendering.

### What's NOT worth testing

- **Tests whose only assertion is a mocked call's shape** — you've
  tested your mock, not the system.
- **Tauri IPC roundtrips and the boot sequence** — side-effect-heavy and
  tied to real native APIs. Watch them in `npm run tauri dev`.

### VM-harness gotcha

A few component tests (`useHistory.test.mjs`, `configure-modal.test.mjs`,
`extensions-page.test.mjs`) read the component **source** via
`vm.runInNewContext` and stub its dependencies. If you add a new import
to such a component, add a matching stub to the test's VM context. When
comparing arrays created in the VM realm, use `.join(',')` + `assert.equal`
— `deepStrictEqual` reports a spurious cross-realm prototype mismatch.

### Running tests

```bash
npm run test:static          # node:test unit suites
npm run test:scripts         # scripts/*.test.mjs
npm run test:a11y-static     # Playwright rendered + a11y specs
npm run test:design-static   # design-token contracts
npm run smoke:webui-static   # full rendered UI smoke
```

> Count failures with summed `ℹ fail`
> (`npm run test:static 2>&1 | grep -E '^. fail ' | awk '{s+=$3} END{print s+0}'`),
> NOT `grep '^not ok'` — node:test's default reporter emits `✖`/`ℹ fail`,
> and a test that crashes on load won't print a TAP `not ok` line.

---

## Adding an API call

The pattern, end to end:

1. **Add the function.** A generic gateway endpoint goes in `lib/api.js`
   (wrap `apiFetch(path, options)`); a feature-specific one goes in
   `pages/<feature>/lib/<feature>-api.js`. Read the wire shape
   defensively and return the consumer-facing shape:

   ```js
   // pages/things/lib/things-api.js
   import { apiFetch } from '../../../lib/api.js';

   // Fetch the thing at /api/webchat/v2/things/{id}.
   // Wire (verified <date> vs IronClaw <version>): { thing: { id, name, ts } }
   // — note `name` not `label`, `ts` not `created_at`.
   export async function fetchThing(id) {
     const raw = await apiFetch(`/api/webchat/v2/things/${encodeURIComponent(id)}`);
     const t = raw?.thing;
     if (!t?.id) return null; // "no such thing" is a normal app state
     return { id: t.id, label: t.name ?? '(untitled)', createdAt: t.ts };
   }
   ```

   Load-bearing details:
   - Map wire field names at the boundary; the consumer-facing shape
     stays stable across gateway renames.
   - `encodeURIComponent` every path segment.
   - Lifecycle endpoints take the **bare** extension id, not a catalog
     ref — `canonicalExtensionName` strips any `kind/` prefix before the
     wire (see `pages/extensions/lib/extensions-api.js`).

2. **Consume it through react-query.** Wrap the call in a `useQuery` /
   `useMutation` inside the feature's hook (`useExtensions.js` is the
   template) so caching, invalidation, and loading state are uniform.

3. **Never claim readiness the gateway can't prove.** A connector or
   surface may only show "active"/"connected" when the gateway returns
   positive proof — see `activationProvedConnected` in `useExtensions.js`
   and the Design Laws in `CLAUDE.md`.

4. **Write the test** in `<module>.test.mjs`: stub `apiFetch` (or
   `global.fetch`), assert the function returns the consumer-facing
   shape. Cover a happy path and at least one "wire shape evolved" case
   (e.g. `t.ts` missing → `createdAt` undefined).

---

## Adding a new surface

A "surface" is a top-level route. The scaffolding list, in order:

1. **Create the page** at `pages/<name>/<name>-page.js`, exporting a
   `<Name>Page` component. Sub-components/hooks/api go in that feature's
   `components/`, `hooks/`, `lib/`. Boilerplate:

   ```js
   import { React, html } from '../../lib/html.js';
   import { useT } from '../../lib/i18n.js';
   import { useThings } from './hooks/useThings.js';

   export function ThingsPage() {
     const t = useT();
     const { things, isLoading, loadError } = useThings();
     // ...render with html`...`
   }
   ```

2. **Register the route** in `app/routes.js` `primaryRoutes`:

   ```js
   { id: 'things', path: '/things', labelKey: 'nav.things', hidden: false },
   ```

   Add the `id` to the relevant `routeSectionDefs` group, and wire the
   page component into the router/app shell. Keep a surface `hidden: true`
   until its workflow is honest and supported (no fake-ready stubs) — see
   the comments in `routes.js`.

3. **Add the nav label** `nav.things` to `i18n/en.js` and all 11 locale
   packs; bump the completeness lock.

4. **If the surface has sub-tabs**, add a `<NAME>_SUB_ROUTES` array in
   `routes.js` and register it in `EXPANDABLE_SUB_ROUTES` (see
   `EXTENSIONS_SUB_ROUTES`).

5. **Update the CHANGELOG** under the next-release section.

---

## Adding a new icon

Icons are inline SVG in `design-system/icons.js`, rendered by
`Icon({ name, className, strokeWidth })`.

1. Add your glyph to the icon registry in `icons.js`, keyed by a new
   `name` (24×24 viewBox, `currentColor`, weight matching the existing
   set).
2. Use it: `html\`<${Icon} name="thing" className="h-4 w-4 text-signal" />\``.
3. If the glyph is non-trivial (multi-path / conditional), add a case to
   the icon test.

---

## Forking the repo

1. Fork on GitHub.
2. Clone your fork.
3. Add the upstream:

   ```bash
   git remote add upstream <upstream-url>
   ```

4. Sync regularly:

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

### Branch naming

`<type>/<short-description>`, where `<type>` is one of:

- `feat` — new feature or surface
- `fix` — bug fix
- `refactor` — code restructure with no behavior change
- `chore` — tooling / CI / dependency bumps
- `docs` — documentation only

Examples: `feat/things-surface`, `fix/sidecar-port-collision`,
`refactor/extensions-actions`, `chore/bump-tauri`.

### Commit messages

Short imperative subject line, blank, optional body. Group related
changes into one commit; don't split a single logical change across
multiple commits.

```
Add Things surface

Surfaces the /api/webchat/v2/things endpoint with a list/detail page,
registered in app/routes.js and gated until the gateway supports it.
Includes the things-api.js client, a useThings hook, tests, and nav
i18n in all locale packs.
```

### PR checklist

- [ ] `npm run prepare:webui-static` run and the regenerated bundle committed
- [ ] `npm run verify:static-frontend` passes
- [ ] `npm run check:static-bundle` passes
- [ ] `npm run lint:static-tokens` + `npm run lint:static-copy` pass
- [ ] `npm run test:static` (0 fail) + `npm run test:scripts` pass
- [ ] `npm run smoke:webui-static` + `npm run smoke:gate-enforcement` pass
- [ ] `npm run test:a11y-static` passes
- [ ] If Rust changed: `cargo check` + `cargo clippy` pass
- [ ] New user-facing copy added to all 11 i18n packs + completeness lock bumped
- [ ] Tests added for new behavior
- [ ] CHANGELOG updated under the next-release section
- [ ] Surface change tested in `npm run tauri dev` (not just `dev:webui-static`)

---

## Release flow

End-to-end, when you're ready to ship a new version:

1. **Bump the version** across the three places that must agree:

   ```bash
   bash scripts/bump-version.sh 0.1.8
   ```

   This updates `package.json`, `src-tauri/tauri.conf.json`, and
   `src-tauri/Cargo.toml`. Semver-validated. `scripts/release-prep.sh`
   wraps the full preflight (gates + cargo build) if you want one
   command.

2. **Update `CHANGELOG.md`** under a new top-level header. Move the
   "unreleased" entries into the new version's header.

3. **Commit + tag**:

   ```bash
   git commit -am "v0.1.8"
   git tag v0.1.8
   git push && git push --tags
   ```

4. The `release.yml` workflow runs:
   - Installs both target triples
   - Downloads + builds sidecar binaries
   - Builds `tauri bundle` for `aarch64-apple-darwin` and
     `x86_64-apple-darwin` (the `beforeBuildCommand` rebuilds the static
     WebUI)
   - Signs updater artifacts if `TAURI_SIGNING_PRIVATE_KEY` +
     `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secrets are configured
   - Creates a GitHub release with `.dmg`, `.app.tar.gz`,
     `.app.tar.gz.sig` attached and auto-generated notes

5. **Verify** in the GitHub release UI that both DMGs are attached and
   `latest.json` is present. The updater endpoint in `tauri.conf.json`
   points at
   `https://github.com/nearai/ironclaw-desktop-app/releases/latest/download/latest.json`.

### First-time release setup (signing keypair)

Once per repository:

1. Generate the keypair:

   ```bash
   bash scripts/generate-updater-key.sh
   ```

   Writes to `~/.tauri/ironclaw-updater.key{,.pub}` and refuses to
   overwrite. Empty password by default.

2. Paste the printed public key into `src-tauri/tauri.conf.json`
   under `plugins.updater.pubkey`. Commit.

3. In the GitHub repo settings → Actions → Secrets, add:
   - `TAURI_SIGNING_PRIVATE_KEY` — `cat ~/.tauri/ironclaw-updater.key | pbcopy`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — empty (or whatever you set)

Until both secrets are present and the pubkey is committed, builds
succeed but produce unsigned artifacts; auto-update verification
will fail until signing is wired.

### Probing for newly-landed gateway endpoints

We stub calls for endpoints the gateway doesn't yet expose (routine
create, real DELETE, etc.). To find ones that have shipped upstream:

```bash
bash scripts/probe-blocked-endpoints.sh
```

Reads your configured SSH alias (`IRONCLAW_SSH_ALIAS`) to discover the
live gateway token. Yellow `WARN` lines mean an endpoint started
responding — time to wire UI for it. Always exits 0 (discovery tool,
not a CI gate).

---

## Questions / discussion

Open an issue or a draft PR with the question in the body — even a
half-formed direction is easier to react to than a question in the
abstract.
