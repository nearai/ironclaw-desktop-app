import { html } from '../../../lib/html.js';
import { Button } from '../../../design-system/button.js';
import { Card, CardLabel } from '../../../design-system/card.js';
import { appScopedPath } from '../../../lib/app-path.js';
import { ExtensionCard, RegistryCard } from './extension-card.js';

function packageId(item) {
  return item.package_ref?.id || '';
}

export function McpTab({
  mcpServers,
  mcpRegistry,
  loadError,
  onActivate,
  onConfigure,
  onRemove,
  onInstall,
  isBusy
}) {
  if (mcpServers.length === 0 && mcpRegistry.length === 0) {
    return html`
      <${Card} variant="bordered" radius="lg" padding="lg">
        <h3 className="text-lg font-semibold text-[var(--v2-text-strong)]">
          No knowledge apps connected
        </h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-[var(--v2-text-muted)]">
          Connect Notion or another knowledge source from Browse so IronClaw can search team context
          before drafting or deciding.
        </p>
        <${Button}
          as="a"
          href=${appScopedPath('/extensions/registry?setup=1&focus=notion')}
          variant="primary"
          size="sm"
          className="mt-4"
        >
          Browse knowledge apps
        <//>
        ${loadError &&
        html`
          <p className="mt-3 text-sm leading-6 text-[var(--v2-warning-text)]" role="status">
            The local gateway is unavailable, so app setup cannot start yet.
          </p>
        `}
      <//>
    `;
  }

  return html`
    <div className="space-y-5">
      ${mcpServers.length > 0 &&
      html`
        <${Card} variant="bordered" radius="lg" padding="md">
          <${CardLabel} className="mb-4 text-[var(--v2-accent-text)]"> Connected knowledge apps <//>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            ${mcpServers.map(
              (ext) => html`
                <${ExtensionCard}
                  key=${packageId(ext)}
                  ext=${ext}
                  onActivate=${onActivate}
                  onConfigure=${onConfigure}
                  onRemove=${onRemove}
                  isBusy=${isBusy}
                />
              `
            )}
          </div>
        <//>
      `}
      ${mcpRegistry.length > 0 &&
      html`
        <${Card} variant="bordered" radius="lg" padding="md">
          <${CardLabel} className="mb-4 text-[var(--v2-accent-text)]"> Available knowledge apps <//>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            ${mcpRegistry.map(
              (entry) => html`
                <${RegistryCard}
                  key=${packageId(entry)}
                  entry=${entry}
                  onInstall=${onInstall}
                  isBusy=${isBusy}
                />
              `
            )}
          </div>
        <//>
      `}
    </div>
  `;
}
