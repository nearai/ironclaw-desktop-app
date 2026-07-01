import { React, html } from '../../../lib/html.js';
import { Button } from '../../../design-system/button.js';
import { Icon } from '../../../design-system/icons.js';
import { KIND_LABELS } from '../lib/extensions-schema.js';
import {
  connectorFamily,
  connectorKey,
  connectorSetupGuidance,
  primaryExtensionAction,
  registryConnectButtonState,
  registryStatusBadge
} from '../lib/extension-actions.js';

/* One depth. A connector is a de-boxed hairline row: no per-row card, no
   shadow, no nested filled panels. Status is a single line of text plus at most
   one breathing dot for genuine in-flight state. When a connector needs the
   user, the whole row carries a danger/amber left-rail and a one-line blocker;
   healthy connectors stay quiet. The per-row primary action is the user's
   action (accent blue); everything else is overflow. Machine strings
   (env vars, transports, normalized names, capability chips) live behind a
   quiet Details disclosure so the resting row reads like a name and a state. */

const ROW = 'flex flex-col py-4';
const ROW_RAIL_DANGER =
  '-mx-3 rounded-[var(--v2-radius-control)] border-l-2 border-[var(--v2-danger-text)] bg-[var(--v2-danger-soft)] px-3';
const ROW_RAIL_WARNING =
  '-mx-3 rounded-[var(--v2-radius-control)] border-l-2 border-[var(--v2-warning-text)] bg-[var(--v2-warning-soft)] px-3';
const META = 'mt-1 flex flex-wrap items-center gap-x-2 v2-text-meta';
const DESC = 'mt-2 line-clamp-2 v2-text-body text-[var(--v2-text-muted)]';
const FOOTER = 'mt-3 flex items-center gap-2';
const DISCLOSURE =
  '-my-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--v2-radius-control)] ' +
  'border-0 bg-transparent py-2 pr-2 v2-text-meta hover:text-[var(--v2-accent-text)]';
const CHIP =
  'rounded-[var(--v2-radius-control)] bg-[var(--v2-surface-soft)] ' +
  'px-1.5 py-0.5 v2-text-meta text-[var(--v2-text-muted)]';
const APP_ICON =
  'grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[var(--v2-radius-control)] ' +
  'border border-[var(--v2-panel-border)] bg-[var(--v2-surface)]';

function packageId(item) {
  return item.package_ref?.id || '';
}

/* ── Readiness model ──────────────────────────────────────────────────
   Every list on this surface groups by readiness: connectors that need the
   user sit in one focal "Needs you" zone at the top; healthy ones sit below.
   `extensionReadiness` maps a live extension onto that model, and
   `groupByReadiness` splits a list into { needsYou, healthy } preserving
   input order within each group. A failed connector never sits at the same
   altitude as a healthy one. */

const NEEDS_YOU_STATES = new Set([
  'failed',
  'auth_required',
  'setup_required',
  'pairing_required',
  'pairing'
]);

export function extensionState(ext) {
  return ext?.onboarding_state || ext?.activation_status || (ext?.active ? 'active' : 'installed');
}

const READINESS_TEXT = {
  failed: { label: 'Failed', tone: 'danger', blocker: 'Setup failed. Reconfigure to recover.' },
  auth_required: {
    label: 'Needs sign-in',
    tone: 'warning',
    blocker: 'Sign-in required before the agent can use it.'
  },
  setup_required: {
    label: 'Needs setup',
    tone: 'warning',
    blocker: 'Add credentials to finish connecting.'
  },
  pairing_required: {
    label: 'Needs pairing',
    tone: 'warning',
    blocker: 'Enter the pairing code to link this app.'
  },
  pairing: {
    label: 'Needs pairing',
    tone: 'warning',
    blocker: 'Enter the pairing code to link this app.'
  },
  active: { label: 'Active', tone: 'success', blocker: '' },
  ready: { label: 'Active', tone: 'success', blocker: '' },
  installed: { label: 'Idle', tone: 'muted', blocker: '' }
};

