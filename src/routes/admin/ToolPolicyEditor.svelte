<script lang="ts">
  // Tool-policy editor.
  //
  // Loads the live tool catalog + the admin policy, joins them into a
  // table, and lets the operator flip each tool's action between Allow,
  // Prompt, and Deny. Save/Discard buttons gate on a `dirty` derivation
  // so the user can't accidentally re-save a no-op (and can clearly see
  // their pending changes).
  //
  // Wire-shape detail: the gateway stores a *disabled* list, not a 3-way
  // map. The client (`setToolPolicy`) collapses `deny` entries into that
  // list on save; on load, anything not in the list defaults to `prompt`
  // (the natural "no opinion yet" state). See ironclaw.ts for the full
  // mapping rationale.
  //
  // UX surface (admin prefs):
  //   - Debounced search input (250ms) over name + extension + description.
  //   - Action filter pills (All / Allow / Prompt / Deny).
  //   - Both persist in localStorage `ironclaw-admin-prefs` so the editor
  //     comes back where the operator left it. Bulk actions scope to the
  //     visible subset when a filter is active, with a confirm above 5 rows.

  import { onMount } from 'svelte';
  import { connection } from '$lib/stores/connection.svelte';
  import { toasts } from '$lib/stores/toasts.svelte';
  import type { ExtensionTool, ToolPolicy, ToolPolicyAction } from '$lib/api/types';

  type LoadState = 'idle' | 'loading' | 'loaded' | 'error';
  type SaveState = 'idle' | 'saving' | 'saved' | 'error';

  // Default action for tools not explicitly listed in the server policy.
  // The server treats absence-from-disabled as "enabled"; we expose it as
  // `prompt` so the UI's 3-way radio has a meaningful resting state.
  const DEFAULT_ACTION: ToolPolicyAction = 'prompt';

  // Segmented-radio options. Static; lives at script scope so the inner
  // `{#each}` can iterate it directly without an in-template `{@const}`
  // (which would have to be the immediate child of the parent `{#each}`).
  type RadioOption = {
    v: ToolPolicyAction;
    label: string;
    tint: 'green' | 'gold' | 'red';
  };
  const RADIO_OPTIONS: RadioOption[] = [
    { v: 'allow', label: 'Allow', tint: 'green' },
    { v: 'prompt', label: 'Prompt', tint: 'gold' },
    { v: 'deny', label: 'Deny', tint: 'red' }
  ];

  // Filter pill domain. `all` short-circuits the action filter; the others
  // narrow to a single action. Kept as a union so the radio loop below is
  // type-checked against the same shape as `actionFilter`.
  type ActionFilter = 'all' | ToolPolicyAction;
  type FilterPill = { v: ActionFilter; label: string };
  const FILTER_PILLS: FilterPill[] = [
    { v: 'all', label: 'All' },
    { v: 'allow', label: 'Allow' },
    { v: 'prompt', label: 'Prompt' },
    { v: 'deny', label: 'Deny' }
  ];

  // Shared localStorage key for the whole admin route. The system-prompt
  // editor uses its own keys; this one stores tool-policy preferences.
  const LS_KEY = 'ironclaw-admin-prefs';
  type PersistedPrefs = {
    search?: string;
    actionFilter?: ActionFilter;
  };

  let loadState = $state<LoadState>('idle');
  let loadError = $state<string | null>(null);

  let saveState = $state<SaveState>('idle');
  let saveError = $state<string | null>(null);

  // Hydrated from the server. `serverPolicy` is the snapshot used for
  // dirty-checking; `policy` is the working draft the user edits.
  let tools = $state<ExtensionTool[]>([]);
  let serverPolicy = $state<ToolPolicy>({});
  let policy = $state<ToolPolicy>({});
  // Per-user overrides (`{user_id: [tool, ...]}`) we don't edit here but
  // must preserve on save — otherwise a global PUT would wipe them out.
  let userOverrides = $state<Record<string, string[]>>({});

  // Live input bound to the search field. `debouncedSearch` lags behind by
  // 250ms and is what the filter actually reads — avoids re-deriving the
  // filtered row list (and re-rendering hundreds of rows) on every keystroke.
  let searchInput = $state('');
  let debouncedSearch = $state('');
  let actionFilter = $state<ActionFilter>('all');

  // Forbidden-error trigger: the route owns the 403 banner, but we also
  // surface the message inline if the load itself returned forbidden.
  let forbidden = $state(false);

  const isDisconnected = $derived(
    connection.status === 'disconnected' ||
      connection.status === 'idle' ||
      !connection.client
  );

  // Project the catalog + draft policy onto a single row shape. We
  // synthesize a row for every catalog tool, defaulting any unknown
  // policy entry to `prompt`. Server-side disabled tools that the local
  // catalog doesn't know about (rare — happens if MCP servers drift
  // between loads) appear in `extraRows` below so they don't silently
  // vanish from the editor.
  const catalogRows = $derived.by(() => {
    return tools.map((t) => ({
      name: t.name,
      extension: t.extension || '',
      description: t.description ?? '',
      action: policy[t.name] ?? DEFAULT_ACTION
    }));
  });

  const extraRows = $derived.by(() => {
    const known = new Set(tools.map((t) => t.name));
    return Object.entries(policy)
      .filter(([name]) => !known.has(name))
      .map(([name, action]) => ({
        name,
        extension: '(unknown — server-only)',
        description: '',
        action
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  const allRows = $derived([...catalogRows, ...extraRows]);

  // Filtered view = search query AND action filter. The search side reads
  // `debouncedSearch` (lags 250ms behind keystrokes); the pill side reads
  // `actionFilter` directly because pill clicks aren't high-frequency.
  const filteredRows = $derived.by(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return allRows.filter((r) => {
      if (actionFilter !== 'all' && r.action !== actionFilter) return false;
      if (!q) return true;
      const hay = `${r.name} ${r.extension} ${r.description}`.toLowerCase();
      return hay.includes(q);
    });
  });

  const filterActive = $derived(
    actionFilter !== 'all' || debouncedSearch.trim().length > 0
  );

  // Dirty whenever the working policy diverges from the server snapshot.
  // We compare by serializing the `deny`-only projection (which mirrors
  // what the wire actually persists) rather than the full UI map — that
  // way flipping a tool between `allow` and `prompt` doesn't show as
  // dirty (the server can't distinguish those two states today).
  const dirty = $derived.by(() => {
    return denySet(policy) !== denySet(serverPolicy);
  });

  function denySet(p: ToolPolicy): string {
    return Object.entries(p)
      .filter(([, a]) => a === 'deny')
      .map(([n]) => n)
      .sort()
      .join('|');
  }

  // ---- Lifecycle --------------------------------------------------------

  onMount(() => {
    hydratePrefs();
    void load();
  });

  // Debounce: every keystroke resets a 250ms timer; the timer's payload
  // promotes `searchInput` into `debouncedSearch` (which the filter reads).
  // Inline so we don't pull in a dependency — same idea as lodash.debounce.
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    const next = searchInput;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debouncedSearch = next;
      persistPrefs();
    }, 250);
  });

  function hydratePrefs() {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedPrefs;
      if (typeof parsed.search === 'string') {
        searchInput = parsed.search;
        debouncedSearch = parsed.search;
      }
      if (
        parsed.actionFilter === 'all' ||
        parsed.actionFilter === 'allow' ||
        parsed.actionFilter === 'prompt' ||
        parsed.actionFilter === 'deny'
      ) {
        actionFilter = parsed.actionFilter;
      }
    } catch {
      // Corrupt prefs are non-fatal; the editor opens with defaults.
    }
  }

  function persistPrefs() {
    if (typeof window === 'undefined') return;
    try {
      const payload: PersistedPrefs = {
        search: debouncedSearch,
        actionFilter
      };
      window.localStorage.setItem(LS_KEY, JSON.stringify(payload));
    } catch {
      // Storage may be full or disabled; ignore.
    }
  }

  async function load() {
    const client = connection.client;
    if (!client) {
      loadState = 'idle';
      return;
    }
    loadState = 'loading';
    loadError = null;
    forbidden = false;
    try {
      const [allTools, policyResp] = await Promise.all([
        client.listAllTools(),
        client.getToolPolicy()
      ]);
      tools = allTools;
      serverPolicy = { ...policyResp.policy };
      policy = { ...policyResp.policy };
      userOverrides = { ...policyResp.user_disabled_tools };
      loadState = 'loaded';
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401 || status === 403) {
        forbidden = true;
        loadError =
          "This profile's token doesn't have admin role. Switch profile or use a token with admin permission.";
      } else if (status === 404) {
        loadError =
          'Admin tool policy is only available in multi-tenant mode on this gateway.';
      } else {
        loadError = (err as Error).message;
      }
      loadState = 'error';
    }
  }

  // ---- Actions ----------------------------------------------------------

  function setAction(name: string, action: ToolPolicyAction) {
    policy = { ...policy, [name]: action };
  }

  function setActionFilter(v: ActionFilter) {
    actionFilter = v;
    persistPrefs();
  }

  function clearFilters() {
    searchInput = '';
    debouncedSearch = '';
    actionFilter = 'all';
    persistPrefs();
  }

  // Bulk helpers respect the active filter. When no filter is active, the
  // target set is the full catalog; with a filter, we only touch the visible
  // rows. Anything over 5 rows triggers a confirm so the operator doesn't
  // accidentally flip the wrong subset.
  function bulkApply(action: ToolPolicyAction, verb: string) {
    const target = filterActive ? filteredRows : allRows;
    if (target.length === 0) {
      toasts.show('No tools match the current filter.', 'info');
      return;
    }
    if (filterActive && target.length > 5) {
      const ok = confirm(
        `${verb} ${target.length} filtered tools? This only affects the currently visible rows.`
      );
      if (!ok) return;
    }
    if (!filterActive) {
      // Full-catalog bulk: reset the whole policy object so unaffected
      // tools also collapse to the chosen action (matches prior behavior).
      const next: ToolPolicy = {};
      for (const r of allRows) next[r.name] = action;
      policy = next;
      return;
    }
    // Filtered bulk: merge over the existing policy, leaving non-visible
    // tools untouched.
    const next: ToolPolicy = { ...policy };
    for (const r of target) next[r.name] = action;
    policy = next;
  }

  function bulkAllow() {
    bulkApply('allow', 'Allow');
  }

  function bulkDeny() {
    bulkApply('deny', 'Deny');
  }

  function bulkReset() {
    // Reset to the default action (prompt). With a filter active we only
    // touch the visible subset; without one we reset the entire policy
    // (which on save clears the server's `disabled_tools` list).
    bulkApply('prompt', 'Reset');
  }

  function discard() {
    policy = { ...serverPolicy };
    saveState = 'idle';
    saveError = null;
  }

  async function save() {
    const client = connection.client;
    if (!client) return;
    saveState = 'saving';
    saveError = null;
    try {
      await client.setToolPolicy(policy, userOverrides);
      serverPolicy = { ...policy };
      saveState = 'saved';
      toasts.show('Tool policy saved', 'success');
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401 || status === 403) {
        saveError =
          "This profile's token doesn't have admin role. Switch profile or use a token with admin permission.";
        forbidden = true;
      } else {
        saveError = (err as Error).message;
      }
      saveState = 'error';
      toasts.show(`Save failed: ${saveError}`, 'error');
    }
  }

  // ---- Counts (footer) --------------------------------------------------

  const counts = $derived.by(() => {
    let allow = 0,
      prompt = 0,
      deny = 0;
    for (const r of allRows) {
      if (r.action === 'allow') allow++;
      else if (r.action === 'deny') deny++;
      else prompt++;
    }
    return { allow, prompt, deny, total: allRows.length };
  });
