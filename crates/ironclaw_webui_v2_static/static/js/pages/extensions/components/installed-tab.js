import { html } from '../../../lib/html.js';
import { Button } from '../../../design-system/button.js';
import { appScopedPath } from '../../../lib/app-path.js';
import { ExtensionCard, groupByReadiness } from './extension-card.js';

function packageId(ext) {
  return ext.package_ref?.id || '';
}

function ConnectorRows({ items, onActivate, onConfigure, onRemove, isBusy }) {
  return html`
    <div className="mt-2 grid grid-cols-1">
      ${items.map(
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
  `;
}

export function InstalledTab({ extensions, onActivate, onConfigure, onRemove, isBusy }) {
  if (extensions.length === 0) {
    return html`
      <section className="max-w-md py-2">
        <div className="v2-text-label">Connected apps</div>
        <h3 className="mt-2 v2-text-title text-[var(--v2-text-strong)]">No apps connected yet</h3>
        <p className="mt-2 v2-text-body text-[var(--v2-text-muted)]">
          Open Browse to connect mail, calendar, docs, chat, code, web, routines, and workspace
          files.
        </p>
        <${Button}
          as="a"
          href=${appScopedPath('/extensions/registry')}
          variant="primary"
          size="sm"
          className="mt-4 min-h-[44px] px-3.5"
        >
          Browse apps
        <//>
      </section>
    `;
  }

  // Readiness-grouped: connectors that need the user sit in one focal zone at
  // the top; healthy connectors sit quietly below. A failed connector never
  // shares an altitude with a healthy one.
  const { needsYou, healthy } = groupByReadiness(extensions);

  return html`
    <div className="space-y-8">
      ${needsYou.length > 0 &&
      html`
        <section>
          <div className="v2-text-label text-[var(--v2-warning-text)]">Needs you</div>
          <${ConnectorRows}
            items=${needsYou}
            onActivate=${onActivate}
            onConfigure=${onConfigure}
            onRemove=${onRemove}
            isBusy=${isBusy}
          />
        </section>
      `}
      ${healthy.length > 0 &&
      html`
        <section>
          <div className="v2-text-label">Connected apps</div>
          <${ConnectorRows}
            items=${healthy}
            onActivate=${onActivate}
            onConfigure=${onConfigure}
            onRemove=${onRemove}
            isBusy=${isBusy}
          />
        </section>
      `}
    </div>
  `;
}