export function extensionReadiness(ext) {
  const state = extensionState(ext);
  const needsYou = NEEDS_YOU_STATES.has(state);
  const info = READINESS_TEXT[state] || { label: state, tone: 'muted', blocker: '' };
  // A live activation error is the truest blocker line — prefer it.
  const blocker = needsYou ? ext?.activation_error || info.blocker : '';
  return { state, needsYou, statusLabel: info.label, tone: info.tone, blocker };
}

export function groupByReadiness(list = []) {
  const needsYou = [];
  const healthy = [];
  for (const ext of list) {
    (extensionReadiness(ext).needsYou ? needsYou : healthy).push(ext);
  }
  return { needsYou, healthy };
}

/* ── Status line ──────────────────────────────────────────────────────
   Collapses the old parallel status-pill systems to ONE disciplined
   status-text + single-dot treatment. The breathing dot appears only for a
   genuine live state (active/ready). Uses semantic v2 tone tokens — never raw
   Tailwind colour classes. */

function statusToneClass(tone) {
  if (tone === 'success') return 'text-[var(--v2-positive-text)]';
  if (tone === 'danger') return 'text-[var(--v2-danger-text)]';
  if (tone === 'warning') return 'text-[var(--v2-warning-text)]';
  if (tone === 'info') return 'text-[var(--v2-info-text)]';
  if (tone === 'accent') return 'text-[var(--v2-accent-text)]';
  return 'text-[var(--v2-text-faint)]';
}

export function StatusText({ label, tone = 'muted', live = false }) {
  return html`
    <span
      className=${['inline-flex items-center gap-1.5 v2-text-label', statusToneClass(tone)].join(
        ' '
      )}
    >
      ${live &&
      html`<span
        aria-hidden="true"
        className="v2-breathing-dot h-1.5 w-1.5 shrink-0 rounded-full bg-current"
      />`}
      ${label}
    </span>
  `;
}

export function connectorIconKind(source) {
  const key = connectorKey(source);
  const family = connectorFamily(source);

  if (key === 'gmail') return 'gmail';
  if (key === 'google-calendar' || key === 'google_calendar') return 'google-calendar';
  if (key === 'google-drive' || key === 'gdrive' || key === 'drive') return 'google-drive';
  if (key === 'google-sheets' || key === 'gsheets' || key === 'sheets') return 'google-sheets';
  if (key.includes('github')) return 'github';
  if (key.includes('telegram')) return 'telegram';
  if (key === 'web' || key === 'web-http' || key.startsWith('http') || key === 'hacker-news') {
    return 'web';
  }
  if (key.includes('routine') || key.includes('trigger')) return 'routine';
  if (family === 'notion') return 'notion';
  if (family === 'slack') return 'slack';
  if (family === 'workspace') return 'workspace';
  if (family === 'google') return 'google';
  if (source?.kind === 'wasm_channel') return 'channel';
  if (source?.kind === 'mcp_server') return 'knowledge';
  return 'tool';
}

function GoogleBarsIcon({ letter }) {
  return html`
    <svg viewBox="0 0 36 36" className="h-full w-full" aria-hidden="true">
      <rect width="36" height="36" rx="9" fill="#fff" />
      <path d="M6 9h24v5H6z" fill="#4285f4" />
      <path d="M6 14h24v5H6z" fill="#34a853" />
      <path d="M6 19h24v5H6z" fill="#fbbc04" />
      <path d="M6 24h24v3H6z" fill="#ea4335" />
      <text
        x="18"
        y="22"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fontFamily="Inter, ui-sans-serif, system-ui"
        fill="#1f2937"
      >
        ${letter}
      </text>
    </svg>
  `;
}

