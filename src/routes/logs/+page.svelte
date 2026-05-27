<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import type { LogEntry, LogLevel } from '$lib/api/types';
  import { connection } from '$lib/stores/connection.svelte';
  import { toasts } from '$lib/stores/toasts.svelte';

  /** Hard cap on the in-memory log buffer. Bursts above this get pruned. */
  const MAX_ENTRIES = 5000;
  /** How many oldest entries to drop in one shot once we hit MAX_ENTRIES. */
  const PRUNE_BATCH = 500;
  /** Filter input debounce. */
  const FILTER_DEBOUNCE_MS = 250;

  // ---- Virtualization constants --------------------------------------------
  /**
   * Fixed row height in pixels. All log rows render at exactly this height
   * so the windowing math is a simple division — no per-row measurement.
   * Matches the visual: text-xs (~12px) + leading-5 (20px line) + py-1.5
   * (6px top/bottom) ≈ 32px including the border. The row template enforces
   * this explicitly via inline height + line-height to defeat content-driven
   * growth (long messages clip with overflow-hidden + text-ellipsis on the
   * message cell; titles surface the full text on hover).
   */
  const ITEM_HEIGHT = 32;
  /**
   * Rows rendered above + below the visible window. Smooths fast scrolls so
   * the user doesn't see blank flashes between recycles. Keep small — bigger
   * over-scan means more DOM nodes per frame which is what we're trying to
   * avoid.
   */
  const OVERSCAN = 10;

  const LEVELS: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error'];

  // ---- Reactive state -------------------------------------------------------

  /**
   * Flat list of log entries in arrival order. Kept as a plain $state array
   * so we can splice/push without reactivity tricks; the filtered view is
   * memoized via $derived.by below.
   */
  let entries = $state<LogEntry[]>([]);

  /** Current effective server log level (last value read or set). */
  let level = $state<LogLevel>('info');
  /** Free-text filter applied client-side. Debounced into `appliedFilter`. */
  let filterInput = $state('');
  /** Debounced version of `filterInput` used for the derived filtered list. */
  let appliedFilter = $state('');
  /** When true, stop accumulating new entries (stream stays open under the hood). */
  let paused = $state(false);
  /** When true, snap to bottom on each new entry. Off by default — live tails are jumpy. */
  let autoScroll = $state(false);
  /** True while the SSE generator is actively pumping events. */
  let streaming = $state(false);

  /** Count of new entries that landed below the viewport since the user scrolled away. */
  let unreadBelow = $state(0);

  // `listEl` is bound via `bind:this` and only read imperatively (scroll
  // math, scroll-to-bottom). Wrapped in $state so Svelte 5's binding check
  // sees a reactive holder.
  let listEl = $state<HTMLDivElement | null>(null);
  let abort: AbortController | null = null;
  let filterTimer: ReturnType<typeof setTimeout> | null = null;
  /** Tracks whether the user has scrolled away from the bottom of the list. */
  let stuckToBottom = true;

  // ---- Virtualization state -------------------------------------------------
  /** Current scrollTop of the viewport — drives the visible window slice. */
  let scrollTop = $state(0);
  /** Height of the scrollable viewport, measured on mount + resize. */
  let viewportHeight = $state(0);

  // ---- Derived filtered view + window slice --------------------------------

  const filtered = $derived.by<LogEntry[]>(() => {
    const q = appliedFilter.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) => e.message.toLowerCase().includes(q) || e.target.toLowerCase().includes(q)
    );
  });

  /**
   * Window slice computed from scrollTop / viewportHeight / ITEM_HEIGHT.
   * Clamped to the bounds of `filtered`. `firstIndex` and `lastIndex` are
   * inclusive of OVERSCAN; the {#each} block iterates this slice directly,
   * and spacer divs above/below restore the correct scrollHeight so the
   * scrollbar represents the full list.
   */
  const windowSlice = $derived.by(() => {
    const total = filtered.length;
    if (total === 0 || viewportHeight === 0) {
      return { first: 0, last: 0, items: [] as Array<{ entry: LogEntry; index: number }> };
    }
    const rough = Math.floor(scrollTop / ITEM_HEIGHT);
    const visibleCount = Math.ceil(viewportHeight / ITEM_HEIGHT);
    const first = Math.max(0, rough - OVERSCAN);
    const last = Math.min(total - 1, rough + visibleCount + OVERSCAN);
    const items: Array<{ entry: LogEntry; index: number }> = [];
    for (let i = first; i <= last; i++) items.push({ entry: filtered[i], index: i });
    return { first, last, items };
  });

  /** Top spacer height = rows skipped above the window. */
  const topSpacer = $derived(windowSlice.first * ITEM_HEIGHT);
  /**
   * Bottom spacer height = rows skipped below the window. (total - last - 1)
   * because `last` is inclusive.
   */
  const bottomSpacer = $derived(
    Math.max(0, (filtered.length - windowSlice.last - 1) * ITEM_HEIGHT)
  );

  // ---- Lifecycle ------------------------------------------------------------

  onMount(() => {
    void boot();
    // Measure the viewport once the DOM is laid out, then observe resizes so
    // the visible-row count stays in sync with window/sidebar resizing.
    const ro = listEl ? new ResizeObserver(measureViewport) : null;
    void tick().then(() => {
      measureViewport();
      if (ro && listEl) ro.observe(listEl);
    });
    return () => {
      ro?.disconnect();
    };
  });

  onDestroy(() => {
    teardown();
  });

  function measureViewport() {
    if (!listEl) return;
    viewportHeight = listEl.clientHeight;
  }

  async function boot() {
    if (connection.status !== 'connected') return;
    const client = connection.client;
    if (!client) return;
    try {
      const cur = await client.getLogLevel();
      level = cur.level;
    } catch (err) {
      toasts.show(`Couldn't read log level: ${(err as Error).message}`, 'error');
    }
    openStream();
  }

  function teardown() {
    if (filterTimer) clearTimeout(filterTimer);
    filterTimer = null;
    closeStream();
  }

  function openStream() {
    const client = connection.client;
    if (!client) return;
    closeStream();
    abort = new AbortController();
    streaming = true;
    void pump(client.streamLogs(abort.signal));
  }

  function closeStream() {
    streaming = false;
    if (abort) {
      abort.abort();
      abort = null;
    }
  }

  async function pump(it: AsyncIterable<LogEntry>) {
    try {
      for await (const entry of it) {
        if (paused) continue;
        appendEntry(entry);
      }
    } catch (err) {
      const msg = (err as Error).message;
      // AbortError on teardown is expected — only surface real failures.
      if (msg && !msg.toLowerCase().includes('abort')) {
        toasts.show(`Log stream error: ${msg}`, 'error');
      }
    } finally {
      streaming = false;
    }
  }

  function appendEntry(entry: LogEntry) {
    // Append, then prune in a batch when we cross MAX_ENTRIES. Doing this in
    // one slice keeps reactivity work O(1) per overflow instead of O(N).
    const next = entries.length >= MAX_ENTRIES ? entries.slice(PRUNE_BATCH) : entries.slice();
    next.push(entry);
    entries = next;

    if (autoScroll) {
      void scrollToBottom();
    } else if (!stuckToBottom) {
      unreadBelow += 1;
    }
  }

  // ---- Event handlers -------------------------------------------------------

  function onFilterInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    filterInput = value;
    if (filterTimer) clearTimeout(filterTimer);
    filterTimer = setTimeout(() => {
      appliedFilter = value;
      // Filter changes the list length under the cursor; reset scroll to the
      // top so the user doesn't end up staring at a blank window past the
      // end of the new (shorter) filtered list.
      if (listEl) {
        listEl.scrollTop = 0;
        scrollTop = 0;
      }
    }, FILTER_DEBOUNCE_MS);
  }

  async function onLevelChange(e: Event) {
    const next = (e.target as HTMLSelectElement).value as LogLevel;
    const client = connection.client;
    if (!client) return;
    const previous = level;
    level = next;
    try {
      const res = await client.setLogLevel(next);
      if (!res.ok) throw new Error('Server did not confirm level change.');
      toasts.show(`Log level set to ${next}`, 'success');
      // Re-open so the server's new buffered window matches the new level.
      openStream();
    } catch (err) {
      level = previous;
      toasts.show(`Set level failed: ${(err as Error).message}`, 'error');
    }
  }

  function togglePause() {
    paused = !paused;
  }

  function clearEntries() {
    entries = [];
    unreadBelow = 0;
    if (listEl) {
      listEl.scrollTop = 0;
      scrollTop = 0;
    }
  }

  function onAutoScrollChange(e: Event) {
    autoScroll = (e.target as HTMLInputElement).checked;
    if (autoScroll) {
      unreadBelow = 0;
      void scrollToBottom();
    }
  }

  function onListScroll() {
    if (!listEl) return;
    scrollTop = listEl.scrollTop;
    // 8px slack so we don't lose "at bottom" status to subpixel rounding.
    const atBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 8;
    stuckToBottom = atBottom;
    if (atBottom) unreadBelow = 0;
  }

  async function scrollToBottom() {
    await tick();
    if (!listEl) return;
    listEl.scrollTop = listEl.scrollHeight;
    scrollTop = listEl.scrollTop;
    stuckToBottom = true;
    unreadBelow = 0;
  }

  function jumpToBottom() {
    autoScroll = true;
    void scrollToBottom();
  }

  // ---- Formatting helpers ---------------------------------------------------

  function formatTime(ts: string): string {
    // Show HH:mm:ss.SSS in the user's local zone — useful for live tail.
    // Fall back to the raw string if Date parsing chokes.
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss}.${ms}`;
  }

  function levelClasses(l: LogLevel): string {
    switch (l) {
      case 'trace':
        return 'bg-border-subtle/60 text-text-muted';
      case 'debug':
        return 'bg-accent-cyan/10 text-accent-cyan';
      case 'info':
        return 'bg-accent-cyan/20 text-accent-cyan';
      case 'warn':
        return 'bg-accent-gold/15 text-accent-gold';
      case 'error':
        return 'bg-red-500/15 text-red-400';
    }
  }
</script>

<section class="p-8 h-full flex flex-col">
  <header class="mb-4 flex items-start justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold text-text-primary">Logs</h1>
      <p class="text-text-muted text-sm mt-1">Live tail of the gateway's tracing output.</p>
    </div>
  </header>

  {#if connection.status !== 'connected'}
    <!-- Connection guard: no point opening a stream if we can't auth. -->
    <div class="surface flex-1 flex flex-col items-center justify-center gap-2 p-8">
      <svg
        viewBox="0 0 24 24"
        class="w-8 h-8 text-text-muted"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <div class="text-sm text-text-primary">IronClaw is offline</div>
      <div class="text-xs text-text-muted">
        Check
        <a href="/settings" class="text-accent-cyan hover:underline">Settings</a>
        to verify the gateway connection.
      </div>
    </div>
  {:else}
    <!-- Control strip -->
    <div
      class="surface mb-3 px-3 py-2 flex flex-wrap items-center gap-3 text-xs"
    >
      <div class="flex items-center gap-2">
        <span
          class="w-2 h-2 rounded-full"
          class:bg-green-500={streaming && !paused}
          class:animate-pulse={streaming && !paused}
          class:bg-accent-gold={streaming && paused}
          class:bg-text-muted={!streaming}
        ></span>
        <span class="text-text-muted">
          {#if !streaming}
            Disconnected
          {:else if paused}
            Paused
          {:else}
            Live
          {/if}
        </span>
      </div>

      <div class="h-4 w-px bg-border-subtle"></div>

      <label class="flex items-center gap-2">
        <span class="text-text-muted uppercase tracking-wide">Level</span>
        <select
          value={level}
          onchange={onLevelChange}
          class="bg-bg-deep border border-border-subtle rounded px-2 py-1 text-text-primary focus:outline-none focus:border-accent-cyan"
        >
          {#each LEVELS as l (l)}
            <option value={l}>{l}</option>
          {/each}
        </select>
      </label>

      <div class="flex-1 min-w-[180px]">
        <input
          type="text"
          value={filterInput}
          oninput={onFilterInput}
          placeholder="Filter by message or target…"
          class="w-full bg-bg-deep border border-border-subtle rounded px-2 py-1 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan"
        />
      </div>

      <button
        type="button"
        onclick={togglePause}
        class="px-2.5 py-1 rounded border border-border-subtle text-text-muted hover:border-accent-cyan hover:text-accent-cyan transition-colors min-h-[28px]"
        aria-pressed={paused}
      >
        {paused ? 'Resume' : 'Pause'}
      </button>

      <button
        type="button"
        onclick={clearEntries}
        class="px-2.5 py-1 rounded border border-border-subtle text-text-muted hover:border-accent-cyan hover:text-accent-cyan transition-colors min-h-[28px]"
      >
        Clear
      </button>

      <label class="flex items-center gap-1.5 text-text-muted cursor-pointer select-none">
        <input
          type="checkbox"
          checked={autoScroll}
          onchange={onAutoScrollChange}
          class="accent-accent-cyan"
        />
        Auto-scroll
      </label>

      <div class="text-text-muted tabular-nums">
        {filtered.length}{appliedFilter ? ` / ${entries.length}` : ''} entries
      </div>
    </div>

    <!-- Log list -->
    <div class="surface flex-1 overflow-hidden flex flex-col relative">
      <div
        bind:this={listEl}
        onscroll={onListScroll}
        class="flex-1 overflow-auto font-mono text-xs"
      >
        {#if entries.length === 0}
          <div class="h-full flex items-center justify-center text-text-muted">
            {streaming ? 'Waiting for log events…' : 'No log entries yet.'}
          </div>
        {:else if filtered.length === 0}
          <div class="h-full flex items-center justify-center text-text-muted">
            No entries match "{appliedFilter}".
          </div>
        {:else}
          <!--
            Virtualized window. The two spacer divs preserve the total
            scrollHeight (= filtered.length * ITEM_HEIGHT) so the native
            scrollbar reflects the full list, even though only ~viewport+overscan
            rows are mounted in the DOM. Each rendered row is forced to exactly
            ITEM_HEIGHT via inline style so the math stays trivially correct —
            no per-row measurement, no growing/shrinking under the cursor.
          -->
          <div style="height: {topSpacer}px;" aria-hidden="true"></div>
          {#each windowSlice.items as row (row.index + '|' + row.entry.timestamp)}
            <div
              class="grid grid-cols-[64px_56px_minmax(0,200px)_1fr] gap-x-3 px-3 items-center border-b border-border-subtle/30 hover:bg-bg-deep transition-colors"
              style="height: {ITEM_HEIGHT}px; line-height: 1.1;"
            >
              <span class="text-text-muted text-[10px] tabular-nums truncate">
                {formatTime(row.entry.timestamp)}
              </span>
              <span
                class="px-1.5 rounded text-[10px] uppercase tracking-wide text-center {levelClasses(
                  row.entry.level
                )}"
              >
                {row.entry.level}
              </span>
              <span class="text-text-muted truncate" title={row.entry.target}>
                {row.entry.target}
              </span>
              <span
                class="text-text-primary truncate"
                title={row.entry.message}
              >
                {row.entry.message}
              </span>
            </div>
          {/each}
          <div style="height: {bottomSpacer}px;" aria-hidden="true"></div>
        {/if}
      </div>

      {#if !autoScroll && unreadBelow > 0}
        <button
          type="button"
          onclick={jumpToBottom}
          class="absolute bottom-3 right-4 px-3 py-1.5 rounded-full bg-accent-cyan text-bg-deep text-xs font-medium shadow-lg hover:bg-accent-cyan/90 transition-colors flex items-center gap-1.5"
        >
          <svg
            viewBox="0 0 24 24"
            class="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          {unreadBelow} new
        </button>
      {/if}
    </div>
  {/if}
</section>
