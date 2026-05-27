<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { Routine, RoutineSummary } from '$lib/api/types';
  import { connection } from '$lib/stores/connection.svelte';
  import DetailPanel from './DetailPanel.svelte';
  import { toasts } from '$lib/stores/toasts.svelte';
  import { notifications } from '$lib/stores/notifications.svelte';
  import { relativeTime } from './time';

  const POLL_INTERVAL_MS = 30_000;

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

  // Routine-completion notification bookkeeping. We track the `last_run`
  // timestamp seen on the previous poll per routine id; when it advances
  // we know the routine just completed and we can fetch the run to learn
  // success vs failure. The seeded flag suppresses notifications on the
  // FIRST poll so we don't spam every existing routine when the app
  // launches and observes historical state.
  let prevLastRunByRoutine: Record<string, string | undefined> = {};
  let seededLastRun = false;

  const selected = $derived(routines.find((r) => r.id === selectedId) ?? null);

  onMount(() => {
    void refresh();
    pollTimer = setInterval(() => {
      void refresh({ silent: true });
    }, POLL_INTERVAL_MS);
  });

  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
    // Don't toasts.clear() here — the store is now shared across the
    // whole app via the root layout, and unmounting this page must not
    // wipe toasts queued by another surface.
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
              sound: 'default'
            });
          } else if (top.status === 'failed') {
            void notifications.notify({
              title: 'Routine failed',
              body: `${r.name} failed`,
              sound: 'default'
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
    <!-- Stat strip -->
    <div class="grid grid-cols-4 gap-3 mb-6">
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
      {:else}
        <div class="overflow-auto">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-bg-surface z-10">
              <tr class="text-left text-text-muted border-b border-border-subtle">
                <th class="font-medium px-4 py-3">Name</th>
                <th class="font-medium px-4 py-3">Schedule</th>
                <th class="font-medium px-4 py-3 w-24">Enabled</th>
                <th class="font-medium px-4 py-3">Last run</th>
                <th class="font-medium px-4 py-3">Next run</th>
                <th class="font-medium px-4 py-3 w-32 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each routines as routine (routine.id)}
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

{#if selected}
  <DetailPanel routine={selected} onclose={closeDetail} />
{/if}
