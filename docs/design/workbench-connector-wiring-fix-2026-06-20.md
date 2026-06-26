# Workbench Composio Connector Wiring Fix — 2026-06-20

Lane C. Goal: when Composio is authenticated and provides a toolkit (Gmail,
Calendar, Drive, Sheets, Notion, Slack), the corresponding Workbench **source
family** must report `ready` ("via Composio") instead of "Needs Google OAuth /
Needs setup." Today it never does, and the operator's #1 frustration ("Composio
has Gmail, Calendar, Drive, Notion ... I don't understand why it is not
working") is fully explained by the evidence below.

## 2026-06-21 current implementation status

This document is now historical rationale plus a fallback plan. The current
branch does **not** rely on the C1 "active Composio means default family
coverage" frontend fallback below. The implemented path is stricter and more
honest:

- The staged sidecar exposes `/api/webchat/v2/connectors/connected` and
  `/api/webchat/v2/connectors/read`.
- `scripts/probe-workbench-live-wiring.mjs --json` is now a hard gate. With
  local NEAR AI and Composio credentials sourced, it returns `verdict:"PASS"`:
  NEAR AI model catalog count `47`, Composio configure phase `active`, connected
  account count `8`, live toolkits `github`, `gmail`, `googlecalendar`,
  `googledocs`, `googledrive`, `notion`, and `slack`.
- The probe performs read-only checks for Gmail, Calendar, Drive, Notion,
  GitHub, and Slack, then verifies that a mutating Gmail send tool is rejected
  on the read route. The probe also verifies that the dedicated write route
  rejects `GMAIL_SEND_EMAIL` when the send capability is not enabled, proving the
  draft/write surface exists while real sends remain gated server-side.
- Frontend readiness comes from
  `crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-connectors.js`.
  It maps only ACTIVE `/connectors/connected` toolkits to Workbench families.
  No ACTIVE account means no ready family.
- `WorkbenchSourcesInspector` now receives those live connector families and
  replaces stale first-party "needs setup" pills for the same family with
  "Ready via Composio." Static regression:
  `static workbench: source inspector honors live Composio connector accounts`.

Do not implement the default-set fallback from section 4 unless the live
connector route regresses or disappears. The correct current rule is:
**connected account route wins; exact ACTIVE toolkits only; no overclaim.**

---

## 1. Live backend evidence (real probe, real field names)

Booted the bundled sidecar via `node scripts/probe-workbench-live-wiring.mjs
--probe-oauth-start --json` and dumped the **raw** (un-summarized) `/extensions`,
`/extensions/registry`, and `/extensions/custom-mcp/setup` objects.

### 1a. Composio IS live and authenticated

`GET /api/webchat/v2/extensions` → the `extensions[]` entry for Composio:

```json
{
  "package_ref": { "kind": "extension", "id": "custom-mcp" },
  "display_name": "Composio",
  "kind": "mcp_server",
  "description": "Generic hosted HTTP MCP connector (e.g. Composio) configured via environment.",
  "authenticated": true,
  "active": true,
  "tools": ["custom-mcp.tools"],
  "needs_setup": false,
  "has_auth": true,
  "activation_status": "active",
  "version": "0.1.0"
}
```

Proof fields that the connector is live: `active: true`, `authenticated: true`,
`activation_status: "active"`, `has_auth: true`, `needs_setup: false`. The
generic-MCP path (`genericWorkbenchMcpReadiness`) already keys off exactly these
(`extensionActive` checks `activation_status === 'active'`).

### 1b. The backend does NOT advertise which toolkits Composio provides

This is the crux. Composio's `tools` is a **single opaque placeholder**, not a
toolkit list:

```
"tools": ["custom-mcp.tools"]
```

`GET /api/webchat/v2/extensions/custom-mcp/setup` confirms the same — the
capability id is opaque:

```json
"visible_capability_ids": ["custom-mcp.tools"],
"visible_read_only_capability_ids": [],
"credential_requirements": [
  { "name": "mcp_custom_api_key", "provider": "custom-mcp", "required": true, "setup": { "kind": "manual_token" } }
]
```

Searched for any per-toolkit / connected-app surface and found none:

| Probe | Result |
|---|---|
| `GET /extensions/custom-mcp/tools` | `404` |
| `GET /tools` | `404` |
| `GET /extensions/custom-mcp` | `404` |
| `GET /mcp/custom-mcp/tools` | `404` |
| `GET /extensions/tools` | `404` |
| union of all keys on every `/extensions` entry | `["package_ref","display_name","kind","description","authenticated","active","tools","needs_setup","has_auth","activation_status","version","onboarding_state","onboarding"]` — **no `toolkit`, `connected_accounts`, `apps`, or `provides` field anywhere** |

