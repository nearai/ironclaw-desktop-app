/**
 * AuthGateShell — shared chrome for auth gates (Status Pill + Drawer pattern).
 *
 * Presentation only: renders a collapsible pill header and an expandable
 * drawer. It owns NO security logic and handles NO credentials — the action
 * area (CTA / token input / cancel) is supplied by the calling card via
 * `children`, so each card keeps its own form semantics and security guards.
 *
 * Props
 *   icon          design-system icon name for the header chip (default "lock")
 *   headline      bold pill title
 *   provider      optional provider name (subtitle)
 *   accountLabel  optional account label (subtitle; takes precedence)
 *   body          optional descriptive text shown at the top of the drawer
 *   expiresAt     optional ISO timestamp rendered as an expiry hint
 *   expired       when true, the expiry line reads as a lapsed-authorization notice
 *   pillHint      short call-to-action text on the right of the pill
 *   defaultExpanded boolean (default true — active gates block the run)
 *   controlsId    id used for aria-controls / drawer id
 *   children      drawer action area (CTA, input, cancel)
 */
import { React, html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';
import { Icon } from '../../../design-system/icons.js';

export function AuthGateShell({
  icon = 'lock',
  headline,
  provider,
  accountLabel,
  body,
  expiresAt,
  expired = false,
  pillHint,
  defaultExpanded = true,
  children
}) {
  const t = useT();
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const controlsId = React.useId();
  const subtitle = accountLabel || provider || '';

  return html`
    <div
      className="mx-auto w-full max-w-xl rounded-[16px] border border-[color-mix(in_srgb,var(--v2-gold)_30%,var(--v2-panel-border))] bg-[var(--v2-surface-soft)]"
    >
      <button
        type="button"
        onClick=${() => setExpanded((v) => !v)}
        aria-expanded=${expanded ? 'true' : 'false'}
        aria-controls=${controlsId}
        className="flex w-full items-center gap-3 rounded-[10px] border-0 bg-transparent px-4 py-3 text-left"
      >
        <span
          className="grid h-9 w-9 shrink-0 place-items-center text-[var(--v2-gold-text)]"
          aria-hidden="true"
        >
          <${Icon} name=${icon} className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--v2-gold)]"
            />
            <span className="block truncate text-sm font-semibold text-[var(--v2-text-strong)]">
              ${headline || t('authGate.title')}
            </span>
          </span>
          ${subtitle &&
          html`<span className="mt-0.5 block truncate text-xs text-[var(--v2-text-muted)]"
            >${subtitle}</span
          >`}
        </span>
        <span
          className="ml-auto flex shrink-0 items-center gap-1.5 text-xs font-medium text-[var(--v2-gold-text)]"
        >
          ${pillHint && html`<span className="hidden sm:inline">${pillHint}</span>`}
          <${Icon}
            name="chevron"
            className=${['h-4 w-4', expanded ? 'rotate-180' : ''].join(' ')}
          />
        </span>
      </button>

      ${expanded &&
      html`
        <div id=${controlsId} className="border-t border-[var(--v2-panel-border)] px-4 pb-4 pt-3">
          ${body &&
          html`<div className="mb-3 text-sm leading-6 text-[var(--v2-text-muted)]">${body}</div>`}
          ${children}
          ${expiresAt &&
          (expired
            ? html`
                <p className="mt-2 text-xs text-[var(--v2-warning-text)]">
                  ${t('authGate.oauthExpired')}
                </p>
              `
            : html`
                <p className="mt-2 text-xs text-[var(--v2-text-faint)]">
                  ${t('authGate.expiresAt')}: ${new Date(expiresAt).toLocaleString()}
                </p>
              `)}
        </div>
      `}
    </div>
  `;
}
