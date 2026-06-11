import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Icon } from '../../../design-system/icons.js';
import { React, html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';
import { ChatInput } from './chat-input.js';

// Anticipation over interrogation: the front door greets by time of day,
// offers the threads you were just working in, and showcases tasks the app
// can genuinely finish today (document summarize / draft / spreadsheet
// analysis — all backed by the client-side extractors). Suggestion clicks
// PREFILL the composer rather than firing blind, since two of the three
// start with attaching a file.
function greetingKey() {
  const hour = new Date().getHours();
  if (hour < 12) return 'chat.heroMorning';
  if (hour < 18) return 'chat.heroAfternoon';
  return 'chat.heroEvening';
}

function relativeAge(iso, t) {
  const stamp = Date.parse(iso || '');
  if (!Number.isFinite(stamp)) return '';
  const minutes = Math.max(1, Math.round((Date.now() - stamp) / 60_000));
  if (minutes < 60) return t('chat.resumeMinutes', { n: String(minutes) });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('chat.resumeHours', { n: String(hours) });
  return t('chat.resumeDays', { n: String(Math.round(hours / 24)) });
}

export function EmptyState({
  onSuggestion: _onSuggestion,
  onSend,
  disabled,
  initialText,
  resetKey,
  context,
  statusText,
  canCancel,
  onCancel
}) {
  const t = useT();
  // Reads the cached threads list (loaded by the sidebar); no extra traffic.
  const threadsQuery = useQuery({ queryKey: ['threads'], enabled: false });
  const recentThreads = (threadsQuery.data?.threads || [])
    .filter((thread) => thread?.thread_id && (thread.title || '').trim())
    .slice(0, 3);

  const [draft, setDraft] = React.useState('');
  const [draftKey, setDraftKey] = React.useState(0);
  const prefill = (text) => {
    setDraft(text);
    setDraftKey((key) => key + 1);
  };

  const suggestions = [
    {
      icon: 'file',
      title: t('chat.suggestion1'),
      detail: t('chat.suggestion1Desc'),
      prompt: t('chat.suggestion1Prompt')
    },
    {
      icon: 'send',
      title: t('chat.suggestion2'),
      detail: t('chat.suggestion2Desc'),
      prompt: t('chat.suggestion2Prompt')
    },
    {
      icon: 'pulse',
      title: t('chat.suggestion3'),
      detail: t('chat.suggestion3Desc'),
      prompt: t('chat.suggestion3Prompt')
    }
  ];

  return html`
    <div
      className="v2-page-entrance flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8 sm:px-8 lg:px-12"
    >
      <div className="w-full max-w-5xl text-center">
        <h2
          className="mx-auto max-w-[28ch] text-[28px] font-semibold leading-[1.2] tracking-[-0.01em] text-[var(--v2-text-strong)]"
        >
          ${t(greetingKey())}
        </h2>
        <p
          className="mx-auto mt-2 max-w-[56ch] text-sm leading-relaxed text-[var(--v2-text-muted)]"
        >
          ${t('chat.heroDesc')}
        </p>
      </div>

      <div className="mt-8 w-full max-w-5xl">
        <${ChatInput}
          onSend=${onSend}
          disabled=${disabled}
          initialText=${draft || initialText}
          resetKey=${`${resetKey}-${draftKey}`}
          variant="hero"
          context=${context}
          statusText=${statusText}
          canCancel=${canCancel}
          onCancel=${onCancel}
        />
      </div>

      ${recentThreads.length > 0 &&
      html`
        <div className="mt-7 w-full max-w-5xl">
          <div
            className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--v2-text-faint)]"
          >
            ${t('chat.resumeHeading')}
          </div>
          <div className="flex flex-wrap gap-2">
            ${recentThreads.map(
              (thread) => html`
                <${Link}
                  key=${thread.thread_id}
                  to=${`/chat/${thread.thread_id}`}
                  className="group inline-flex max-w-[24rem] items-center gap-2 rounded-full border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] px-3 py-1.5 text-sm text-[var(--v2-text)] hover:border-[color-mix(in_srgb,var(--v2-accent)_45%,var(--v2-panel-border))] hover:text-[var(--v2-accent-text)]"
                >
                  <${Icon} name="chat" className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="truncate">${thread.title}</span>
                  ${thread.updated_at &&
                  html`<span className="shrink-0 text-xs text-[var(--v2-text-faint)]">
                    ${relativeAge(thread.updated_at, t)}
                  </span>`}
                <//>
              `
            )}
          </div>
        </div>
      `}

      <div className="mt-7 grid w-full max-w-5xl gap-2">
        ${suggestions.map(
          (item) => html`
            <button
              type="button"
              key=${item.title}
              onClick=${() => prefill(item.prompt)}
              className="v2-button group grid grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-[var(--v2-panel-border)] px-2 py-4 text-left hover:border-[color-mix(in_srgb,var(--v2-accent)_45%,var(--v2-panel-border))]"
            >
              <span
                className="grid h-8 w-8 place-items-center rounded-full border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] text-[var(--v2-text-muted)] group-hover:border-[var(--v2-accent)] group-hover:text-[var(--v2-accent-text)]"
              >
                <${Icon} name=${item.icon} className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--v2-text-strong)]">
                  ${item.title}
                </span>
                <span className="mt-0.5 block text-sm text-[var(--v2-text-muted)]">
                  ${item.detail}
                </span>
              </span>
              <span
                className="text-xs font-medium text-[var(--v2-text-faint)] opacity-0 transition-opacity group-hover:opacity-100"
              >
                ${t('chat.suggestionUse')}
              </span>
            </button>
          `
        )}
      </div>
    </div>
  `;
}
