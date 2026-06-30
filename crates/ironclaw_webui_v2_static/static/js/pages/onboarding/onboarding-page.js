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
import { ProviderLogo } from './provider-logos.js';

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

// One provider row: logo + name/subtitle on the left, the auth action(s) on the
// right. Stacks vertically on mobile (actions wrap onto their own line) and sits
// on a single line from `sm` up. NEAR AI Cloud is the only featured provider, so
// the row always renders the cloud sign-in actions.
function FeaturedProviderRow({ entry, showReady, login, resuming = false, t }) {
  const name = t(entry.nameKey);
  const authBusy = login.nearaiBusy || resuming;

  const actions = html`
    <${Button}
      type="button"
      variant="primary"
      size="md"
      fullWidth=${true}
      className="col-span-2"
      disabled=${authBusy}
      onClick=${() => login.startNearai('github')}
    >
      ${t('onboarding.continue')}
    <//>
    <${Button}
      type="button"
      variant="secondary"
      size="md"
      fullWidth=${true}
      disabled=${authBusy}
      onClick=${() => login.startNearai('google')}
    >
      ${t('onboarding.continueGoogle')}
    <//>
    <${Button}
      type="button"
      variant="secondary"
      size="md"
      fullWidth=${true}
      disabled=${authBusy}
      onClick=${login.startNearaiWallet}
    >
      ${t('onboarding.continueWallet')}
    <//>
  `;

  return html`
    <div className="grid gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <${ProviderLogo} id=${entry.id} name=${name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[var(--v2-text-strong)]">${name}</span>
            ${showReady &&
            html`<${Badge} tone="positive" label=${t('onboarding.ready')} size="sm" />`}
          </div>
          <p className="mt-1 text-sm leading-6 text-[var(--v2-text-muted)]">
            ${entry.auth === 'nearai' && isDesktopRuntime()
              ? t('onboarding.providerNearaiDescDesktop')
              : t(entry.descKey)}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">${actions}</div>
    </div>
  `;
}

