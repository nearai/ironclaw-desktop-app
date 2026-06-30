import { NavLink, useLocation } from 'react-router';
import { primaryRoutes, routeSectionDefs, EXPANDABLE_SUB_ROUTES } from '../app/routes.js';
import { Icon } from '../design-system/icons.js';
import { React, html } from '../lib/html.js';
import { useT } from '../lib/i18n.js';
import { cn } from '../utils/cn.js';
import { readSavedWorkItems } from '../pages/chat/lib/work-product-save.js';

const ROUTE_ICONS = {
  chat: 'chat',
  workbench: 'spark',
  you: 'book',
  work: 'file',
  workspace: 'layers',
  projects: 'folder',
  jobs: 'pulse',
  routines: 'clock',
  automations: 'calendar',
  missions: 'flag',
  extensions: 'plug',
  settings: 'settings',
  admin: 'shield'
};

const navRoutes = primaryRoutes.filter((r) => !r.hidden);

// Respect the deliberate hidden-IA: the Work entry only earns a sidebar slot
// once the user has saved at least one work product. First run shows no dead
// link to an empty surface.
export function hasSavedWork() {
  return readSavedWorkItems().length > 0;
}

function NavItem({ route, label, onNavigate, compact = false, horizontal = false }) {
  return html`
    <${NavLink}
      to=${route.path}
      onClick=${onNavigate}
      className=${({ isActive }) =>
        cn(
          'flex min-h-[44px] items-center rounded-[var(--v2-radius-control)] py-2 text-[13px] font-medium',
          compact ? 'justify-center px-2' : 'gap-3 px-3',
          horizontal && !compact && 'min-w-[112px]',
          isActive
            ? 'rounded-l-none border-l-2 border-[var(--v2-accent)] bg-[var(--v2-accent-soft)] text-[var(--v2-text-strong)]'
            : 'border-l-2 border-transparent text-[var(--v2-text-muted)] hover:bg-[var(--v2-surface-soft)] hover:text-[var(--v2-text-strong)]'
        )}
      title=${label}
    >
      <${Icon} name=${ROUTE_ICONS[route.id] || 'bolt'} className="h-4 w-4 shrink-0" />
      <span className=${compact ? 'sr-only' : 'min-w-0 truncate'}>${label}</span>
    <//>
  `;
}

function ExpandableNavItem({
  route,
  label,
  subRoutes,
  onNavigate,
  compact = false,
  horizontal = false
}) {
  const t = useT();
  const location = useLocation();
  const isExpanded =
    location.pathname === route.path || location.pathname.startsWith(route.path + '/');
  const defaultPath = `${route.path}/${subRoutes[0].id}`;

  if (compact || horizontal) {
    return html`
      <${NavLink}
        to=${defaultPath}
        onClick=${onNavigate}
        title=${label}
        className=${() =>
          cn(
            'flex min-h-[44px] items-center rounded-[var(--v2-radius-control)] py-2 text-[13px] font-medium',
            compact ? 'justify-center px-2' : 'min-w-[112px] gap-3 px-3',
            isExpanded
              ? 'rounded-l-none border-l-2 border-[var(--v2-accent)] bg-[var(--v2-accent-soft)] text-[var(--v2-text-strong)]'
              : 'border-l-2 border-transparent text-[var(--v2-text-muted)] hover:bg-[var(--v2-surface-soft)] hover:text-[var(--v2-text-strong)]'
          )}
      >
        <${Icon} name=${ROUTE_ICONS[route.id] || 'bolt'} className="h-4 w-4 shrink-0" />
        <span className=${compact ? 'sr-only' : 'min-w-0 truncate'}>${label}</span>
      <//>
    `;
  }

  return html`
    <div className="flex flex-col">
      <${NavLink}
        to=${defaultPath}
        onClick=${onNavigate}
        className=${() =>
          cn(
            'flex min-h-[44px] items-center gap-3 rounded-[var(--v2-radius-control)] px-3 py-2 text-[13px] font-medium',
            isExpanded
              ? 'rounded-l-none border-l-2 border-[var(--v2-accent)] bg-[var(--v2-accent-soft)] text-[var(--v2-text-strong)]'
              : 'border-l-2 border-transparent text-[var(--v2-text-muted)] hover:bg-[var(--v2-surface-soft)] hover:text-[var(--v2-text-strong)]'
          )}
      >
        <${Icon} name=${ROUTE_ICONS[route.id] || 'bolt'} className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">${label}</span>
        <${Icon}
          name="chevron"
          className=${cn('h-3.5 w-3.5 shrink-0', isExpanded && 'rotate-180')}
        />
      <//>

      ${isExpanded &&
      html`
        <div className="mt-0.5 flex flex-col gap-0.5 pl-3">
          ${subRoutes.map(
            (sub) => html`
              <${NavLink}
                key=${sub.id}
                to=${route.path + '/' + sub.id}
                onClick=${onNavigate}
                className=${({ isActive }) =>
                  cn(
                    'flex min-h-[36px] items-center gap-2.5 rounded-[var(--v2-radius-control)] py-1.5 pl-7 pr-3 text-[12px] font-medium',
                    isActive
                      ? 'bg-[var(--v2-surface-soft)] text-[var(--v2-accent-text)]'
                      : 'text-[var(--v2-text-muted)] hover:bg-[var(--v2-surface-soft)] hover:text-[var(--v2-text-strong)]'
                  )}
              >
                <${Icon} name=${sub.icon} className="h-3 w-3 shrink-0" />
                <span className="min-w-0 truncate">${t(sub.labelKey)}</span>
              <//>
            `
          )}
        </div>
      `}
    </div>
  `;
}

