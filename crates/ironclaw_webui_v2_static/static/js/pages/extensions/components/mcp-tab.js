import { React, html } from '../../../lib/html.js';
import { Button } from '../../../design-system/button.js';
import { FormField, Input } from '../../../design-system/input.js';
import { Icon } from '../../../design-system/icons.js';
import { appScopedPath } from '../../../lib/app-path.js';
import { ExtensionCard, RegistryCard, groupByReadiness } from './extension-card.js';
import { validateCustomMcpInput } from '../lib/custom-mcp.js';

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
  onAddCustom,
  isBusy
}) {
  const isEmpty = mcpServers.length === 0 && mcpRegistry.length === 0;
  const { needsYou, healthy } = groupByReadiness(mcpServers);

  return html`
    <div className="space-y-8">
      ${isEmpty &&
      html`
        <section className="max-w-md py-2">
          <div className="v2-text-label">Knowledge apps</div>
          <h3 className="mt-2 v2-text-title text-[var(--v2-text-strong)]">
            No knowledge apps connected
          </h3>
          <p className="mt-2 v2-text-body text-[var(--v2-text-muted)]">
            Connect Notion or another knowledge source from Browse so IronClaw can search team
            context before drafting or deciding.
          </p>
          <${Button}
            as="a"
            href=${appScopedPath('/extensions/registry?setup=1&focus=notion')}
            variant="primary"
            size="sm"
            className="mt-4 min-h-[44px] px-3.5"
          >
            Browse knowledge apps
          <//>
          ${loadError &&
          html`
            <p className="mt-3 v2-text-body text-[var(--v2-warning-text)]" role="status">
              The local gateway is unavailable, so app setup cannot start yet.
            </p>
          `}
        </section>
      `}
      ${needsYou.length > 0 &&
      html`
        <section>
          <div className="v2-text-label text-[var(--v2-warning-text)]">Needs you</div>
          <div className="mt-2 grid grid-cols-1">
            ${needsYou.map(
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
        </section>
      `}
      ${healthy.length > 0 &&
      html`
        <section>
          <div className="v2-text-label">Connected knowledge apps</div>
          <div className="mt-2 grid grid-cols-1">
            ${healthy.map(
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
        </section>
      `}
      ${mcpRegistry.length > 0 &&
      html`
        <section>
          <div className="v2-text-label">Available knowledge apps</div>
          <div className="mt-2 grid grid-cols-1">
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
        </section>
      `}

      <${CustomMcpServerDisclosure} onAddCustom=${onAddCustom} isBusy=${isBusy} />
    </div>
  `;
}

// The custom-MCP path is the developer escape hatch, not the common one. It
// lives below the common path as a collapsed "Advanced" disclosure — one
// depth, no filled card — so the resting surface leads with connectable apps.
function CustomMcpServerDisclosure({ onAddCustom, isBusy }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [url, setUrl] = React.useState('');
  const [errors, setErrors] = React.useState({});
  const preview = React.useMemo(
    () => validateCustomMcpInput({ name, url: url || 'https://mcp.example.com/mcp' }),
    [name, url]
  );
  const normalizedName = preview.name;
  const disabledReason = isBusy ? 'busy' : !onAddCustom ? 'missing-action' : '';
  const fieldsDisabled = Boolean(isBusy);

  const handleSubmit = React.useCallback(
    (event) => {
      event.preventDefault();
      const validated = validateCustomMcpInput({ name, url });
      setErrors(validated.errors);
      if (!validated.ok) return;
      if (!onAddCustom) {
        setErrors({ url: 'Connection actions are unavailable in this build.' });
        return;
      }
      onAddCustom({ name: validated.name, url: validated.url });
    },
    [name, onAddCustom, url]
  );

  return html`
    <section
      data-testid="custom-mcp-card"
      data-disabled-reason=${disabledReason}
      className="border-t border-[var(--v2-panel-border)] pt-6"
    >
      <button
        type="button"
        aria-expanded=${open ? 'true' : 'false'}
        aria-controls="custom-mcp-panel"
        onClick=${() => setOpen((v) => !v)}
        className="flex min-h-[44px] w-full items-center gap-1.5 rounded-[var(--v2-radius-control)] text-left"
      >
        <${Icon}
          name="chevron"
          aria-hidden="true"
          className=${['h-3.5 w-3.5 text-[var(--v2-text-faint)]', open ? 'rotate-180' : ''].join(
            ' '
          )}
        />
        <span className="v2-text-label">Advanced: add custom server</span>
      </button>

      ${open &&
      html`
        <div id="custom-mcp-panel" aria-label="Add custom MCP server" className="mt-3">
          <p className="max-w-2xl v2-text-body text-[var(--v2-text-muted)]">
            Use an MCP server that does not need sign-in. Sign-in protected custom servers need a
            gateway update before desktop can add them here.
          </p>

          <form
            className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)_auto]"
            onSubmit=${handleSubmit}
          >
            <${FormField}
              label="Server name"
              htmlFor="custom-mcp-name"
              error=${errors.name}
              hint="Lowercase slug, for example team-docs."
            >
              <${Input}
                id="custom-mcp-name"
                data-testid="custom-mcp-name"
                value=${name}
                placeholder="team-docs"
                disabled=${fieldsDisabled}
                onChange=${(event) => {
                  setName(event.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                }}
              />
            <//>
            <${FormField}
              label="MCP URL"
              htmlFor="custom-mcp-url"
              error=${errors.url}
              hint="HTTPS, or localhost HTTP for local development."
            >
              <${Input}
                id="custom-mcp-url"
                data-testid="custom-mcp-url"
                type="url"
                value=${url}
                placeholder="https://mcp.example.com/mcp"
                disabled=${fieldsDisabled}
                onChange=${(event) => {
                  setUrl(event.target.value);
                  if (errors.url) setErrors((prev) => ({ ...prev, url: '' }));
                }}
              />
            <//>
            <div className="flex items-end">
              <${Button}
                type="submit"
                data-testid="custom-mcp-submit"
                variant="primary"
                disabled=${fieldsDisabled}
                size="md"
                className="min-h-[44px] w-full lg:w-auto"
              >
                Add MCP server
              <//>
            </div>
          </form>

          ${normalizedName &&
          html` <p className="mt-2 v2-text-meta">Registers as ${normalizedName}</p> `}
        </div>
      `}
    </section>
  `;
}
