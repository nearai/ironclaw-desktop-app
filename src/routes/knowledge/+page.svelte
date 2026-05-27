<script lang="ts">
  // Knowledge browser: left tree rail + right detail pane with search.
  //
  // State ownership lives here so the search bar can clear results and
  // restore the tree-selection view in one place. Tree node expansion
  // state is owned per-row by TreeNode itself unless we drive an
  // expand-all / collapse-all via the `forceExpanded` prop (set to true
  // or false, then reset to null on the next tick so individual rows can
  // toggle again).
  //
  // Recent docs, bookmarks, and search history all persist to
  // localStorage. Storage failures degrade silently — the page works in
  // private-browsing mode, just without persistence.

  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { connection } from '$lib/stores/connection.svelte';
  import { toasts } from '$lib/stores/toasts.svelte';
  import type { IronClawClient } from '$lib/api/ironclaw';
  import type { MemoryHit, MemoryNode } from '$lib/api/types';
  import TreeNode from './TreeNode.svelte';
  import SearchBar from './SearchBar.svelte';
  import SearchResults from './SearchResults.svelte';
  import DocViewer from './DocViewer.svelte';
  import NewDocModal, { validateMemoryPath } from './NewDocModal.svelte';
  import ResizeHandle from '$lib/components/ResizeHandle.svelte';

  // ---- Tree-rail width (drag-to-resize) ------------------------------------
  //
  // The tree rail is user-resizable via a `ResizeHandle` strip in the gap
  // between the rail and the doc viewer. Width persists across reloads
  // via localStorage. Below `NARROW_VIEWPORT_PX` the handle is hidden
  // and the rail snaps back to its default — the doc viewer needs the
  // breathing room more than the rail needs custom widths at small sizes.
  const TREE_RAIL_DEFAULT = 320;
  const TREE_RAIL_MIN = 240;
  const TREE_RAIL_MAX = 500;
  const NARROW_VIEWPORT_PX = 900;
  const TREE_RAIL_STORAGE_KEY = 'ironclaw-knowledge-tree-width';

  let treeRailWidth = $state<number>(TREE_RAIL_DEFAULT);
  let viewportWidth = $state<number>(
    typeof window === 'undefined' ? 1280 : window.innerWidth
  );
  const resizeEnabled = $derived(viewportWidth >= NARROW_VIEWPORT_PX);
  const effectiveTreeRailWidth = $derived(
    resizeEnabled ? treeRailWidth : TREE_RAIL_DEFAULT
  );

  // ---- localStorage keys / caps ---------------------------------------------
  const RECENT_KEY = 'ironclaw-knowledge-recent';
  const BOOKMARKS_KEY = 'ironclaw-knowledge-bookmarks';
  const SEARCH_HISTORY_KEY = 'ironclaw-knowledge-search-history';
  const RECENT_MAX = 12;
  const SEARCH_HISTORY_MAX = 10;

  // ---- Tree state ----
  let rootNodes = $state<MemoryNode[]>([]);
  let rootLoading = $state(false);
  let rootError = $state<string | null>(null);
  /**
   * Controlled tree-wide expansion override.
   *
   * - `true`  → expand-all triggered; every TreeNode opens itself.
   * - `false` → collapse-all triggered; every TreeNode closes itself.
   * - `null`  → each TreeNode owns its own state.
   *
   * Flipped to true/false by the toolbar buttons, then reset to null on
   * the next tick so per-row clicks resume working. The reset is what
   * makes this a one-shot pulse rather than a persistent lock.
   */
  let forceExpanded = $state<boolean | null>(null);

  // ---- Selected doc state ----
  let selectedPath = $state<string | null>(null);
  let selectedContent = $state<string>('');
  let docLoading = $state(false);
  let docError = $state<string | null>(null);

  // ---- Search state ----
  // We track the *committed* query separately from the raw input so the
  // results header stays stable across keystrokes (debounce drops new
  // values into committedQuery once the timer fires).
  let inputValue = $state('');
  let committedQuery = $state('');
  let searchResults = $state<MemoryHit[]>([]);
  let searchPending = $state(false);
  let searchError = $state<string | null>(null);
  /** Last N distinct queries, MRU first. */
  let searchHistory = $state<string[]>([]);

  // ---- Recent docs + bookmarks ----------------------------------------------
  /** Recently opened doc paths, MRU first. */
  let recentPaths = $state<string[]>([]);
  /** Map of recentPath → timestamp (ms) for "opened 3m ago" labels. */
  let recentOpenedAt = $state<Record<string, number>>({});
  /** Bookmarked doc paths. Order is insertion order. */
  let bookmarks = $state<string[]>([]);
  /** Derived Set so TreeNode + indicator lookups are O(1). */
  const bookmarkSet = $derived(new Set(bookmarks));

  /** Collapsible UI state for the two rail sections. */
  let recentOpen = $state(true);
  let bookmarksOpen = $state(true);

  /** "now" tick used to recompute relative-time labels every minute. */
  let nowMs = $state(Date.now());

  // ---- Context menu state ----------------------------------------------------
  interface CtxMenuState {
    path: string;
    type: 'file' | 'dir';
    x: number;
    y: number;
  }
  let ctxMenu = $state<CtxMenuState | null>(null);

  // ---- New-doc modal state ----
  // Modal is mounted only while `newDocOpen` is true so its inputs are
  // freshly seeded on every open. No reset logic needed.
  let newDocOpen = $state(false);

  // Strictly a UI flag: true once we've fired at least one search for
  // the current query. Lets us distinguish "no results" from "didn't
  // search yet".
  const hasActiveSearch = $derived(committedQuery.trim().length > 0);

  // Stash the client into a local $derived so we don't pass `connection`
  // through to children — they only need the IronClawClient.
  const client = $derived(connection.client);

  /** Is the currently-selected doc bookmarked? Drives the star fill state. */
  const selectedBookmarked = $derived(
    selectedPath !== null && bookmarkSet.has(selectedPath)
  );

  onMount(async () => {
    hydratePersisted();
    // Hydrate the tree-rail width from localStorage. ResizeHandle pushes
    // the value back on its own mount too, but reading here lets the
    // first paint use the persisted width without a flash.
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(TREE_RAIL_STORAGE_KEY);
        const parsed = raw === null ? NaN : Number.parseInt(raw, 10);
        if (Number.isFinite(parsed)) {
          treeRailWidth = Math.min(
            Math.max(parsed, TREE_RAIL_MIN),
            TREE_RAIL_MAX
          );
        }
      }
    } catch {
      // ignore — defaults stand.
    }
    // Capture deep-link target *before* any async work so a slow connection
    // init doesn't race with a URL-param mutation from elsewhere.
    const deepLinkPath = page.url.searchParams.get('path');
    // The sidebar mounts first and calls connection.init(), but if the
    // user navigates directly to /knowledge with a still-connecting
    // client we wait one tick to give it a chance.
    if (!connection.client) {
      await connection.init();
    }
    await loadRoot();
    // If we arrived with `?path=<encoded>` from the CommandPalette, load
    // the requested doc into the viewer. The path is URL-decoded by the
    // searchParams getter, so we pass it straight through. We don't gate
    // on tree load — `openPath` only needs the client. Errors surface via
    // the existing toast inside `openPath`.
    if (deepLinkPath && client) {
      await openPath(deepLinkPath, client);
    }
    // Clear the deep-link param either way so a refresh doesn't keep
    // re-opening it and so Back doesn't return to the param-laden URL.
    if (deepLinkPath) clearPathParam();
  });

  /**
   * Strip the `?path=<encoded>` query param from the URL without
   * triggering a navigation reload. Mirrors the routines page approach.
   */
  function clearPathParam() {
    if (typeof window === 'undefined') return;
    if (!page.url.searchParams.has('path')) return;
    const url = new URL(page.url);
    url.searchParams.delete('path');
    const target = url.pathname + (url.search ? url.search : '') + url.hash;
    void goto(target, { replaceState: true, noScroll: true, keepFocus: true });
  }

  // Side-effects scoped to the page's lifetime: a minute-tick timer for
  // relative-time labels and the global listeners that dismiss the
  // context menu. Kept in $effect so the cleanup return is type-correct
  // (an async onMount can't return a cleanup function).
  $effect(() => {
    const tickTimer = setInterval(() => {
      nowMs = Date.now();
    }, 60_000);

    const onDocClick = () => {
      if (ctxMenu) ctxMenu = null;
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && ctxMenu) ctxMenu = null;
    };
    // Track viewport width so the resize handle can drop below the
    // narrow-viewport breakpoint. Listener is passive.
    const onResize = () => {
      viewportWidth = window.innerWidth;
    };
    viewportWidth = window.innerWidth;
    window.addEventListener('click', onDocClick);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);

    return () => {
      clearInterval(tickTimer);
      window.removeEventListener('click', onDocClick);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  });

  // If the user re-saves the gateway connection, re-fetch the tree.
  $effect(() => {
    if (connection.status === 'connected' && rootNodes.length === 0 && !rootLoading) {
      void loadRoot();
    }
  });

  async function loadRoot() {
    if (!client) {
      rootError = 'IronClaw client unavailable.';
      return;
    }
    rootLoading = true;
    rootError = null;
    try {
      const nodes = await client.listMemory();
      // Sort: directories first, then files, alphabetically within group.
      nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return basename(a.path).localeCompare(basename(b.path));
      });
      rootNodes = nodes;
    } catch (err) {
      rootError = (err as Error).message;
      toasts.show(`Failed to load knowledge tree: ${rootError}`, 'error');
    } finally {
      rootLoading = false;
    }
  }

  function basename(p: string): string {
    const trimmed = p.replace(/\/+$/, '');
    const idx = trimmed.lastIndexOf('/');
    return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
  }

  async function openPath(path: string, c: IronClawClient | null) {
    if (!c) return;
    selectedPath = path;
    docLoading = true;
    docError = null;
    selectedContent = '';
    // Stamp the open *before* the fetch so the UI updates instantly even
    // if the read hangs. We re-record on subsequent opens of the same path
    // so it stays at the top of the recent list with a fresh timestamp.
    recordRecent(path);
    try {
      const res = await c.readMemory(path);
      selectedContent = res.content;
    } catch (err) {
      docError = (err as Error).message;
      toasts.show(`Failed to load doc: ${docError}`, 'error');
    } finally {
      docLoading = false;
    }
  }

  async function onSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) {
      committedQuery = '';
      searchResults = [];
      searchError = null;
      return;
    }
    if (!client) return;
    committedQuery = trimmed;
    inputValue = trimmed;
    // Record successful commits (even before results land) so the dropdown
    // surfaces what the user actually typed, not what came back.
    recordSearchHistory(trimmed);
    searchPending = true;
    searchError = null;
    try {
      // Bump default limit slightly above the API's 10 so users see more
      // context without a "load more" affordance.
      searchResults = await client.searchMemory(trimmed, 20);
    } catch (err) {
      searchError = (err as Error).message;
      searchResults = [];
      toasts.show(`Search failed: ${searchError}`, 'error');
    } finally {
      searchPending = false;
    }
  }

  function clearSearch() {
    inputValue = '';
    committedQuery = '';
    searchResults = [];
    searchError = null;
  }

  // ---- Persistence helpers --------------------------------------------------

  /**
   * Hydrate recent/bookmarks/search-history from localStorage. Wrapped in
   * try/catch per key because the browser may have disabled storage
   * (private mode, quota error) or any single key may be corrupt; we
   * fall back to defaults rather than break the page.
   */
  function hydratePersisted() {
    if (typeof window === 'undefined') return;
    // Recent — wire shape is { v: 1, items: Array<{ path, openedAt }> }
    try {
      const raw = window.localStorage.getItem(RECENT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.v === 1 && Array.isArray(parsed.items)) {
          const paths: string[] = [];
          const stamps: Record<string, number> = {};
          for (const item of parsed.items) {
            if (item && typeof item.path === 'string' && typeof item.openedAt === 'number') {
              paths.push(item.path);
              stamps[item.path] = item.openedAt;
            }
          }
          recentPaths = paths.slice(0, RECENT_MAX);
          recentOpenedAt = stamps;
        }
      }
    } catch {
      // Corrupt; reset.
      recentPaths = [];
      recentOpenedAt = {};
    }
    // Bookmarks — wire shape is string[].
    try {
      const raw = window.localStorage.getItem(BOOKMARKS_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          bookmarks = arr.filter((s): s is string => typeof s === 'string');
        }
      }
    } catch {
      bookmarks = [];
    }
    // Search history — wire shape is string[].
    try {
      const raw = window.localStorage.getItem(SEARCH_HISTORY_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          searchHistory = arr
            .filter((s): s is string => typeof s === 'string')
            .slice(0, SEARCH_HISTORY_MAX);
        }
      }
    } catch {
      searchHistory = [];
    }
  }

  function saveRecent() {
    if (typeof window === 'undefined') return;
    try {
      const items = recentPaths.map((p) => ({
        path: p,
        openedAt: recentOpenedAt[p] ?? Date.now()
      }));
      window.localStorage.setItem(RECENT_KEY, JSON.stringify({ v: 1, items }));
    } catch {
      /* ignore */
    }
  }

  function saveBookmarks() {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
    } catch {
      /* ignore */
    }
  }

  function saveSearchHistory() {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory));
    } catch {
      /* ignore */
    }
  }

  /**
   * Push a path to the top of the recent list. Dedupes by removing any
   * earlier copy, then caps at RECENT_MAX. The stamp on the chosen path
   * is refreshed so the relative-time label resets.
   */
  function recordRecent(path: string) {
    const next = [path, ...recentPaths.filter((p) => p !== path)].slice(0, RECENT_MAX);
    // Prune stamps for entries that fell off the end.
    const allowed = new Set(next);
    const stamps: Record<string, number> = {};
    for (const p of next) {
      stamps[p] = p === path ? Date.now() : recentOpenedAt[p] ?? Date.now();
    }
    // Drop entries that were evicted.
    for (const key of Object.keys(recentOpenedAt)) {
      if (allowed.has(key) && !(key in stamps)) {
        stamps[key] = recentOpenedAt[key];
      }
    }
    recentPaths = next;
    recentOpenedAt = stamps;
    saveRecent();
  }

  function clearRecent() {
    recentPaths = [];
    recentOpenedAt = {};
    saveRecent();
  }

  function recordSearchHistory(q: string) {
    const next = [q, ...searchHistory.filter((existing) => existing !== q)].slice(
      0,
      SEARCH_HISTORY_MAX
    );
    searchHistory = next;
    saveSearchHistory();
  }

  function clearSearchHistory() {
    searchHistory = [];
    saveSearchHistory();
  }

  function toggleBookmark(path: string) {
    if (bookmarks.includes(path)) {
      bookmarks = bookmarks.filter((p) => p !== path);
      toasts.show(`Removed bookmark: ${path}`, 'info');
    } else {
      bookmarks = [...bookmarks, path];
      toasts.show(`Bookmarked: ${path}`, 'success');
    }
    saveBookmarks();
  }

  // ---- Expand all / Collapse all -------------------------------------------

  /**
   * Pulse `forceExpanded` to true (or false) so every TreeNode picks up
   * the controlled override, then reset to null on the next tick so
   * individual rows can toggle again. Without the reset the rail would
   * be locked open or closed.
   */
  async function expandAll() {
    forceExpanded = true;
    await tick();
    forceExpanded = null;
  }

  async function collapseAll() {
    forceExpanded = false;
    await tick();
    forceExpanded = null;
  }

  // ---- Relative-time formatting --------------------------------------------

  function relativeTime(ts: number, now: number): string {
    const diff = Math.max(0, now - ts);
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return 'just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d ago`;
    const wk = Math.floor(day / 7);
    if (wk < 5) return `${wk}w ago`;
    const mo = Math.floor(day / 30);
    if (mo < 12) return `${mo}mo ago`;
    const yr = Math.floor(day / 365);
    return `${yr}y ago`;
  }

  // ---- Context menu handlers -----------------------------------------------

  function onTreeContextMenu(path: string, _type: 'file' | 'dir', x: number, y: number) {
    ctxMenu = { path, type: _type, x, y };
  }

  function ctxBookmarkToggle() {
    if (!ctxMenu) return;
    toggleBookmark(ctxMenu.path);
    ctxMenu = null;
  }

  /**
   * Save the in-flight edit of the currently-selected doc.
   *
   * Returns true on success so the viewer can drop out of edit mode.
   * On failure we toast and return false; the viewer keeps the user's
   * draft so they can retry without losing work.
   *
   * After a successful write we re-read the doc so any server-side
   * normalization (trailing newline, layer redirect, etc.) is reflected
   * in the rendered view.
   */
  async function saveDoc(newContent: string): Promise<boolean> {
    if (!client || !selectedPath) return false;
    const path = selectedPath;
    const pathError = validateMemoryPath(path);
    if (pathError) {
      toasts.show(`Save failed: ${pathError}`, 'error');
      return false;
    }
    try {
      const res = await client.writeMemory(path, newContent);
      if (!res.ok) {
        toasts.show(`Save failed: gateway did not confirm write`, 'error');
        return false;
      }
      toasts.show(`Saved: ${path}`, 'info');
      // Re-fetch so the rendered view matches whatever the server stored.
      // We swallow read errors here — the write succeeded, so the worst
      // case is a stale local view that the user can refresh manually.
      try {
        const fresh = await client.readMemory(path);
        if (selectedPath === path) selectedContent = fresh.content;
      } catch {
        /* ignore — write already toasted success */
      }
      return true;
    } catch (err) {
      toasts.show(`Save failed: ${(err as Error).message}`, 'error');
      return false;
    }
  }

  // TODO(2026-05-27): wire up doc-delete handler once the gateway implements
  // either `DELETE /api/memory?path=...` or `POST /api/memory/delete`. Live-
  // server probe today returns 404 for both shapes — no matching route in
  // `src/channels/web/platform/router.rs`. The client method
  // `client.deleteMemory(path)` is pre-wired in `src/lib/api/ironclaw.ts`
  // (tries DELETE first, falls back to POST on 404/405). UI plan: pass an
  // `ondelete` callback to DocViewer that opens a styled confirm dialog,
  // calls the client, toasts on success, clears `selectedPath`, and
  // re-loads the tree via `await loadRoot()`.

  /**
   * Create a new doc from the modal, refresh the tree so the row appears,
   * and select the new doc so the user lands in it ready to edit.
   *
   * The modal pre-validates the path, but we re-run it here in case the
   * caller path ever diverges from the modal's validator.
   */
  async function createDoc(path: string, content: string): Promise<void> {
    if (!client) return;
    const trimmed = path.trim();
    const pathError = validateMemoryPath(trimmed);
    if (pathError) {
      toasts.show(`Create failed: ${pathError}`, 'error');
      return;
    }
    if (content.length === 0) {
      // Allow but warn — empty docs are valid but rarely useful.
      toasts.show('Empty doc created — add content to make it searchable.', 'info');
    }
    try {
      const res = await client.writeMemory(trimmed, content);
      if (!res.ok) {
        toasts.show(`Create failed: gateway did not confirm write`, 'error');
        return;
      }
      toasts.show(`Created: ${trimmed}`, 'success');
      newDocOpen = false;
      // Refresh the tree so the new row appears, then open the doc.
      await loadRoot();
      await openPath(trimmed, client);
    } catch (err) {
      toasts.show(`Create failed: ${(err as Error).message}`, 'error');
    }
  }
