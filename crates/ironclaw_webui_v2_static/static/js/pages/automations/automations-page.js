import { React, html } from '../../lib/html.js';
import { useT } from '../../lib/i18n.js';
import { AutomationDeliveryDefaultsPanel } from './components/automation-delivery-defaults-panel.js';
import { AutomationsList } from './components/automations-list.js';
import { AutomationsSummaryStrip } from './components/automations-summary-strip.js';
import { useAutomations } from './hooks/useAutomations.js';
import { useOutboundDeliveryDefaults } from './hooks/useOutboundDeliveryDefaults.js';

export function AutomationsPage() {
  const t = useT();
  const [filter, setFilter] = React.useState('all');
  const [selectedAutomationId, setSelectedAutomationId] = React.useState(null);
  const automationsState = useAutomations();
  const deliveryState = useOutboundDeliveryDefaults();

  const [minSpin, setMinSpin] = React.useState(false);
  const minSpinTimer = React.useRef(null);
  React.useEffect(() => () => clearTimeout(minSpinTimer.current), []);
  const handleRefresh = React.useCallback(() => {
    setMinSpin(true);
    clearTimeout(minSpinTimer.current);
    minSpinTimer.current = setTimeout(() => setMinSpin(false), 1000);
    automationsState.refetch();
  }, [automationsState.refetch]);
  const isRefreshing = automationsState.isRefreshing || minSpin;
  const showErrorOnly =
    automationsState.error &&
    !automationsState.isLoading &&
    automationsState.automations.length === 0;

  React.useEffect(() => {
    if (!automationsState.automations.length) {
      setSelectedAutomationId(null);
      return;
    }
    const stillExists = automationsState.automations.some(
      (automation) => automation.automation_id === selectedAutomationId
    );
    if (!stillExists) {
      setSelectedAutomationId(automationsState.automations[0].automation_id);
    }
  }, [automationsState.automations, selectedAutomationId]);

  return html`
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="v2-page-entrance flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-8">
          ${automationsState.error &&
          html`
            <div
              className="rounded-[8px] border border-[color-mix(in_srgb,var(--v2-danger-text)_36%,var(--v2-panel-border))] bg-[var(--v2-danger-soft)] px-4 py-3 text-sm text-[var(--v2-danger-text)]"
            >
              ${t('automations.error.loadFailed')}
            </div>
          `}
          ${showErrorOnly
            ? null
            : html`
                ${!automationsState.isLoading &&
                !automationsState.schedulerEnabled &&
                html`
                  <div
                    role="status"
                    className="rounded-[8px] border border-[color-mix(in_srgb,var(--v2-warning-text)_36%,var(--v2-panel-border))] bg-[var(--v2-warning-soft)] px-4 py-3"
                  >
                    <div className="text-sm font-semibold text-[var(--v2-warning-text)]">
                      ${t('automations.schedulerOff.title')}
                    </div>
                    <div className="mt-0.5 text-xs leading-5 text-[var(--v2-warning-text)]">
                      ${t('automations.schedulerOff.description')}
                    </div>
                  </div>
                `}
                <${AutomationsSummaryStrip}
                  summary=${automationsState.summary}
                  activeFilter=${filter}
                  onSelectFilter=${setFilter}
                />
                <${AutomationDeliveryDefaultsPanel} deliveryState=${deliveryState} />

                ${automationsState.isLoading
                  ? html`
                      <div className="space-y-4">
                        ${[1, 2, 3].map(
                          (index) =>
                            html`<div key=${index} className="v2-skeleton h-24 rounded-[8px]" />`
                        )}
                      </div>
                    `
                  : html`
                      <${AutomationsList}
                        automations=${automationsState.automations}
                        filter=${filter}
                        onFilterChange=${setFilter}
                        onRefresh=${handleRefresh}
                        isRefreshing=${isRefreshing}
                        selectedAutomationId=${selectedAutomationId}
                        onSelectAutomation=${setSelectedAutomationId}
                      />
                    `}
              `}
        </div>
      </div>
    </div>
  `;
}
