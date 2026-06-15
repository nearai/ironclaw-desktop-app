import { React } from '../../../lib/html.js';

// Pure matcher: the ids of loaded messages whose text contains the query,
// case-insensitive, in render order. Extracted so the match logic is unit
// testable without a DOM. Empty/blank query matches nothing.
export function threadFindMatches(messages, query) {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  if (!q) return [];
  return (messages || [])
    .filter((m) => m && typeof m.content === 'string' && m.content.toLowerCase().includes(q))
    .map((m) => m.id);
}

function prefersReducedMotion() {
  return Boolean(
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function escapeSelectorValue(value) {
  if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
  return String(value).replace(/["\\]/g, '\\$&');
}

// In-thread find (Cmd/Ctrl+F). Searches the already-loaded message text — no
// network — and scrolls/rings the matched message. "Search earlier messages"
// pages the timeline via the existing cursor so a phrase paged out of view is
// still reachable. Nothing here implies server-side search the gateway lacks.
export function useThreadFind({ messages, containerRef, hasMore, onLoadMore }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [index, setIndex] = React.useState(0);

  const matchIds = React.useMemo(() => threadFindMatches(messages, query), [messages, query]);

  // Keep the cursor in range as matches change (new query, paged-in history).
  React.useEffect(() => {
    setIndex((i) => (matchIds.length === 0 ? 0 : Math.min(i, matchIds.length - 1)));
  }, [matchIds.length]);

  const activeMatchId = matchIds.length ? matchIds[Math.min(index, matchIds.length - 1)] : null;

  // Scroll the active match into view (centered, motion-respecting).
  React.useEffect(() => {
    if (!open || !activeMatchId) return undefined;
    const root = containerRef && containerRef.current;
    if (!root) return undefined;
    const el = root.querySelector(`[data-message-id="${escapeSelectorValue(activeMatchId)}"]`);
    if (el) {
      el.scrollIntoView({
        block: 'center',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth'
      });
    }
    return undefined;
  }, [open, activeMatchId, containerRef]);

  const openFind = React.useCallback(() => setOpen(true), []);
  const close = React.useCallback(() => {
    setOpen(false);
    setQuery('');
    setIndex(0);
  }, []);
  const next = React.useCallback(() => {
    setIndex((i) => (matchIds.length ? (i + 1) % matchIds.length : 0));
  }, [matchIds.length]);
  const prev = React.useCallback(() => {
    setIndex((i) => (matchIds.length ? (i - 1 + matchIds.length) % matchIds.length : 0));
  }, [matchIds.length]);
  const searchEarlier = React.useCallback(() => {
    if (hasMore && onLoadMore) onLoadMore();
  }, [hasMore, onLoadMore]);

  React.useEffect(() => {
    const onKeyDown = (event) => {
      const key = String(event.key || '').toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === 'f') {
        event.preventDefault();
        setOpen(true);
      } else if (key === 'escape' && open) {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  return {
    open,
    query,
    setQuery,
    matchCount: matchIds.length,
    // 1-based position for display; 0 when there are no matches.
    currentIndex: matchIds.length ? index + 1 : 0,
    activeMatchId,
    hasMore: Boolean(hasMore),
    openFind,
    close,
    next,
    prev,
    searchEarlier
  };
}
