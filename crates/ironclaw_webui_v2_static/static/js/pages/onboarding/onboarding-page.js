import { useNavigate, useOutletContext } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { React, html } from '../../lib/html.js';
import { isDesktopRuntime } from '../../lib/api.js';
import { useT } from '../../lib/i18n.js';
import { Badge } from '../../design-system/badge.js';
import { Button } from '../../design-system/button.js';
import { Card } from '../../design-system/card.js';
import { Icon } from '../../design-system/icons.js';
import { ProviderLoginStatus } from '../settings/components/provider-login-status.js';
import { useProviderManagementActions } from '../settings/hooks/useProviderManagementActions.js';
import { useProviderLogin } from '../settings/hooks/useProviderLogin.js';
import { setActiveLlm, testLlmProviderConnection } from '../settings/lib/settings-api.js';

// First-run model setup. The desktop product contract is NEAR AI Cloud by
// default; generic Reborn provider support stays hidden until an explicit
// advanced-provider mode exists.
const RESUME_SESSION_TIMEOUT_MS = 4000;
const FEATURED = [
  {
    id: 'nearai',
    auth: 'nearai',
    nameKey: 'onboarding.providerNearai',
    descKey: 'onboarding.providerNearaiDesc'
  }
];

// The one NEAR AI Cloud sign-in cluster. Written ONCE and shared by both the
// ready path (FeaturedProviderRow) and the gateway-unavailable path, so the two
// states can never drift into two copies of the same three buttons. GitHub is
// the single blue primary — the user's one action — with Google and NEAR Wallet
// as quiet secondary paths to the same flow.
function AuthActions({ login, disabled = false, primaryVariant = 'primary' }) {
  const t = useT();
  const busy = disabled || login.nearaiBusy;
  return html`
    <div className="grid grid-cols-2 gap-2">
      <${Button}
        type="button"
        variant=${primaryVariant}
        size="md"
        fullWidth=${true}
        className="col-span-2"
        disabled=${busy}
        onClick=${() => login.startNearai('github')}
      >
        ${t('onboarding.continue')}
      <//>
      <${Button}
        type="button"
        variant="secondary"
        size="md"
        fullWidth=${true}
        disabled=${busy}
        onClick=${() => login.startNearai('google')}
      >
        ${t('onboarding.continueGoogle')}
      <//>
      <${Button}
        type="button"
        variant="secondary"
        size="md"
        fullWidth=${true}
        disabled=${busy}
        onClick=${login.startNearaiWallet}
      >
        ${t('onboarding.continueWallet')}
      <//>
    </div>
  `;
}

// Ready path: one quiet provider line (name + honest description + gated READY
// state) above the shared sign-in cluster. No saturated brand tile — the accent
// belongs to the user's action, not a logo island.
function FeaturedProviderRow({ entry, showReady, login, resuming = false, t }) {
  const name = t(entry.nameKey);

  return html`
    <div className="grid gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="v2-text-section">${name}</span>
          ${showReady &&
          html`<${Badge} tone="positive" label=${t('onboarding.ready')} size="sm" />`}
        </div>
        <p className="v2-text-body mt-1 text-[var(--v2-text-muted)]">
          ${entry.auth === 'nearai' && isDesktopRuntime()
            ? t('onboarding.providerNearaiDescDesktop')
            : t(entry.descKey)}
        </p>
      </div>
      <${AuthActions} login=${login} disabled=${resuming} />
    </div>
  `;
}

// The product's actual signature, in the gate's own voice: first-run ties
// straight to the approval gate. One line, not a marketing trust-row triad.
function GateContractLine() {
  return html`
    <div
      className="flex items-start gap-2.5 border-t border-[var(--v2-panel-border)] pt-4 text-[var(--v2-text-muted)]"
    >
      <${Icon} name="lock" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden=${true} />
      <p className="v2-text-body">It asks before any external action leaves this machine.</p>
    </div>
  `;
}