function connectorGlyph(kind) {
  switch (kind) {
    case 'gmail':
      return html`
        <svg viewBox="0 0 36 36" className="h-full w-full" aria-hidden="true">
          <rect width="36" height="36" rx="9" fill="#fff" />
          <path
            d="M7 11.5v14h5.2V16.2L18 20.8l5.8-4.6v9.3H29v-14h-5.2L18 16.1l-5.8-4.6H7Z"
            fill="#ea4335"
          />
          <path d="M7 11.5 18 20.8l11-9.3v3.8L18 24.6 7 15.3v-3.8Z" fill="#fbbc04" />
          <path d="M7 15.3v10.2h5.2v-5.8L7 15.3Z" fill="#4285f4" />
          <path d="M29 15.3v10.2h-5.2v-5.8L29 15.3Z" fill="#34a853" />
        </svg>
      `;
    case 'google-calendar':
      return html`
        <svg viewBox="0 0 36 36" className="h-full w-full" aria-hidden="true">
          <rect width="36" height="36" rx="9" fill="#fff" />
          <path d="M9 8h18a2 2 0 0 1 2 2v4H7v-4a2 2 0 0 1 2-2Z" fill="#4285f4" />
          <path d="M7 14h22v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V14Z" fill="#fff" />
          <path
            d="M9 8h18a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Z"
            fill="none"
            stroke="#dadce0"
          />
          <text
            x="18"
            y="24"
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fontFamily="Inter, ui-sans-serif, system-ui"
            fill="#1a73e8"
          >
            31
          </text>
        </svg>
      `;
    case 'notion':
      return html`
        <svg viewBox="0 0 36 36" className="h-full w-full" aria-hidden="true">
          <rect
            x="5"
            y="5"
            width="26"
            height="26"
            rx="5"
            fill="#fff"
            stroke="#111827"
            strokeWidth="1.5"
          />
          <text
            x="18"
            y="23.5"
            textAnchor="middle"
            fontSize="17"
            fontWeight="800"
            fontFamily="Georgia, serif"
            fill="#111827"
          >
            N
          </text>
        </svg>
      `;
    case 'slack':
      return html`
        <svg viewBox="0 0 36 36" className="h-full w-full" aria-hidden="true">
          <rect width="36" height="36" rx="9" fill="#fff" />
          <rect x="10" y="15" width="6" height="16" rx="3" fill="#36c5f0" />
          <rect x="5" y="20" width="16" height="6" rx="3" fill="#36c5f0" />
          <rect x="20" y="5" width="6" height="16" rx="3" fill="#2eb67d" />
          <rect x="15" y="10" width="16" height="6" rx="3" fill="#2eb67d" />
          <rect x="20" y="15" width="6" height="16" rx="3" fill="#ecb22e" />
          <rect x="15" y="20" width="16" height="6" rx="3" fill="#ecb22e" />
          <rect x="10" y="5" width="6" height="16" rx="3" fill="#e01e5a" />
          <rect x="5" y="10" width="16" height="6" rx="3" fill="#e01e5a" />
        </svg>
      `;
    case 'google-drive':
      return html`
        <svg viewBox="0 0 36 36" className="h-full w-full" aria-hidden="true">
          <rect width="36" height="36" rx="9" fill="#fff" />
          <path d="M14.5 7h7l8.5 14.7h-7L14.5 7Z" fill="#0f9d58" />
          <path d="M6 21.7 14.5 7l3.5 6.1-5 8.6H6Z" fill="#f4b400" />
          <path d="M13 21.7h17L26.5 28h-17L13 21.7Z" fill="#4285f4" />
        </svg>
      `;
    case 'google-sheets':
      return html`<${GoogleBarsIcon} letter="S" />`;
    case 'github':
      return html`
        <svg viewBox="0 0 36 36" className="h-full w-full" aria-hidden="true">
          <rect width="36" height="36" rx="9" fill="#111827" />
          <circle cx="18" cy="18" r="9" fill="#fff" />
          <path
            d="M14.2 26.5c.6-1.4.4-2.4 0-3.1-2.9.2-4.1-1.2-4.6-2.4-.3-.7-.7-1.1-1.3-1.6-.4-.3-.1-.6.5-.5 1.1.2 1.8 1.2 2.2 1.8.9 1.5 2.5 1.3 3.3 1 .1-.7.5-1.3 1-1.6-2.6-.3-5.2-1.3-5.2-5.4 0-1.2.4-2.2 1.1-3-.1-.3-.5-1.5.1-3 0 0 .9-.3 3 1.1.9-.2 1.8-.4 2.7-.4s1.9.1 2.7.4c2.1-1.4 3-1.1 3-1.1.6 1.5.2 2.7.1 3 .7.8 1.1 1.8 1.1 3 0 4.1-2.6 5.1-5.2 5.4.7.6 1.2 1.6 1.2 3.2v3.1"
            fill="#111827"
          />
        </svg>
      `;
    case 'telegram':
      return html`
        <svg viewBox="0 0 36 36" className="h-full w-full" aria-hidden="true">
          <rect width="36" height="36" rx="9" fill="#27a7e7" />
          <path
            d="M27.8 9.4 23 27.1c-.3 1.2-1.2 1.5-2.3.9l-6.4-4.7-3.1 3c-.3.3-.6.6-1.2.6l.4-6.6L22.5 11c.5-.5-.1-.7-.8-.3L7.1 19.9c-1.1.3-1.9-.1-2.1-.8-.2-.6.5-1.1 1.4-1.4l19.5-7.5c.9-.3 1.7.2 1.9 1.2Z"
            fill="#fff"
          />
        </svg>
      `;
    case 'workspace':
      return html`<${Icon} name="folder" className="h-5 w-5 text-[var(--v2-text-muted)]" />`;
    case 'web':
      return html`<${Icon} name="search" className="h-5 w-5 text-[var(--v2-info-text)]" />`;
    case 'routine':
      return html`<${Icon} name="clock" className="h-5 w-5 text-[var(--v2-warning-text)]" />`;
    case 'channel':
      return html`<${Icon} name="send" className="h-5 w-5 text-[var(--v2-text-muted)]" />`;
    case 'knowledge':
      return html`<${Icon} name="layers" className="h-5 w-5 text-[var(--v2-text-muted)]" />`;
    default:
      return html`<${Icon} name="plug" className="h-5 w-5 text-[var(--v2-text-muted)]" />`;
  }
}

