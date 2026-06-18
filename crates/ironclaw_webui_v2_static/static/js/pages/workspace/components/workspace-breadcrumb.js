import { html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';
import {
  areaDisplayName,
  pathSegments,
  routeForWorkspacePath
} from '../lib/workspace-presenters.js';

export function WorkspaceBreadcrumb({ path, onNavigate }) {
  const t = useT();
  const parts = pathSegments(path);
  let current = '';

  return html`
    <div className="flex min-w-0 flex-wrap items-center gap-2 font-mono text-sm">
      <button
        type="button"
        onClick=${() => onNavigate('/workspace')}
        className="text-[var(--v2-accent-text)] hover:underline"
      >
        ${t('workspace.breadcrumbRoot')}
      </button>
      ${parts.map((part, index) => {
        current = current ? `${current}/${part}` : part;
        const target = current;
        const label = index === 0 ? areaDisplayName(part) : part;
        return html`
          <span key=${`${target}-slash`} className="text-[var(--v2-text-subtle)]">/</span>
          <button
            key=${`${target}-button`}
            type="button"
            onClick=${() => onNavigate(routeForWorkspacePath(target))}
            className="max-w-[220px] truncate text-[var(--v2-accent-text)] hover:underline"
          >
            ${label}
          </button>
        `;
      })}
    </div>
  `;
}