export function SidebarNav({
  onNewChat,
  isCreating,
  isAdmin = true,
  onNavigate,
  orientation = 'vertical',
  density = 'expanded'
}) {
  const t = useT();
  const location = useLocation();
  const compact = density === 'compact';
  const horizontal = orientation === 'horizontal';
  const showWork = React.useMemo(
    () => hasSavedWork(),
    // Re-check saved work on navigation so the entry appears once a work
    // product is saved (e.g. after returning from chat) without a reload.
    [location.pathname]
  );
  const visibleRoutes = React.useMemo(
    () =>
      navRoutes.filter((route) => {
        if (route.id === 'admin' && !isAdmin) return false;
        if (route.id === 'work' && !showWork) return false;
        return true;
      }),
    [isAdmin, showWork]
  );

  const renderRoute = (route) => {
    const subRoutes = (EXPANDABLE_SUB_ROUTES[route.id] || []).filter(
      (subRoute) => isAdmin || !(route.id === 'settings' && subRoute.id === 'users')
    );
    if (subRoutes.length > 0) {
      return html`
        <${ExpandableNavItem}
          key=${route.id}
          route=${route}
          label=${t(route.labelKey)}
          subRoutes=${subRoutes}
          onNavigate=${onNavigate}
          compact=${compact}
          horizontal=${horizontal}
        />
      `;
    }
    return html`
      <${NavItem}
        key=${route.id}
        route=${route}
        label=${t(route.labelKey)}
        onNavigate=${onNavigate}
        compact=${compact}
        horizontal=${horizontal}
      />
    `;
  };

  // Group the visible routes under their section labels (Assistant / Manage),
  // preserving section order; any route not claimed by a section falls into a
  // trailing unlabelled group so nothing is silently dropped.
  const claimed = new Set();
  const sections = routeSectionDefs
    .map((section) => ({
      labelKey: section.labelKey,
      routes: section.ids
        .map((id) => visibleRoutes.find((route) => route.id === id))
        .filter(Boolean)
    }))
    .filter((section) => {
      section.routes.forEach((route) => claimed.add(route.id));
      return section.routes.length > 0;
    });
  const leftover = visibleRoutes.filter((route) => !claimed.has(route.id));
  if (leftover.length > 0) sections.push({ labelKey: '', routes: leftover });

  return html`
    <div
      className=${cn(
        horizontal
          ? 'flex min-w-0 flex-1 items-center gap-2 px-2 py-2'
          : compact
            ? 'flex flex-col px-2 py-3'
            : 'flex flex-col px-3 py-3'
      )}
    >
      <button
        type="button"
        onClick=${onNewChat}
        disabled=${isCreating}
        title=${isCreating ? t('chat.creating') : t('chat.newThread')}
        className=${cn(
          'flex min-h-[44px] items-center rounded-[var(--v2-radius-control)] py-2',
          compact ? 'justify-center px-2' : 'gap-2.5 px-3',
          horizontal && 'shrink-0',
          // The one blue action in otherwise-neutral chrome (the user's hand).
          'border border-transparent bg-[var(--v2-accent-btn)] text-[13px] font-medium text-white v2-force-white',
          'hover:bg-[color-mix(in_srgb,var(--v2-accent-btn)_88%,#000)] disabled:opacity-50'
        )}
      >
        <${Icon} name="plus" className="h-4 w-4 shrink-0" />
        <span className=${compact ? 'sr-only' : ''}>
          ${isCreating ? t('chat.creating') : t('chat.newThread')}
        </span>
        ${!compact &&
        !horizontal &&
        html`<span aria-hidden="true" className="ml-auto v2-text-meta v2-force-white">⌘N</span>`}
      </button>

      <nav
        className=${cn(
          horizontal ? 'flex min-w-0 flex-1 gap-1 overflow-x-auto' : 'mt-3 flex flex-col gap-3'
        )}
      >
        ${horizontal
          ? visibleRoutes.map(renderRoute)
          : sections.map(
              (section) => html`
                <div key=${section.labelKey || 'more'} className="flex flex-col gap-0.5">
                  ${!compact &&
                  section.labelKey &&
                  html`<div className="v2-text-label px-3 pb-1">${t(section.labelKey)}</div>`}
                  ${section.routes.map(renderRoute)}
                </div>
              `
            )}
      </nav>
    </div>
  `;
}
