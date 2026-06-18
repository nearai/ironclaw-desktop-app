import { html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';
import { Icon } from '../../../design-system/icons.js';
import { Panel } from '../../../design-system/primitives.js';
import { sortEntries } from '../lib/workspace-presenters.js';
import { WorkspaceBreadcrumb } from './workspace-breadcrumb.js';

function isUiHiddenWorkspacePath(path = '') {
  return String(path)
    .split('/')
    .some((segment) => segment.startsWith('.'));
}

export function WorkspaceDirectory({ path, entries, isLoading, filter, onOpen, onNavigate }) {
  const t = useT();

  if (isLoading) {
    return html`
      <div className="space-y-4">
        <div className="v2-skeleton h-16 rounded-xl" />
        <div className="v2-skeleton h-[460px] rounded-xl" />
      </div>
    `;
  }

  const visible = (entries || []).filter((entry) => !isUiHiddenWorkspacePath(entry.path));
  const needle = String(filter || '')
    .trim()
    .toLowerCase();
  const filtered = needle
    ? visible.filter((entry) => entry.name.toLowerCase().includes(needle))
    : visible;
  const rows = sortEntries(filtered);

  let body;
  if (!visible.length) {
    body = html`
      <div className="px-4 py-10 text-center text-sm text-[var(--v2-text-muted)]">
        ${t('workspace.emptyDir')}
      </div>
    `;
  } else if (!rows.length) {
    body = html`
      <div className="px-4 py-10 text-center text-sm text-[var(--v2-text-muted)]">
        ${t('workspace.noMatches')}
      </div>
    `;
  } else {
    body = html`
      <div className="divide-y divide-[var(--v2-panel-border)]">
        ${rows.map(
          (entry) => html`
            <button
              key=${entry.path}
              type="button"
              onClick=${() => onOpen(entry.path)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[var(--v2-text-muted)] hover:bg-[var(--v2-surface-soft)] hover:text-[var(--v2-text-strong)]"
            >
              <${Icon}
                name=${entry.is_dir ? 'folder' : 'file'}
                className=${[
                  'h-4 w-4 shrink-0',
                  entry.is_dir ? 'text-[var(--v2-accent-text)]' : 'text-[var(--v2-text-subtle)]'
                ].join(' ')}
              />
              <span
                className=${['min-w-0 truncate', entry.is_dir ? 'font-semibold' : ''].join(' ')}
              >
                ${entry.name}
              </span>
            </button>
          `
        )}
      </div>
    `;
  }

  return html`
    <${Panel} className="flex min-h-[520px] flex-col overflow-hidden p-0 xl:min-h-0">
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--v2-panel-border)] px-4 py-3"
      >
        <${WorkspaceBreadcrumb} path=${path} onNavigate=${onNavigate} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">${body}</div>
    <//>
  `;
}
