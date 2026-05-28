<script lang="ts">
  // Dashboard / "Today" surface (R77 / lane W1).
  //
  // The new home tier per docs/WORKSPACE-OS.md §60 — a tile grid of live
  // + scheduled widgets. v1 ships three tile kinds (recent threads,
  // active routines, recent skills); user-rearrangeable, layout
  // persisted in localStorage by the dashboard store. Custom tiles
  // promoted from chat/council (W5 generative-widget framework) plug
  // into the existing grid via the `'custom'` kind.
  //
  // The route is intentionally thin — TileGrid owns the layout +
  // drag-drop, and each individual tile owns its own data fetch and
  // refresh cadence. We only ensure the connection is initialized so
  // the tiles' `client.list*()` calls succeed.

  import { onMount } from 'svelte';
  import { connection } from '$lib/stores/connection.svelte';
  import TileGrid from '$lib/components/dashboard/TileGrid.svelte';

  onMount(async () => {
    // Connection is normally initialized by the root layout, but the
    // dashboard route can land first (e.g. user opens via Cmd+0 on
    // app launch). Calling `init()` again is a cheap idempotent
    // operation — the store dedupes via `initialized` + `initPromise`.
    if (!connection.client) {
      try {
        await connection.init();
      } catch {
        // Tile-level error handlers surface load failures inline; we
        // don't need a route-level toast here.
      }
    }
  });
</script>

<svelte:head>
  <title>Today · IronClaw</title>
</svelte:head>

<div class="p-6 h-full overflow-auto">
  <header class="mb-6 flex items-baseline justify-between gap-4">
    <div>
      <h1 class="text-2xl font-medium text-text-primary">Today</h1>
      <p class="text-sm text-text-muted">Live + scheduled across your workspace.</p>
    </div>
  </header>

  <TileGrid />
</div>
