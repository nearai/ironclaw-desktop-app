import { useQuery } from '@tanstack/react-query';
import { Icon } from '../../../design-system/icons.js';
import { html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';
import { listWorkspace } from '../lib/workspace-api.js';
import { sortEntries } from '../lib/workspace-presenters.js';

function isUiHiddenWorkspacePath(path = '') {
  return String(path)
    .split('/')
    .some((segment) => segment.startsWith('.'));
}

// Calm, non-animated skeleton rows. Reuses the shared `.v2-skeleton` primitive
// so loading reads as reserved structure rather than raw "Loading…" text, and
// reveals the real rows without shifting layout.
function TreeSkeleton({ rows = 4, indent = 0 }) {
  return html`<div className="space-y-1 py-1" aria-hidden="true">
    ${Array.from({ length: rows }, (_, i) => i).map(
      (i) =>
        html`<div
          key=${i}
          className="v2-skeleton h-8 rounded-md"
          style=${{ marginLeft: `${indent}px` }}
        />`
    )}
  </div>`;
}

function visibleEntries(entries, filter, expandedPaths) {
  const needle = String(filter || '')
    .trim()
    .toLowerCase();
  const filtered = (entries || [])
    .filter((entry) => !isUiHiddenWorkspacePath(entry.path))
    .filter((entry) => {
      if (!needle) return true;
      if (entry.name.toLowerCase().includes(needle)) return true;
      return entry.is_dir && expandedPaths.has(entry.path);
    });
  return sortEntries(filtered);
}

function TreeNode({
  entry,
  depth,
  selectedPath,
  expandedPaths,
  filter,
  onToggleDirectory,
  onSelectFile
}) {
  const isExpanded = expandedPaths.has(entry.path);
  const childQuery = useQuery({
    queryKey: ['workspace-list', entry.path],
    queryFn: () => listWorkspace(entry.path),
    enabled: entry.is_dir && isExpanded
  });

  if (entry.is_dir) {
    const children = visibleEntries(childQuery.data?.entries, filter, expandedPaths);
    return html`
      <div>
        <button
          type="button"
          onClick=${() => {
            onSelectFile(entry.path);
            onToggleDirectory(entry.path);
          }}
          className=${[
            'flex min-h-[38px] w-full items-center gap-2 rounded-[7px] px-2 text-left text-sm hover:bg-[var(--v2-surface-soft)] hover:text-[var(--v2-text-strong)]',
            selectedPath === entry.path
              ? 'bg-[var(--v2-accent-soft)] text-[var(--v2-accent-text)]'
              : 'text-[var(--v2-text-muted)]'
          ].join(' ')}
          style=${{ paddingLeft: `${8 + depth * 16}px` }}
          aria-expanded=${isExpanded}
        >
          <${Icon}
            name="chevron"
            className=${['h-3 w-3 shrink-0', isExpanded ? 'rotate-0' : '-rotate-90'].join(' ')}
          />
          <${Icon} name="folder" className="h-3.5 w-3.5 shrink-0 opacity-80" />
          <span className="min-w-0 truncate font-semibold">${entry.name}</span>
        </button>
        ${isExpanded &&
        html`
          <div className="space-y-1">
            ${childQuery.isLoading
              ? html`<${TreeSkeleton} rows=${3} indent=${(depth + 1) * 16 + 8} />`
              : children.map(
                  (child) => html`
                    <${TreeNode}
                      key=${child.path}
                      entry=${child}
                      depth=${depth + 1}
                      selectedPath=${selectedPath}
                      expandedPaths=${expandedPaths}
                      filter=${filter}
                      onToggleDirectory=${onToggleDirectory}
                      onSelectFile=${onSelectFile}
                    />
                  `
                )}
          </div>
        `}
      </div>
    `;
  }

  return html`
    <button
      type="button"
      onClick=${() => onSelectFile(entry.path)}
      className=${[
        'flex min-h-[38px] w-full items-center gap-2 rounded-[7px] px-2 text-left text-sm',
        selectedPath === entry.path
          ? 'bg-[var(--v2-accent-soft)] text-[var(--v2-accent-text)]'
          : 'text-[var(--v2-text-muted)] hover:bg-[var(--v2-surface-soft)] hover:text-[var(--v2-text-strong)]'
      ].join(' ')}
      style=${{ paddingLeft: `${24 + depth * 16}px` }}
    >
      <${Icon} name="file" className="h-3.5 w-3.5 shrink-0 opacity-70" />
      <span className="min-w-0 truncate">${entry.name}</span>
    </button>
  `;
}

export function WorkspaceTree({
  entries,
  selectedPath,
  expandedPaths,
  filter,
  onToggleDirectory,
  onSelectFile,
  isLoading
}) {
  const t = useT();
  if (isLoading) {
    return html`<div className="p-3"><${TreeSkeleton} rows=${4} /></div>`;
  }

  const visibleEntries = sortEntries(
    entries.filter((entry) => !isUiHiddenWorkspacePath(entry.path))
  );

  if (!visibleEntries.length) {
    return html`<div className="px-4 py-8 text-sm text-[var(--v2-text-muted)]">
      ${t('workspace.noFiles')}
    </div>`;
  }

  return html`
    <div className="space-y-1 p-2">
      ${visibleEntries.map(
        (entry) => html`
          <${TreeNode}
            key=${entry.path}
            entry=${entry}
            depth=${0}
            selectedPath=${selectedPath}
            expandedPaths=${expandedPaths}
            filter=${filter}
            onToggleDirectory=${onToggleDirectory}
            onSelectFile=${onSelectFile}
          />
        `
      )}
    </div>
  `;
}
