import { NavLink, useLocation } from 'react-router';
import { React, html } from '../lib/html.js';
import { primaryRoutes, EXPANDABLE_SUB_ROUTES } from '../app/routes.js';
import { Icon } from '../design-system/icons.js';
import { useT } from '../lib/i18n.js';
import { cn } from '../utils/cn.js';
import { TeeShield } from './tee-shield.js';

const DOCS_URL = 'https://docs.ironclaw.com';

// The ⌘K palette is owned by GatewayLayout's global keydown handler. Re-dispatch
// the same shortcut so the header trigger and the keyboard both toggle one source
// of truth, with no extra prop threading or duplicate palette state.
function openCommandPalette() {
  window.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true, cancelable: true })
  );
}

function ChromeControls({ chrome, onSetChromePosition, onSetChromeDensity }) {
  if (!chrome || !onSetChromePosition || !onSetChromeDensity) return null;
  return html`
    <div className="hidden items-center gap-1 md:flex">
      <select
        aria-label="Sidebar position"
        value=${chrome.position}
        onChange=${(event) => onSetChromePosition(event.currentTarget.value)}
        className="h-8 rounded-[7px] border border-[var(--v2-panel-border)] bg-[var(--v2-input-bg)] px-2 text-[11px] font-semibold text-[var(--v2-text-muted)] outline-none hover:bg-[var(--v2-surface-muted)] focus:border-[var(--v2-accent)]"
      >
        <option value="left">Left</option>
        <option value="right">Right</option>
        <option value="bottom">Bottom</option>
      </select>
      <select
        aria-label="Sidebar density"
        value=${chrome.density}
        onChange=${(event) => onSetChromeDensity(event.currentTarget.value)}
        className="h-8 rounded-[7px] border border-[var(--v2-panel-border)] bg-[var(--v2-input-bg)] px-2 text-[11px] font-semibold text-[var(--v2-text-muted)] outline-none hover:bg-[var(--v2-surface-muted)] focus:border-[var(--v2-accent)]"
      >
        <option value="expanded">Expanded</option>
        <option value="compact">Compact</option>
      </select>
    </div>
  `;
}

export function PageHeader({
  threadsState,
  onToggleSidebar,
  chrome,
  onSetChromePosition,
  onSetChromeDensity
}) {
  const t = useT();
  const location = useLocation();

  const breadcrumb = React.useMemo(() => {
    for (const route of primaryRoutes) {
      const subRoutes = EXPANDABLE_SUB_ROUTES[route.id];
      if (!subRoutes) continue;
      const prefix = route.path + '/';
      if (location.pathname.startsWith(prefix)) {
        const subId = location.pathname.slice(prefix.length).split('/')[0];
        const sub = subRoutes.find((s) => s.id === subId);
        if (sub) {
          return {
            parent: t(route.labelKey),
            current: t(sub.labelKey)
          };
        }
      }
    }
    return null;
  }, [location.pathname, t]);

  const title = React.useMemo(() => {
    if (breadcrumb) return null;
    if (location.pathname.startsWith('/chat')) {
      if (threadsState.activeThreadId) {
        const thread = threadsState.threads.find((th) => th.id === threadsState.activeThreadId);
        return thread?.title || t('nav.chat');
      }
      return t('nav.chat');
    }
    const route = primaryRoutes.find((r) => location.pathname.startsWith(r.path));
    return route ? t(route.labelKey) : '';
  }, [location.pathname, threadsState.activeThreadId, threadsState.threads, t, breadcrumb]);

  return html`
    <header
      className=${cn(
        'flex min-h-12 shrink-0 items-center gap-3 px-4',
        'border-b border-[var(--v2-panel-border)]',
        'bg-[color-mix(in_srgb,var(--v2-canvas-strong)_92%,transparent)] backdrop-blur-xl'
      )}
    >
      <button
        onClick=${onToggleSidebar}
        className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-[7px] text-[var(--v2-text-muted)] hover:bg-[var(--v2-surface-muted)] md:hidden"
        aria-label="Toggle sidebar"
      >
        <${Icon} name="list" className="h-4 w-4" />
      </button>

      ${breadcrumb
        ? html`
            <div className="flex min-w-0 items-center gap-2 text-[13px] font-semibold">
              <span className="shrink-0 text-[var(--v2-text-muted)]"> ${breadcrumb.parent} </span>
              <${Icon}
                name="chevron"
                className="h-3.5 w-3.5 shrink-0 -rotate-90 text-[var(--v2-text-muted)]"
              />
              <span className="truncate text-[var(--v2-text-strong)]"> ${breadcrumb.current} </span>
            </div>
          `
        : html`
            <span className="truncate text-[13px] font-semibold text-[var(--v2-text-strong)]">
              ${title}
            </span>
          `}

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <${ChromeControls}
          chrome=${chrome}
          onSetChromePosition=${onSetChromePosition}
          onSetChromeDensity=${onSetChromeDensity}
        />
        <${TeeShield} />
        <button
          type="button"
          onClick=${openCommandPalette}
          className="hidden h-11 items-center gap-1.5 rounded-[8px] px-2.5 text-[var(--v2-text-muted)] hover:bg-[var(--v2-surface-muted)] hover:text-[var(--v2-text-strong)] sm:inline-flex"
          title=${t('nav.commandPalette')}
          aria-label=${t('nav.commandPalette')}
        >
          <${Icon} name="search" className="h-4 w-4" />
          <kbd
            className="rounded-[4px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[var(--v2-text-faint)]"
            >⌘K</kbd
          >
        </button>
        <${NavLink}
          to="/logs"
          className=${({ isActive }) =>
            cn(
              'inline-flex min-h-[44px] items-center rounded-[7px] px-3 text-xs font-semibold text-[var(--v2-text-muted)] hover:bg-[var(--v2-surface-muted)] hover:text-[var(--v2-text-strong)]',
              isActive &&
                'border border-[color-mix(in_srgb,var(--v2-accent)_32%,var(--v2-panel-border))] bg-[var(--v2-accent-soft)] text-[var(--v2-accent-text)]'
            )}
          title=${t('nav.logs')}
        >
          ${t('nav.logs')}
        <//>
        <a
          href=${DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="-mr-2 inline-flex min-h-[44px] items-center rounded-[7px] px-3 text-xs font-semibold text-[var(--v2-text-muted)] hover:bg-[var(--v2-surface-muted)] hover:text-[var(--v2-text-strong)]"
          title=${t('nav.docs')}
        >
          ${t('nav.docs')}
        </a>
      </div>
    </header>
  `;
}
