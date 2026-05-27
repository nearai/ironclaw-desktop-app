<script lang="ts">
  import { onMount } from 'svelte';
  import { connection } from '$lib/stores/connection.svelte';
  import { toasts } from '$lib/stores/toasts.svelte';
  import type { Extension } from '$lib/api/types';
  import ExtensionCard from './ExtensionCard.svelte';
  import SetupDrawer from './SetupDrawer.svelte';

  type Tab = 'installed' | 'registry';
  type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

  // Refresh the installed list + readiness every 30s while the tab is open.
  // The interval is cleared on unmount and whenever the user switches modes
  // (the connection store handles its own polling separately).
  const REFRESH_INTERVAL_MS = 30_000;

  let activeTab = $state<Tab>('installed');

  let installedState = $state<LoadState>('idle');
  let installedError = $state<string | null>(null);
  let installed = $state<Extension[]>([]);

  let registryState = $state<LoadState>('idle');
  let registryError = $state<string | null>(null);
  let registry = $state<Extension[]>([]);

  // Per-extension "currently mutating" set so we can disable the right cards
  // while their install/activate/remove call is in flight.
  let busyNames = $state<Set<string>>(new Set());

  // Setup drawer state.
  let setupTarget = $state<Extension | null>(null);

  // Search input (registry tab only).
  let searchInput = $state('');
  let debouncedQuery = $state('');
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  let refreshTimer: ReturnType<typeof setInterval> | null = null;

  const isDisconnected = $derived(
    connection.status === 'disconnected' ||
      connection.status === 'idle' ||
      !connection.client
  );

  const filteredRegistry = $derived.by(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return registry;
    return registry.filter((e) => {
      const haystack = [
        e.name,
        e.display_name ?? '',
        e.description ?? '',
        ...(e.keywords ?? [])
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  });

  // Debounce the search input (registry tab).
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

  // Auto-load when connection becomes available — handles both cold-start
  // (mount-before-init) and reconnects (mode-switch in /settings).
  $effect(() => {
    const client = connection.client;
    if (!client) {
      installedState = 'idle';
      registryState = 'idle';
      stopRefresh();
      return;
    }
    if (installedState === 'idle') void loadInstalled();
    if (registryState === 'idle') void loadRegistry();
    startRefresh();
  });

  onMount(() => {
    void connection.init();
    return () => stopRefresh();
  });

  function startRefresh() {
    if (refreshTimer) return;
    refreshTimer = setInterval(() => {
      // Quietly refresh the installed list + its readiness. Don't toast on
      // failure during the silent poll — keep the last good state visible.
      void loadInstalled({ quiet: true });
    }, REFRESH_INTERVAL_MS);
  }

  function stopRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  async function loadInstalled(opts: { quiet?: boolean } = {}) {
    const client = connection.client;
    if (!client) return;
    if (!opts.quiet) {
      installedState = installed.length === 0 ? 'loading' : installedState;
      installedError = null;
    }
    try {
      const list = await client.listExtensions();
      installed = list.slice().sort((a, b) => a.name.localeCompare(b.name));
      installedState = 'loaded';
    } catch (err) {
      installedError = (err as Error).message;
      if (!opts.quiet) {
        installedState = 'error';
        toasts.show(`Failed to load extensions: ${installedError}`, 'error');
      }
    }
  }

  async function loadRegistry() {
    const client = connection.client;
    if (!client) return;
    registryState = 'loading';
    registryError = null;
    try {
      const list = await client.listRegistry();
      registry = list.slice().sort((a, b) =>
        (a.display_name ?? a.name).localeCompare(b.display_name ?? b.name)
      );
      registryState = 'loaded';
    } catch (err) {
      registryError = (err as Error).message;
      registryState = 'error';
      toasts.show(`Failed to load registry: ${registryError}`, 'error');
    }
  }

  function setBusy(name: string, busy: boolean) {
    const next = new Set(busyNames);
    if (busy) next.add(name);
    else next.delete(name);
    busyNames = next;
  }

  async function handleInstall(ext: Extension) {
    const client = connection.client;
    if (!client) return;
    setBusy(ext.name, true);
    try {
      const res = await client.installExtension(ext.name);
      if (res.ok) {
        toasts.show(`Installed ${ext.display_name ?? ext.name}`, 'success');
      } else {
        toasts.show(`Install request sent for ${ext.name}`, 'info');
      }
      // Refresh both panes — registry's `installed` flag and the installed
      // list both move when this succeeds.
      await Promise.all([loadInstalled(), loadRegistry()]);
    } catch (err) {
      toasts.show(`Install failed: ${(err as Error).message}`, 'error');
    } finally {
      setBusy(ext.name, false);
    }
  }

  async function handleToggleActivate(ext: Extension) {
    const client = connection.client;
    if (!client) return;
    setBusy(ext.name, true);
    try {
      // The gateway exposes activate; deactivate is not in the documented
      // surface so we call activate as a toggle. If the server adds a
      // dedicated /deactivate endpoint later, swap on `ext.active` here.
      const res = await client.activateExtension(ext.name);
      if (res.ok) {
        toasts.show(
          `${ext.active ? 'Toggled' : 'Activated'} ${ext.display_name ?? ext.name}`,
          'success'
        );
      }
      await loadInstalled();
    } catch (err) {
      toasts.show(`Action failed: ${(err as Error).message}`, 'error');
    } finally {
      setBusy(ext.name, false);
    }
  }

  async function handleRemove(ext: Extension) {
    const client = connection.client;
    if (!client) return;
    // Native confirm is consistent with Tauri's webview and avoids pulling
    // in a modal component just for the destructive-action gate.
    const label = ext.display_name ?? ext.name;
    if (!confirm(`Remove ${label}? This will uninstall it from IronClaw.`)) {
      return;
    }
    setBusy(ext.name, true);
    try {
      const res = await client.removeExtension(ext.name);
      if (res.ok) {
        toasts.show(`Removed ${label}`, 'success');
      }
      await Promise.all([loadInstalled(), loadRegistry()]);
    } catch (err) {
      toasts.show(`Remove failed: ${(err as Error).message}`, 'error');
    } finally {
      setBusy(ext.name, false);
    }
  }

  function openSetup(ext: Extension) {
    setupTarget = ext;
  }

  function closeSetup() {
    setupTarget = null;
  }

  async function handleSetupSaved() {
    // Setup flow may have switched readiness from "needs setup" → "ready".
    await loadInstalled();
  }

  function setTab(t: Tab) {
    activeTab = t;
  }

  const showInstalledSkeleton = $derived(
    !isDisconnected &&
      (installedState === 'idle' || installedState === 'loading') &&
      installed.length === 0
  );
  const showRegistrySkeleton = $derived(
    !isDisconnected &&
      (registryState === 'idle' || registryState === 'loading') &&
      registry.length === 0
  );
</script>

<section class="p-8 h-full flex flex-col overflow-hidden">
  <header class="mb-5 flex items-baseline justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold text-text-primary">Extensions</h1>
      <p class="text-text-muted text-sm mt-1">
        MCP servers, OAuth tools, and channel integrations.
        {#if installedState === 'loaded'}
          <span class="text-text-muted/70">·</span>
          <span class="text-text-muted">{installed.length} installed</span>
        {/if}
      </p>
    </div>
  </header>

  <!-- Tabs -->
  <div class="mb-5 flex items-center gap-1 border-b border-border-subtle">
    <button
      type="button"
      onclick={() => setTab('installed')}
      class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition"
      class:border-accent-cyan={activeTab === 'installed'}
      class:text-accent-cyan={activeTab === 'installed'}
      class:border-transparent={activeTab !== 'installed'}
      class:text-text-muted={activeTab !== 'installed'}
      class:hover:text-text-primary={activeTab !== 'installed'}
    >
      Installed
      {#if installed.length > 0}
        <span class="ml-1.5 text-[10px] font-mono text-text-muted bg-bg-deep px-1.5 py-0.5 rounded">
          {installed.length}
        </span>
      {/if}
    </button>
    <button
      type="button"
      onclick={() => setTab('registry')}
      class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition"
      class:border-accent-cyan={activeTab === 'registry'}
      class:text-accent-cyan={activeTab === 'registry'}
      class:border-transparent={activeTab !== 'registry'}
      class:text-text-muted={activeTab !== 'registry'}
      class:hover:text-text-primary={activeTab !== 'registry'}
    >
      Registry
      {#if registry.length > 0}
        <span class="ml-1.5 text-[10px] font-mono text-text-muted bg-bg-deep px-1.5 py-0.5 rounded">
          {registry.length}
        </span>
      {/if}
    </button>
  </div>

  {#if activeTab === 'registry'}
    <!-- Registry search -->
    <div class="mb-5 relative max-w-md">
      <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-text-muted">
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </span>
      <input
        type="search"
        bind:value={searchInput}
        placeholder="Search extensions…"
        disabled={isDisconnected}
        class="w-full bg-bg-deep border border-border-subtle rounded-md pl-10 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-accent-cyan transition-colors min-h-[40px] disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  {/if}

  <!-- Content -->
  <div class="flex-1 overflow-auto -mx-2 px-2">
    {#if isDisconnected}
      <div class="surface p-10 flex flex-col items-center justify-center text-center min-h-[280px]">
        <div class="text-sm text-text-primary mb-2">IronClaw is offline</div>
        <div class="text-xs text-text-muted">
          Check <a href="/settings" class="text-accent-cyan hover:underline">Settings</a> to configure the connection.
        </div>
      </div>
    {:else if activeTab === 'installed'}
      {#if installedState === 'error'}
        <div class="surface p-10 flex flex-col items-center justify-center text-center min-h-[280px]">
          <div class="text-sm text-red-400 mb-2">Failed to load extensions</div>
          <div class="text-xs text-text-muted font-mono mb-4 max-w-md break-words">
            {installedError ?? 'Unknown error'}
          </div>
          <button
            type="button"
            onclick={() => loadInstalled()}
            class="px-4 py-2 rounded-md border border-accent-cyan text-accent-cyan text-sm font-semibold hover:bg-accent-cyan hover:text-bg-deep transition min-h-[40px]"
          >
            Retry
          </button>
        </div>
      {:else if showInstalledSkeleton}
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {#each Array(6) as _, i (i)}
            <div class="rounded-lg border border-border-subtle bg-bg-surface p-4 min-h-[180px] animate-pulse">
              <div class="h-4 w-1/3 bg-border-subtle rounded mb-3"></div>
              <div class="h-3 w-full bg-border-subtle rounded mb-2"></div>
              <div class="h-3 w-4/5 bg-border-subtle rounded mb-6"></div>
              <div class="flex justify-between items-center">
                <div class="h-5 w-20 bg-border-subtle rounded"></div>
                <div class="h-7 w-24 bg-border-subtle rounded"></div>
              </div>
            </div>
          {/each}
        </div>
      {:else if installed.length === 0}
        <div class="surface p-10 flex flex-col items-center justify-center text-center min-h-[280px]">
          <div class="text-sm text-text-primary mb-1">No extensions installed</div>
          <div class="text-xs text-text-muted">
            Browse the <button type="button" onclick={() => setTab('registry')} class="text-accent-cyan hover:underline">Registry</button> to add some.
          </div>
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
          {#each installed as ext (ext.name)}
            <ExtensionCard
              extension={ext}
              variant="installed"
              busy={busyNames.has(ext.name)}
              onSetup={openSetup}
              onToggleActivate={handleToggleActivate}
              onRemove={handleRemove}
            />
          {/each}
        </div>
      {/if}
    {:else if activeTab === 'registry'}
      {#if registryState === 'error'}
        <div class="surface p-10 flex flex-col items-center justify-center text-center min-h-[280px]">
          <div class="text-sm text-red-400 mb-2">Failed to load registry</div>
          <div class="text-xs text-text-muted font-mono mb-4 max-w-md break-words">
            {registryError ?? 'Unknown error'}
          </div>
          <button
            type="button"
            onclick={loadRegistry}
            class="px-4 py-2 rounded-md border border-accent-cyan text-accent-cyan text-sm font-semibold hover:bg-accent-cyan hover:text-bg-deep transition min-h-[40px]"
          >
            Retry
          </button>
        </div>
      {:else if showRegistrySkeleton}
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {#each Array(6) as _, i (i)}
            <div class="rounded-lg border border-border-subtle bg-bg-surface p-4 min-h-[180px] animate-pulse">
              <div class="h-4 w-1/3 bg-border-subtle rounded mb-3"></div>
              <div class="h-3 w-full bg-border-subtle rounded mb-2"></div>
              <div class="h-3 w-4/5 bg-border-subtle rounded mb-6"></div>
            </div>
          {/each}
        </div>
      {:else if filteredRegistry.length === 0 && debouncedQuery.trim().length > 0}
        <div class="surface p-10 flex flex-col items-center justify-center text-center min-h-[280px]">
          <div class="text-sm text-text-primary mb-1">No matching extensions</div>
          <div class="text-xs text-text-muted">
            No registry entries match «<span class="text-text-primary">{debouncedQuery}</span>».
          </div>
        </div>
      {:else if filteredRegistry.length === 0}
        <div class="surface p-10 flex flex-col items-center justify-center text-center min-h-[280px]">
          <div class="text-sm text-text-muted">The registry is empty.</div>
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
          {#each filteredRegistry as ext (ext.name)}
            <ExtensionCard
              extension={ext}
              variant="registry"
              busy={busyNames.has(ext.name)}
              onInstall={handleInstall}
            />
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</section>

{#if setupTarget}
  <SetupDrawer
    extension={setupTarget}
    onClose={closeSetup}
    onSaved={handleSetupSaved}
  />
{/if}