export function ConnectorAppIcon({ source, className = '' }) {
  const kind = connectorIconKind(source);
  return html`
    <span
      aria-hidden="true"
      data-testid="connector-app-icon"
      data-connector-icon=${kind}
      className=${[APP_ICON, className].filter(Boolean).join(' ')}
    >
      ${connectorGlyph(kind)}
    </span>
  `;
}

/* Lightweight overflow menu. Real <button>s; closes on outside click. Keyboard:
   Escape closes and restores trigger focus, ArrowUp/Down move between menuitems,
   and the first item is focused on open (mirrors the ModalShell/ConfigureModal
   focus pattern). */
function OverflowMenu({ actions, isBusy }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const triggerRef = React.useRef(null);
  const menuRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Focus the first menuitem when the menu opens.
  React.useEffect(() => {
    if (!open) return undefined;
    const id = window.requestAnimationFrame(() => {
      const first = menuRef.current?.querySelector('[role="menuitem"]:not([disabled])');
      if (first instanceof HTMLElement) first.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  const closeAndRestore = () => {
    setOpen(false);
    triggerRef.current?.focus?.();
  };

  const onMenuKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAndRestore();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const menu = menuRef.current;
    if (!menu) return;
    const items = Array.from(menu.querySelectorAll('[role="menuitem"]:not([disabled])'));
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement);
    const delta = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (currentIndex + delta + items.length) % items.length;
    const next = items[nextIndex];
    if (next instanceof HTMLElement) next.focus();
  };

  return html`
    <div ref=${ref} className="relative shrink-0">
      <button
        ref=${triggerRef}
        type="button"
        aria-label="More actions"
        aria-haspopup="true"
        aria-expanded=${open ? 'true' : 'false'}
        disabled=${isBusy}
        onClick=${() => setOpen((v) => !v)}
        className="grid h-11 w-11 -mr-1.5 -mt-1.5 place-items-center rounded-[var(--v2-radius-control)] border border-transparent text-[var(--v2-text-faint)] hover:bg-[var(--v2-surface-muted)] hover:text-[var(--v2-text-strong)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <${Icon} name="more" className="h-4 w-4" strokeWidth=${2.4} />
      </button>
      ${open &&
      html`
        <div
          ref=${menuRef}
          role="menu"
          onKeyDown=${onMenuKeyDown}
          className="absolute right-0 top-8 z-10 min-w-[156px] rounded-[var(--v2-radius-card)] border border-[var(--v2-panel-border)] bg-[var(--v2-surface)] p-1"
        >
          ${actions.map(
            (action) => html`
              <button
                key=${action.id}
                type="button"
                role="menuitem"
                disabled=${isBusy}
                onClick=${() => {
                  setOpen(false);
                  action.run();
                }}
                className=${[
                  'flex min-h-[44px] w-full items-center gap-2.5 rounded-[var(--v2-radius-control)] px-2.5 py-1.5 text-left v2-text-body disabled:cursor-not-allowed disabled:opacity-50',
                  action.danger
                    ? 'text-[var(--v2-danger-text)] hover:bg-[var(--v2-danger-soft)]'
                    : 'text-[var(--v2-text)] hover:bg-[var(--v2-surface-soft)]'
                ].join(' ')}
              >
                <${Icon} name=${action.icon || 'settings'} className="h-3.5 w-3.5" />
                ${action.label}
              </button>
            `
          )}
        </div>
      `}
    </div>
  `;
}

function ChipGrid({ items }) {
  if (!items || items.length === 0) return null;
  return html`
    <div className="mt-1.5 flex flex-wrap gap-1">
      ${items.map((item) => html`<span key=${item} className=${CHIP}>${item}</span>`)}
    </div>
  `;
}

/* Setup guidance is a quiet inline note — one depth, no nested filled card.
   The blocker sentence reads as body text under the row; any setup link is an
   inline accent link (the user's next physical action). */
function ConnectorGuidance({ guidance, fallback }) {
  const body = fallback || guidance?.body;
  if (!body && !guidance?.title) return null;

  return html`
    <div className="mt-2 v2-text-body text-[var(--v2-text-muted)]">
      ${guidance?.title &&
      html`<span className="text-[var(--v2-text-strong)]">${guidance.title} </span>`}
      ${body}
      ${guidance?.href &&
      html`
        <${Button}
          as="a"
          href=${guidance.href}
          variant="secondary"
          size="sm"
          className="mt-2 min-h-[44px] px-2.5"
        >
          ${guidance.actionLabel || 'Open setup'}
        <//>
      `}
    </div>
  `;
}

export function ExtensionCard({ ext, onActivate, onConfigure, onRemove, isBusy }) {
  const readiness = extensionReadiness(ext);
  const state = readiness.state;
  const kindLabel = KIND_LABELS[ext.kind] || ext.kind;
  const displayName = ext.display_name || packageId(ext);
  const canManage = Boolean(ext.package_ref);
  const tools = ext.tools || [];
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  const setupState = state === 'setup_required' || state === 'auth_required';
  const onboardingHint =
    (setupState
      ? ext.onboarding?.credential_instructions || ext.onboarding?.credential_next_step
      : ext.onboarding?.credential_next_step || ext.onboarding?.credential_instructions) || null;
  const guidance = connectorSetupGuidance(ext, { state });

  const configurePayload = { packageRef: ext.package_ref, displayName };

  const primaryActions = [];
  const overflowActions = [];
  const primaryAction = primaryExtensionAction(ext);

  if (primaryAction === 'configure') {
    primaryActions.push({
      id: 'configure',
      label: ext.authenticated ? 'Reconfigure' : 'Configure',
      run: () => onConfigure(configurePayload)
    });
  } else if (primaryAction === 'activate') {
    primaryActions.push({
      id: 'activate',
      label: 'Activate',
      run: () => onActivate(configurePayload)
    });
  }
  if (canManage && (ext.needs_setup || ext.has_auth) && primaryAction !== 'configure') {
    overflowActions.push({
      id: 'configure',
      label: ext.authenticated ? 'Reconfigure' : 'Configure',
      icon: 'settings',
      run: () => onConfigure(configurePayload)
    });
  }
  if (
    canManage &&
    ext.kind === 'wasm_channel' &&
    (state === 'setup_required' || state === 'failed')
  ) {
    overflowActions.push({
      id: 'setup',
      label: 'Setup',
      icon: 'settings',
      run: () => onConfigure(configurePayload)
    });
  }
  if (
    canManage &&
    ext.kind === 'wasm_channel' &&
    (state === 'active' || state === 'ready' || state === 'pairing_required' || state === 'pairing')
  ) {
    overflowActions.push({
      id: 'reconfigure',
      label: 'Reconfigure',
      icon: 'settings',
      run: () => onConfigure(configurePayload)
    });
  }
  if (canManage) {
    overflowActions.push({
      id: 'remove',
      label: 'Remove',
      icon: 'trash',
      danger: true,
      run: () => onRemove(configurePayload)
    });
  }

  const primary = primaryActions[0];
  const hasDetails = tools.length > 0 || Boolean(kindLabel) || Boolean(ext.version);
  const showFooter = hasDetails || Boolean(primary);

  // One focal zone: a connector that needs the user carries a tone left-rail so
  // it never sits at the same altitude as a healthy row.
  const railClass =
    readiness.tone === 'danger'
      ? ROW_RAIL_DANGER
      : readiness.needsYou
        ? ROW_RAIL_WARNING
        : 'border-t border-[var(--v2-panel-border)] first:border-t-0';

  return html`
    <div
      className=${[ROW, railClass].join(' ')}
      data-readiness=${readiness.needsYou ? 'needs-you' : 'healthy'}
    >
      <div className="flex items-start gap-3">
        <${ConnectorAppIcon} source=${ext} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate v2-text-section text-[var(--v2-text-strong)]">
              ${displayName}
            </span>
          </div>
          <div className="mt-1">
            <${StatusText}
              label=${readiness.statusLabel}
              tone=${readiness.tone}
              live=${state === 'active' || state === 'ready'}
            />
          </div>
        </div>
        ${overflowActions.length > 0 &&
        html`<${OverflowMenu} actions=${overflowActions} isBusy=${isBusy} />`}
      </div>

      ${ext.description && html`<p className=${DESC}>${ext.description}</p>`}
      ${readiness.blocker &&
      html`<p className="mt-2 v2-text-body text-[var(--v2-text-strong)]">${readiness.blocker}</p>`}
      <${ConnectorGuidance} guidance=${guidance} fallback=${onboardingHint} />

      ${showFooter &&
      html`
        <div className=${FOOTER}>
          ${hasDetails &&
          html`
            <button
              type="button"
              aria-expanded=${detailsOpen ? 'true' : 'false'}
              onClick=${() => setDetailsOpen((v) => !v)}
              className=${DISCLOSURE}
            >
              <${Icon} name="layers" className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Details</span>
              <${Icon}
                name="chevron"
                aria-hidden="true"
                className=${['h-3 w-3', detailsOpen ? 'rotate-180' : ''].join(' ')}
              />
            </button>
          `}
          <span className="flex-1"></span>
          ${primary &&
          html`
            <${Button}
              variant="primary"
              size="sm"
              className="min-h-[44px] px-3.5"
              onClick=${primary.run}
              disabled=${isBusy}
            >
              ${primary.label}
            <//>
          `}
        </div>
      `}
      ${detailsOpen &&
      html`
        <div className="mt-2 flex flex-col gap-2">
          <div className=${META}>
            <span>${kindLabel}</span>
            ${ext.version && html`<span>· v${ext.version}</span>`}
          </div>
          ${tools.length > 0 &&
          html`
            <div>
              <div className="v2-text-label">
                ${tools.length} ${tools.length === 1 ? 'capability' : 'capabilities'}
              </div>
              <${ChipGrid} items=${tools} />
            </div>
          `}
        </div>
      `}
    </div>
  `;
}

/* Registry readiness mirrors the installed-row model: a blocked/needs-setup
   entry is a "needs you" row (danger/amber left-rail + one-line blocker); an
   available entry is a quiet healthy row. Shared with groupByReadiness via the
   registryStatusBadge tone. */
export function registryEntryNeedsYou(entry, connectPhase) {
  const tone = registryStatusBadge(entry, connectPhase).tone;
  return tone === 'danger' || tone === 'warning';
}

export function RegistryCard({ entry, onInstall, isBusy, onConnect, onManualSetup, connectPhase }) {
  const kindLabel = KIND_LABELS[entry.kind] || entry.kind;
  const displayName = entry.display_name || packageId(entry);
  const canInstall = Boolean(entry.package_ref);
  const keywords = entry.keywords || [];
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const connectButton = registryConnectButtonState(connectPhase, entry);
  const guidance = connectorSetupGuidance(entry, { connectPhase });
  const statusBadge = registryStatusBadge(entry, connectPhase);
  const needsYou = statusBadge.tone === 'danger' || statusBadge.tone === 'warning';
  const runConnectAction = () => {
    if (connectButton.action === 'manual_setup' && onManualSetup) {
      onManualSetup(entry);
      return;
    }
    if (onConnect) {
      onConnect(entry);
      return;
    }
    onInstall({ packageRef: entry.package_ref, displayName });
  };
  const hasDetails = keywords.length > 0 || Boolean(kindLabel) || Boolean(entry.version);
  const showFooter = hasDetails || canInstall;
  const blocker =
    connectPhase?.phase === 'error'
      ? connectPhase?.message
      : connectPhase?.phase === 'blocked-google-client-id'
        ? connectPhase?.message
        : '';

  const railClass =
    statusBadge.tone === 'danger'
      ? ROW_RAIL_DANGER
      : needsYou
        ? ROW_RAIL_WARNING
        : 'border-t border-[var(--v2-panel-border)] first:border-t-0';

  // Only surface the guidance note here when it is NOT already shown as the
  // blocker line, so the row never repeats itself.
  const guidanceFallback =
    connectPhase?.phase === 'blocked-google-client-id' && !blocker ? connectPhase?.message : null;

  return html`
    <div
      className=${[ROW, railClass].join(' ')}
      data-testid=${`registry-card-${entry.id || packageId(entry)}`}
      data-package-ref=${entry.package_ref?.id || ''}
      data-readiness=${needsYou ? 'needs-you' : 'healthy'}
    >
      <div className="flex items-start gap-3">
        <${ConnectorAppIcon} source=${entry} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate v2-text-section text-[var(--v2-text-strong)]">
              ${displayName}
            </span>
          </div>
          <div className="mt-1">
            <${StatusText}
              label=${statusBadge.label}
              tone=${needsYou ? statusBadge.tone : 'muted'}
            />
          </div>
        </div>
      </div>

      ${entry.description && html`<p className=${DESC}>${entry.description}</p>`}
      ${blocker &&
      html`<p className="mt-2 v2-text-body text-[var(--v2-text-strong)]">${blocker}</p>`}
      <${ConnectorGuidance} guidance=${guidance} fallback=${guidanceFallback} />

      ${showFooter &&
      html`
        <div className=${FOOTER}>
          ${hasDetails &&
          html`
            <button
              type="button"
              aria-expanded=${detailsOpen ? 'true' : 'false'}
              onClick=${() => setDetailsOpen((v) => !v)}
              className=${DISCLOSURE}
            >
              <${Icon} name="list" className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Details</span>
              <${Icon}
                name="chevron"
                aria-hidden="true"
                className=${['h-3 w-3', detailsOpen ? 'rotate-180' : ''].join(' ')}
              />
            </button>
          `}
          <span className="flex-1"></span>
          ${canInstall &&
          connectButton.href &&
          html`
            <${Button}
              as="a"
              href=${connectButton.href}
              variant=${connectButton.variant}
              size="sm"
              className="min-h-[44px] px-3.5"
              aria-disabled=${isBusy || connectButton.disabled ? 'true' : 'false'}
            >
              ${connectButton.label}
            <//>
          `}
          ${canInstall &&
          !connectButton.href &&
          html`
            <${Button}
              variant=${connectButton.variant}
              size="sm"
              className="min-h-[44px] px-3.5"
              onClick=${runConnectAction}
              disabled=${isBusy || connectButton.disabled}
            >
              ${connectButton.action === 'connect' &&
              html`<${Icon} name="plus" className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />`}
              ${connectButton.label}
            <//>
          `}
        </div>
      `}
      ${detailsOpen &&
      html`
        <div className="mt-2 flex flex-col gap-2">
          <div className=${META}>
            <span>${kindLabel}</span>
            ${entry.version && html`<span>· v${entry.version}</span>`}
          </div>
          ${keywords.length > 0 &&
          html`
            <div>
              <div className="v2-text-label">
                ${keywords.length} ${keywords.length === 1 ? 'keyword' : 'keywords'}
              </div>
              <${ChipGrid} items=${keywords} />
            </div>
          `}
        </div>
      `}
    </div>
  `;
}
