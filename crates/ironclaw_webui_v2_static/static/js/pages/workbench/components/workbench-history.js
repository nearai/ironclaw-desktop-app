import { Icon } from '../../../design-system/icons.js';
import { html } from '../../../lib/html.js';
import { useThreads } from '../../chat/hooks/useThreads.js';
import { readThreadTitles, threadDisplayTitle } from '../lib/workbench-thread-titles.js';

// Compact relative time for a thread's last activity. Honest-empty on an unparseable time.
function threadWhen(iso) {
  const ms = Date.parse(iso || '');
  if (!Number.isFinite(ms)) return '';
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  try {
    return new Date(ms).toLocaleDateString();
  } catch (_) {
    return '';
  }
}

function threadMeta(thread) {
  const turns = Number(thread.turn_count || 0);
  return [turns ? `${turns} turn${turns === 1 ? '' : 's'}` : null, threadWhen(thread.updated_at)]
    .filter(Boolean)
    .join(' · ');
}

// Conversation history: every Ask runs on a durable thread, so this lists past threads and
// reopens one back into the Workbench run surface (which is a pure function of threadId) —
// no hand-off to the desktop chat, no lost context. Honest about loading / error / empty so
// "still loading" and "couldn't load" never collapse into a false "nothing here".
export function HistoryView({ onReopen }) {
  const { threads, isLoading, isError, refetch } = useThreads();
  const rows = Array.isArray(threads) ? threads : [];
  // Prefer the clean brief we remembered locally over the gateway's scaffold-derived title.
  const titles = readThreadTitles();
  return html`
    <main className="wb13-main">
      <div className="wb13-page">
        <div className="wb13-wrap">
          <div className="wb13-head"><h1>Conversations</h1></div>
          ${isError
            ? html`<div className="wb13-allclear" data-testid="workbench-history-error">
                Couldn't load your conversations.
                <button type="button" className="wb13-button is-sm" onClick=${() => refetch()}>
                  Retry
                </button>
              </div>`
            : isLoading
              ? html`<div className="wb13-allclear">Loading your conversations…</div>`
              : !rows.length
                ? html`<div className="wb13-allclear" data-testid="workbench-history-empty">
                    No conversations yet. Anything you Ask in the Workbench shows up here.
                  </div>`
                : html`<div className="wb13-section wb13-list" data-testid="workbench-history-list">
                    ${rows.map(
                      (thread) =>
                        html`<button
                          key=${thread.id}
                          type="button"
                          className="wb13-card wb13-card-readable"
                          data-testid="workbench-history-row"
                          onClick=${() => typeof onReopen === 'function' && onReopen(thread)}
                        >
                          <div className="wb13-card-main">
                            <div className="wb13-card-title">
                              ${threadDisplayTitle(thread, titles)}
                            </div>
                            ${threadMeta(thread)
                              ? html`<div className="wb13-card-copy">${threadMeta(thread)}</div>`
                              : null}
                          </div>
                          <span className="wb13-button is-sm"><${Icon} name="pulse" /> Open</span>
                        </button>`
                    )}
                  </div>`}
        </div>
      </div>
    </main>
  `;
}
