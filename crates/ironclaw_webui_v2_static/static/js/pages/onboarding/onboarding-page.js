import { useNavigate, useOutletContext } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { React, html } from '../../lib/html.js';
import { isDesktopRuntime } from '../../lib/api.js';
import { useT } from '../../lib/i18n.js';
import { Badge } from '../../design-system/badge.js';
import { Button } from '../../design-system/button.js';
import { Card } from '../../design-system/card.js';
import { ProviderDialog } from '../settings/components/provider-dialog.js';
import { ProviderLoginStatus } from '../settings/components/provider-login-status.js';
import { useProviderManagementActions } from '../settings/hooks/useProviderManagementActions.js';
import { useProviderLogin } from '../settings/hooks/useProviderLogin.js';
import { isProviderConfigured } from '../settings/lib/llm-providers.js';
import { setActiveLlm, testLlmProviderConnection } from '../settings/lib/settings-api.js';
import { ProviderLogo } from './provider-logos.js';

// First-run model setup. The desktop product contract is NEAR AI Cloud by
// default; generic Reborn provider support stays hidden until an explicit
// advanced-provider mode exists.
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
// on a single line from `sm` up.
function FeaturedProviderRow({ entry, provider, configured, isBusy, login, t, onUse, onSetUp }) {
  const name = t(entry.nameKey);

  // Desktop: NEAR AI sign-in runs in a dedicated app window (the
  // server only accepts private.near.ai callbacks; the window captures the
  // token from that navigation). Wallet and API key remain as fallbacks.
  let actions;
  if (entry.auth === 'nearai') {
    if (isDesktopRuntime()) {
      actions = html`
        <${Button}
          type="button"
          variant="primary"
          size="sm"
          disabled=${login.nearaiBusy}
          onClick=${() => login.startNearai('github')}
        >
          ${t('onboarding.signInGithub')}
        <//>
        <${Button}
          type="button"
          variant="secondary"
          size="sm"
          disabled=${login.nearaiBusy}
          onClick=${() => login.startNearai('google')}
        >
          Google
        <//>
        <${Button}
          type="button"
          variant="secondary"
          size="sm"
          disabled=${login.nearaiBusy}
          onClick=${login.startNearaiWallet}
        >
          ${t('onboarding.nearWallet')}
        <//>
        <${Button}
          type="button"
          variant="ghost"
          size="sm"
          disabled=${isBusy}
          onClick=${() => onSetUp(provider)}
        >
          ${t('onboarding.useApiKey')}
        <//>
      `;
    } else {
      actions = html`
        <${Button}
          type="button"
          variant="secondary"
          size="sm"
          disabled=${login.nearaiBusy}
          onClick=${login.startNearaiWallet}
        >
          ${t('onboarding.nearWallet')}
        <//>
        <${Button}
          type="button"
          variant="secondary"
          size="sm"
          disabled=${login.nearaiBusy}
          onClick=${() => login.startNearai('github')}
        >
          GitHub
        <//>
        <${Button}
          type="button"
          variant="secondary"
          size="sm"
          disabled=${login.nearaiBusy}
          onClick=${() => login.startNearai('google')}
        >
          Google
        <//>
      `;
    }
  } else if (entry.auth === 'codex') {
    actions = html`
      <${Button}
        type="button"
        variant="secondary"
        size="sm"
        disabled=${login.codexBusy}
        onClick=${login.startCodex}
      >
        ${t('onboarding.signIn')}
      <//>
    `;
  } else if (configured) {
    actions = html`<${Button}
      type="button"
      variant="primary"
      size="sm"
      disabled=${isBusy}
      onClick=${() => onUse(provider)}
    >
      ${t('llm.use')}
    <//>`;
  } else {
    actions = html`<${Button}
      type="button"
      variant="primary"
      size="sm"
      disabled=${isBusy}
      onClick=${() => onSetUp(provider)}
    >
      ${t('onboarding.setUp')}
    <//>`;
  }

  return html`
    <${Card} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <${ProviderLogo} id=${entry.id} name=${name} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-[var(--v2-text-strong)]"
              >${name}</span
            >
            ${configured &&
            html`<${Badge} tone="positive" label=${t('onboarding.ready')} size="sm" />`}
          </div>
          <div className="mt-0.5 truncate text-xs text-[var(--v2-text-muted)]">
            ${entry.auth === 'nearai' && isDesktopRuntime()
              ? t('onboarding.providerNearaiDescDesktop')
              : t(entry.descKey)}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">${actions}</div>
    <//>
  `;
}