export function OnboardingPage() {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const outletContext = useOutletContext() || {};
  const { gatewayStatus } = outletContext;
  const actions = useProviderManagementActions({
    settings: {},
    gatewayStatus,
    searchQuery: '',
    t
  });
  const state = actions.providerState;
  const fallbackNearaiProvider = React.useMemo(
    () => ({
      id: 'nearai',
      name: t('onboarding.providerNearai'),
      builtin: true,
      adapter: 'nearai',
      accepts_api_key: true,
      api_key_required: false,
      base_url_required: false,
      has_api_key: false,
      default_model: 'auto'
    }),
    [t]
  );

  const featured = FEATURED.map((entry) => {
    const provider = state.providers.find((candidate) => candidate.id === entry.id);
    const fallbackProvider = entry.id === 'nearai' ? fallbackNearaiProvider : null;
    return {
      entry,
      provider: provider || fallbackProvider,
      isFallbackProvider: !provider && Boolean(fallbackProvider)
    };
  }).filter((row) => row.provider);
  const hasSyntheticProvider = featured.some((row) => row.provider?.synthetic_unavailable);
  const hasOnlyFallbackProvider =
    featured.length === 0 || featured.every((row) => row.isFallbackProvider);
  const providerSnapshotPending = Boolean(
    state.isChecking && (hasSyntheticProvider || hasOnlyFallbackProvider)
  );
  const providerSnapshotUnavailable = Boolean(
    state.error || (!providerSnapshotPending && (hasSyntheticProvider || hasOnlyFallbackProvider))
  );
  const showFallbackAccess = providerSnapshotPending || providerSnapshotUnavailable;
  const desktopRuntime = isDesktopRuntime();
  const accessStatusTitle = providerSnapshotPending
    ? desktopRuntime
      ? 'Checking local gateway'
      : 'Checking preview gateway'
    : providerSnapshotUnavailable
      ? desktopRuntime
        ? 'Gateway not available'
        : 'Static preview needs a gateway'
      : 'Ready to sign in';
  const gatewayPendingCopy = desktopRuntime
    ? 'Checking the local gateway for NEAR AI Cloud access.'
    : 'Checking the gateway configured for this browser preview.';
  const gatewayUnavailableCopy = desktopRuntime
    ? 'IronClaw cannot reach the local sidecar yet. Restart the app or start the sidecar, then sign in with NEAR AI Cloud.'
    : 'This browser preview cannot start the desktop sidecar. Run the packaged app or npm run tauri dev for sign-in; use npm run dev:webui-static only for UI smoke tests against an already running gateway.';
  const gatewayFollowupCopy = desktopRuntime
    ? 'Finish the access step once the gateway is reachable. IronClaw will keep model routing on NEAR AI Cloud.'
    : 'For a working desktop session, launch IronClaw through Tauri so the sidecar and native auth bridge are available.';

  // NEAR AI login shares the same backend flow as the Inference tab; on success
  // here we head straight to chat.
  const navigateToChat = React.useCallback(() => navigate('/chat'), [navigate]);
  const login = useProviderLogin({ onSuccess: navigateToChat });

  // Resume an existing NEAR AI session instead of demanding a fresh sign-in.
  // A returning user (or a machine that signed in via the CLI) already holds
  // a working session the sidecar loaded — verify it with a real connection
  // test, activate it, and go straight to chat. Sign-in stays the path for
  // genuinely new machines.
  const resumeAttemptedRef = React.useRef(false);
  // While the resume probe is in flight, the auth buttons are disabled and a
  // status line renders — otherwise a returning user could fire a fresh sign-in
  // on top of the silent resume and race two logins.
  const [resuming, setResuming] = React.useState(false);
  React.useEffect(() => {
    if (resumeAttemptedRef.current || state.isLoading) return;
    const nearai = state.providers.find((provider) => provider.id === 'nearai');
    if (!nearai || state.activeProviderId) return;
    resumeAttemptedRef.current = true;
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), RESUME_SESSION_TIMEOUT_MS);
    setResuming(true);
    (async () => {
      try {
        const probe = await testLlmProviderConnection(
          {
            provider_id: 'nearai',
            adapter: nearai.adapter || 'nearai',
            model: nearai.active_model || nearai.default_model || 'auto'
          },
          {
            signal: controller.signal
          }
        );
        if (cancelled || !probe?.ok) return;
        await setActiveLlm({
          provider_id: 'nearai',
          model: nearai.active_model || nearai.default_model || 'auto'
        });
        await queryClient.invalidateQueries({ queryKey: ['llm-providers'] });
        if (!cancelled) navigate('/chat');
      } catch (_) {
        // No working session — the sign-in buttons below are the path.
      } finally {
        window.clearTimeout(timeout);
        if (!cancelled) setResuming(false);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [state.isLoading, state.providers, state.activeProviderId, navigate, queryClient]);

  // The physical next action for a blocked gateway — start the sidecar or
  // restart the app — is the honest primary. No disabled fake-ready sign-in.
  const gatewayActionTitle = desktopRuntime ? 'Restart IronClaw' : 'Start the sidecar';

  return html`
    <div className="h-full overflow-y-auto bg-[var(--v2-canvas)]">
      <div
        className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-8 px-4 py-12 sm:px-6"
      >
        <!-- Quiet product lockup: masthead, one sentence, nothing more. -->
        <div className="grid gap-3">
          <div className="v2-text-label">NEAR AI Cloud native</div>
          <h1 className="v2-text-display">${t('onboarding.title')}</h1>
          <p className="v2-text-body text-[var(--v2-text-muted)]">${t('onboarding.subtitle')}</p>
        </div>

        ${resuming &&
        html`<div
          className="flex items-center gap-2 text-[var(--v2-text-muted)]"
          role="status"
          aria-live="polite"
        >
          <${Icon} name="pulse" className="h-3.5 w-3.5" aria-hidden=${true} />
          <span className="v2-text-body">${t('onboarding.resumingSession')}</span>
        </div>`}

        <!-- The one dominant action. -->
        <${Card} variant="soft" radius="lg" className="p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="grid gap-1">
              <div className="v2-text-label">${t('onboarding.accessLabel')}</div>
              <h2 className="v2-text-title">${t('onboarding.accessTitle')}</h2>
            </div>
            <${Badge} tone="muted" label=${t('onboarding.firstRun')} size="sm" />
          </div>
          <div className="grid gap-3">
            ${showFallbackAccess
              ? html`
                  <div className="grid gap-4">
                    <div className="grid gap-1.5">
                      <div className="flex items-center gap-2 text-[var(--v2-warning-text)]">
                        <${Icon} name="pulse" className="h-3.5 w-3.5" aria-hidden=${true} />
                        <span className="v2-text-section text-[var(--v2-text-strong)]"
                          >${accessStatusTitle}</span
                        >
                      </div>
                      <p className="v2-text-body text-[var(--v2-text-muted)]">
                        ${providerSnapshotPending
                          ? gatewayPendingCopy
                          : providerSnapshotUnavailable
                            ? gatewayUnavailableCopy
                            : t('onboarding.providerNearaiDescDesktop')}
                      </p>
                    </div>
                    ${providerSnapshotUnavailable
                      ? html`
                          <div
                            className="rounded-[var(--v2-radius-control)] border border-[var(--v2-panel-border)] bg-[var(--v2-surface)] px-3.5 py-3"
                          >
                            <div className="v2-text-label text-[var(--v2-text-strong)]">
                              ${gatewayActionTitle}
                            </div>
                            <p className="v2-text-body mt-1 text-[var(--v2-text-muted)]">
                              ${gatewayFollowupCopy}
                            </p>
                          </div>
                        `
                      : html`<p className="v2-text-body text-[var(--v2-text-muted)]">
                          ${gatewayFollowupCopy}
                        </p>`}
                  </div>
                `
              : featured.map(
                  ({ entry, provider }) => html`
                    <${FeaturedProviderRow}
                      key=${entry.id}
                      entry=${entry}
                      showReady=${state.activeProviderId === provider.id ||
                      provider.has_api_key === true}
                      login=${login}
                      resuming=${resuming}
                      t=${t}
                    />
                  `
                )}
          </div>
        <//>

        <${ProviderLoginStatus} login=${login} />

        <div className="grid gap-4">
          <${GateContractLine} />
          <p className="v2-text-body text-[var(--v2-text-muted)]">
            ${t('onboarding.moreInSettings')}
          </p>
        </div>
      </div>
    </div>
  `;
}