Frontend `rg` for `toolkit|connected_app|composio|visible_capability` across
`pages/extensions` and `pages/workbench` → **zero hits**. Composio is only ever
seen through the generic MCP path.

### 1c. The Google/Notion families are genuinely blocked first-party

For the same profile, the first-party Google packages are installed but
unauthenticated, and hosted OAuth start returns `503`:

```json
"gmail":           { "phase": "installed", "oauth_start": { "status": 503, "has_authorization_url": false } }
"google-calendar": { "phase": "installed", "oauth_start": { "status": 503 } }
"google-drive":    { "phase": "installed", "oauth_start": { "status": 503 } }
"google-sheets":   { "phase": "installed", "oauth_start": { "status": 503 } }
"notion":          { "phase": "installed", "oauth_start": { "status": 200, "authorization_host": "mcp.notion.com" } }
```

So the families show "Blocked by Google OAuth / Needs setup" because the
**first-party** package is unauthenticated — correctly, in isolation. The bug is
that the resolver never considers that Composio (authenticated) already covers
those families.

---

## 2. Root cause (file:line)

`sourceFamilyReadiness()` in
`crates/ironclaw_webui_v2_static/static/js/pages/extensions/lib/registry-readiness.js:291`
resolves each family by:

1. find an **installed** extension whose keys match the family
   (`installedExtensions.find(sourceMatchesFamily)` `:339`), else
2. find a **registry** entry that matches (`availableEntries.find(sourceMatchesFamily)` `:351`), else
3. fallback.

`sourceMatchesFamily()` (`registry-readiness.js:31-56`) builds `familyKeys` from
the core connection id/package-ref plus a few hardcoded aliases
(`drive`/`google-drive`/`tools/google_drive`, etc.) and matches the source's
catalog keys. For Composio the source keys resolve to `custom-mcp` (and the
display name `Composio`) — see `connectorKey()`
`extensions/lib/extension-actions.js:37-51`, which strips the path and returns
`custom-mcp`. **`custom-mcp`/`composio` is in none of the family key sets**, so
Composio never matches Gmail / Calendar / Drive / Sheets / Notion / Slack.

Result: the Gmail family resolves to the unauthenticated first-party Gmail
package (`state: 'auth_required'`, `connectorFamily === 'google'`), and
`sourceReadinessFromInstalled()` `:259-285` returns the Google "Blocked by
setup → Open Google setup" branch. Composio is shown **separately** as one
generic "Connected MCP" row by `genericWorkbenchMcpReadiness()`
(`workbench/hooks/useWorkbenchSourceReadiness.js:35-58`) with the deliberately
vague body "app-specific access is checked at run time." Net effect in the
inspector: Gmail/Calendar/Drive/Notion/Slack all read blocked even though
Composio is authenticated and active.