</script>

<section class="p-8 h-full flex flex-col min-h-0">
  <header class="mb-6">
    <h1 class="text-2xl font-semibold text-text-primary">Knowledge</h1>
    <p class="text-text-muted text-sm mt-1">Docs, transcripts, and RAG sources.</p>
  </header>

  {#if connection.status !== 'connected'}
    <div class="surface flex-1 flex flex-col items-center justify-center text-center px-6">
      <svg
        viewBox="0 0 24 24"
        class="w-10 h-10 text-text-muted mb-3"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div class="text-sm text-text-primary mb-1">IronClaw is offline</div>
      <div class="text-xs text-text-muted">
        Check Settings to configure or restart the gateway.
      </div>
      {#if connection.lastError}
        <div class="mt-3 text-xs text-red-400 font-mono max-w-md break-all">
          {connection.lastError}
        </div>
      {/if}
    </div>
  {:else}
    <!-- Row gap removed in favor of an explicit margin on the doc-viewer
         pane so the `ResizeHandle` between them sits in a tight gutter
         instead of being padded out by the row's gap-4. Visual spacing is
         preserved by `ml-2` + `mr-0` (no gap) on the right pane and the
         handle's own 4px column. -->
    <div class="flex-1 min-h-0 flex">
      <!-- Left rail: bookmarks + recent + tree. Width comes from
           `effectiveTreeRailWidth`; the in-class `w-[320px]` was replaced
           by an inline style so the drag handle below owns the source of
           truth for the column width. -->
      <aside
        class="shrink-0 surface flex flex-col min-h-0"
        style="width: {effectiveTreeRailWidth}px;"
      >
        <div class="px-3 py-3 border-b border-border-subtle flex items-center justify-between gap-2">
          <span class="text-xs font-semibold text-text-primary uppercase tracking-wider">
            Workspace
          </span>
          <div class="flex items-center gap-1">
            <button
              type="button"
              onclick={expandAll}
              title="Expand all directories"
              aria-label="Expand all directories"
              class="inline-flex items-center justify-center w-7 h-7 rounded-md text-text-muted hover:text-accent-cyan transition-colors"
            >
              <svg
                viewBox="0 0 24 24"
                class="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
                <polyline points="6 3 12 9 18 3" />
              </svg>
            </button>
            <button
              type="button"
              onclick={collapseAll}
              title="Collapse all directories"
              aria-label="Collapse all directories"
              class="inline-flex items-center justify-center w-7 h-7 rounded-md text-text-muted hover:text-accent-cyan transition-colors"
            >
              <svg
                viewBox="0 0 24 24"
                class="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="18 15 12 9 6 15" />
                <polyline points="18 21 12 15 6 21" />
              </svg>
            </button>
            <button
              type="button"
              onclick={() => (newDocOpen = true)}
              disabled={!client}
              title="New document"
              aria-label="New document"
              class="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md border border-border-subtle text-text-muted hover:text-accent-cyan hover:border-accent-cyan transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg
                viewBox="0 0 24 24"
                class="w-3 h-3"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New
            </button>
            <button
              type="button"
              onclick={loadRoot}
              disabled={rootLoading}
              title="Refresh tree"
              aria-label="Refresh tree"
              class="inline-flex items-center justify-center w-7 h-7 rounded-md text-text-muted hover:text-accent-cyan transition-colors disabled:opacity-50"
            >
              <svg
                viewBox="0 0 24 24"
                class="w-3.5 h-3.5"
                class:animate-spin={rootLoading}
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          </div>
        </div>
        <div class="flex-1 overflow-auto py-2">
          <!-- Bookmarks section (above Recent). Renders only if non-empty so
               the rail doesn't grow a header for an empty list. -->
          {#if bookmarks.length > 0}
            <div class="px-2 mb-2">
              <button
                type="button"
                onclick={() => (bookmarksOpen = !bookmarksOpen)}
                class="w-full flex items-center justify-between gap-2 px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted hover:text-text-primary transition-colors"
              >
                <span class="flex items-center gap-1.5">
                  <svg
                    viewBox="0 0 16 16"
                    class="w-3 h-3 transition-transform"
                    class:rotate-90={bookmarksOpen}
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="6 4 10 8 6 12" />
                  </svg>
                  <span>Bookmarks</span>
                  <span class="text-text-muted/60">({bookmarks.length})</span>
                </span>
              </button>
              {#if bookmarksOpen}
                <ul class="mt-1">
                  {#each bookmarks as path (path)}
                    <li>
                      <button
                        type="button"
                        onclick={() => openPath(path, client)}
                        oncontextmenu={(ev) => {
                          ev.preventDefault();
                          onTreeContextMenu(path, 'file', ev.clientX, ev.clientY);
                        }}
                        class="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left text-xs transition-colors border-l-2 min-h-[28px]"
                        class:border-accent-cyan={selectedPath === path}
                        class:border-transparent={selectedPath !== path}
                        class:bg-bg-surface={selectedPath === path}
                        class:text-text-primary={selectedPath === path}
                        class:text-text-muted={selectedPath !== path}
                        class:hover:bg-bg-surface={selectedPath !== path}
                        class:hover:text-text-primary={selectedPath !== path}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          class="w-3 h-3 shrink-0 text-accent-gold"
                          fill="currentColor"
                          stroke="currentColor"
                          stroke-width="1"
                          stroke-linejoin="round"
                          aria-hidden="true"
                        >
                          <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9 12 2" />
                        </svg>
                        <span class="truncate flex-1 min-w-0" title={path}>{basename(path)}</span>
                      </button>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/if}

          <!-- Recent section. Same pattern as Bookmarks. -->
          {#if recentPaths.length > 0}
            <div class="px-2 mb-2">
              <div class="flex items-center justify-between gap-2 px-1 py-1">
                <button
                  type="button"
                  onclick={() => (recentOpen = !recentOpen)}
                  class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted hover:text-text-primary transition-colors"
                >
                  <svg
                    viewBox="0 0 16 16"
                    class="w-3 h-3 transition-transform"
                    class:rotate-90={recentOpen}
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="6 4 10 8 6 12" />
                  </svg>
                  <span>Recent</span>
                  <span class="text-text-muted/60">({recentPaths.length})</span>
                </button>
                <button
                  type="button"
                  onclick={clearRecent}
                  class="text-[10px] uppercase tracking-wide text-text-muted hover:text-red-400 transition-colors"
                  title="Clear recent docs"
                >
                  Clear
                </button>
              </div>
              {#if recentOpen}
                <ul class="mt-1">
                  {#each recentPaths as path (path)}
                    <li>
                      <button
                        type="button"
                        onclick={() => openPath(path, client)}
                        oncontextmenu={(ev) => {
                          ev.preventDefault();
                          onTreeContextMenu(path, 'file', ev.clientX, ev.clientY);
                        }}
                        class="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left text-xs transition-colors border-l-2 min-h-[28px]"
                        class:border-accent-cyan={selectedPath === path}
                        class:border-transparent={selectedPath !== path}
                        class:bg-bg-surface={selectedPath === path}
                        class:text-text-primary={selectedPath === path}
                        class:text-text-muted={selectedPath !== path}
                        class:hover:bg-bg-surface={selectedPath !== path}
                        class:hover:text-text-primary={selectedPath !== path}
                      >
                        <svg
                          viewBox="0 0 16 16"
                          class="w-3.5 h-3.5 shrink-0"
                          class:text-accent-cyan={selectedPath === path}
                          class:text-text-muted={selectedPath !== path}
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path d="M9 1.5H4a1 1 0 0 0-1 1V13.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.5z" />
                          <polyline points="9 1.5 9 5.5 13 5.5" />
                        </svg>
                        <span class="truncate flex-1 min-w-0" title={path}>{basename(path)}</span>
                        <span class="text-[10px] text-text-muted/50 shrink-0 tabular-nums">
                          {relativeTime(recentOpenedAt[path] ?? nowMs, nowMs)}
                        </span>
                      </button>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/if}

          <!-- Main tree -->
          {#if (recentPaths.length > 0 || bookmarks.length > 0)}
            <div class="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted/70 border-t border-border-subtle/60 mt-2 pt-3">
              All docs
            </div>
          {/if}
          {#if rootLoading && rootNodes.length === 0}
            <div class="text-xs text-text-muted px-3 py-2">Loading…</div>
          {:else if rootError}
            <div class="text-xs text-red-400 px-3 py-2 break-words">{rootError}</div>
          {:else if rootNodes.length === 0}
            <div class="text-xs text-text-muted px-3 py-2 italic">Empty workspace.</div>
          {:else if client}
            {#each rootNodes as node (node.path)}
              <TreeNode
                {node}
                depth={0}
                {selectedPath}
                {client}
                onSelect={(p) => openPath(p, client)}
                bookmarks={bookmarkSet}
                onContextMenu={onTreeContextMenu}
                {forceExpanded}
              />
            {/each}
          {/if}
        </div>
      </aside>

      <!-- Resize handle between tree rail and doc viewer. Sits in a small
           gutter (8px each side via mx on the handle wrapper) so the
           hover glow has room without crowding the panes. Hidden when
           the viewport is narrow. -->
      {#if resizeEnabled}
        <div class="flex items-stretch mx-2">
          <ResizeHandle
            min={TREE_RAIL_MIN}
            max={TREE_RAIL_MAX}
            defaultWidth={TREE_RAIL_DEFAULT}
            storageKey={TREE_RAIL_STORAGE_KEY}
            initialWidth={treeRailWidth}
            onresize={(w) => (treeRailWidth = w)}
          />
        </div>
      {:else}
        <!-- Spacer matching the gap-4 the parent used to provide so the
             non-resizable narrow-viewport layout still gets visual
             breathing room between rail and doc viewer. -->
        <div class="w-4 shrink-0"></div>
      {/if}

      <!-- Right pane: search + content -->
      <div class="flex-1 min-w-0 flex flex-col gap-4 min-h-0">
        <SearchBar
          value={inputValue}
          onChange={(v) => {
            inputValue = v;
            void onSearch(v);
          }}
          onSubmit={(v) => {
            inputValue = v;
            void onSearch(v);
          }}
          pending={searchPending}
          history={searchHistory}
          onClearHistory={clearSearchHistory}
        />

        {#if hasActiveSearch}
          {#if searchPending && searchResults.length === 0}
            <div class="text-xs text-text-muted">Searching…</div>
          {:else if searchError}
            <div class="surface p-4 text-sm text-red-400">{searchError}</div>
          {:else}
            <SearchResults
              results={searchResults}
              query={committedQuery}
              onClear={clearSearch}
              onOpen={(p) => openPath(p, client)}
              {selectedPath}
            />
          {/if}

          {#if selectedPath}
            <div class="flex-1 min-h-0">
              <DocViewer
                path={selectedPath}
                content={selectedContent}
                loading={docLoading}
                error={docError}
                onsave={saveDoc}
                bookmarked={selectedBookmarked}
                onToggleBookmark={() => selectedPath && toggleBookmark(selectedPath)}
              />
            </div>
          {/if}
        {:else if selectedPath}
          <div class="flex-1 min-h-0">
            <DocViewer
              path={selectedPath}
              content={selectedContent}
              loading={docLoading}
              error={docError}
              onsave={saveDoc}
              bookmarked={selectedBookmarked}
              onToggleBookmark={() => selectedPath && toggleBookmark(selectedPath)}
            />
          </div>
        {:else}
          <div class="surface flex-1 flex items-center justify-center">
            <div class="text-text-muted text-sm">
              Select a doc or search the knowledge base.
            </div>
          </div>
        {/if}
      </div>
    </div>

    {#if newDocOpen}
      <NewDocModal
        onclose={() => (newDocOpen = false)}
        oncreate={createDoc}
      />
    {/if}

    <!-- Context menu. Stops click propagation so the global click-handler
         that closes ctxMenu doesn't fire from inside it. -->
    {#if ctxMenu}
      <div
        role="menu"
        tabindex="-1"
        class="fixed z-50 min-w-[180px] bg-bg-deep border border-border-subtle rounded-md shadow-lg overflow-hidden"
        style="left: {ctxMenu.x}px; top: {ctxMenu.y}px;"
        onclick={(ev) => ev.stopPropagation()}
        onkeydown={(ev) => {
          if (ev.key === 'Escape') ctxMenu = null;
        }}
      >
        <button
          type="button"
          onclick={ctxBookmarkToggle}
          class="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-bg-surface hover:text-accent-gold transition-colors text-left"
        >
          <svg
            viewBox="0 0 24 24"
            class="w-3.5 h-3.5 shrink-0"
            fill={bookmarkSet.has(ctxMenu.path) ? 'currentColor' : 'none'}
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9 12 2" />
          </svg>
          <span>
            {bookmarkSet.has(ctxMenu.path) ? 'Unbookmark' : 'Bookmark'}
          </span>
        </button>
      </div>
    {/if}
  {/if}
</section>
