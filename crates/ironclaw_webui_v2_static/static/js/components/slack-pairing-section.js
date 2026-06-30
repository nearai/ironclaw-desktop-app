import { React, html } from '../lib/html.js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../design-system/button.js';
import { useT } from '../lib/i18n.js';
import { redeemSlackPairingCode } from '../lib/slack-pairing-api.js';

export function SlackPairingSection({ action }) {
  const t = useT();
  const queryClient = useQueryClient();
  const redeemMutation = useMutation({
    mutationFn: ({ code }) => redeemSlackPairingCode(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extensions'] });
      queryClient.invalidateQueries({ queryKey: ['connectable-channels'] });
      queryClient.invalidateQueries({ queryKey: ['pairing', 'slack'] });
    }
  });
  const [manualCode, setManualCode] = React.useState('');
  const copy = slackPairingCopy(action, t);

  const submit = () => {
    const code = manualCode.trim();
    if (!code) return;
    redeemMutation.mutate({ code });
    setManualCode('');
  };

  return html`
    <div
      className="mt-4 rounded-[12px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] p-4"
    >
      <h4 className="mb-2 text-[13px] font-medium text-[var(--v2-text-muted)]">${copy.title}</h4>
      <p className="mb-4 text-xs leading-5 text-[var(--v2-text-muted)]">${copy.instructions}</p>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value=${manualCode}
          onChange=${(event) => setManualCode(event.target.value)}
          onKeyDown=${(event) => event.key === 'Enter' && submit()}
          placeholder=${copy.codePlaceholder}
          className="h-11 min-w-0 flex-1 rounded-[8px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface)] px-3 font-mono text-sm text-[var(--v2-text-strong)] outline-none placeholder:text-[var(--v2-text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--v2-accent)]/40"
        />
        <${Button}
          variant="primary"
          size="md"
          className="shrink-0"
          onClick=${submit}
          disabled=${redeemMutation.isPending || !manualCode.trim()}
        >
          ${copy.submitLabel}
        <//>
      </div>

      ${redeemMutation.isSuccess &&
      redeemMutation.data?.success !== false &&
      html`<p className="text-xs text-[var(--v2-positive-text)]">
        ${redeemMutation.data?.message || copy.successMessage}
      </p>`}
      ${redeemMutation.isSuccess &&
      redeemMutation.data?.success === false &&
      html`<p className="text-xs text-[var(--v2-danger-text)]">
        ${redeemMutation.data?.message || copy.errorMessage}
      </p>`}
      ${redeemMutation.isError &&
      html`<p className="text-xs text-[var(--v2-danger-text)]">
        ${slackPairingError(redeemMutation.error, copy.errorMessage)}
      </p>`}
    </div>
  `;
}

function slackPairingCopy(action, t) {
  return {
    title: action?.title || t('pairing.slackTitle'),
    instructions: action?.instructions || t('pairing.slackInstructions'),
    codePlaceholder: action?.code_placeholder || t('pairing.slackPlaceholder'),
    submitLabel: action?.submit_label || t('pairing.connect'),
    successMessage: action?.success_message || t('pairing.slackSuccess'),
    errorMessage: action?.error_message || t('pairing.slackError')
  };
}

function slackPairingError(error, fallback) {
  return error?.payload?.error || error?.payload?.message || error?.message || fallback;
}
