import { React, html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';
import { ActivityRun } from './activity-run.js';
import { MessageBubble } from './message-bubble.js';
import { ThreadFindBar } from './thread-find-bar.js';
import { Icon } from '../../../design-system/icons.js';
import { groupMessages } from '../lib/message-groups.js';
import { useThreadFind } from '../hooks/useThreadFind.js';

function messageListScrollClass() {
  return 'flex flex-1 overflow-y-auto px-4 pb-24 pt-6 sm:px-5 sm:pb-28 lg:px-8';
}

function messageListContentClass() {
  return 'mx-auto flex w-full max-w-5xl flex-col gap-5';
}

function jumpToLatestClass() {
  return 'absolute bottom-0 left-1/2 z-20 inline-flex -translate-x-1/2 translate-y-1/2 items-center gap-1.5 rounded-full border border-[var(--v2-panel-border)] bg-[var(--v2-surface)] px-3 py-1.5 text-xs font-medium text-[var(--v2-text-strong)] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)] hover:border-[color-mix(in_srgb,var(--v2-accent)_40%,var(--v2-panel-border))]';
}

export function MessageList({
  messages,
  isLoading,
  hasMore,
  onLoadMore,
  onRetryMessage,
  threadId,
  children
}) {
  const t = useT();
  const containerRef = React.useRef(null);
  const shouldScrollRef = React.useRef(true);
  // Set just before requesting an older page so the post-insert layout effect can
  // restore the read position instead of letting the prepend jump the viewport.
  const prependAnchorRef = React.useRef(null);
  const [atBottom, setAtBottom] = React.useState(true);

  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // An older page was just prepended: keep the previously-read content under the
    // user's eyes by adding the height the prepend introduced. This takes
    // precedence over autoscroll, which only ever fires when already near bottom.
    const anchor = prependAnchorRef.current;
    if (anchor != null) {
      prependAnchorRef.current = null;
      el.scrollTop += el.scrollHeight - anchor;
      return;
    }
    if (!shouldScrollRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const requestLoadMore = React.useCallback(() => {
    const el = containerRef.current;
    // Capture the scroll height before the older page lands so the layout effect
    // can offset scrollTop by exactly the height the prepend added.
    if (el) prependAnchorRef.current = el.scrollHeight;
    // If the page never lands (fetch rejects, or it dedupes to the same message
    // array so the layout effect never re-runs), clear the anchor — otherwise a
    // later bottom-append would consume the stale offset and suppress autoscroll.
    Promise.resolve(onLoadMore?.()).catch(() => {
      prependAnchorRef.current = null;
    });
  }, [onLoadMore]);

  const onScroll = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 100;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldScrollRef.current = distance < threshold;
    setAtBottom(distance < threshold);

    if (hasMore && el.scrollTop < threshold && onLoadMore && !isLoading) {
      requestLoadMore();
    }
  }, [hasMore, onLoadMore, isLoading, requestLoadMore]);

  const jumpToBottom = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    shouldScrollRef.current = true;
    setAtBottom(true);
  }, []);

  const grouped = React.useMemo(() => groupMessages(messages), [messages]);
  const find = useThreadFind({ messages, containerRef, hasMore, onLoadMore });

  return html`
    <div className="relative flex min-h-0 flex-1">
      ${find.open &&
      html`<${ThreadFindBar}
        query=${find.query}
        onQueryChange=${find.setQuery}
        matchCount=${find.matchCount}
        currentIndex=${find.currentIndex}
        onNext=${find.next}
        onPrev=${find.prev}
        onClose=${find.close}
        hasMore=${find.hasMore}
        onSearchEarlier=${find.searchEarlier}
      />`}
      <div
        ref=${containerRef}
        onScroll=${onScroll}
        className=${messageListScrollClass()}
        data-testid="chat-message-scroll"
      >
        <div className=${messageListContentClass()} data-testid="chat-message-content">
          ${hasMore &&
          html`
            <div className="text-center">
              <button
                onClick=${requestLoadMore}
                disabled=${isLoading}
                className="v2-button rounded-[8px] border border-[var(--v2-panel-border)] px-3 py-1.5 text-xs text-[var(--v2-text-muted)] hover:border-[color-mix(in_srgb,var(--v2-accent)_38%,var(--v2-panel-border))] hover:text-[var(--v2-text-strong)] disabled:opacity-50"
              >
                ${isLoading ? t('chat.history.loading') : t('chat.history.loadOlder')}
              </button>
            </div>
          `}
          ${grouped.map((item) =>
            item.type === 'activity-run'
              ? html`<${ActivityRun} key=${item.id} activity=${item.activity} />`
              : html`<div
                  key=${item.id}
                  data-message-id=${item.id}
                  aria-current=${find.activeMatchId === item.id ? 'true' : undefined}
                  className=${find.activeMatchId === item.id
                    ? 'scroll-mt-20 rounded-[14px] ring-2 ring-[var(--v2-accent)] ring-offset-2 ring-offset-[var(--v2-canvas)]'
                    : 'scroll-mt-20'}
                >
                  <${MessageBubble}
                    message=${item.message}
                    messages=${messages}
                    onRetry=${onRetryMessage}
                    threadId=${threadId}
                  />
                </div>`
          )}
          ${children}
        </div>
      </div>
      ${!atBottom &&
      html`
        <button
          type="button"
          onClick=${jumpToBottom}
          aria-label=${t('chat.jumpToLatest')}
          className=${jumpToLatestClass()}
          data-testid="chat-jump-to-latest"
        >
          <${Icon} name="arrowDown" className="h-3.5 w-3.5" />
          ${t('chat.jumpToLatest')}
        </button>
      `}
    </div>
  `;
}
