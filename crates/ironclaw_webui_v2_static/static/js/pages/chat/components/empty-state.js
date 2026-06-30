import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { React, html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';
import { filterDesktopVisibleLlmProviders } from '../../settings/lib/llm-providers.js';
import { fetchLlmProviders } from '../../settings/lib/settings-api.js';
import { ChatInput } from './chat-input.js';

// Chat-first front door. The home is the single thing the user came to do — hand
// IronClaw a task — so it is a calm greeting and one prominent composer, nothing
// else. Approvals surface in the thread when they are real; receipts and saved
// work live in Work; recent conversations live in the sidebar. The only extra
// element here is an honest "connect model access" notice when the gateway has
// no usable provider, because without it a failed send would be a mystery.
function greetingKey() {
  const hour = new Date().getHours();
  if (hour < 12) return 'chat.heroMorning';
  if (hour < 18) return 'chat.heroAfternoon';
  return 'chat.heroEvening';
}

function visibleLlmSnapshot(snapshot = {}) {
  const providers = filterDesktopVisibleLlmProviders(
    Array.isArray(snapshot.providers) ? snapshot.providers : []
  );
  const rawActive = snapshot.active || null;
  const active =
    rawActive && providers.some((provider) => provider.id === rawActive.provider_id)
      ? rawActive
      : null;
  return { providers, active };
}

export function EmptyState({
  onSend,
  disabled,
  initialText,
  resetKey,
  draftKey: composerDraftKey,
  context,
  statusText,
  canCancel,
  onCancel
}) {
  const t = useT();
  const providersQuery = useQuery({
    queryKey: ['llm-providers'],
    queryFn: fetchLlmProviders,
    staleTime: 60_000
  });
  const providersSnapshot = providersQuery.data;
  const visibleProvidersSnapshot = visibleLlmSnapshot(providersSnapshot || {});
  const providerSetupRequired = Boolean(providersSnapshot && !visibleProvidersSnapshot.active);
  const providerSetupFailed = Boolean(!providersSnapshot && providersQuery.error);
  const setupBlocked =
    context?.sendBlocked === true || providerSetupRequired || providerSetupFailed;

  return html`
    <div
      className="v2-page-entrance flex min-h-0 flex-1 flex-col overflow-y-auto px-6"
      data-testid="chat-front-door"
    >
      <div className="mx-auto mt-[12vh] flex w-full max-w-[720px] flex-col pb-12">
        <h1 className="v2-text-display">${t(greetingKey())}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--v2-text-muted)]">
          ${t('chat.heroDesc')}
        </p>

        <div className="mt-6">
          <${ChatInput}
            onSend=${onSend}
            disabled=${disabled}
            initialText=${initialText}
            resetKey=${resetKey}
            draftKey=${composerDraftKey}
            variant="hero"
            context=${context}
            statusText=${statusText}
            canCancel=${canCancel}
            onCancel=${onCancel}
          />
        </div>

        ${setupBlocked &&
        html`
          <div
            className="mt-4 rounded-[var(--v2-radius-card)] border border-[color-mix(in_srgb,var(--v2-warning-text)_30%,var(--v2-panel-border))] bg-[var(--v2-warning-soft)] px-4 py-3"
          >
            <div className="text-sm font-medium text-[var(--v2-text-strong)]">
              ${t('chat.briefNeedsSetupTitle')}
            </div>
            <div className="mt-1 text-sm leading-5 text-[var(--v2-text-muted)]">
              ${context?.sendBlockReason || t('chat.briefNeedsSetupDesc')}
            </div>
            <${Link}
              to="/settings/inference"
              className="mt-3 inline-flex min-h-[40px] items-center rounded-[var(--v2-radius-control)] bg-[var(--v2-accent-btn)] px-4 text-sm font-medium text-white v2-force-white"
            >
              Open setup
            <//>
          </div>
        `}
      </div>
    </div>
  `;
}
