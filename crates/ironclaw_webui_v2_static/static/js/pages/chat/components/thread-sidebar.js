import { Icon } from '../../../design-system/icons.js';
import { html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function ThreadSidebar({
  threads,
  activeThreadId,
  onSelect,
  onCreate,
  isCreating,
  compact = false
}) {
  const t = useT();
  const canCreate = !(
    activeThreadId && threads.some((t) => t.id === activeThreadId && (t.turn_count || 0) === 0)
  );
  const createDisabled = isCreating || !canCreate;

  if (compact) {
    return html`
      <div className="flex items-center gap-2">
        <button
          onClick=${onCreate}
          disabled=${createDisabled}
          className="v2-button h-9 shrink-0 rounded-[8px] border border-transparent bg-transparent px-3 text-xs font-medium text-[var(--v2-text-muted)] hover:bg-[var(--v2-surface-muted)] hover:text-[var(--v2-text-strong)] disabled:opacity-50"
        >
          ${isCreating ? t('chat.creating') : t('chat.newThread')}
        </button>
        <select
          value=${activeThreadId || ''}
          onChange=${(event) => onSelect(event.target.value || null)}
          className="v2-select h-9 min-w-0 flex-1 rounded-[8px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] px-3 text-sm text-[var(--v2-text-strong)] outline-none focus:border-[color-mix(in_srgb,var(--v2-accent)_60%,var(--v2-panel-border))]"
        >
          <option value="">${t('chat.selectConversation')}</option>
          ${threads.map(
            (thread) => html`
              <option key=${thread.id} value=${thread.id}>
                ${thread.title || `Thread ${thread.id.slice(0, 8)}`}
              </option>
            `
          )}
        </select>
      </div>
    `;
  }

  return html`
    <div
      className="flex h-full flex-col border-r border-[var(--v2-panel-border)] bg-[var(--v2-surface)]"
    >
      <div
        className="flex items-center justify-between border-b border-[var(--v2-panel-border)] px-5 py-5"
      >
        <div>
          <span className="text-sm font-semibold text-[var(--v2-text-strong)]"
            >${t('chat.conversations')}</span
          >
          <p className="mt-1 text-[13px] font-medium text-[var(--v2-text-muted)] tabular-nums">
            ${t('chat.threads', { count: threads.length })}
          </p>
        </div>
        <button
          onClick=${onCreate}
          disabled=${createDisabled}
          className="v2-button inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-transparent bg-transparent px-2 text-xs font-medium text-[var(--v2-text-muted)] hover:bg-[var(--v2-surface-muted)] hover:text-[var(--v2-text-strong)] disabled:opacity-50"
        >
          ${isCreating
            ? t('chat.creating')
            : html`<${Icon} name="plus" className="h-3.5 w-3.5" /> ${t('chat.newThread')}`}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        ${threads.length === 0 &&
        html`<div
          className="mx-2 mt-3 px-2 py-7 text-left text-xs leading-5 text-[var(--v2-text-muted)]"
        >
          ${t('chat.noConversations')}
        </div>`}
        ${threads.map((thread) => {
          const active = thread.id === activeThreadId;
          return html`
            <button
              key=${thread.id}
              onClick=${() => onSelect(thread.id)}
              className=${[
                'v2-button mb-0.5 flex w-full justify-start items-start flex-col gap-1 rounded-[8px] px-3 py-2.5 text-left',
                active
                  ? 'bg-[var(--v2-accent-soft)] text-[var(--v2-accent-text)]'
                  : 'text-[var(--v2-text)] hover:bg-[var(--v2-surface-muted)]'
              ].join(' ')}
            >
              <div className="flex w-full items-center gap-2">
                <span
                  className="truncate max-w-[150px] text-sm font-medium text-[var(--v2-text-strong)]"
                >
                  ${thread.title || `Thread ${thread.id.slice(0, 8)}`}
                </span>
                ${thread.state === 'Processing' &&
                html`<span
                  className="v2-breathing-dot ml-auto h-2 w-2 rounded-full bg-[var(--v2-accent)]"
                />`}
              </div>
              <div
                className="flex items-center gap-2 text-[11px] text-[var(--v2-text-faint)] tabular-nums"
              >
                <span>${t('chat.turns', { count: thread.turn_count || 0 })}</span>
                <span>·</span>
                <span>${formatTime(thread.updated_at)}</span>
              </div>
            </button>
          `;
        })}
      </div>
    </div>
  `;
}
