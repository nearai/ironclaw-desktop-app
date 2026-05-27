<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import type { Routine, RoutineSummary } from '$lib/api/types';
  import { connection } from '$lib/stores/connection.svelte';
  import DetailPanel from './DetailPanel.svelte';
  import { toasts } from '$lib/stores/toasts.svelte';
  import { notifications } from '$lib/stores/notifications.svelte';
  import { relativeTime } from './time';

  const POLL_INTERVAL_MS = 30_000;

  // Persisted UI prefs (search + sort + filter pill). Stored under a single
  // namespaced key so a future settings panel can wipe them in one call.
  const PREFS_STORAGE_KEY = 'ironclaw-routines-prefs';

  type EnabledFilter = 'all' | 'enabled' | 'disabled';
  type SortKey = 'name' | 'next_run' | 'last_run' | 'schedule';
  type Prefs = { search: string; filter: EnabledFilter; sort: SortKey };
  const DEFAULT_PREFS: Prefs = { search: '', filter: 'all', sort: 'name' };

  // Loaded data
  let routines = $state<Routine[]>([]);
  let summary = $state<RoutineSummary>({
    total: 0,
    enabled: 0,
    running: 0,
    failed_last_24h: 0
  });

  // UI state
  let initialLoad = $state(true);
  let refreshing = $state(false);
  let loadError = $state<string | null>(null);
  let selectedId = $state<string | null>(null);
  /** IDs currently mid-toggle, so we can disable the switch and avoid races. */
  let togglingIds = $state<Set<string>>(new Set());
  /** IDs currently being triggered, so we can disable the play button. */
  let triggeringIds = $state<Set<string>>(new Set());

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  // Search input + debounce. The input updates immediately; `debouncedQuery`
  // is what the derived filter actually consumes, lagging by 250ms.
  let searchInput = $state(DEFAULT_PREFS.search);
  let debouncedQuery = $state(DEFAULT_PREFS.search);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Persisted filter + sort. Hydrated from localStorage before mount via the
  // top-level guard below so the initial render reflects the saved values.
  let filterKey = $state<EnabledFilter>(DEFAULT_PREFS.filter);
  let sortKey = $state<SortKey>(DEFAULT_PREFS.sort);
  // Track when prefs are hydrated from storage so the persist effect doesn't
  // immediately clobber storage with defaults during mount.
  let prefsHydrated = $state(false);

  // Cron help popover visibility (click-to-toggle, since hover-only popovers
  // are inaccessible on keyboard / touch). Closed by default.
  let cronHelpOpen = $state(false);

  // Routine-completion notification bookkeeping. We track the `last_run`
  // timestamp seen on the previous poll per routine id; when it advances
  // we know the routine just completed and we can fetch the run to learn
  // success vs failure. The seeded flag suppresses notifications on the
  // FIRST poll so we don't spam every existing routine when the app
  // launches and observes historical state.
  let prevLastRunByRoutine: Record<string, string | undefined> = {};
  let seededLastRun = false;

  const selected = $derived(routines.find((r) => r.id === selectedId) ?? null);

  // ────────────────────────────────────────────────────────────────────────
  // Filter pill + sort metadata. Module-scoped so the template can iterate.
  // ────────────────────────────────────────────────────────────────────────

  const FILTER_PILLS: Array<{ value: EnabledFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'enabled', label: 'Enabled' },
    { value: 'disabled', label: 'Disabled' }
  ];

  const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
    { value: 'name', label: 'Name (A-Z)' },
    { value: 'next_run', label: 'Next run (soonest first)' },
    { value: 'last_run', label: 'Last run (newest first)' },
    { value: 'schedule', label: 'Schedule' }
  ];

  // ────────────────────────────────────────────────────────────────────────
  // Hydrate persisted prefs. Done at top level (not in onMount) so the
  // initial render reflects the saved values rather than flashing defaults.
  // localStorage isn't available in SSR, but this route is SPA-only inside
  // the Tauri shell so the guard is mostly defensive.
  // ────────────────────────────────────────────────────────────────────────
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(PREFS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Prefs>;
        if (parsed && typeof parsed === 'object') {
          if (typeof parsed.search === 'string') {
            searchInput = parsed.search;
            debouncedQuery = parsed.search;
          }
          const f = parsed.filter;
          if (f === 'all' || f === 'enabled' || f === 'disabled') {
            filterKey = f;
          }
          const s = parsed.sort;
          if (
            s === 'name' ||
            s === 'next_run' ||
            s === 'last_run' ||
            s === 'schedule'
          ) {
            sortKey = s;
          }
        }
      }
    } catch {
      // Corrupt JSON — fall back to defaults and let the next write fix it.
    }
    prefsHydrated = true;
  } else {
    prefsHydrated = true;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Derived filter + sort pipeline.
  // ────────────────────────────────────────────────────────────────────────

  function matchesFilter(r: Routine): boolean {
    if (filterKey === 'all') return true;
    if (filterKey === 'enabled') return r.enabled;
    return !r.enabled;
  }

  function matchesSearch(r: Routine, q: string): boolean {
    if (!q) return true;
    return r.name.toLowerCase().includes(q);
  }

  /** Sort key extractor for time-based sorts. Unparseable / missing
   *  timestamps return `null` so we can bucket them to the bottom. */
  function tsOrNull(iso?: string): number | null {
    if (!iso) return null;
    const t = Date.parse(iso);
    return Number.isNaN(t) ? null : t;
  }

  function applySort(list: Routine[]): Routine[] {
    const out = list.slice();
    if (sortKey === 'next_run') {
      // Soonest first; nulls (no next_run) sink to the bottom regardless of
      // direction. Tiebreak on name to keep ordering stable across polls.
      out.sort((a, b) => {
        const ta = tsOrNull(a.next_run);
        const tb = tsOrNull(b.next_run);
        if (ta === null && tb === null) return a.name.localeCompare(b.name);
        if (ta === null) return 1;
        if (tb === null) return -1;
        if (ta !== tb) return ta - tb;
        return a.name.localeCompare(b.name);
      });
    } else if (sortKey === 'last_run') {
      // Newest first; nulls (never run) sink to the bottom.
      out.sort((a, b) => {
        const ta = tsOrNull(a.last_run);
        const tb = tsOrNull(b.last_run);
        if (ta === null && tb === null) return a.name.localeCompare(b.name);
        if (ta === null) return 1;
        if (tb === null) return -1;
        if (ta !== tb) return tb - ta;
        return a.name.localeCompare(b.name);
      });
    } else if (sortKey === 'schedule') {
      out.sort((a, b) => {
        const sa = (a.schedule ?? '').toString();
        const sb = (b.schedule ?? '').toString();
        const cmp = sa.localeCompare(sb);
        if (cmp !== 0) return cmp;
        return a.name.localeCompare(b.name);
      });
    } else {
      // Name (default).
      out.sort((a, b) => a.name.localeCompare(b.name));
    }
    return out;
  }

  const filteredRoutines = $derived.by(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return applySort(
      routines.filter((r) => matchesFilter(r) && matchesSearch(r, q))
    );
  });

  const filterActive = $derived(
    debouncedQuery.trim().length > 0 || filterKey !== 'all'
  );

  // ────────────────────────────────────────────────────────────────────────
  // Sparkline data. We bucket each enabled routine's `last_run` timestamp
  // into one of 24 hourly slots covering the past 24h. This is a coarse v1
  // approximation — the server does not yet expose a "recent runs" endpoint,
  // and we cap at one observation per routine to keep request volume zero.
  // When `/api/routines/recent-runs` lands, swap this for the real data.
  // TODO(routines:+page.svelte:sparkline): replace per-routine last_run
  // bucketing with a /api/routines/recent-runs aggregate once the gateway
  // exposes it. Until then we cannot distinguish success vs failure at the
  // hourly granularity, so every bar renders as cyan (success).
  // ────────────────────────────────────────────────────────────────────────
  type SparkBucket = { success: number; failed: number };

  const sparkBuckets = $derived.by<SparkBucket[]>(() => {
    const buckets: SparkBucket[] = Array.from({ length: 24 }, () => ({
      success: 0,
      failed: 0
    }));
    const now = Date.now();
    const cutoff = now - 24 * 60 * 60 * 1000;
    for (const r of routines) {
      if (!r.last_run) continue;
      const t = Date.parse(r.last_run);
      if (Number.isNaN(t)) continue;
      if (t < cutoff || t > now) continue;
      const hoursAgo = Math.floor((now - t) / (60 * 60 * 1000));
      // Bucket index 0 = 23h ago, bucket 23 = current hour (left-to-right
      // is past-to-present, matching natural reading order).
      const idx = 23 - hoursAgo;
      if (idx < 0 || idx > 23) continue;
      // We can't tell success vs failure from the `last_run` timestamp
      // alone, so v1 attributes every bar to the cyan success channel.
      buckets[idx].success += 1;
    }
    return buckets;
  });

  const sparkTotal = $derived(
    sparkBuckets.reduce((acc, b) => acc + b.success + b.failed, 0)
  );

  const sparkMax = $derived(
    sparkBuckets.reduce((m, b) => Math.max(m, b.success + b.failed), 0)
  );

  // Deep-link target id from `?open=<id>` (set by CommandPalette). Captured
  // once on mount; if the routine list hasn't loaded the target yet on the
  // first refresh we retry once after a silent refresh, then give up and
  // clear the URL param regardless so the param is never sticky.
  let pendingOpenId: string | null = null;

  onMount(() => {
    pendingOpenId = page.url.searchParams.get('open');
    void (async () => {
      await refresh();
      if (pendingOpenId && tryOpenPending()) return;
      if (pendingOpenId) {
        // Routine list didn't include the id yet — give the gateway one
        // more silent poll's worth of time, then clear the param either way.
        await refresh({ silent: true });
        tryOpenPending();
        clearOpenParam();
      }
    })();
    pollTimer = setInterval(() => {
      void refresh({ silent: true });
    }, POLL_INTERVAL_MS);
  });

  /**
   * If a `?open=<id>` deep-link target is pending and matches a loaded
   * routine, open its detail panel and clear the URL param. Returns true
   * when the target was found (so the caller can stop retrying).
   */
  function tryOpenPending(): boolean {
    if (!pendingOpenId) return false;
    const match = routines.find((r) => r.id === pendingOpenId);
    if (!match) return false;
    selectedId = match.id;
    pendingOpenId = null;
    clearOpenParam();
    return true;
  }

  /**
   * Strip the `?open=<id>` query param from the URL without triggering a
   * navigation reload. Uses SvelteKit's `goto` with `replaceState` so the
   * history entry is replaced in place (the user shouldn't be able to Back
   * into the deep-link URL after we've consumed it).
   */
  function clearOpenParam() {
    if (typeof window === 'undefined') return;
    if (!page.url.searchParams.has('open')) return;
    const url = new URL(page.url);
    url.searchParams.delete('open');
    const target = url.pathname + (url.search ? url.search : '') + url.hash;
    void goto(target, { replaceState: true, noScroll: true, keepFocus: true });
  }

  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
    if (debounceTimer) clearTimeout(debounceTimer);
    // Don't toasts.clear() here — the store is now shared across the
    // whole app via the root layout, and unmounting this page must not
    // wipe toasts queued by another surface.
  });

  // Debounce the search input. 250 ms matches /extensions and feels snappy
  // without thrashing the filter on each keystroke.
  $effect(() => {
    const v = searchInput;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debouncedQuery = v;
    }, 250);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  });

  // Persist prefs whenever they change. Guarded on `prefsHydrated` so the
  // initial reactive run doesn't overwrite a freshly-loaded value with the
  // module-scope default.
  $effect(() => {
    if (!prefsHydrated) return;
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      const payload: Prefs = {
        search: debouncedQuery,
        filter: filterKey,
        sort: sortKey
      };
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Quota / private-mode failures are non-fatal.
    }
  });

  // Close the cron help popover on Escape so keyboard users can dismiss it.
  $effect(() => {
    if (!cronHelpOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') cronHelpOpen = false;
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function refresh(opts: { silent?: boolean } = {}) {
    const client = connection.client;
    if (!client) {
      if (!opts.silent) loadError = 'Not connected.';
      initialLoad = false;
      return;
    }
    if (!opts.silent) refreshing = true;
    try {
      // Fire both in parallel — the summary call is independent of the list.
      const [sum, list] = await Promise.all([
        client.routinesSummary(),
        client.listRoutines()
      ]);
      summary = sum;
      routines = list;
      loadError = null;
      // Compare against the previous poll's `last_run` map to surface
      // any newly-completed routines. Skipped on the first poll (we
      // need a baseline) and when notifications are globally disabled.
      void detectCompletions(list);
    } catch (err) {
      loadError = (err as Error).message;
      if (!opts.silent) toasts.show(`Refresh failed: ${loadError}`, 'error');
    } finally {
      refreshing = false;
      initialLoad = false;
    }
  }

  /**
   * Detect routine completions across polls. For each routine whose
   * `last_run` advanced since the previous snapshot, fetch its most
   * recent run row to learn success vs failure, then fire a desktop
   * notification. First poll seeds the map without firing — otherwise
   * the app launch would spray notifications for every historical run.
   */
  async function detectCompletions(list: Routine[]): Promise<void> {
    const client = connection.client;
    if (!client) return;
    const nextMap: Record<string, string | undefined> = {};
    const advanced: Routine[] = [];
    for (const r of list) {
      nextMap[r.id] = r.last_run;
      const prev = prevLastRunByRoutine[r.id];
      // A new last_run timestamp counts as a transition; either it
      // didn't exist before or it moved forward. Both signal "the
      // routine just produced a run."
      if (seededLastRun && r.last_run && r.last_run !== prev) {
        advanced.push(r);
      }
    }
    prevLastRunByRoutine = nextMap;
    if (!seededLastRun) {
      // Baseline established — start firing on subsequent polls.
      seededLastRun = true;
      return;
    }

    if (advanced.length === 0) return;
    if (!notifications.enabled || !notifications.routineCompletions) return;

    // Look up the newest run for each advanced routine in parallel.
    // We only need run #0 (limit=1) since `last_run` is the latest.
    await Promise.all(
      advanced.map(async (r) => {
        try {
          const runs = await client.getRoutineRuns(r.id, 1);
          const top = runs[0];
          // Only notify on terminal states; `running` would be a race
          // (the routine row's last_run was bumped before completion).
          if (!top || top.status === 'running') return;
          if (top.status === 'success') {
            void notifications.notify({
              title: 'Routine completed',
              body: `${r.name} finished successfully`,
              category: 'routine'
            });
          } else if (top.status === 'failed') {
            void notifications.notify({
              title: 'Routine failed',
              body: `${r.name} failed`,
              category: 'routine'
            });
          }
        } catch (err) {
          // Best-effort: a single completion lookup failing should not
          // break the rest of the poll cycle.
          console.warn('routine-run lookup failed', r.id, err);
        }
      })
    );
  }

  async function onToggle(routine: Routine) {
    const client = connection.client;
    if (!client) return;
    const id = routine.id;
    if (togglingIds.has(id)) return;

    const previous = routine.enabled;
    const next = !previous;

    // Optimistic update + mark in-flight. Svelte 5 requires a new Set to
    // trigger reactivity since Sets are mutable references.
    routines = routines.map((r) => (r.id === id ? { ...r, enabled: next } : r));
    togglingIds = new Set([...togglingIds, id]);

    try {
      const res = await client.toggleRoutine(id, next);
      if (!res.ok) throw new Error('Server did not confirm toggle.');
      toasts.show(
        next ? `Enabled: ${routine.name}` : `Disabled: ${routine.name}`,
        'success'
      );
      // Re-sync from server so summary counters reflect reality.
      void refresh({ silent: true });
    } catch (err) {
      // Revert on error.
      routines = routines.map((r) => (r.id === id ? { ...r, enabled: previous } : r));
      toasts.show(`Toggle failed: ${(err as Error).message}`, 'error');
    } finally {
      const dropped = new Set(togglingIds);
      dropped.delete(id);
      togglingIds = dropped;
    }
  }

  async function onTrigger(routine: Routine) {
    const client = connection.client;
    if (!client) return;
    const id = routine.id;
    if (triggeringIds.has(id)) return;
    triggeringIds = new Set([...triggeringIds, id]);
    try {
      await client.triggerRoutine(id);
      toasts.show(`Triggered: ${routine.name}`, 'success');
      // Refresh to surface the new "running" row in the detail panel /
      // updated last_run on the table.
      void refresh({ silent: true });
    } catch (err) {
      toasts.show(`Trigger failed: ${(err as Error).message}`, 'error');
    } finally {
      const dropped = new Set(triggeringIds);
      dropped.delete(id);
      triggeringIds = dropped;
    }
  }

  function openDetail(id: string) {
    selectedId = id;
  }

  function closeDetail() {
    selectedId = null;
  }

  function clearFilters() {
    searchInput = '';
    debouncedQuery = '';
    filterKey = 'all';
  }

  // TODO(2026-05-27): wire up "+ New routine" button + CreateRoutineModal once
  // the gateway implements `POST /api/routines`. Live-server probe today shows
  // 405 Method Not Allowed against IronClaw v0.29.x (no POST handler
  // registered in `src/channels/web/platform/router.rs`). The client method
  // `client.createRoutine(req)` is pre-wired in `src/lib/api/ironclaw.ts`;
  // open the modal from a button in the header next to Refresh, then call
  // `void refresh()` on success. Mirror NewDocModal.svelte for layout and
  // validation patterns. When the modal lands, attach the cron-syntax help
  // popover here below the schedule field too (currently exposed only via
  // the `?` icon next to the Schedule column header on the table).
</script>

<section class="p-8 h-full flex flex-col">
  <header class="mb-6 flex items-start justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold text-text-primary">Routines</h1>
      <p class="text-text-muted text-sm mt-1">Scheduled jobs and cron tasks.</p>
    </div>
    {#if connection.status === 'connected'}
      <button
        type="button"
        onclick={() => void refresh()}
        disabled={refreshing}
        class="flex items-center gap-2 px-3 py-2 rounded-md border border-border-subtle text-xs text-text-muted hover:border-accent-cyan hover:text-accent-cyan transition-colors disabled:opacity-50 min-h-[36px]"
      >
        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class:animate-spin={refreshing}>
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
        {refreshing ? 'Refreshing…' : 'Refresh'}
      </button>
    {/if}
  </header>

  {#if connection.status !== 'connected'}
    <!-- Connection guard: deny all reads until the gateway is up. -->
    <div class="surface flex-1 flex flex-col items-center justify-center gap-2 p-8">
      <svg viewBox="0 0 24 24" class="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <div class="text-sm text-text-primary">IronClaw is offline</div>
      <div class="text-xs text-text-muted">
        Check <a href="/settings" class="text-accent-cyan hover:underline">Settings</a> to verify the gateway connection.
      </div>
    </div>
  {:else}
    <!-- Stat strip — grows to a 5th "Recent runs" sparkline card whenever we
         have any last_run data in the past 24h. Hidden otherwise so the card
         doesn't render as an empty box. -->
    <div
      class="grid gap-3 mb-6"
      class:grid-cols-4={sparkTotal === 0}
      class:grid-cols-5={sparkTotal > 0}
    >
      <div class="surface p-4">
        <div class="text-3xl font-bold text-accent-cyan leading-none">{summary.total}</div>
        <div class="text-xs text-text-muted mt-2 uppercase tracking-wide">Total</div>
      </div>
      <div class="surface p-4">
        <div class="text-3xl font-bold text-accent-cyan leading-none">{summary.enabled}</div>
        <div class="text-xs text-text-muted mt-2 uppercase tracking-wide">Enabled</div>
      </div>
      <div class="surface p-4">
        <div
          class="text-3xl font-bold leading-none"
          class:text-accent-gold={summary.failed_last_24h === 0}
          class:text-red-400={summary.failed_last_24h > 0}
        >
          {summary.failed_last_24h}
        </div>
        <div class="text-xs text-text-muted mt-2 uppercase tracking-wide">Failed (24h)</div>
      </div>
      <div class="surface p-4">
        <div class="text-3xl font-bold text-accent-gold leading-none">{summary.running}</div>
        <div class="text-xs text-text-muted mt-2 uppercase tracking-wide">Running</div>
      </div>
      {#if sparkTotal > 0}
        <div class="surface p-4 flex flex-col justify-between">
          <div
            class="flex items-end gap-[3px] h-10"
            role="img"
            aria-label="Recent routine runs over the past 24 hours"
            title="Recent routine runs over the past 24 hours"
          >
            {#each sparkBuckets as bucket, i (i)}
              {@const total = bucket.success + bucket.failed}
              {@const heightPct = sparkMax > 0 ? Math.max(8, (total / sparkMax) * 100) : 0}
              {@const failedFrac = total > 0 ? bucket.failed / total : 0}
              <div
                class="flex-1 min-w-[3px] flex flex-col justify-end rounded-sm overflow-hidden bg-bg-deep"
                style="height: 100%"
                title={total > 0
                  ? `${23 - i}h ago: ${total} run${total === 1 ? '' : 's'}${bucket.failed > 0 ? ` (${bucket.failed} failed)` : ''}`
                  : `${23 - i}h ago: no runs`}
              >
                {#if total > 0}
                  <!-- Stacked: red on top (failed), cyan on bottom (success).
                       Proportional within the bar's total height. -->
                  {#if bucket.failed > 0}
                    <div
                      class="bg-red-400 w-full"
                      style="height: {heightPct * failedFrac}%"
                    ></div>
                  {/if}
                  {#if bucket.success > 0}
                    <div
                      class="bg-accent-cyan w-full"
                      style="height: {heightPct * (1 - failedFrac)}%"
                    ></div>
                  {/if}
                {/if}
              </div>
            {/each}
          </div>
          <div class="text-xs text-text-muted mt-2 uppercase tracking-wide">Recent runs</div>
        </div>
      {/if}
    </div>

    <!-- Search + filter pills + sort. Same shape as /extensions so the
         controls land where the user already expects them. -->
    <div class="mb-4 flex flex-col gap-3">
      <div
        class="flex flex-wrap items-center gap-1.5"
        role="radiogroup"
        aria-label="Filter routines by enabled state"
      >
        {#each FILTER_PILLS as pill (pill.value)}
          {@const isSelected = filterKey === pill.value}
          <button
            type="button"
            role="radio"
            aria-checked={isSelected}
            onclick={() => (filterKey = pill.value)}
            class="px-3 py-1 rounded-full text-xs font-medium border transition"
            class:bg-accent-cyan={isSelected}
            class:text-bg-deep={isSelected}
            class:border-accent-cyan={isSelected}
            class:bg-bg-deep={!isSelected}
            class:text-text-muted={!isSelected}
            class:border-border-subtle={!isSelected}
            class:hover:text-text-primary={!isSelected}
            class:hover:border-accent-cyan={!isSelected}
          >
            {pill.label}
          </button>
        {/each}
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div class="relative flex-1 min-w-[200px] max-w-md">
          <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-text-muted">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="search"
            bind:value={searchInput}
            placeholder="Search routine name…"
            aria-label="Search routines by name"
            class="w-full bg-bg-deep border border-border-subtle rounded-md pl-10 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-accent-cyan transition-colors min-h-[40px]"
          />
        </div>
        <label class="flex items-center gap-2 text-xs text-text-muted">
          <span class="shrink-0">Sort</span>
          <select
            bind:value={sortKey}
            aria-label="Sort routines"
            class="bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-cyan transition-colors min-h-[40px]"
          >
            {#each SORT_OPTIONS as opt (opt.value)}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </label>
      </div>

      {#if filterActive}
        <div class="flex items-center justify-between gap-3 text-xs text-text-muted">
          <span>
            <span class="text-text-primary font-semibold">{filteredRoutines.length}</span>
            of <span class="text-text-primary">{routines.length}</span>
            {filteredRoutines.length === 1 ? 'routine' : 'routines'}
          </span>
          <button
            type="button"
            onclick={clearFilters}
            class="text-accent-cyan hover:underline"
          >
            Clear filters
          </button>
        </div>
      {/if}
    </div>

    <!-- Main panel -->
    <div class="surface flex-1 overflow-hidden flex flex-col">
      {#if initialLoad && routines.length === 0 && !loadError}
        <div class="flex-1 flex items-center justify-center text-text-muted text-sm">
          Loading routines…
        </div>
      {:else if loadError && routines.length === 0}
        <div class="flex-1 flex flex-col items-center justify-center gap-2 p-8">
          <div class="text-sm text-red-400">Failed to load routines</div>
          <div class="text-xs text-text-muted font-mono">{loadError}</div>
          <button
            type="button"
            onclick={() => void refresh()}
            class="mt-3 px-3 py-1.5 rounded-md border border-accent-cyan text-accent-cyan text-xs hover:bg-accent-cyan hover:text-bg-deep transition-colors"
          >
            Retry
          </button>
        </div>
      {:else if routines.length === 0}
        <div class="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <svg viewBox="0 0 24 24" class="w-10 h-10 text-text-muted" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <div class="text-sm text-text-primary">No routines configured yet.</div>
          <div class="text-xs text-text-muted max-w-sm">
            Create routines via IronClaw's TUI or admin API. They'll show up here
            automatically.
          </div>
          <button
            type="button"
            onclick={() => void refresh()}
            disabled={refreshing}
            class="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-md border border-border-subtle text-xs text-text-muted hover:border-accent-cyan hover:text-accent-cyan transition-colors disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class:animate-spin={refreshing}>
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      {:else if filteredRoutines.length === 0}
        <!-- Filtered-empty state. Distinct from the no-data state above so the
             user gets an action ("Clear filters") instead of a refresh button. -->
        <div class="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <div class="text-sm text-text-primary">No routines match the current filters.</div>
          <button
            type="button"
            onclick={clearFilters}
            class="mt-1 px-3 py-1.5 rounded-md border border-accent-cyan text-accent-cyan text-xs hover:bg-accent-cyan hover:text-bg-deep transition-colors"
          >
            Clear filters
          </button>
        </div>
      {:else}
        <div class="overflow-auto">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-bg-surface z-10">
              <tr class="text-left text-text-muted border-b border-border-subtle">
                <th class="font-medium px-4 py-3">Name</th>
                <th class="font-medium px-4 py-3">
                  <span class="inline-flex items-center gap-1.5">
                    <span>Schedule</span>
                    <!-- Cron-syntax help. Click toggles; Escape closes; click
                         outside closes via the backdrop button below. No
                         library — title attribute is the screen-reader hint
                         and a click-anchored popover handles the rich form. -->
                    <span class="relative inline-flex">
                      <button
                        type="button"
                        onclick={(e) => {
                          e.stopPropagation();
                          cronHelpOpen = !cronHelpOpen;
                        }}
                        aria-label="Cron syntax help"
                        aria-expanded={cronHelpOpen}
                        title={'cron format: m h dom mon dow\n  0 9 * * *      every day at 9am\n  */15 * * * *   every 15 minutes\n  0 0 * * 0      every Sunday at midnight'}
                        class="w-4 h-4 rounded-full border border-border-subtle text-[10px] leading-none text-text-muted hover:border-accent-cyan hover:text-accent-cyan transition-colors flex items-center justify-center"
                      >
                        ?
                      </button>
                      {#if cronHelpOpen}
                        <div
                          role="tooltip"
                          class="absolute top-full left-0 mt-1 z-20 w-72 bg-bg-deep border border-border-subtle rounded-md shadow-lg p-3 text-xs text-text-primary font-mono whitespace-pre normal-case tracking-normal"
                        >
                          <div class="text-text-muted mb-1">cron format: m h dom mon dow</div>
                          <div class="text-text-muted mb-2">Examples:</div>
                          <div><span class="text-accent-cyan">0 9 * * *</span>      every day at 9am</div>
                          <div><span class="text-accent-cyan">*/15 * * * *</span>   every 15 minutes</div>
                          <div><span class="text-accent-cyan">0 0 * * 0</span>      every Sunday at midnight</div>
                        </div>
                      {/if}
                    </span>
                  </span>
                </th>
                <th class="font-medium px-4 py-3 w-24">Enabled</th>
                <th class="font-medium px-4 py-3">Last run</th>
                <th class="font-medium px-4 py-3">Next run</th>
                <th class="font-medium px-4 py-3 w-32 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredRoutines as routine (routine.id)}
                {@const isToggling = togglingIds.has(routine.id)}
                {@const isTriggering = triggeringIds.has(routine.id)}
                {@const isSelected = selectedId === routine.id}
                <tr
                  class="border-b border-border-subtle/40 transition-colors"
                  class:bg-bg-deep={isSelected}
                  class:hover:bg-bg-deep={!isSelected}
                >
                  <td class="px-4 py-3 text-text-primary font-medium">{routine.name}</td>
                  <td class="px-4 py-3 text-text-muted font-mono text-xs">
                    {routine.schedule || '—'}
                  </td>
                  <td class="px-4 py-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={routine.enabled}
                      aria-label={routine.enabled ? 'Disable' : 'Enable'}
                      onclick={() => void onToggle(routine)}
                      disabled={isToggling}
                      class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-wait"
                      class:bg-accent-cyan={routine.enabled}
                      class:bg-border-subtle={!routine.enabled}
                    >
                      <span
                        class="inline-block h-3.5 w-3.5 transform rounded-full bg-bg-deep transition-transform"
                        class:translate-x-4={routine.enabled}
                        class:translate-x-1={!routine.enabled}
                      ></span>
                    </button>
                  </td>
                  <td class="px-4 py-3 text-text-muted text-xs">
                    {relativeTime(routine.last_run)}
                  </td>
                  <td class="px-4 py-3 text-text-muted text-xs">
                    {relativeTime(routine.next_run)}
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onclick={() => void onTrigger(routine)}
                        disabled={isTriggering || !routine.enabled}
                        title={routine.enabled ? 'Trigger now' : 'Enable to trigger'}
                        aria-label="Trigger {routine.name}"
                        class="p-2 rounded-md text-accent-gold hover:bg-accent-gold/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent min-h-[36px] min-w-[36px] flex items-center justify-center"
                      >
                        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onclick={() => openDetail(routine.id)}
                        title="View detail"
                        aria-label="View {routine.name}"
                        class="p-2 rounded-md text-accent-cyan hover:bg-accent-cyan/10 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                      >
                        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}
</section>

{#if cronHelpOpen}
  <!-- Click-outside backdrop. Transparent, full-viewport, sits below the
       popover (z-10) but above the rest of the page so any click anywhere
       else dismisses the help. Keyboard close is wired via the $effect
       above (Escape). -->
  <button
    type="button"
    aria-label="Close cron help"
    onclick={() => (cronHelpOpen = false)}
    class="fixed inset-0 z-10 cursor-default bg-transparent"
  ></button>
{/if}

{#if selected}
  <DetailPanel routine={selected} onclose={closeDetail} />
{/if}
