import { Navigate, useOutletContext, useParams } from 'react-router';
import { Icon } from '../../design-system/icons.js';
import { React, html } from '../../lib/html.js';
import { useT } from '../../lib/i18n.js';
import { AgentTab } from './components/agent-tab.js';
import { ChannelsTab } from './components/channels-tab.js';
import { InferenceTab } from './components/inference-tab.js';
import { LanguageTab } from './components/language-tab.js';
import { NetworkingTab } from './components/networking-tab.js';
import { RestartBanner } from './components/restart-banner.js';
import { SkillsTab } from './components/skills-tab.js';
import { ToolsTab } from './components/tools-tab.js';
import { TraceCommonsTab } from './components/trace-commons-tab.js';
import { UsersTab } from './components/users-tab.js';
import { useSettings } from './hooks/useSettings.js';

export function SettingsPage() {
  const t = useT();
  const { tab: requestedTab } = useParams();
  const { gatewayStatus, gatewayStatusQuery, isAdmin = true } = useOutletContext();
  const { settings, query, status, save, savedKeys, needsRestart, saveError } = useSettings();
  const defaultTab = 'inference';
  const tab = requestedTab || defaultTab;
  const [searchQuery, setSearchQuery] = React.useState('');

  React.useEffect(() => {
    setSearchQuery('');
  }, [tab]);

  const isLoading = query.isLoading;

  const tabContent = {
    inference: html`<${InferenceTab}
      settings=${settings}
      gatewayStatus=${gatewayStatus}
      settingsStatus=${status}
      onSave=${save}
      savedKeys=${savedKeys}
      isLoading=${isLoading}
      searchQuery=${searchQuery}
    />`,
    agent: html`<${AgentTab}
      settings=${settings}
      settingsStatus=${status}
      onSave=${save}
      savedKeys=${savedKeys}
      isLoading=${isLoading}
      searchQuery=${searchQuery}
    />`,
    channels: html`<${ChannelsTab} searchQuery=${searchQuery} />`,
    networking: html`<${NetworkingTab}
      settings=${settings}
      settingsStatus=${status}
      onSave=${save}
      savedKeys=${savedKeys}
      isLoading=${isLoading}
      searchQuery=${searchQuery}
    />`,
    tools: html`<${ToolsTab} searchQuery=${searchQuery} />`,
    skills: html`<${SkillsTab} searchQuery=${searchQuery} />`,
    traces: html`<${TraceCommonsTab} searchQuery=${searchQuery} />`,
    users: html`<${UsersTab} searchQuery=${searchQuery} />`,
    language: html`<${LanguageTab} searchQuery=${searchQuery} />`
  };

  const isOperatorTab = (id) => id === 'users';
  const tabContentHas = (id) => Object.prototype.hasOwnProperty.call(tabContent, id);
  const visibleTabIds = Object.keys(tabContent).filter((id) => isAdmin || !isOperatorTab(id));
  const defaultTabIsVisible = tabContentHas(defaultTab) && visibleTabIds.includes(defaultTab);
  const redirectTab = defaultTabIsVisible ? defaultTab : visibleTabIds[0] || 'language';

  if (!tabContentHas(tab) || (!isAdmin && isOperatorTab(tab))) {
    return html`<${Navigate} to=${`/settings/${redirectTab}`} replace />`;
  }

  return html`
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="v2-page-entrance flex-1 p-4 sm:p-5">
          <div className="space-y-4">
            ${needsRestart &&
            html`<div
              className="sticky top-0 z-20 -mx-4 -mt-4 mb-1 bg-[color-mix(in_srgb,var(--v2-canvas)_92%,transparent)] px-4 pt-4 backdrop-blur sm:-mx-5 sm:px-5"
            >
              <${RestartBanner}
                visible=${true}
                gatewayStatus=${gatewayStatus}
                gatewayStatusQuery=${gatewayStatusQuery}
              />
            </div>`}
            ${saveError &&
            html`
              <div
                className="rounded-[8px] border border-[color-mix(in_srgb,var(--v2-danger-text)_36%,var(--v2-panel-border))] bg-[var(--v2-danger-soft)] px-4 py-3 text-sm text-[var(--v2-danger-text)]"
              >
                ${t('error.saveFailed', { message: saveError.message })}
              </div>
            `}
            <label className="relative block">
              <span className="sr-only">${t('settings.searchPlaceholder')}</span>
              <${Icon}
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--v2-text-faint)]"
              />
              <input
                type="search"
                value=${searchQuery}
                onChange=${(event) => setSearchQuery(event.target.value)}
                placeholder=${t('settings.searchPlaceholder')}
                className="h-10 w-full rounded-[7px] border border-[var(--v2-panel-border)] bg-[var(--v2-input-bg)] pl-9 pr-9 text-sm text-[var(--v2-text-strong)] outline-none placeholder:text-[var(--v2-text-faint)] focus:border-[color-mix(in_srgb,var(--v2-accent)_45%,var(--v2-panel-border))]"
              />
              ${searchQuery &&
              html`
                <button
                  type="button"
                  onClick=${() => setSearchQuery('')}
                  aria-label=${t('settings.clearSearch')}
                  className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-[var(--v2-text-faint)] hover:bg-[var(--v2-surface-muted)] hover:text-[var(--v2-text-strong)]"
                >
                  <${Icon} name="close" className="h-3.5 w-3.5" />
                </button>
              `}
            </label>
            ${tabContent[tab]}
          </div>
        </div>
      </div>
    </div>
  `;
}
