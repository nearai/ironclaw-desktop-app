import { Link } from 'react-router';
import { Button } from '../../../design-system/button.js';
import { Icon } from '../../../design-system/icons.js';
import { Panel } from '../../../design-system/primitives.js';
import { React, html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';
import { cn } from '../../../utils/cn.js';

const EXAMPLE_PROMPT_KEYS = [
  'automations.empty.example1',
  'automations.empty.example2',
  'automations.empty.example3'
];

function ExamplePrompt({ promptKey }) {
  const t = useT();
  const text = t(promptKey);
  const [copied, setCopied] = React.useState(false);
  const timerRef = React.useRef(null);

  React.useEffect(() => () => clearTimeout(timerRef.current), []);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch (_) {
      // Clipboard can be blocked; keep the prompt visible for manual copy.
    }
  };

  return html`
    <li
      className="flex items-center gap-3 rounded-[var(--v2-radius-control)] border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] px-4 py-3"
    >
      <span className="min-w-0 flex-1 v2-text-body text-[var(--v2-text-strong)]">${text}</span>
      <button
        type="button"
        onClick=${onCopy}
        aria-label=${copied ? t('automations.empty.copied') : t('automations.empty.copyPrompt')}
        title=${copied ? t('automations.empty.copied') : t('automations.empty.copyPrompt')}
        className=${cn(
          'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--v2-radius-control)] border border-[var(--v2-panel-border)] text-[var(--v2-text-muted)] hover:border-[color-mix(in_srgb,var(--v2-accent)_30%,var(--v2-panel-border))] hover:text-[var(--v2-text-strong)]',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--v2-accent)]',
          copied && 'text-[var(--v2-positive-text)]'
        )}
      >
        <${Icon} name=${copied ? 'check' : 'copy'} className="h-4 w-4" />
      </button>
    </li>
  `;
}

export function AutomationsEmptyState() {
  const t = useT();

  return html`
    <${Panel} className="p-6 sm:p-8">
      <div className="max-w-2xl">
        <h2 className="v2-text-title">${t('automations.empty.noneTitle')}</h2>
        <p className="mt-3 v2-text-body text-[var(--v2-text-muted)]">
          ${t('automations.empty.onboardingDescription')}
        </p>

        <div className="mt-6">
          <div className="v2-text-label">${t('automations.empty.examplesTitle')}</div>
          <ul className="mt-3 space-y-2">
            ${EXAMPLE_PROMPT_KEYS.map(
              (key) => html`<${ExamplePrompt} key=${key} promptKey=${key} />`
            )}
          </ul>
        </div>

        <div className="mt-6">
          <${Button} as=${Link} to="/chat" variant="primary" size="md">
            <${Icon} name="chat" className="mr-1.5 h-4 w-4" />
            ${t('automations.empty.startInChat')}
          <//>
        </div>
      </div>
    <//>
  `;
}
