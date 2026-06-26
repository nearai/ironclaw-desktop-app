import { html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';
import { Panel } from '../../../design-system/primitives.js';
import { WorkspaceTree } from './workspace-tree.js';

export function WorkspaceSidebar({
  rootEntries,
  selectedPath,
  expandedPaths,
  filter,
  onFilterChange,
  isLoadingTree,
  onToggleDirectory,
  onSelectFile
}) {
  const t = useT();

  return html`
    <${Panel} className="flex min-h-[420px] flex-col overflow-hidden p-0 xl:min-h-0">
      <div className="border-b border-[var(--v2-panel-border)] p-3">
        <input
          value=${filter}
          onInput=${(event) => onFilterChange(event.target.value)}
          placeholder=${t('workspace.filterPlaceholder')}
          className="h-10 w-full rounded-[7px] border border-[var(--v2-panel-border)] bg-[var(--v2-input-bg)] px-3 text-sm text-[var(--v2-text-strong)] outline-none placeholder:text-[var(--v2-text-muted)] focus:border-[var(--v2-accent)]"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <${WorkspaceTree}
          entries=${rootEntries}
          selectedPath=${selectedPath}
          expandedPaths=${expandedPaths}
          filter=${filter}
          onToggleDirectory=${onToggleDirectory}
          onSelectFile=${onSelectFile}
          isLoading=${isLoadingTree}
        />
      </div>
    <//>
  `;
}
