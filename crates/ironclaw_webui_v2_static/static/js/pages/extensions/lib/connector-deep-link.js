import { canonicalExtensionName } from './extensions-api.js';

// Connector deep links arrive as `?focus=<kind>/<id>&setup=1` (URL-encoded),
// e.g. `focus=tools%2Fgmail`. They let a "Configure Gmail" link from the
// morning brief, a blocked-connector card, or an external prompt land directly
// on a connector's setup form.
//
// `focus` carries the catalog ref (kind-prefixed, e.g. `tools/gmail`), while the
// installed list the gateway returns keys connectors by the bare canonical name
// (`gmail`). Match on `canonicalExtensionName` so the prefixed ref lines up with
// the bare id, then hand the ConfigureModal a `{ packageRef, displayName }` shaped
// exactly like the one ExtensionCard builds. The packageRef flows back through
// `canonicalExtensionName` when the lifecycle request fires, so the bare ref the
// gateway expects crosses the wire — the catalog prefix never does.
export function resolveConnectorDeepLink(focusRef, { extensions = [], catalogEntries = [] } = {}) {
  if (!focusRef) return null;

  const canonical = safeCanonicalName(focusRef);
  if (!canonical) return null;

  const candidates = [
    ...extensions,
    ...catalogEntries.map((item) => item?.extension || item?.entry)
  ];
  for (const candidate of candidates) {
    const id = candidate?.package_ref?.id;
    if (!id) continue;
    if (safeCanonicalName(id) !== canonical) continue;
    return {
      packageRef: candidate.package_ref,
      displayName: candidate.display_name || id
    };
  }

  // No catalog row matched (the connector may not be installed in this build);
  // still honor the link with the focus ref so setup targets the bare lifecycle
  // route. canonicalExtensionName has already stripped the kind prefix.
  return {
    packageRef: { kind: 'extension', id: focusRef },
    displayName: canonical
  };
}

function safeCanonicalName(ref) {
  try {
    return canonicalExtensionName(ref);
  } catch {
    return null;
  }
}