</script>

<div class="flex flex-col flex-1 min-h-0">
  {#if isDisconnected}
    <div class="surface p-10 flex flex-col items-center justify-center text-center min-h-[280px]">
      <div class="text-sm text-text-primary mb-2">IronClaw is offline</div>
      <div class="text-xs text-text-muted">
        Check <a href="/settings" class="text-accent-cyan hover:underline">Settings</a> to configure the connection.
      </div>
    </div>
  {:else if loadState === 'loading'}
    <div class="surface p-10 flex flex-col items-center justify-center text-center min-h-[280px]">
      <div class="text-sm text-text-muted">Loading tool policy…</div>
    </div>
  {:else if loadState === 'error'}
    <div class="surface p-10 flex flex-col items-center justify-center text-center min-h-[280px]">
      <div class="text-sm text-red-400 mb-2">
        {forbidden ? 'Admin permission required' : 'Failed to load tool policy'}
      </div>
      <div class="text-xs text-text-muted font-mono mb-4 max-w-md break-words">
        {loadError ?? 'Unknown error'}
      </div>
      {#if !forbidden}
        <button
          type="button"
          onclick={() => void load()}
          class="px-4 py-2 rounded-md border border-accent-cyan text-accent-cyan text-sm font-semibold hover:bg-accent-cyan hover:text-bg-deep transition min-h-[40px]"
        >
          Retry
        </button>
      {/if}
    </div>
  {:else}
    <!-- Bulk actions + search + filter pills. The bulk buttons silently
         change scope when a filter is active — copy + confirm dialog make
         that explicit. -->
    <div class="surface p-4 mb-4 flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex items-center gap-2">
          <button
            type="button"
            onclick={bulkAllow}
            class="px-3 py-1.5 rounded-md border border-border-subtle text-xs text-text-primary hover:border-green-500 hover:text-green-400 transition min-h-[32px]"
            title={filterActive
              ? `Allow only the ${filteredRows.length} filtered tools`
              : 'Allow every tool in the catalog'}
          >
            {filterActive ? `Allow filtered (${filteredRows.length})` : 'Allow all'}
          </button>
          <button
            type="button"
            onclick={bulkDeny}
            class="px-3 py-1.5 rounded-md border border-border-subtle text-xs text-text-primary hover:border-red-500 hover:text-red-400 transition min-h-[32px]"
            title={filterActive
              ? `Deny only the ${filteredRows.length} filtered tools`
              : 'Deny every tool in the catalog'}
          >
            {filterActive ? `Deny filtered (${filteredRows.length})` : 'Deny all'}
          </button>
          <button
            type="button"
            onclick={bulkReset}
            class="px-3 py-1.5 rounded-md border border-border-subtle text-xs text-text-primary hover:border-accent-gold hover:text-accent-gold transition min-h-[32px]"
            title={filterActive
              ? `Reset only the ${filteredRows.length} filtered tools to Prompt`
              : 'Reset every tool to the default action (Prompt)'}
          >
            {filterActive ? `Reset filtered (${filteredRows.length})` : 'Reset to default'}
          </button>
        </div>

        <div class="flex-1 min-w-[200px] relative max-w-md ml-auto">
          <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-text-muted">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="search"
            bind:value={searchInput}
            placeholder="Search name + description…"
            class="w-full bg-bg-deep border border-border-subtle rounded-md pl-10 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-accent-cyan transition-colors min-h-[36px]"
            aria-label="Filter tools"
          />
        </div>
      </div>

      <!-- Action filter pills + reset link. Pills mirror the radio tints
           used in each row so the connection is visual, not just labeled. -->
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-[10px] uppercase tracking-wider text-text-muted mr-1">Filter</span>
        {#each FILTER_PILLS as pill (pill.v)}
          {@const active = actionFilter === pill.v}
          {@const tintBg =
            pill.v === 'allow'
              ? 'bg-green-500 text-bg-deep border-green-500'
              : pill.v === 'prompt'
                ? 'bg-accent-gold text-bg-deep border-accent-gold'
                : pill.v === 'deny'
                  ? 'bg-red-500 text-white border-red-500'
                  : 'bg-accent-cyan text-bg-deep border-accent-cyan'}
          <button
            type="button"
            onclick={() => setActionFilter(pill.v)}
            class="px-2.5 py-1 rounded-full text-[11px] font-semibold border transition min-h-[28px] {active
              ? tintBg
              : 'border-border-subtle text-text-muted hover:text-text-primary hover:border-text-muted'}"
          >
            {pill.label}
          </button>
        {/each}
        {#if filterActive}
          <button
            type="button"
            onclick={clearFilters}
            class="ml-auto text-[11px] text-text-muted hover:text-accent-gold transition"
            title="Clear search + filter"
          >
            Clear filters
          </button>
        {/if}
      </div>
    </div>

    <!-- Counts strip. When any filter is active we surface "N of M tools"
         so the operator sees the subset size at a glance. -->
    <div class="flex items-center gap-4 text-[11px] text-text-muted font-mono mb-2 px-1">
      <span>
        <span class="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5 align-middle"></span>
        Allow <span class="text-text-primary">{counts.allow}</span>
      </span>
      <span>
        <span class="inline-block w-2 h-2 rounded-full bg-accent-gold mr-1.5 align-middle"></span>
        Prompt <span class="text-text-primary">{counts.prompt}</span>
      </span>
      <span>
        <span class="inline-block w-2 h-2 rounded-full bg-red-500 mr-1.5 align-middle"></span>
        Deny <span class="text-text-primary">{counts.deny}</span>
      </span>
      <span class="ml-auto">
        {#if filterActive}
          <span class="text-accent-cyan">{filteredRows.length} of {counts.total} tools</span>
        {:else}
          Showing {filteredRows.length} of {counts.total}
        {/if}
      </span>
    </div>

    <!-- Table. Uses a CSS grid so columns line up without table semantics.
         Header row sticks to the top of the scroll area for long catalogs. -->
    <div class="flex-1 min-h-0 overflow-auto surface">
      {#if filteredRows.length === 0}
        <div class="p-10 text-center text-xs text-text-muted">
          {filterActive
            ? 'No tools match the current filter.'
            : 'No tools available.'}
        </div>
      {:else}
        <div class="grid grid-cols-[1fr_220px] sticky top-0 bg-bg-surface border-b border-border-subtle px-4 py-2 text-[10px] uppercase tracking-wider text-text-muted z-10">
          <div>Tool</div>
          <div class="text-right">Action</div>
        </div>
        <div>
          {#each filteredRows as row (row.name)}
            {@const tint =
              row.action === 'allow'
                ? 'border-l-green-500/60'
                : row.action === 'deny'
                  ? 'border-l-red-500/60'
                  : 'border-l-accent-gold/60'}
            <div
              class="grid grid-cols-[1fr_220px] items-center gap-4 px-4 py-2.5 border-b border-border-subtle/60 border-l-2 {tint} hover:bg-bg-deep/40 transition-colors"
            >
              <div class="min-w-0">
                <div class="flex items-baseline gap-2">
                  <code class="text-sm font-mono text-text-primary truncate">{row.name}</code>
                  {#if row.extension}
                    <span class="text-[10px] text-text-muted font-mono shrink-0">
                      {row.extension}
                    </span>
                  {/if}
                </div>
                {#if row.description}
                  <div class="text-xs text-text-muted truncate mt-0.5" title={row.description}>
                    {row.description}
                  </div>
                {/if}
              </div>

              <div class="flex items-center justify-end gap-1">
                <!-- Three-way radio rendered as segmented buttons. -->
                {#each RADIO_OPTIONS as opt (opt.v)}
                  {@const active = row.action === opt.v}
                  <button
                    type="button"
                    onclick={() => setAction(row.name, opt.v)}
                    class="px-2.5 py-1 rounded text-[11px] font-semibold transition min-h-[28px] border"
                    class:bg-green-500={active && opt.tint === 'green'}
                    class:text-bg-deep={active &&
                      (opt.tint === 'green' || opt.tint === 'gold')}
                    class:bg-accent-gold={active && opt.tint === 'gold'}
                    class:bg-red-500={active && opt.tint === 'red'}
                    class:text-white={active && opt.tint === 'red'}
                    class:border-green-500={active && opt.tint === 'green'}
                    class:border-accent-gold={active && opt.tint === 'gold'}
                    class:border-red-500={active && opt.tint === 'red'}
                    class:border-border-subtle={!active}
                    class:text-text-muted={!active}
                    class:hover:text-text-primary={!active}
                    class:hover:border-text-muted={!active}
                  >
                    {opt.label}
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Save/Discard bar -->
    <div class="mt-4 flex items-center justify-between gap-3">
      <div class="text-xs text-text-muted">
        {#if dirty}
          <span class="text-accent-gold">Unsaved changes.</span>
        {:else if saveState === 'saved'}
          <span class="text-accent-cyan">Saved.</span>
        {:else}
          <span>Up to date with the server.</span>
        {/if}
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          onclick={discard}
          disabled={!dirty || saveState === 'saving'}
          class="px-4 py-2 rounded-md border border-border-subtle text-sm text-text-primary hover:border-accent-gold hover:text-accent-gold transition disabled:opacity-30 disabled:hover:border-border-subtle disabled:hover:text-text-primary min-h-[40px]"
        >
          Discard
        </button>
        <button
          type="button"
          onclick={() => void save()}
          disabled={!dirty || saveState === 'saving'}
          class="px-4 py-2 rounded-md bg-accent-cyan text-bg-deep text-sm font-semibold hover:brightness-110 transition disabled:opacity-50 min-h-[40px]"
        >
          {saveState === 'saving' ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  {/if}
</div>
