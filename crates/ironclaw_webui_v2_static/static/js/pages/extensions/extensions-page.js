import { Navigate, useParams, useSearchParams } from 'react-router';
import { React, html } from '../../lib/html.js';
import { ActionToast } from './components/action-toast.js';
import { ChannelsTab } from './components/channels-tab.js';
import { ConfigureModal } from './components/configure-modal.js';
import { InstalledTab } from './components/installed-tab.js';
import { McpTab } from './components/mcp-tab.js';
import { RegistryTab } from './components/registry-tab.js';
import { useExtensions } from './hooks/useExtensions.js';
import { resolveConnectorDeepLink } from './lib/connector-deep-link.js';

export function ExtensionsPage() {
  const { tab = 'registry' } = useParams();
  const [searchParams] = useSearchParams();
  const [configuring, setConfiguring] = React.useState(null);
  const handledFocusRef = React.useRef(null);

  const {
    status,
    extensions,
    channels,
    mcpServers,
    channelRegistry,
    mcpRegistry,
    catalogEntries,
    loadError,
    connectableChannels,
    isLoading,
    isBusy,
    actionResult,
    clearResult,
    install,
    addCustomMcp,
    activate,
    remove,
    invalidate
  } = useExtensions();

  const handleConfigure = React.useCallback((extension) => setConfiguring(extension), []);
  const handleCloseModal = React.useCallback(() => setConfiguring(null), []);
  const handleSaved = React.useCallback(() => invalidate(), [invalidate]);
  const handleActivateFromModal = React.useCallback(
    (extension) => {
      if (!extension) return;
      activate(extension);
      setConfiguring(null);
    },
    [activate]
  );

  // Connector deep links (`?focus=<kind>/<id>&setup=1`) auto-open the setup
  // modal so a "Configure Gmail" link lands straight on the credential form,
  // on whichever tab the connector lives. Resolve once the catalog has loaded;
  // the handled-ref guard keeps a closed modal from reopening while the query
  // string is still on the URL.
  const focusRef = searchParams.get('focus');
  const wantsSetup = searchParams.get('setup') === '1';
  React.useEffect(() => {
    if (!focusRef || !wantsSetup || isLoading) return;
    if (handledFocusRef.current === focusRef) return;
    const connector = resolveConnectorDeepLink(focusRef, { extensions, catalogEntries });
    if (!connector) return;
    handledFocusRef.current = focusRef;
    setConfiguring(connector);
  }, [focusRef, wantsSetup, isLoading, extensions, catalogEntries]);

  if (isLoading) {
    return html`
      <div className="flex h-full flex-col overflow-y-auto">
        <div className="v2-page-entrance flex-1 p-4 sm:p-6">
          <div className="space-y-5">
            ${[1, 2, 3].map(
              (i) => html`
                <div
                  key=${i}
                  className="flex items-center justify-between border-t border-[var(--v2-panel-border)] py-4 first:border-0"
                >
                  <div>
                    <div className="v2-skeleton h-4 w-40 rounded" />
                    <div className="v2-skeleton mt-2 h-3 w-56 rounded" />
                  </div>
                  <div className="v2-skeleton h-7 w-16 rounded-full" />
                </div>
              `
            )}
          </div>
        </div>
      </div>
    `;
  }

  const tabContent = {
    installed: html`<${InstalledTab}
      extensions=${extensions}
      onActivate=${activate}
      onConfigure=${handleConfigure}
      onRemove=${remove}
      isBusy=${isBusy}
    />`,
    channels: html`<${ChannelsTab}
      status=${status}
      channels=${channels}
      connectableChannels=${connectableChannels}
      channelRegistry=${channelRegistry}
      onActivate=${activate}
      onConfigure=${handleConfigure}
      onRemove=${remove}
      onInstall=${install}
      isBusy=${isBusy}
    />`,
    mcp: html`<${McpTab}
      mcpServers=${mcpServers}
      mcpRegistry=${mcpRegistry}
      loadError=${loadError}
      onActivate=${activate}
      onConfigure=${handleConfigure}
      onRemove=${remove}
      onInstall=${install}
      onAddCustom=${addCustomMcp}
      isBusy=${isBusy}
    />`,
    registry: html`<${RegistryTab}
      catalogEntries=${catalogEntries}
      loadError=${loadError}
      onInstall=${install}
      onActivate=${activate}
      onConfigure=${handleConfigure}
      onRemove=${remove}
      isBusy=${isBusy}
    />`
  };

  if (!tabContent[tab]) {
    return html`<${Navigate} to="/extensions/registry" replace />`;
  }

  return html`
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="v2-page-entrance flex-1 p-4 sm:p-6">
        <div className="space-y-5">
          <${ActionToast} result=${actionResult} onDismiss=${clearResult} />
          ${tabContent[tab]}
        </div>
      </div>

      ${configuring &&
      html`
        <${ConfigureModal}
          extension=${configuring}
          onActivate=${handleActivateFromModal}
          onClose=${handleCloseModal}
          onSaved=${handleSaved}
        />
      `}
    </div>
  `;
}
