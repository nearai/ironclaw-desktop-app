import { html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';
import { INFERENCE_FIELDS } from '../lib/settings-schema.js';
import { filterSettingsSections, matchesSearch } from '../lib/settings-search.js';
import { ProviderManagement } from './provider-management.js';
import { GoogleOauthCard } from './google-oauth-card.js';
import { SettingsGroup } from './settings-field.js';
import { SettingsSearchEmpty } from './settings-search-empty.js';
import { SettingsNotWritable } from './settings-not-writable.js';
import { modelExecutionReadiness } from '../../../lib/model-readiness.js';
import { useProviderLogin } from '../hooks/useProviderLogin.js';
import { ProviderLoginStatus } from './provider-login-status.js';
import { Button } from '../../../design-system/button.js';

export function InferenceTab({
  settings,
  gatewayStatus,
  settingsStatus = 'ready',
  onSave,
  savedKeys,
  isLoading,
  searchQuery = ''
}) {
  const t = useT();
  const backend = 'NEAR AI Cloud';
  const model = gatewayStatus?.llm_model || settings.selected_model || 'NEAR AI Cloud default';
  const readiness = modelExecutionReadiness(gatewayStatus);
  // ONE model source, one connect action. When NEAR AI Cloud has not completed a
  // live run this chip is the always-reachable sign-in entry (the provider rows
  // only offer Connect when NEAR is *not* active, which dead-ends a gateway that
  // reports NEAR active-but-unverified). Multi-provider taxonomy is demoted into
  // the "Advanced · custom provider" disclosure below.
  const login = useProviderLogin();
  // The embeddings/sampling field cards write through `useSettings.save`, which
  // has no v2 persistence endpoint yet (status:'todo'). Rendering live toggles
  // and inputs that silently fail to save is fake readiness — gate them on a
  // proven settings backend. The provider summary and ProviderManagement below
  // stay: those read real `gatewayStatus`/LLM-provider state and are the honest
  // AI-setup controls on this surface.
  const settingsWritable = settingsStatus !== 'todo';
  const sections = settingsWritable
    ? filterSettingsSections(INFERENCE_FIELDS, settings, searchQuery, t)
    : [];
  const showProviderSummary = matchesSearch(searchQuery, [
    t('inference.provider'),
    t('inference.backend'),
    backend,
    t('inference.model'),
    model,
    readiness.label
  ]);
  const showProviderManagement = matchesSearch(searchQuery, [
    t('llm.providers'),
    t('llm.providersDesc'),
    'llm',
    'model',
    'near',
    'near ai cloud'
  ]);

  if (isLoading) {
    return html`<${SettingsSkeleton} />`;
  }

  if (!showProviderSummary && !showProviderManagement && sections.length === 0) {
    // The field cards are gated off when the settings backend cannot persist
    // (settingsWritable === false). If nothing else is showing either, fall back to
    // the honest "not writable" panel instead of a bare search-empty — mirrors the
    // Agent/Networking tabs so the surface never goes silently blank.
    if (!settingsWritable) {
      return html`<${SettingsNotWritable} />`;
    }
    return html`<${SettingsSearchEmpty} query=${searchQuery} />`;
  }

  return html`
    <div className="space-y-8">
      ${showProviderSummary &&
      html`
        <${ModelSourceChip}
          backend=${backend}
          model=${model}
          readiness=${readiness}
          login=${login}
          t=${t}
        />
      `}
      ${showProviderManagement &&
      html`
        <${ProviderManagement}
          settings=${settings}
          gatewayStatus=${gatewayStatus}
          searchQuery=${searchQuery}
        />
      `}
      ${showProviderManagement &&
      html`
        <details className="group">
          <summary
            className="flex cursor-pointer list-none items-center gap-2 py-1 text-left [&::-webkit-details-marker]:hidden"
          >
            <span className="v2-text-label">Advanced · custom provider</span>
            <span
              aria-hidden="true"
              className="text-[var(--v2-text-faint)] transition-transform group-open:rotate-90"
            >
              ›
            </span>
          </summary>
          <p className="mt-1 max-w-prose text-sm text-[var(--v2-text-muted)]">
            Connect a Google account for Workspace tools. Most desktops never need this here.
          </p>
          <div className="mt-4">
            <${GoogleOauthCard} />
          </div>
        </details>
      `}
      ${sections.map(
        (section) => html`
          <${SettingsGroup}
            key=${section.groupKey}
            groupKey=${section.groupKey}
            fields=${section.fields}
            settings=${settings}
            onSave=${onSave}
            savedKeys=${savedKeys}
          />
        `
      )}
    </div>
  `;
}

// Compact NEAR AI Cloud state: one runtime, one status line, one action. When
// unverified it is a single primary Connect (browser SSO) with a quiet wallet
// fallback — never a duplicated Google/GitHub button bank. When active the
// runtime + active model read as text; model choice lives in the Advanced
// disclosure's ActiveModelPanel so this surface stays a single decision.
export function ModelSourceChip({ backend, model, readiness, login, t }) {
  const connected = readiness.verified;
  return html`
    <section
      className="rounded-[var(--v2-radius-card)] border border-[var(--v2-panel-border)] p-4 sm:p-5"
    >
      <div className="v2-text-label">${t('inference.provider')}</div>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            ${connected &&
            html`<span
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--v2-positive-text)]"
            />`}
            <span className="v2-text-section">${backend}</span>
          </div>
          <div
            className=${[
              'mt-1 text-sm',
              connected ? 'text-[var(--v2-positive-text)]' : 'text-[var(--v2-warning-text)]'
            ].join(' ')}
          >
            ${readiness.label}
          </div>
          <p className="mt-1 max-w-prose text-sm text-[var(--v2-text-muted)]">
            ${readiness.description}
          </p>
        </div>
        ${connected
          ? html`
              <div className="text-right">
                <div className="v2-text-label">${t('inference.model')}</div>
                <div className="mt-1 text-sm font-medium text-[var(--v2-text-strong)]">
                  ${model || t('inference.none')}
                </div>
              </div>
            `
          : html`
              <div className="flex flex-col items-stretch gap-2 sm:items-end">
                <${Button}
                  type="button"
                  variant="primary"
                  disabled=${login.nearaiBusy}
                  onClick=${() => login.startNearai('google')}
                >
                  Connect NEAR AI Cloud
                <//>
                <${Button}
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled=${login.nearaiBusy}
                  onClick=${login.startNearaiWallet}
                >
                  ${t('onboarding.nearWallet')}
                <//>
              </div>
            `}
      </div>
      ${!connected &&
      html`
        <p className="mt-3 text-xs leading-5 text-[var(--v2-text-faint)]">
          IronClaw opens your browser to authorize, then connects automatically — no API key to
          copy.
        </p>
      `}
      <${ProviderLoginStatus} login=${login} />
    </section>
  `;
}

function Skeleton({ className = '' }) {
  return html` <div className=${'v2-skeleton rounded ' + className} /> `;
}

function SettingsSkeleton() {
  return html`
    <div className="space-y-8">
      <section
        className="rounded-[var(--v2-radius-card)] border border-[var(--v2-panel-border)] p-4 sm:p-5"
      >
        <${Skeleton} className="mb-3 h-3 w-24" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <${Skeleton} className="h-5 w-32" />
            <${Skeleton} className="mt-2 h-3 w-40" />
          </div>
          <${Skeleton} className="h-9 w-44" />
        </div>
      </section>
      ${[1, 2].map(
        (i) => html`
          <section key=${i}>
            <${Skeleton} className="mb-4 h-3 w-20" />
            ${[1, 2, 3].map(
              (j) => html`
                <div
                  key=${j}
                  className="flex items-center justify-between border-t border-[var(--v2-panel-border)] py-4 first:border-0"
                >
                  <${Skeleton} className="h-4 w-32" />
                  <${Skeleton} className="h-9 w-36" />
                </div>
              `
            )}
          </section>
        `
      )}
    </div>
  `;
}