function TrustRow({ icon, title, body }) {
  return html`
    <div
      className="grid grid-cols-[auto_1fr] items-start gap-3 border-t border-[var(--v2-panel-border)] py-3.5 first:border-t-0"
    >
      <span className="mt-1 grid h-7 w-7 place-items-center text-[var(--v2-text-muted)]">
        <${Icon} name=${icon} className="h-4 w-4" />
      </span>
      <span>
        <span className="block text-sm font-medium text-[var(--v2-text-strong)]">${title}</span>
        <span className="mt-1 block text-sm leading-6 text-[var(--v2-text-muted)]">${body}</span>
      </span>
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
  const providerAccessBlocked = providerSnapshotPending || providerSnapshotUnavailable;
  const showFallbackAccess = providerAccessBlocked;
  const primaryAuthVariant = providerAccessBlocked ? 'secondary' : 'primary';
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

  return html`
    <div className="h-full overflow-y-auto bg-[var(--v2-canvas)]">
      <div
        className="mx-auto grid min-h-full max-w-6xl gap-7 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-8"
      >
        <div className="max-w-2xl">
          <div className="mb-3 text-[13px] font-medium text-[var(--v2-text-muted)]">
            NEAR AI Cloud native
          </div>
          <h1
            className="max-w-[16ch] text-[28px] font-semibold leading-[1.06] tracking-[-0.01em] text-[var(--v2-text-strong)] sm:text-[28px]"
          >
            ${t('onboarding.title')}
          </h1>
          <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-[var(--v2-text-muted)]">
            ${t('onboarding.subtitle')}
          </p>
          <div className="mt-9 hidden lg:grid">
            <${TrustRow}
              icon="spark"
              title=${t('onboarding.promiseModelsTitle')}
              body=${t('onboarding.promiseModelsBody')}
            />
            <${TrustRow}
              icon="lock"
              title=${t('onboarding.promiseApprovalsTitle')}
              body=${t('onboarding.promiseApprovalsBody')}
            />
            <${TrustRow}
              icon="file"
              title=${t('onboarding.promiseFilesTitle')}
              body=${t('onboarding.promiseFilesBody')}
            />
          </div>
        </div>

        <div className="grid gap-7">
          ${resuming &&
          html`<div
            className="flex items-center justify-center gap-2 text-sm text-[var(--v2-text-muted)]"
            role="status"
            aria-live="polite"
          >
            <${Icon} name="pulse" className="h-3.5 w-3.5" />
            ${t('onboarding.resumingSession')}
          </div>`}
          <${Card} variant="soft" radius="lg" className="p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-medium text-[var(--v2-text-muted)]">
                  ${t('onboarding.accessLabel')}
                </div>
                <h2 className="mt-1 text-[20px] font-semibold text-[var(--v2-text-strong)]">
                  ${t('onboarding.accessTitle')}
                </h2>
              </div>
              <${Badge} tone="muted" label=${t('onboarding.firstRun')} size="sm" />
            </div>
            <div className="grid gap-3">
              ${showFallbackAccess
                ? html`
                    <div className="grid gap-3">
                      <div
                        className="grid grid-cols-[auto_1fr] gap-3 rounded-[12px] border border-[color-mix(in_srgb,var(--v2-warning-text)_30%,var(--v2-panel-border))] bg-[var(--v2-warning-soft)] px-3 py-3"
                      >
                        <span
                          className="grid h-8 w-8 place-items-center rounded-[8px] border border-[color-mix(in_srgb,var(--v2-warning-text)_28%,var(--v2-panel-border))] bg-[color-mix(in_srgb,var(--v2-warning-text)_12%,transparent)] text-[var(--v2-warning-text)]"
                        >
                          <${Icon} name="pulse" className="h-3.5 w-3.5" />
                        </span>
                        <span>
                          <span
                            className="block text-sm font-semibold text-[var(--v2-text-strong)]"
                          >
                            ${accessStatusTitle}
                          </span>
                          <span
                            className="mt-0.5 block text-sm leading-6 text-[var(--v2-text-muted)]"
                          >
                            ${providerSnapshotPending
                              ? gatewayPendingCopy
                              : providerSnapshotUnavailable
                                ? gatewayUnavailableCopy
                                : t('onboarding.providerNearaiDescDesktop')}
                          </span>
                        </span>
                      </div>
                      <p className="text-sm leading-6 text-[var(--v2-text-muted)]">
                        ${gatewayFollowupCopy}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <${Button}
                          type="button"
                          variant=${primaryAuthVariant}
                          size="md"
                          fullWidth=${true}
                          className="col-span-2"
                          disabled=${providerAccessBlocked || login.nearaiBusy || resuming}
                          onClick=${() => login.startNearai('github')}
                        >
                          ${t('onboarding.continue')}
                        <//>
                        <${Button}
                          type="button"
                          variant="secondary"
                          size="md"
                          fullWidth=${true}
                          disabled=${providerAccessBlocked || login.nearaiBusy || resuming}
                          onClick=${() => login.startNearai('google')}
                        >
                          ${t('onboarding.continueGoogle')}
                        <//>
                        <${Button}
                          type="button"
                          variant="secondary"
                          size="md"
                          fullWidth=${true}
                          disabled=${providerAccessBlocked || login.nearaiBusy || resuming}
                          onClick=${login.startNearaiWallet}
                        >
                          ${t('onboarding.continueWallet')}
                        <//>
                      </div>
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

          <div className="px-1 text-sm leading-6 text-[var(--v2-text-muted)]">
            ${t('onboarding.moreInSettings')}${' '}
            <span className="font-medium text-[var(--v2-text-strong)]"> ${t('nav.settings')} </span>
          </div>

          <div className="grid lg:hidden">
            <${TrustRow}
              icon="spark"
              title=${t('onboarding.promiseModelsTitle')}
              body=${t('onboarding.promiseModelsBody')}
            />
            <${TrustRow}
              icon="lock"
              title=${t('onboarding.promiseApprovalsTitle')}
              body=${t('onboarding.promiseApprovalsBody')}
            />
            <${TrustRow}
              icon="file"
              title=${t('onboarding.promiseFilesTitle')}
              body=${t('onboarding.promiseFilesBody')}
            />
          </div>
        </div>
      </div>
    </div>
  `;
}
