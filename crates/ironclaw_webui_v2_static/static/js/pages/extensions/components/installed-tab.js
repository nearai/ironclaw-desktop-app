import { html } from '../../../lib/html.js';
import { Button } from '../../../design-system/button.js';
import { ExtensionCard } from './extension-card.js';

function packageId(ext) {
  return ext.package_ref?.id || '';
}

export function InstalledTab({ extensions, onActivate, onConfigure, onRemove, isBusy }) {
  if (extensions.length === 0) {
    return html`
      <div className="v2-panel rounded-[18px] p-6 sm:p-8">
        <h3 className="text-lg font-semibold text-white">No apps connected yet</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-iron-300">
          Open Browse to connect Gmail, Google Calendar, Notion, Slack, or local workspace files.
        </p>
        <${Button} as="a" href="/extensions/registry" variant="primary" size="sm" className="mt-4">
          Browse apps
        <//>
      </div>
    `;
  }

  return html`
    <div className="v2-panel rounded-[18px] p-5 sm:p-6">
      <h3 className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-signal">
        Connected apps
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
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
    </div>
  `;
}
