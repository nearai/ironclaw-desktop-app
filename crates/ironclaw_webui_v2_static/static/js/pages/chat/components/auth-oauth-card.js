/**
 * AuthOauthCard — rendered when `gate.challengeKind === "oauth_url"`.
 *
 * Status Pill + Drawer presentation (AuthGateShell). The drawer holds the
 * authorization CTA and waiting/expiry metadata.
 *
 * Opens `gate.authorizationUrl` in a new browser tab via a user-gesture
 * click. The OAuth callback is handled server-side
 * (`/api/reborn/product-auth/oauth/callback/{flow_id}`), which resumes the
 * paused run. The callback page emits a same-origin completion signal so the
 * WebUI can clear this gate immediately, then projection_update confirms the
 * resumed run state.
 *
 * Security invariants (issue #4112):
 * - No raw token, PKCE verifier, opaque state, or auth code is ever handled
 *   by this component. The server supplies only an opaque IDP URL.
 * - window.open is called with `noopener,noreferrer` to prevent the popup
 *   from accessing this window's context.
 * - The URL is parsed and must have the "https:" protocol before opening to
 *   reject non-HTTPS schemes (javascript:, data:, custom protocol handlers).
 */
import { React, html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';
import { openExternalUrl } from '../../../lib/api.js';
import { Button } from '../../../design-system/button.js';
import { Icon } from '../../../design-system/icons.js';
import { AuthGateShell } from './auth-gate-shell.js';

// Resolve the gate expiry to a finite epoch-ms value, or null when absent.
function resolveExpiry(expiresAt) {
  if (expiresAt == null || expiresAt === '') return null;
  const stamp = typeof expiresAt === 'number' ? expiresAt : Date.parse(expiresAt);
  return Number.isFinite(stamp) ? stamp : null;
}

export function AuthOauthCard({ gate, onCancel }) {
  const t = useT();
  const [opened, setOpened] = React.useState(false);
  const [error, setError] = React.useState('');
  const hasHttpsAuthorizationUrl = React.useMemo(() => {
    if (!gate.authorizationUrl) return false;
    try {
      return new URL(gate.authorizationUrl).protocol === 'https:';
    } catch {
      return false;
    }
  }, [gate.authorizationUrl]);
  React.useEffect(() => {
    setError('');
  }, [gate.authorizationUrl, gate.gateRef, gate.runId]);

  // Expiry: an OAuth authorization URL is time-boxed. Once it lapses the waiting
  // text would lie ("waiting…" on a dead link), so we flip to an expired state
  // and steer the user to re-open instead. A timer fires at the expiry instant so
  // the state changes without a fresh render trigger.
  const expiresAt = React.useMemo(() => resolveExpiry(gate?.expiresAt), [gate?.expiresAt]);
  const [expired, setExpired] = React.useState(() =>
    expiresAt != null ? Date.now() >= expiresAt : false
  );
  React.useEffect(() => {
    if (expiresAt == null) {
      setExpired(false);
      return undefined;
    }
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      setExpired(true);
      return undefined;
    }
    setExpired(false);
    const timer = window.setTimeout(() => setExpired(true), remaining);
    return () => window.clearTimeout(timer);
  }, [expiresAt]);

  const providerLabel = gate.provider
    ? gate.provider.charAt(0).toUpperCase() + gate.provider.slice(1)
    : t('authGate.oauthProviderFallback');

  const openAuth = React.useCallback(() => {
    // Guard: reject missing or non-HTTPS URLs before window.open so that
    // custom protocol handlers (javascript:, tel:, ms-msdt:, slack:) are
    // never opened even if a future code path writes an unexpected scheme.
    if (!hasHttpsAuthorizationUrl) {
      setError(t('authGate.serviceUnavailable'));
      return;
    }
    // Re-opening after expiry mints a fresh attempt; clear the expired flag so
    // the waiting hint replaces the expiry notice.
    setExpired(false);
    // Desktop: route to the SYSTEM browser — window.open in WKWebView spawns
    // a cookie-less child webview where the user has no Google session and
    // OAuth cannot complete. openExternalUrl falls back to window.open when
    // hosted, keeping the user-gesture popup semantics there.
    setError('');
    openExternalUrl(gate.authorizationUrl);
    setOpened(true);
  }, [gate.authorizationUrl, hasHttpsAuthorizationUrl, t]);

  // After expiry the CTA always reads as a re-open, since the prior link is dead.
  const openLabel =
    opened || expired
      ? t('authGate.reopenAuthorization', { provider: providerLabel })
      : t('authGate.openAuthorization', { provider: providerLabel });

  return html`
    <${AuthGateShell}
      icon="link"
      headline=${gate?.headline || t('authGate.oauthTitle')}
      provider=${gate?.provider ? providerLabel : ''}
      accountLabel=${gate?.accountLabel || ''}
      body=${gate?.body || ''}
      expiresAt=${gate?.expiresAt || ''}
      expired=${expired}
      pillHint=${t('authGate.pillAuthorize')}
    >
      <div className="flex flex-wrap gap-2">
        <${Button}
          as="a"
          href=${hasHttpsAuthorizationUrl ? gate.authorizationUrl : undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="auth-oauth"
          variant="primary"
          onClick=${(event) => {
            event.preventDefault();
            openAuth();
          }}
        >
          <${Icon} name="link" className="h-4 w-4" />
          ${openLabel}
        <//>
        <${Button} type="button" variant="secondary" onClick=${() => onCancel?.()}>
          ${t('authGate.cancel')}
        <//>
      </div>

      ${error &&
      html`
        <div
          className="mt-3 rounded-md border border-[color-mix(in_srgb,var(--v2-danger-text)_25%,transparent)] bg-[var(--v2-danger-soft)] px-3 py-2 text-xs text-[var(--v2-danger-text)]"
          role="alert"
        >
          ${error}
        </div>
      `}
      ${hasHttpsAuthorizationUrl &&
      !expired &&
      opened &&
      html`
        <p className="mt-2 text-xs text-[var(--v2-text-muted)]">${t('authGate.oauthWaiting')}</p>
      `}
    <//>
  `;
}
