import { Icon } from '../../../design-system/icons.js';
import { React, html } from '../../../lib/html.js';
import { cn } from '../../../utils/cn.js';

export function MemoryView() {
  const [scope, setScope] = React.useState('');
  return html`
    <main className="wb13-main" data-testid="workbench-memory">
      <div className="wb13-page">
        <div className="wb13-wrap">
          <div className="wb13-head">
            <h1>Save a preference?</h1>
            <span className="meta">User controlled memory</span>
          </div>
          <section className="wb13-group">
            <div className="wb13-read">
              <p>
                IronClaw can learn lightweight preferences from repeated corrections, but durable
                memory should be scoped and approved.
              </p>
            </div>
          </section>
          <section className="wb13-group">
            <div className="wb13-kicker">Example preference</div>
            <div className="wb13-card">
              <div className="wb13-action-icon is-hold"><${Icon} name="pin" /></div>
              <div className="wb13-card-main">
                <div className="wb13-card-title">Show sources before external drafts leave</div>
                <div className="wb13-card-copy">
                  Applies to briefs, replies, updates, and prepared documents when you choose a
                  scope.
                </div>
              </div>
            </div>
          </section>
          <section className="wb13-group">
            <div className="wb13-kicker">Choose a scope</div>
            <div className="wb13-chips" role="radiogroup" aria-label="Memory scope">
              ${['Personal', 'Workspace', 'This project', 'This source'].map(
                (value) => html`
                  <button
                    key=${value}
                    type="button"
                    role="radio"
                    aria-checked=${scope === value}
                    className=${cn('wb13-chip', scope === value && 'is-active')}
                    onClick=${() => setScope(value)}
                  >
                    ${value}
                  </button>
                `
              )}
            </div>
          </section>
          <button type="button" className="wb13-button is-primary" disabled>Save preference</button>
          <div className="wb13-inspector-note">
            Preference saving is shown as a review pattern only until a writable memory backend is
            available.
          </div>
        </div>
      </div>
    </main>
  `;
}
