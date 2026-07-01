import { Navigate, useNavigate, useOutletContext, useParams } from 'react-router';
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
import { SettingsTabs, SettingsTabsMobile } from './components/settings-tabs.js';
import { useSettings } from './hooks/useSettings.js';

// A labeled desk, not a generic gateway admin. Each tab is a bordered surface
// with a title + one-line purpose (plain literals — the i18n key count is
// pinned) and, where a list is long enough to earn one, a quiet inline filter.
// Search was demoted out of the focal slot: it is a per-tab filter, never the
// page's headline control.
const TAB_META = {
  inference: {
    titleKey: 'settings.inference',
    purpose: 'Connect NEAR AI Cloud and choose the model IronClaw runs on.',
    filter: false
  },
  agent: {
    titleKey: 'settings.agent',
    purpose: 'Guardrails first: what the agent may spend, run, and touch without asking.',
    filter: true
  },
  channels: {
    titleKey: 'settings.channels',
    purpose: 'Where IronClaw can reach you and which servers it can talk to.',
    filter: true
  },
  networking: {
    titleKey: 'settings.networking',
    purpose: 'Local gateway address and how the desk is reached from outside.',
    filter: false
  },
  tools: {
    titleKey: 'settings.tools',
    purpose: 'Grant tools by blast radius. Sending tools stay a deliberate choice.',
    filter: true
  },
  skills: {
    titleKey: 'settings.skills',
    purpose: 'Import and manage the skills the agent can load into context.',
    filter: true
  },
  traces: {
    titleKey: 'settings.traceCommons',
    purpose: 'Your contribution ledger and any submissions waiting on your authorization.',
    filter: false
  },
  users: {
    titleKey: 'settings.users',
    purpose: 'Operators who can sign in to this gateway.',
    filter: true
  },
  language: {
    titleKey: 'settings.language',
    purpose: 'The language IronClaw uses across the desk.',
    filter: true
  }
};

export function SettingsPage() {
  const t = useT();
  const navigate = useNavigate();
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

  const meta = TAB_META[tab] || TAB_META[defaultTab];
  const handleTabChange = (id) => navigate(`/settings/${id}`);

  return html`
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="v2-page-entrance flex-1 p-4 sm:p-6 lg:p-8">
          ${needsRestart &&
          html`<div
            className="sticky top-0 z-20 -mx-4 -mt-4 mb-4 bg-[color-mix(in_srgb,var(--v2-canvas)_92%,transparent)] px-4 pt-4 backdrop-blur sm:-mx-6 sm:px-6"
          >
            <${RestartBanner}
              visible=${true}
              gatewayStatus=${gatewayStatus}
              gatewayStatusQuery=${gatewayStatusQuery}
            />
          </div>`}
          <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
            <div className="mb-6 lg:mb-0">
              <div className="lg:hidden">
                <${SettingsTabsMobile}
                  activeTab=${tab}
                  onTabChange=${handleTabChange}
                  isAdmin=${isAdmin}
                />
              </div>
              <div className="hidden lg:block lg:sticky lg:top-2">
                <${SettingsTabs}
                  activeTab=${tab}
                  onTabChange=${handleTabChange}
                  isAdmin=${isAdmin}
                />
              </div>
            </div>

            <div className="min-w-0">
              ${saveError &&
              html`
                <div
                  className="mb-6 rounded-[var(--v2-radius-control)] border border-[color-mix(in_srgb,var(--v2-danger-text)_36%,var(--v2-panel-border))] bg-[var(--v2-danger-soft)] px-4 py-3 text-sm text-[var(--v2-danger-text)]"
                >
                  ${t('error.saveFailed', { message: saveError.message })}
                </div>
              `}

              <div
                className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--v2-panel-border)] pb-4"
              >
                <div className="min-w-0">
                  <h2 className="v2-text-title">${t(meta.titleKey)}</h2>
                  <p className="mt-1 max-w-prose text-sm text-[var(--v2-text-muted)]">
                    ${meta.purpose}
                  </p>
                </div>
                ${meta.filter &&
                html`
                  <label className="relative block w-full sm:w-64">
                    <span className="sr-only">${t('settings.searchPlaceholder')}</span>
                    <${Icon}
                      name="search"
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--v2-text-faint)]"
                    />
                    <input
                      type="search"
                      value=${searchQuery}
                      onChange=${(event) => setSearchQuery(event.target.value)}
                      placeholder=${t('settings.searchPlaceholder')}
                      className="h-9 w-full rounded-[var(--v2-radius-control)] border border-[var(--v2-panel-border)] bg-[var(--v2-input-bg)] pl-8 pr-8 text-sm text-[var(--v2-text-strong)] outline-none placeholder:text-[var(--v2-text-faint)] focus:border-[color-mix(in_srgb,var(--v2-accent)_45%,var(--v2-panel-border))]"
                    />
                    ${searchQuery &&
                    html`
                      <button
                        type="button"
                        onClick=${() => setSearchQuery('')}
                        aria-label=${t('settings.clearSearch')}
                        className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-[var(--v2-radius-control)] text-[var(--v2-text-faint)] hover:bg-[var(--v2-surface-muted)] hover:text-[var(--v2-text-strong)]"
                      >
                        <${Icon} name="close" className="h-3 w-3" aria-hidden="true" />
                      </button>
                    `}
                  </label>
                `}
              </div>

              ${tabContent[tab]}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
