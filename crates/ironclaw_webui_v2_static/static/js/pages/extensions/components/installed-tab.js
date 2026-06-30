import { html } from '../../../lib/html.js';
import { Button } from '../../../design-system/button.js';
import { CardLabel } from '../../../design-system/card.js';
import { appScopedPath } from '../../../lib/app-path.js';
import { ExtensionCard } from './extension-card.js';

function packageId(ext) {
  return ext.package_ref?.id || '';
}

export function InstalledTab({ extensions, onActivate, onConfigure, onRemove, isBusy }) {
  if (extensions.length === 0) {
    return html`
      <div className="max-w-md py-2">
        <h3 className="text-lg font-semibold text-[var(--v2-text-strong)]">
          No apps connected yet
        </h3>
        <p className="mt-2 text-sm leading-6 text-[var(--v2-text-muted)]">
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
      </div>
    `;
  }

  return html`
    <section>
      <${CardLabel}>Connected apps<//>
      <div className="mt-2 grid grid-cols-1">
        ${extensions.map(
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
  `;
}
