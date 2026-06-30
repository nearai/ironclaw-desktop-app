import { Link } from 'react-router';
import { html } from '../lib/html.js';
import { isDesktopRuntime } from '../lib/api.js';
import { appScopedPath } from '../lib/app-path.js';
import { useT } from '../lib/i18n.js';
import { SidebarFooter } from './sidebar-footer.js';
import { SidebarNav } from './sidebar-nav.js';
import { SidebarThreads } from './sidebar-threads.js';
import { cn } from '../utils/cn.js';

function threadTitle(thread) {
  return thread?.title || (thread?.id ? `Thread ${thread.id.slice(0, 8)}` : 'New chat');
}

function RecentThreadStrip({ threads, activeThreadId, onSelect }) {
  const t = useT();
  const recent = threads.slice(0, 5);
  if (recent.length === 0) return null;
  return html`
    <div
      className="hidden h-full min-w-0 max-w-[360px] shrink border-l border-[var(--v2-panel-border)] px-2 py-2 xl:flex xl:flex-col"
      aria-label=${t('chat.conversations')}
    >
      <div className="mb-1 px-1 text-[11px] font-semibold text-[var(--v2-text-faint)]">
        ${t('chat.conversations')}
      </div>
      <div className="flex min-h-0 gap-1 overflow-x-auto [scrollbar-width:thin]">
        ${recent.map(
          (thread) => html`
            <button
              key=${thread.id}
              type="button"
              onClick=${() => onSelect(thread.id)}
              title=${threadTitle(thread)}
              className=${cn(
                'min-h-[36px] min-w-[112px] max-w-[144px] rounded-[7px] border px-2 text-left text-[11px] font-medium',
                thread.id === activeThreadId
                  ? 'border-[color-mix(in_srgb,var(--v2-accent)_36%,var(--v2-panel-border))] bg-[var(--v2-accent-soft)] text-[var(--v2-accent-text)]'
                  : 'border-transparent text-[var(--v2-text-muted)] hover:bg-[var(--v2-surface-soft)] hover:text-[var(--v2-text-strong)]'
              )}
            >
              <span className="block truncate">${threadTitle(thread)}</span>
            </button>
          `
        )}
      </div>
    </div>
  `;
}

export function Sidebar({
  threadsState,
  theme,
  toggleTheme,
  profile,
  isAdmin,
  onSignOut,
  onClose,
  onNewChat,
  onSelectThread,
  onDeleteThread,
  chromePosition = 'left',
  chromeDensity = 'expanded'
}) {
  const bottom = chromePosition === 'bottom';
  const compact = chromeDensity === 'compact';
  const right = chromePosition === 'right';

  if (bottom) {
    return html`
      <aside
        className="flex h-[86px] w-full shrink-0 items-stretch border-t border-[var(--v2-panel-border)] bg-[var(--v2-surface)]"
      >
        <div
          data-tauri-drag-region
          className="flex h-full w-[68px] shrink-0 items-center justify-center border-r border-[var(--v2-panel-border)]"
        >
          <${Link}
            to="/chat"
            onClick=${onClose}
            className="grid min-h-[44px] min-w-[44px] place-items-center opacity-90 hover:opacity-100"
            aria-label="IronClaw"
          >
            <img src=${appScopedPath('/assets/logo.jpg')} alt="IronClaw" className="h-7 w-auto" />
          <//>
        </div>

        <${SidebarNav}
          onNewChat=${onNewChat}
          isCreating=${threadsState.isCreating}
          isAdmin=${isAdmin}
          onNavigate=${onClose}
          orientation="horizontal"
          density=${compact ? 'compact' : 'expanded'}
        />

        <${RecentThreadStrip}
          threads=${threadsState.threads}
          activeThreadId=${threadsState.activeThreadId}
          onSelect=${onSelectThread}
        />

        <${SidebarFooter}
          theme=${theme}
          toggleTheme=${toggleTheme}
          profile=${profile}
          onSignOut=${onSignOut}
          orientation="horizontal"
          density=${compact ? 'compact' : 'expanded'}
        />
      </aside>
    `;
  }

  return html`
    <aside
      className=${cn(
        'flex h-full shrink-0 flex-col bg-[var(--v2-surface)]',
        compact ? 'w-[72px]' : 'w-[260px]',
        right
          ? 'border-l border-[var(--v2-panel-border)]'
          : 'border-r border-[var(--v2-panel-border)]'
      )}
    >
      <div
        data-tauri-drag-region
        className=${cn(
          'flex items-center gap-2.5 pb-4',
          compact ? 'justify-center px-2' : 'px-4',
          isDesktopRuntime() ? 'pt-10' : 'pt-5'
        )}
      >
        <${Link}
          to="/chat"
          onClick=${onClose}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-2.5 opacity-90 hover:opacity-100"
          aria-label="IronClaw"
        >
          <img src=${appScopedPath('/assets/logo.jpg')} alt="IronClaw" className="h-7 w-auto" />
        <//>
      </div>

      <${SidebarNav}
        onNewChat=${onNewChat}
        isCreating=${threadsState.isCreating}
        isAdmin=${isAdmin}
        onNavigate=${onClose}
        density=${compact ? 'compact' : 'expanded'}
      />

      <div className=${compact ? 'hidden' : 'mt-3 flex min-h-0 flex-1 flex-col'}>
        <${SidebarThreads}
          threads=${threadsState.threads}
          activeThreadId=${threadsState.activeThreadId}
          isLoading=${threadsState.isLoading}
          isError=${threadsState.isError}
          onRetry=${threadsState.refetch}
          hasMore=${threadsState.hasMoreThreads}
          isLoadingMore=${threadsState.isLoadingMore}
          onLoadMore=${threadsState.loadMoreThreads}
          onSelect=${onSelectThread}
          onDelete=${onDeleteThread}
        />
      </div>

      <${SidebarFooter}
        theme=${theme}
        toggleTheme=${toggleTheme}
        profile=${profile}
        onSignOut=${onSignOut}
        density=${compact ? 'compact' : 'expanded'}
      />
    </aside>
  `;
}