export function OnboardingPage() {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { gatewayStatus } = useOutletContext();
  const actions = useProviderManagementActions({
    settings: {},
    gatewayStatus,
    searchQuery: '',
    t
  });
  const state = actions.providerState;

  const featured = FEATURED.map((entry) => ({
    entry,
    provider: state.providers.find((provider) => provider.id === entry.id)
  })).filter((row) => row.provider);

  // NEAR AI login shares the same backend flow as the Inference tab; on success
  // here we head straight to chat.
  const navigateToChat = React.useCallback(() => navigate('/chat'), [navigate]);
  const login = useProviderLogin({ onSuccess: navigateToChat });

  // Resume an existing NEAR AI session instead of demanding a fresh sign-in.
  // A returning user (or a machine that signed in via the CLI) already holds
  // a working session the sidecar loaded — verify it with a real connection
  // test, activate it, and go straight to chat. Sign-in stays the path for
  // genuinely new machines.
  const [resumingSession, setResumingSession] = React.useState(false);
  const resumeAttemptedRef = React.useRef(false);
  React.useEffect(() => {
    if (resumeAttemptedRef.current || state.isLoading) return;
    const nearai = state.providers.find((provider) => provider.id === 'nearai');
    if (!nearai || state.activeProviderId) return;
    resumeAttemptedRef.current = true;
    let cancelled = false;
    (async () => {
      setResumingSession(true);
      try {
        const probe = await testLlmProviderConnection({
          provider_id: 'nearai',
          adapter: nearai.adapter || 'nearai',
          model: nearai.active_model || nearai.default_model || 'auto'
        });
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
        if (!cancelled) setResumingSession(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.isLoading, state.providers, state.activeProviderId, navigate, queryClient]);

  // Make an already-configured NEAR AI provider the active selection and head to
  // chat without opening the dialog.
  const handleUse = React.useCallback(
    async (provider) => {
      const model = provider.active_model || provider.default_model || '';
      await setActiveLlm({ provider_id: provider.id, model });
      await queryClient.invalidateQueries({ queryKey: ['llm-providers'] });
      navigate('/chat');
    },
    [navigate, queryClient]
  );

  const handleOnboardingSave = React.useCallback(
    async ({ form, apiKey, provider }) => {
      // Persist the provider (+ any key) via the shared save path, then make it
      // the active selection and head to chat. The cold-boot reload swaps the
      // placeholder for the real provider — no restart needed.
      await actions.handleSave({ form, apiKey, provider });
      const providerId = provider?.id || form.id.trim();
      const model = form.model?.trim() || provider?.default_model || '';
      await setActiveLlm({ provider_id: providerId, model });
      await queryClient.invalidateQueries({ queryKey: ['llm-providers'] });
      actions.closeDialog();
      navigate('/chat');
    },
    [actions, navigate, queryClient]
  );

  if (state.isLoading) {
    return html`
      <div className="grid h-full place-items-center text-sm text-[var(--v2-text-muted)]">
        ${t('common.loading')}
      </div>
    `;
  }

  return html`
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center gap-6 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[var(--v2-text-strong)]">
            ${t('onboarding.title')}
          </h1>
          <p className="mt-2 text-sm text-[var(--v2-text-muted)]">${t('onboarding.subtitle')}</p>
          ${resumingSession &&
          html`<p className="mt-3 text-sm font-medium text-[var(--v2-accent-text)]">
            ${t('onboarding.resumingSession')}
          </p>`}
        </div>

        <div className="flex flex-col gap-3">
          ${featured.map(
            ({ entry, provider }) => html`
              <${FeaturedProviderRow}
                key=${entry.id}
                entry=${entry}
                provider=${provider}
                configured=${isProviderConfigured(provider, state.builtinOverrides)}
                isBusy=${state.isBusy}
                login=${login}
                t=${t}
                onUse=${handleUse}
                onSetUp=${actions.openDialog}
              />
            `
          )}
        </div>

        <${ProviderLoginStatus} login=${login} />

        <div className="text-center text-xs text-[var(--v2-text-muted)]">
          ${t('onboarding.moreInSettings')}${' '}
          <button
            type="button"
            className="underline hover:text-[var(--v2-text-strong)]"
            onClick=${() => navigate('/settings/inference')}
          >
            ${t('nav.settings')}
          </button>
        </div>
      </div>

      <${ProviderDialog}
        open=${actions.isDialogOpen}
        provider=${actions.dialogProvider}
        allProviderIds=${actions.allProviderIds}
        builtinOverrides=${state.builtinOverrides}
        onClose=${actions.closeDialog}
        onSave=${handleOnboardingSave}
        onTest=${state.testConnection}
        onListModels=${state.listModels}
      />
    </div>
  `;
}