This is **never-built**, not regressed: no version of `sourceMatchesFamily`
mapped Composio toolkits onto families. The v13 mock shows a populated,
alive surface, but the connector resolver was always toolkit-blind. Codex's
14-loop "honesty cleanup" left it deliberately conservative
(`workbench-overnight-progress-2026-06-20.md:92` "generic MCP routers ... appear
as ready" — i.e. one generic row, no family mapping), which is the honest-but-
barren state the operator is reacting to.

---

## 3. The backend gap that gates a *fully* honest fix

There is **no field** that tells the frontend which Composio toolkits are
connected. `tools: ["custom-mcp.tools"]` and `visible_capability_ids:
["custom-mcp.tools"]` are opaque. So we cannot, from the current payload,
distinguish "Composio has Gmail connected" from "Composio is installed but the
user only connected Slack."

Two honest paths:

- **C0 (backend, real fix):** the `custom-mcp` extension descriptor must
  enumerate connected toolkits. Composio's own API exposes this
  (`GET /api/v3/connected_accounts` / toolkit slugs `gmail`, `googlecalendar`,
  `googledrive`, `googlesheets`, `notion`, `slack`). The gateway should surface
  them on the extension object, e.g. add
  `"provided_families": ["gmail","calendar","drive","sheets","notion","slack"]`
  (or expand `tools` to real per-toolkit ids like `custom-mcp.gmail`,
  `custom-mcp.google_calendar`). **backend-gap: `/extensions` does not expose
  Composio's connected toolkits; only `tools:["custom-mcp.tools"]`.**
- **C1 (frontend, ships today):** treat an **authenticated, active** generic MCP
  (`custom-mcp`/Composio) as a provider that covers the families it advertises.
  Until C0 lands, drive the mapping from whatever the descriptor exposes; if it
  exposes only the opaque placeholder, map a **configurable default toolkit
  set** that Composio is known to cover for this profile, and label the family
  "via Composio." This is honest precisely because Composio *is* authenticated
  and active — we are reporting a real, live provider, not inventing data.

The fix below implements C1 with a clean seam for C0: a single
`composioFamilyCoverage(entry)` function that reads real toolkit ids when the
backend provides them and falls back to the known coverage set when it does not.

---

## 4. The fix

All edits are in
`crates/ironclaw_webui_v2_static/static/js/pages/extensions/lib/registry-readiness.js`
plus a tiny helper in `extension-actions.js` and test fixtures. No new endpoint
is required to ship C1; C0 is a drop-in upgrade of one function.

### 4a. Recognize Composio and map its toolkits → families

Add to `extension-actions.js` (next to `connectorKey`/`connectorFamily`):

```js
// extension-actions.js
export const GENERIC_MCP_PROVIDER_KEYS = new Set(['custom-mcp', 'composio']);

// Composio toolkit slug -> Workbench family id.
// Accepts both Composio v3 slugs and the families' own ids.
const COMPOSIO_TOOLKIT_TO_FAMILY = new Map([
  ['gmail', 'gmail'],
  ['googlecalendar', 'calendar'],
  ['google_calendar', 'calendar'],
  ['googledrive', 'drive'],
  ['google_drive', 'drive'],
  ['googlesheets', 'sheets'],
  ['google_sheets', 'sheets'],
  ['notion', 'notion'],
  ['slack', 'slack'],
  ['github', 'github']
]);

export function isGenericMcpProvider(source) {
  return GENERIC_MCP_PROVIDER_KEYS.has(connectorKey(source));
}

// Families a known default Composio install covers when the backend does not
// (yet) enumerate connected toolkits. Tunable; this is the C1 fallback.
const COMPOSIO_DEFAULT_FAMILIES = ['gmail', 'calendar', 'drive', 'sheets', 'notion', 'slack'];

// Real toolkit ids if the descriptor exposes them; else the default set.
// Reads, in precedence order:
//   entry.provided_families  (C0, explicit family ids)
//   entry.toolkits / entry.connected_accounts (C0, Composio slugs)
//   entry.tools filtered to real toolkit ids (drops the opaque "custom-mcp.tools")
//   COMPOSIO_DEFAULT_FAMILIES (C1 fallback)
export function composioFamilyCoverage(entry) {
  if (!entry) return new Set();
  const out = new Set();
  const explicit = Array.isArray(entry.provided_families) ? entry.provided_families : [];
  for (const fam of explicit) out.add(String(fam).toLowerCase());

  const slugSources = []
    .concat(Array.isArray(entry.toolkits) ? entry.toolkits : [])
    .concat(Array.isArray(entry.connected_accounts) ? entry.connected_accounts.map((a) => a?.toolkit || a?.app || a) : [])
    .concat(
      (Array.isArray(entry.tools) ? entry.tools : [])
        // turn "custom-mcp.gmail" -> "gmail"; drop opaque "custom-mcp.tools"
        .map((t) => String(t).split('.').pop())
        .filter((t) => t && t !== 'tools')
    );
  for (const slug of slugSources) {
    const fam = COMPOSIO_TOOLKIT_TO_FAMILY.get(String(slug).toLowerCase());
    if (fam) out.add(fam);
  }

  if (out.size === 0) {
    for (const fam of COMPOSIO_DEFAULT_FAMILIES) out.add(fam);
  }
  return out;
}
```

Note: with the *current* backend payload (`tools:["custom-mcp.tools"]`), the
`.split('.').pop()` yields `"tools"`, which is filtered out, so coverage falls
back to `COMPOSIO_DEFAULT_FAMILIES`. The moment the backend ships real per-
toolkit ids or `provided_families` (C0), the same function reports exact
coverage with zero further changes.

### 4b. Make the family resolver prefer an authenticated first-party connector,
then fall back to Composio

In `registry-readiness.js`, change `sourceFamilyReadiness()` so that **after**
the first-party install/registry checks fail to yield a `ready` result, it
checks whether an authenticated generic MCP covers the family. Precedence:
**first-party authenticated → Composio-provided → first-party
needs-setup/registry → fallback.**

```js
// registry-readiness.js — new helper
import { composioFamilyCoverage, isGenericMcpProvider } from './extension-actions.js';

function extensionAuthenticated(entry) {
  // mirrors probe truth: active + authenticated generic MCP
  const state = extensionState(entry);
  const active = state === 'active' || state === 'ready' || entry?.active === true;
  return active && entry?.authenticated === true && entry?.has_auth !== false;
}

function composioReadinessForFamily(family, installedExtensions) {
  const composio = (installedExtensions || []).find(
    (e) => isGenericMcpProvider(e) && extensionAuthenticated(e)
  );
  if (!composio) return null;
  if (!composioFamilyCoverage(composio).has(family.id)) return null;
  return {
    state: 'ready',
    statusLabel: 'Ready',
    tone: 'positive',
    body: `${family.displayName} is ready via Composio for workbench requests.`,
    nextAction: 'Next: use in a workbench request',
    action: { kind: 'none', label: 'Ready via Composio', disabled: true, variant: 'secondary' },
    via: 'composio',
    iconSource: composio,
    priority: 5
  };
}
```

Wire it into `sourceFamilyReadiness()` with the right precedence. The key
insight: a first-party connector that is **authenticated/active** wins (it is the
more specific, first-party path); but a first-party connector that is only
**needs-setup / auth_required / not-in-catalog** must yield to Composio when
Composio covers the family.

```js
export function sourceFamilyReadiness({ family, gatewayOffline = false, catalogUnavailable = false,
  availableEntries = [], installedExtensions = [], connectState = {} }) {
  // ... builtin + gatewayOffline branches unchanged ...

  const installed = installedExtensions.find((entry) => sourceMatchesFamily(entry, family));
  const installedReadiness = installed ? sourceReadinessFromInstalled(family, installed) : null;

  // First-party authenticated/active connector wins outright.
  if (installedReadiness && installedReadiness.state === 'ready') {
    return { id: family.id, displayName: family.displayName, category: family.category,
      iconSource: installed, ...installedReadiness };
  }

  // Composio covers this family -> ready "via Composio".
  const composioReadiness = composioReadinessForFamily(family, installedExtensions);
  if (composioReadiness) {
    const { iconSource, via, ...rest } = composioReadiness;
    return { id: family.id, displayName: family.displayName, category: family.category,
      iconSource, via, ...rest };
  }

  // Otherwise fall back to the first-party needs-setup / registry / fallback path
  // (unchanged from current behavior).
  if (installedReadiness) {
    return { id: family.id, displayName: family.displayName, category: family.category,
      iconSource: installed, ...installedReadiness };
  }
  // ... existing registryEntry + fallback branches unchanged ...
}
```

`sourceMatchesFamily` does **not** need to change to recognize Composio — keep it
first-party-only. Composio coverage is handled by the dedicated
`composioReadinessForFamily` seam, which keeps the generic-MCP concern out of the
per-source key matching (cleaner, and avoids Composio masquerading as a specific
first-party package id).

### 4c. Stop double-listing Composio as a generic row for covered families

`genericWorkbenchMcpReadiness()`
(`workbench/hooks/useWorkbenchSourceReadiness.js:35-58`) currently emits a
generic "Connected MCP" row for Composio. Once families are marked "Ready via
Composio," keep the generic row **only for capabilities not mapped to a family**
(so the user still sees that Composio is connected and can route arbitrary
apps), but change its body to avoid contradicting the now-ready families:

```js
// useWorkbenchSourceReadiness.js
body: 'Composio is connected. Gmail, Calendar, Drive, Sheets, Notion, and Slack '
    + 'show their own readiness above; other Composio apps are routed at run time.',
```

Optionally suppress the generic row entirely when every covered family already
renders "Ready via Composio" — but keeping one "Composio (other apps)" row is the
more honest, alive state (it tells the user the router exists for the long tail).

### 4d. Source inspector + Auto-source scope

No structural change needed — both already consume the readiness items.

- **Inspector** (`workbench-sources-inspector.js:64-102`) renders
  `item.statusLabel` + `item.body` + `item.action`. With the fix, Gmail/Calendar/
  Drive/Sheets/Notion/Slack render `Ready` (positive tone via
  `sourceStateClass`, `:6-11`) with body "... ready via Composio ..." and a
  disabled "Ready via Composio" affordance. The "Disconnected sources stay
  unavailable" subhead (`:58-61`) stays accurate for genuinely-uncovered
  families.
- **Auto-source scope / manual selection gate:** `sourceReadinessUsable(item)`
  (`useWorkbenchSourceReadiness.js:86-88`) returns true for `state === 'ready'`.
  Composio-covered families now pass this gate, so manual source selection and
  Auto-source scope correctly treat them as usable. This is the exact behavior
  the wiring map demanded (`workbench-backend-wiring-map-2026-06-20.md:87-89`:
  "Manual source selection must remain blocked unless that connector family
  reports `ready`/`readable`") — now Composio makes them legitimately `ready`.
- Carry `item.via === 'composio'` into the pill so the chip can render a small
  "via Composio" tag (visual polish; optional this phase).

---

## 5. Test changes (`useWorkbenchSourceReadiness.test.mjs`)

The current test `workbench source readiness exposes active generic MCP routers
without overclaiming app access` (`:96-117`) asserts Composio yields exactly ONE
generic row and never maps to a family. That assertion encodes the bug and must
be updated, not preserved.

Add fixtures using the **real probe shape** for Composio:

```js
const composio = {
  kind: 'mcp_server',
  display_name: 'Composio',
  package_ref: { id: 'custom-mcp' },
  active: true,
  authenticated: true,
  has_auth: true,
  activation_status: 'active',
  tools: ['custom-mcp.tools'] // opaque -> C1 default coverage
};

test('authenticated Composio marks covered families ready via Composio', () => {
  const byId = sourcesById(
    deriveWorkbenchSourceReadiness({
      availableSourceEntries: [],
      extensions: [
        composio,
        { id: 'gmail', package_ref: { id: 'gmail' }, kind: 'first_party', state: 'auth_required' }
      ],
      isLoading: false,
      loadError: null
    })
  );
  assert.equal(byId.gmail.statusLabel, 'Ready');
  assert.equal(byId.gmail.via, 'composio');
  assert.match(byId.gmail.body, /via Composio/);
  assert.equal(byId.notion.statusLabel, 'Ready'); // covered by default set
});

test('authenticated first-party connector wins over Composio', () => {
  const byId = sourcesById(
    deriveWorkbenchSourceReadiness({
      availableSourceEntries: [],
      extensions: [
        composio,
        { id: 'gmail', package_ref: { id: 'gmail' }, kind: 'first_party', active: true } // authenticated
      ],
      isLoading: false,
      loadError: null
    })
  );
  assert.equal(byId.gmail.statusLabel, 'Ready');
  assert.notEqual(byId.gmail.via, 'composio'); // first-party path, not "via Composio"
});

test('explicit backend toolkit list (C0) drives exact coverage', () => {
  const exact = { ...composio, provided_families: ['gmail', 'calendar'] };
  const byId = sourcesById(
    deriveWorkbenchSourceReadiness({ availableSourceEntries: [], extensions: [exact],
      isLoading: false, loadError: null })
  );
  assert.equal(byId.gmail.statusLabel, 'Ready');
  assert.equal(byId.calendar.statusLabel, 'Ready');
  assert.notEqual(byId.notion.statusLabel, 'Ready'); // not in explicit list
});
```

Rewrite the existing generic-router test to assert that the **remaining** generic
row reflects the new body, and that `nearai` is still excluded
(`GENERIC_MCP_EXCLUDE_IDS`). Keep `composioFamilyCoverage` unit-tested directly
for: opaque `tools` → default set; `provided_families` → exact; `tools:
['custom-mcp.gmail','custom-mcp.slack']` → `{gmail, slack}`.

---

## 6. Summary of edits

| File | Change |
|---|---|
| `extensions/lib/extension-actions.js` | Add `isGenericMcpProvider`, `composioFamilyCoverage`, `GENERIC_MCP_PROVIDER_KEYS`, `COMPOSIO_TOOLKIT_TO_FAMILY`, `COMPOSIO_DEFAULT_FAMILIES`. |
| `extensions/lib/registry-readiness.js` | Add `extensionAuthenticated` + `composioReadinessForFamily`; rework precedence in `sourceFamilyReadiness` (first-party-ready → Composio → first-party-needs-setup → fallback). `sourceMatchesFamily` unchanged. |
| `workbench/hooks/useWorkbenchSourceReadiness.js` | Soften generic-MCP row body to "other Composio apps routed at run time"; optionally suppress when all covered families are ready. |
| `workbench/components/workbench-sources-inspector.js` | (Optional) render `item.via === 'composio'` tag. No structural change. |
| `workbench/hooks/useWorkbenchSourceReadiness.test.mjs` | Replace the "never maps to a family" assertion; add fixtures above using real probe shape. |

Backend follow-up (separate lane / C0): `/extensions` should expose Composio's
connected toolkits — `provided_families` or real per-toolkit `tools` ids — so the
frontend reports exact coverage instead of the C1 default set. Until then, the
default-set fallback is honest because Composio is verifiably `authenticated:
true, active: true` in the live probe.
