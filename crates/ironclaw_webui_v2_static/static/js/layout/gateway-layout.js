import { Outlet } from 'react-router';
import { useInterfaceTheme } from '../design-system/theme.js';
import { useGatewayStatus } from '../hooks/useGatewayStatus.js';
import { useLlmProviders } from '../pages/settings/hooks/useLlmProviders.js';
import { useSidebar } from '../hooks/useSidebar.js';
import { html } from '../lib/html.js';
import { useT } from '../lib/i18n.js';
import { useThreads } from '../pages/chat/hooks/useThreads.js';
import { Sidebar } from '../components/sidebar.js';
import { PageHeader } from '../components/page-header.js';
import { CommandPalette } from '../components/command-palette.js';
import { ToastViewport } from '../components/toast-viewport.js';
import { React } from '../lib/html.js';
import { cn } from '../utils/cn.js';

export function GatewayLayout({ token, profile, isAdmin, onSignOut }) {
  const t = useT();
  const { theme, toggleTheme } = useInterfaceTheme();
  const statusQuery = useGatewayStatus(token);
  const threadsState = useThreads();
  const sidebar = useSidebar({
    onNewChat: () => threadsState.setActiveThreadId(null)
  });
  const status = statusQuery.data;

  // Chat is the front door. Model setup remains truthful in the composer and
  // Settings; the layout no longer redirects first-run users into provider
  // management before they can see the product surface.
  const llmProviders = useLlmProviders({ settings: {}, gatewayStatus: status });

  const [paletteOpen, setPaletteOpen] = React.useState(false);
  React.useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  // The current thread contract has no delete endpoint, so the sidebar renders no
  // delete affordance (SidebarThreads conditionally renders the
  // trash button on `onDelete`).

  return html`
    <div className="flex h-[100dvh] overflow-hidden bg-[var(--v2-canvas)]">
      ${sidebar.open &&
      html`<button
        type="button"
        aria-label=${t('nav.close')}
        onClick=${sidebar.close}
        className="fixed inset-0 z-40 bg-black/40 md:hidden"
      />`}

      <div
        className=${cn(
          'fixed inset-y-0 left-0 z-50 md:relative md:z-auto',
          sidebar.open ? 'flex' : 'hidden md:flex'
        )}
      >
        <${Sidebar}
          threadsState=${threadsState}
          theme=${theme}
          toggleTheme=${toggleTheme}
          profile=${profile}
          isAdmin=${isAdmin}
          onSignOut=${onSignOut}
          onClose=${sidebar.close}
          onNewChat=${sidebar.newChat}
          onSelectThread=${sidebar.selectThread}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <${PageHeader} threadsState=${threadsState} onToggleSidebar=${sidebar.toggle} />
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          ${(statusQuery.error || llmProviders.error) &&
          html`
            <div
              className=${cn(
                'm-4 rounded-[14px] border px-4 py-3 text-sm',
                'border-[color-mix(in_srgb,var(--v2-danger-text)_36%,var(--v2-panel-border))]',
                'bg-[var(--v2-danger-soft)] text-[var(--v2-danger-text)]'
              )}
            >
              ${(statusQuery.error || llmProviders.error).message || t('error.gatewayConnection')}
            </div>
          `}
          <${Outlet}
            context=${{
              gatewayStatus: status,
              gatewayStatusQuery: statusQuery,
              currentUser: profile,
              isAdmin,
              threadsState
            }}
          />
        </main>
      </div>
      <${CommandPalette}
        open=${paletteOpen}
        onClose=${() => setPaletteOpen(false)}
        threadsState=${threadsState}
        onNewChat=${sidebar.newChat}
        onToggleTheme=${toggleTheme}
        isAdmin=${isAdmin}
      />
      <${ToastViewport} />
    </div>
  `;
}
