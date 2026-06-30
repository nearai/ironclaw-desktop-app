import { Icon } from '../../../design-system/icons.js';
import { React, html } from '../../../lib/html.js';
import { cn } from '../../../utils/cn.js';
import {
  MEMORY_SCOPES,
  readMemoryPrefs,
  saveMemoryPref,
  removeMemoryPref
} from '../lib/workbench-memory-store.js';
import { readDismissals, learnedSenderSummary } from '../lib/workbench-dismissals.js';

const MEMORY_STYLE = `
.wb13-memory-list { display: flex; flex-direction: column; gap: 8px; }
.wb13-memory-item .wb13-card-copy { color: var(--wb-faint); text-transform: none; }
.wb13-learned-reasons { color: var(--wb-faint); text-transform: none; font-size: 12px; }
`;

// User-controlled memory — a REAL preference store. Saving persists to the browser
// (localStorage via workbench-memory-store), survives reload, and lists what's saved
// with a Forget control. Nothing is sent. Styled on the wb13 (Direction B) tokens.
//
// Also surfaces what the Workbench has LEARNED on its own: senders it auto-muted after the
// user filed them away repeatedly (learnedSenderSummary), each with a Restore. This makes the
// existing learning visible + reversible — it adds no new suppression. dismissals/onClearSender
// come from the page so a Restore reactively un-mutes; falls back to readDismissals() standalone.
export function MemoryView({ dismissals, onClearSender } = {}) {
  const [text, setText] = React.useState('');
  const [scope, setScope] = React.useState('Personal');
  const [prefs, setPrefs] = React.useState(() => readMemoryPrefs());
  const canSave = Boolean(text.trim());
  const learned = learnedSenderSummary(dismissals || readDismissals());

  const onSave = () => {
    if (!canSave) return;
    setPrefs(saveMemoryPref({ text, scope }));
    setText('');
  };
  const onRemove = (id) => setPrefs(removeMemoryPref(id));

  return html`
    <main className="wb13-main" data-testid="workbench-memory">
      <style>
        ${MEMORY_STYLE}
      </style>
      <div className="wb13-page">
        <div className="wb13-wrap">
          <div className="wb13-head">
            <h1>Save a preference?</h1>
            <span className="meta">User controlled memory</span>
          </div>
          <section className="wb13-group">
            <div className="wb13-read">
              <p>
                The Workbench applies these to how it drafts, surfaces, and prepares your work.
                Saved on this device — nothing is sent.
              </p>
            </div>
          </section>
          <section className="wb13-group">
            <div className="wb13-kicker">New preference</div>
            <textarea
              className="wb13-approve-textarea"
              data-testid="workbench-memory-input"
              rows="2"
              placeholder="e.g. Show sources before any external draft leaves"
              aria-label="Preference to remember"
              value=${text}
              onInput=${(event) => setText(event.currentTarget.value)}
            ></textarea>
            <div className="wb13-chips" role="radiogroup" aria-label="Memory scope">
              ${MEMORY_SCOPES.map(
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
            <button
              type="button"
              className="wb13-button is-primary"
              data-testid="workbench-memory-save"
              disabled=${!canSave}
              onClick=${onSave}
            >
              Save preference
            </button>
          </section>
          ${prefs.length
            ? html`<section className="wb13-group">
                <div className="wb13-kicker">Saved preferences · ${prefs.length}</div>
                <div className="wb13-memory-list" data-testid="workbench-memory-list">
                  ${prefs.map(
                    (pref) => html`
                      <div key=${pref.id} className="wb13-card wb13-memory-item">
                        <div className="wb13-action-icon is-hold"><${Icon} name="pin" /></div>
                        <div className="wb13-card-main">
                          <div className="wb13-card-title">${pref.text}</div>
                          <div className="wb13-card-copy">${pref.scope}</div>
                        </div>
                        <button
                          type="button"
                          className="wb13-button is-sm"
                          aria-label=${`Forget: ${pref.text}`}
                          onClick=${() => onRemove(pref.id)}
                        >
                          Forget
                        </button>
                      </div>
                    `
                  )}
                </div>
              </section>`
            : null}
          <section className="wb13-group" data-testid="workbench-memory-learned">
            <div className="wb13-kicker">
              Learned from your dismissals${learned.length ? ` · ${learned.length}` : ''}
            </div>
            <div className="wb13-read">
              <p>
                When you file the same sender away a few times, the Workbench stops surfacing them
                in triage. Here is what it muted on its own — restore any whenever you want.
              </p>
            </div>
            ${learned.length
              ? html`<div className="wb13-memory-list" data-testid="workbench-memory-learned-list">
                  ${learned.map(
                    (row) => html`
                      <div key=${row.sender} className="wb13-card wb13-memory-item">
                        <div className="wb13-action-icon is-hold"><${Icon} name="shield" /></div>
                        <div className="wb13-card-main">
                          <div className="wb13-card-title">${row.sender}</div>
                          <div className="wb13-learned-reasons">
                            Muted after ${row.count}
                            ${row.count === 1 ? 'dismissal' : 'dismissals'}${row.reasons.length
                              ? ` · ${row.reasons.join(', ')}`
                              : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="wb13-button is-sm"
                          data-testid="workbench-memory-restore"
                          aria-label=${`Restore ${row.sender}`}
                          onClick=${() =>
                            typeof onClearSender === 'function' && onClearSender(row.sender)}
                        >
                          Restore
                        </button>
                      </div>
                    `
                  )}
                </div>`
              : html`<div className="wb13-read">
                  <p className="wb13-learned-reasons">
                    Nothing muted yet. File a chatty sender "Not relevant" a couple of times and
                    they will show up here to confirm or restore.
                  </p>
                </div>`}
          </section>
        </div>
      </div>
    </main>
  `;
}
