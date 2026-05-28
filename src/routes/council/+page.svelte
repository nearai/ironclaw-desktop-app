<script lang="ts">
  // /council — LLM Council surface.
  //
  // Pick 2-4 providers from the gateway's `/api/llm/providers` catalog,
  // fire the same prompt at each (sequentially — see store comment),
  // render the responses side-by-side, optionally promote one into a
  // chat thread.
  //
  // Lifecycle:
  //   - onMount → fetch the provider catalog + hydrate selected ids from
  //     localStorage; register Cmd+R refresh for catalog re-pull.
  //   - Convene → store.convene() runs the fanout. Columns update
  //     reactively from the store's runs[] $state.
  //   - Promote → store.promote(idx) creates a new thread, seeds it,
  //     and navigates to /.
  //   - onDestroy → unregister Cmd+R. Runs are kept across navigation
  //     within the same session (handy when the user wants to jump to a
  //     promoted thread and come back). Cleared on full reload.

  import { onDestroy, onMount, type Component } from 'svelte';
  import { goto } from '$app/navigation';
  import type { LlmProvider } from '$lib/api/types';
  import { connection } from '$lib/stores/connection.svelte';
  import { council } from '$lib/stores/council.svelte';
  import { toasts } from '$lib/stores/toasts.svelte';
  import { surfaceRefresh } from '$lib/stores/surface-refresh.svelte';

  // ---- Local state ------------------------------------------------------
  let CouncilColumn = $state<Component<any> | null>(null);

  /** Prompt composer text. Not persisted — a council session is
   *  ephemeral by design (unlike chat threads). */
  let prompt = $state<string>('');

  /** Provider catalog from the gateway. Loaded on mount and refreshed
   *  via Cmd+R. Empty array while loading or on disconnect. */
  let providers = $state<LlmProvider[]>([]);

  /** True while the catalog is being fetched. Drives the loading
   *  placeholder for the picker. */
  let catalogLoading = $state<boolean>(true);

  /** Error from the catalog fetch, surfaced inline so the user can
   *  see "Failed to load providers: <msg>" rather than an empty list. */
  let catalogError = $state<string | null>(null);

  // ---- Provider catalog fetch ------------------------------------------

  async function loadCatalog(): Promise<void> {
    const client = connection.client;
    if (!client) {
      catalogLoading = false;
      catalogError = 'IronClaw is not connected';
      providers = [];
      return;
    }
    catalogLoading = true;
    catalogError = null;
    try {
      providers = await client.listLlmProviders();
      if (providers.length === 0) {
        // Empty catalog is a valid state (e.g. a fresh install before
        // any provider is configured) — surface it as a hint rather
        // than an error so the user knows where to go.
        catalogError = null;
      }
    } catch (err) {
      catalogError = (err as Error).message;
      providers = [];
    } finally {
      catalogLoading = false;
    }
  }

  // ---- Provider chip palette ------------------------------------------
  //
  // Each provider gets a stable chip color so the same provider always
  // reads the same on the grid. Pinned to a small palette so we don't
  // need to register dozens of per-provider tailwind utilities; the
  // tint cycles via a hash of providerId when the catalog grows beyond
  // the palette length.

  const CHIP_PALETTE = [
    'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30',
    'bg-accent-gold/15 text-accent-gold border border-accent-gold/30',
    'bg-green-500/15 text-green-300 border border-green-500/30',
    'bg-violet-400/15 text-violet-300 border border-violet-400/30',
    'bg-rose-400/15 text-rose-300 border border-rose-400/30',
    'bg-teal-400/15 text-teal-300 border border-teal-400/30'
  ];

  /** Stable hash → palette slot for a provider id. */
  function chipClass(providerId: string): string {
    let h = 0;
    for (let i = 0; i < providerId.length; i += 1) {
      h = (h * 31 + providerId.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(h) % CHIP_PALETTE.length;
    return CHIP_PALETTE[idx];
  }

  /** Resolve a provider's display name from the loaded catalog. Falls
   *  back to the id (so promoted columns don't render "undefined" if
   *  the catalog hasn't reloaded between convene and now). */
  function providerName(providerId: string): string {
    return providers.find((p) => p.id === providerId)?.name ?? providerId;
  }

  // ---- Selection limits + UI gates -----------------------------------
  //
  // The brief asks for 2-4 providers. We enforce the upper bound at
  // toggle time (refuse the click when at max) and the lower bound at
  // convene time (Convene button disabled below 2). The upper bound
  // is a soft limit — a more generous "5+" path was considered but
  // the sequential fanout latency budget tops out around 4 columns
  // before the user-facing wait becomes painful (each provider
  // serially runs a full SSE stream).

  const MIN_PROVIDERS = 2;
  const MAX_PROVIDERS = 4;

  const selectedCount = $derived(council.selectedProviderIds.length);
  const overLimit = $derived(selectedCount > MAX_PROVIDERS);
  const canConvene = $derived(
    !council.convening &&
      selectedCount >= MIN_PROVIDERS &&
      selectedCount <= MAX_PROVIDERS &&
      prompt.trim().length > 0
  );

  function onToggleProvider(id: string): void {
    const already = council.selectedProviderIds.includes(id);
    if (!already && selectedCount >= MAX_PROVIDERS) {
      toasts.show(`Pick at most ${MAX_PROVIDERS} providers per council.`, 'info');
      return;
    }
    council.toggleSelected(id);
  }

  // ---- Convene ---------------------------------------------------------

  async function onConvene(): Promise<void> {
    const client = connection.client;
    if (!client) {
      toasts.show('Not connected — check Settings.', 'error');
      return;
    }
    if (!canConvene) return;
    const ids = [...council.selectedProviderIds];
    try {
      await council.convene(prompt, ids, client);
      toasts.show('Council complete.', 'success');
    } catch (err) {
      toasts.show(`Council failed: ${(err as Error).message}`, 'error');
    }
  }

  // ---- Promote ---------------------------------------------------------

  async function onPromote(idx: number): Promise<void> {
    const client = connection.client;
    if (!client) {
      toasts.show('Not connected — check Settings.', 'error');
      return;
    }
    try {
      const threadId = await council.promote(idx, client);
      // Navigate to chat with the new thread selected. The chat
      // surface reads the thread via the threads store (which
      // promote() already refreshed). Hash-style deep link keeps
      // the URL clean.
      await goto(`/?thread=${encodeURIComponent(threadId)}`);
    } catch {
      // promote() already surfaces a toast on failure.
    }
  }

  // ---- New session -----------------------------------------------------

  function onNewSession(): void {
    council.reset();
    prompt = '';
  }

  // ---- Lifecycle -------------------------------------------------------

  onMount(async () => {
    CouncilColumn = (await import('$lib/components/CouncilColumn.svelte')).default;
    council.hydrate();
    void loadCatalog();
    surfaceRefresh.register(async () => {
      await loadCatalog();
    });
  });

  onDestroy(() => {
    surfaceRefresh.unregister();
  });

  // ---- Reactive: re-fetch catalog when the connection comes online ----
  //
  // The route may mount before the gateway is ready (e.g. cold start
  // landing on /council via deep link). Once `connection.client` becomes
  // available, re-pull the catalog so the picker shows providers without
  // a manual refresh. Guarded by `lastClientToken` so re-renders of the
  // same connected client don't spam the network.

  let lastClientToken = $state<string | null>(null);
  $effect(() => {
    const token = connection.client?.token ?? null;
    if (token && token !== lastClientToken) {
      lastClientToken = token;
      void loadCatalog();
    }
  });

  // Column grid template. 2 / 3 / 4 columns based on runs.length so the
  // grid reflows cleanly when the user picks a different number of
  // providers. Two columns side-by-side on a 16" display reads well;
  // four columns collapse to ~25% width which is still readable for
  // streamed prose.
  const gridCols = $derived.by<string>(() => {
    const n = council.runs.length;
    if (n <= 1) return 'grid-cols-1';
    if (n === 2) return 'grid-cols-1 lg:grid-cols-2';
    if (n === 3) return 'grid-cols-1 lg:grid-cols-3';
    return 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-4';
  });
</script>

<section class="p-8 h-full flex flex-col min-h-0">
  <header class="mb-4 flex items-start justify-between gap-4 shrink-0">
    <div>
      <h1 class="text-2xl font-semibold text-text-primary">Council</h1>
      <p class="text-text-muted text-sm mt-1">
        Send one prompt to multiple providers. Compare the answers side-by-side.
      </p>
    </div>
    {#if council.runs.length > 0}
      <button
        type="button"
        onclick={onNewSession}
        disabled={council.convening}
        class="flex items-center gap-2 px-3 py-2 rounded-md border border-border-subtle text-xs text-text-muted hover:border-accent-cyan hover:text-accent-cyan transition-colors disabled:opacity-50 min-h-[36px]"
      >
        New session
      </button>
    {/if}
  </header>

  <!-- Sequential-fanout banner. Spells out the gateway constraint so
       the user is not confused when a four-provider council takes a
       minute. The exact wording mirrors the prompt's directive. -->
  <div
    class="mb-4 px-3 py-2 rounded-md border border-accent-gold/30 bg-accent-gold/5 text-xs text-accent-gold shrink-0"
    role="note"
  >
    <span class="font-semibold">Heads up:</span> each provider runs sequentially because the gateway has
    one active LLM at a time. A four-provider council can take a few minutes.
  </div>

  {#if connection.status !== 'connected'}
    <!-- Disconnected guard. Mirrors the pattern in /jobs and /missions
         so an offline state reads the same across surfaces. -->
    <div class="surface flex-1 flex flex-col items-center justify-center gap-2 p-8">
      <div class="text-sm text-text-primary">IronClaw is offline</div>
      <div class="text-xs text-text-muted">
        Check <a
          href="/settings"
          class="text-accent-cyan underline decoration-dotted hover:decoration-solid">Settings</a
        > to verify the gateway connection.
      </div>
    </div>
  {:else}
    <!-- Composer + picker -->
    <div class="surface border border-border-subtle rounded-md p-4 mb-4 shrink-0">
      <label
        for="council-prompt"
        class="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2"
      >
        Prompt
      </label>
      <textarea
        id="council-prompt"
        bind:value={prompt}
        rows="4"
        placeholder="Ask the council a question. The same prompt will run on every selected provider."
        disabled={council.convening}
        class="w-full px-3 py-2 rounded-md bg-bg-deep border border-border-subtle text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-accent-cyan disabled:opacity-50 resize-y min-h-[100px]"
      ></textarea>

      <div class="mt-4 flex items-start justify-between gap-4 flex-wrap">
        <div class="flex-1 min-w-[280px]">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Providers
            </span>
            <span class="text-[11px] text-text-muted">
              {selectedCount} selected · pick {MIN_PROVIDERS}–{MAX_PROVIDERS}
            </span>
          </div>
          {#if catalogLoading}
            <div class="text-xs text-text-muted italic">Loading providers…</div>
          {:else if catalogError}
            <div class="text-xs text-red-400">{catalogError}</div>
          {:else if providers.length === 0}
            <div class="text-xs text-text-muted">
              No providers configured. Visit <a
                href="/settings"
                class="text-accent-cyan underline decoration-dotted hover:decoration-solid"
                >Settings</a
              > to add one.
            </div>
          {:else}
            <div class="flex flex-wrap gap-2">
              {#each providers as provider (provider.id)}
                {@const checked = council.selectedProviderIds.includes(provider.id)}
                {@const atCap = !checked && selectedCount >= MAX_PROVIDERS}
                <label
                  class="flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs cursor-pointer transition-colors min-h-[32px]"
                  class:border-accent-cyan={checked}
                  class:bg-accent-cyan={false}
                  class:text-text-primary={checked}
                  class:border-border-subtle={!checked}
                  class:text-text-muted={!checked && !atCap}
                  class:opacity-40={atCap}
                  class:cursor-not-allowed={atCap || council.convening}
                  class:hover:border-accent-cyan={!atCap && !council.convening}
                  title={atCap
                    ? `At most ${MAX_PROVIDERS} providers per council.`
                    : (provider.description ?? provider.id)}
                >
                  <input
                    type="checkbox"
                    {checked}
                    disabled={(atCap && !checked) || council.convening}
                    onchange={() => onToggleProvider(provider.id)}
                    class="accent-accent-cyan"
                  />
                  <span class="font-medium">{provider.name}</span>
                  {#if !provider.configured}
                    <span
                      class="text-[10px] uppercase tracking-wider text-accent-gold"
                      title="Not configured"
                    >
                      setup
                    </span>
                  {/if}
                </label>
              {/each}
            </div>
            {#if overLimit}
              <div class="mt-2 text-[11px] text-accent-gold">
                Too many selected — uncheck a provider.
              </div>
            {/if}
          {/if}
        </div>

        <button
          type="button"
          onclick={() => void onConvene()}
          disabled={!canConvene}
          class="px-6 py-2.5 rounded-md font-semibold text-sm transition-colors min-h-[44px] shrink-0"
          class:bg-accent-cyan={canConvene}
          class:text-bg-deep={canConvene}
          class:hover:bg-accent-cyan={canConvene}
          class:bg-bg-deep={!canConvene}
          class:text-text-muted={!canConvene}
          class:border={!canConvene}
          class:border-border-subtle={!canConvene}
          class:cursor-not-allowed={!canConvene}
        >
          {#if council.convening}
            Convening…
          {:else}
            Convene Council
          {/if}
        </button>
      </div>
    </div>

    <!-- Column grid. Empty state surfaces a hint about the workflow.
         Once convene() seeds runs[], each row renders as a column.
         The grid's row height is `min-h-0` so each column can scroll
         independently inside the viewport. -->
    {#if council.runs.length === 0}
      <div
        class="surface flex-1 flex flex-col items-center justify-center gap-2 p-8 text-text-muted"
      >
        <div class="text-sm text-text-primary">No session yet</div>
        <div class="text-xs">Write a prompt, pick 2–4 providers, and click Convene Council.</div>
      </div>
    {:else}
      <div class="flex-1 min-h-0 grid {gridCols} gap-3 overflow-hidden">
        {#each council.runs as run, idx (run.providerId + idx)}
          <CouncilColumn
            {run}
            providerName={providerName(run.providerId)}
            accentClass={chipClass(run.providerId)}
            onPromote={() => void onPromote(idx)}
          />
        {/each}
      </div>
    {/if}
  {/if}
</section>
