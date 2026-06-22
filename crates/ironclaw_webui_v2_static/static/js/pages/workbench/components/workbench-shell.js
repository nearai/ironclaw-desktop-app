import { Link } from 'react-router';

import { Icon } from '../../../design-system/icons.js';
import { useInterfaceTheme } from '../../../design-system/theme.js';
import { html } from '../../../lib/html.js';
import { cn } from '../../../utils/cn.js';

function railToneForGroup(groupId) {
  if (groupId === 'needs-reply') return 'wb13-dot-reply';
  if (groupId === 'needs-approval') return 'wb13-dot-hold';
  if (groupId === 'blocked') return 'wb13-dot-block';
  if (groupId === 'working') return 'wb13-dot-run';
  if (groupId === 'needs-review') return 'wb13-dot-ready';
  if (groupId === 'upcoming') return 'wb13-dot-sched';
  if (groupId === 'scheduled') return 'wb13-dot-sched';
  if (groupId === 'receipts') return 'wb13-dot-done';
  return '';
}

export function WorkbenchNav({ view, onView }) {
  const { theme, toggleTheme } = useInterfaceTheme();
  const nextThemeLabel = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  return html`
    <nav className="wb13-nav" aria-label="Workbench primary">
      <div className="wb13-mark" aria-hidden="true"></div>
      <button
        type="button"
        className=${view === 'home' ? 'is-active' : ''}
        aria-current=${view === 'home' ? 'page' : undefined}
        onClick=${() => onView('home')}
      >
        <${Icon} name="folder" />Work
      </button>
      <button
        type="button"
        className=${view === 'library' ? 'is-active' : ''}
        aria-current=${view === 'library' ? 'page' : undefined}
        onClick=${() => onView('library')}
      >
        <${Icon} name="file" />Library
      </button>
      <button
        type="button"
        className=${view === 'memory' ? 'is-active' : ''}
        aria-current=${view === 'memory' ? 'page' : undefined}
        onClick=${() => onView('memory')}
      >
        <${Icon} name="book" />Memory
      </button>
      <div className="wb13-spacer"></div>
      <button
        type="button"
        className="wb13-top-button"
        aria-label=${nextThemeLabel}
        aria-pressed=${theme === 'dark'}
        title=${nextThemeLabel}
        onClick=${toggleTheme}
      >
        <${Icon} name=${theme === 'dark' ? 'sun' : 'moon'} />
      </button>
      <${Link} to="/settings/inference" className="wb13-top-button" title="Settings">
        <${Icon} name="settings" />
      <//>
    </nav>
  `;
}

function workspaceIdentity(currentUser) {
  const name = currentUser?.displayName || currentUser?.email;
  return name ? `${name} · NEAR AI Cloud` : 'NEAR AI Cloud';
}

// A single rail row. Inbox ("Needs a reply") rows open the in-app reading panel
// via onOpenMessage — they have no route. Calendar ("Upcoming") rows open their
// real Google Calendar htmlLink in a new tab. Everything else navigates to its
// in-app href via the SPA router.
function DockRow({ group, row, onClose, onOpenMessage }) {
  const dot = html`<span className=${cn('wb13-dot', railToneForGroup(group.id))}></span>`;
  const label = html`
    <span>
      <span className="wb13-dock-title">${row.title}</span>
      <span className="wb13-dock-detail">${row.badge} - ${row.detail}</span>
    </span>
  `;

  if (row.kind === 'inbox' || row.kind === 'notion' || row.kind === 'drivedoc') {
    const testid =
      row.kind === 'notion'
        ? 'workbench-rail-notion'
        : row.kind === 'drivedoc'
          ? 'workbench-rail-drivedoc'
          : 'workbench-rail-reply';
    return html`
      <button
        type="button"
        className="wb13-dock-item"
        data-testid=${testid}
        onClick=${() => {
          onClose?.();
          onOpenMessage?.(row);
        }}
      >
        ${dot}${label}
      </button>
    `;
  }

  const isExternal = /^https?:\/\//i.test(row.href || '');
  if (isExternal) {
    return html`
      <a
        className="wb13-dock-item"
        data-testid="workbench-rail-upcoming"
        href=${row.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick=${onClose}
      >
        ${dot}${label}
      </a>
    `;
  }

  return html`
    <${Link} to=${row.href} className="wb13-dock-item" onClick=${onClose}> ${dot}${label} <//>
  `;
}

export function WorkbenchDock({ groups, open = false, onClose, onOpenMessage, currentUser }) {
  // Mirror v13: only render groups that actually have rows, so the rail stays
  // dense instead of stacking placeholder "Nothing… 0" rows.
  const populatedGroups = groups.filter((group) => group.rows.length > 0);
  return html`
    <aside
      id="workbench-active-work-dock"
      className=${cn('wb13-dock', open && 'is-open')}
      aria-label="Active work"
    >
      <div className="wb13-workspace">
        <div>
          <div className="wb13-workspace-title">Workbench</div>
          <div className="wb13-workspace-sub">${workspaceIdentity(currentUser)}</div>
        </div>
        <button
          type="button"
          className="wb13-dock-close"
          aria-label="Close active work"
          onClick=${onClose}
        >
          <${Icon} name="close" />
        </button>
      </div>
      ${populatedGroups.length
        ? populatedGroups.map(
            (group) => html`
              <section key=${group.id}>
                <div className="wb13-dock-group">
                  ${group.label}
                  <span className="wb13-dock-count">${group.total}</span>
                </div>
                ${group.rows.map(
                  (row) => html`
                    <${DockRow}
                      key=${row.id}
                      group=${group}
                      row=${row}
                      onClose=${onClose}
                      onOpenMessage=${onOpenMessage}
                    />
                  `
                )}
              </section>
            `
          )
        : html`<div className="wb13-dock-allclear">
            Nothing needs you right now. Active work appears here as it starts.
          </div>`}
    </aside>
  `;
}

export function WorkbenchTop({ view, currentUser, dockOpen, onHome, onToggleDock }) {
  const inSubview = view !== 'home';
  const accountLabel = currentUser?.displayName || currentUser?.email || 'Account';
  return html`
    <header className="wb13-top">
      ${inSubview
        ? html`<button type="button" className="wb13-top-button" onClick=${onHome}>
            <${Icon} name="chevron" />Work
          </button>`
        : null}
      <button
        type="button"
        className="wb13-icon-button wb13-dock-toggle"
        aria-label="Show active work"
        aria-controls="workbench-active-work-dock"
        aria-expanded=${dockOpen}
        onClick=${onToggleDock}
      >
        <${Icon} name="list" />
      </button>
      <div className="wb13-crumb">
        ${view === 'library'
          ? html`<span>Work</span><span>/</span><strong>Library</strong>`
          : view === 'memory'
            ? html`<span>Work</span><span>/</span><strong>Memory</strong>`
            : html`<strong>Work</strong>`}
      </div>
      <div className="wb13-spacer"></div>
      <div className="wb13-account">
        <span className="wb13-avatar"
          >${String(accountLabel || 'A')
            .slice(0, 1)
            .toUpperCase()}</span
        >
        ${accountLabel}
      </div>
    </header>
  `;
}
