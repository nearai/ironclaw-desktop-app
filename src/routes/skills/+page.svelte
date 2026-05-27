<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { connection } from '$lib/stores/connection.svelte';
  import { toasts } from '$lib/stores/toasts.svelte';
  import type { Skill } from '$lib/api/types';
  import SkillCard from './SkillCard.svelte';
  import SkillDrawer from './SkillDrawer.svelte';

  type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

  let loadState = $state<LoadState>('idle');
  let loadError = $state<string | null>(null);
  let skills = $state<Skill[]>([]);

  // Debounced search input — the rendered value updates immediately, the
  // filter value lags by 250 ms so we don't recompute on every keystroke.
  let searchInput = $state('');
  let debouncedQuery = $state('');
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  let selectedSkill = $state<Skill | null>(null);

  // Derived list. Filter happens client-side over the loaded skills — does
  // NOT call /api/skills/search (which is a richer catalog endpoint).
  const filteredSkills = $derived.by(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q)
    );
  });

  // React to search input changes with a 250 ms debounce.
  $effect(() => {
    const value = searchInput;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debouncedQuery = value;
    }, 250);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  });

  // Auto-load when the client becomes available. This handles both the cold
  // start (mount-before-connection-init) and reconnects (token added later
  // in /settings without a page navigation).
  $effect(() => {
    const client = connection.client;
    if (!client) {
      loadState = 'idle';
      return;
    }
    if (loadState === 'loading') return;
    void loadSkills();
  });

  onMount(() => {
    // Kick connection init in case this is the first page visited — Sidebar
    // also triggers it, but skill route may render before sidebar mount
    // ordering in some edge cases.
    void connection.init();
  });

  async function loadSkills() {
    const client = connection.client;
    if (!client) return;
    loadState = 'loading';
    loadError = null;
    try {
      const list = await client.listSkills();
      // Stable alpha sort so the grid doesn't jitter between reloads.
      skills = list.slice().sort((a, b) => a.name.localeCompare(b.name));
      loadState = 'loaded';
    } catch (err) {
      loadError = (err as Error).message;
      loadState = 'error';
      toasts.show(`Failed to load skills: ${loadError}`, 'error');
    }
  }

  function openSkill(skill: Skill) {
    selectedSkill = skill;
  }

  function closeDrawer() {
    selectedSkill = null;
  }

  function runSkillFromCard(skill: Skill) {
    // "Run" on a card jumps straight to chat with the usage hint prefilled.
    // Drawer's Open-in-Chat covers the input-argument case. Prefer the
    // server-provided usage_hint over the derived `/${name}` heuristic so
    // skills that surface a different invocation phrase render correctly.
    const hint = skillUsageHint(skill);
    toasts.show(`Loaded into chat: ${hint}`, 'info');
    void goto(`/?prefill=${encodeURIComponent(hint)}`);
  }

  /**
   * Extract a slash-style invocation hint from the server's `usage_hint`
   * field, falling back to `/<name>` when absent. The server emits a
   * sentence like "Type `/foo` in chat to force-activate this skill." —
   * we pull the backtick-delimited token out so callers get just the token.
   */
  function skillUsageHint(skill: Skill): string {
    const raw = skill.usage_hint;
    if (raw) {
      const m = raw.match(/`([^`]+)`/);
      if (m) return m[1];
      const trimmed = raw.trim();
      if (trimmed.startsWith('/')) return trimmed.split(/\s+/)[0];
    }
    return `/${skill.name}`;
  }

  const isDisconnected = $derived(
    connection.status === 'disconnected' ||
      connection.status === 'idle' ||
      !connection.client
  );

  const showSkeleton = $derived(
    !isDisconnected && (loadState === 'idle' || loadState === 'loading') && skills.length === 0
  );
</script>

<section class="p-8 h-full flex flex-col overflow-hidden">
  <header class="mb-5 flex items-baseline justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold text-text-primary">Skills</h1>
      <p class="text-text-muted text-sm mt-1">
        Installed skills and tools.
        {#if loadState === 'loaded'}
          <span class="text-text-muted/70">·</span>
          <span class="text-text-muted">{skills.length} loaded</span>
        {/if}
      </p>
    </div>
  </header>

  <!-- Search bar -->
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
      placeholder="Filter skills…"
      disabled={isDisconnected}
      class="w-full bg-bg-deep border border-border-subtle rounded-md pl-10 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-accent-cyan transition-colors min-h-[40px] disabled:opacity-50 disabled:cursor-not-allowed"
    />
  </div>

  <!-- Content -->
  <div class="flex-1 overflow-auto -mx-2 px-2">
    {#if isDisconnected}
      <div class="surface p-10 flex flex-col items-center justify-center text-center min-h-[280px]">
        <div class="text-sm text-text-primary mb-2">IronClaw is offline</div>
        <div class="text-xs text-text-muted">
          Check <a href="/settings" class="text-accent-cyan hover:underline">Settings</a> to configure the connection.
        </div>
      </div>
    {:else if loadState === 'error'}
      <div class="surface p-10 flex flex-col items-center justify-center text-center min-h-[280px]">
        <div class="text-sm text-red-400 mb-2">Failed to load skills</div>
        <div class="text-xs text-text-muted font-mono mb-4 max-w-md break-words">
          {loadError ?? 'Unknown error'}
        </div>
        <button
          type="button"
          onclick={loadSkills}
          class="px-4 py-2 rounded-md border border-accent-cyan text-accent-cyan text-sm font-semibold hover:bg-accent-cyan hover:text-bg-deep transition min-h-[40px]"
        >
          Retry
        </button>
      </div>
    {:else if showSkeleton}
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {#each Array(6) as _, i (i)}
          <div class="rounded-lg border border-border-subtle bg-bg-surface p-4 min-h-[160px] animate-pulse">
            <div class="h-4 w-1/3 bg-border-subtle rounded mb-3"></div>
            <div class="h-3 w-full bg-border-subtle rounded mb-2"></div>
            <div class="h-3 w-4/5 bg-border-subtle rounded mb-6"></div>
            <div class="flex justify-between items-center">
              <div class="h-5 w-10 bg-border-subtle rounded"></div>
              <div class="h-7 w-16 bg-border-subtle rounded"></div>
            </div>
          </div>
        {/each}
      </div>
    {:else if filteredSkills.length === 0 && debouncedQuery.trim().length > 0}
      <div class="surface p-10 flex flex-col items-center justify-center text-center min-h-[280px]">
        <div class="text-sm text-text-primary mb-1">No matching skills</div>
        <div class="text-xs text-text-muted">
          No skills match «<span class="text-text-primary">{debouncedQuery}</span>».
        </div>
      </div>
    {:else if filteredSkills.length === 0}
      <div class="surface p-10 flex flex-col items-center justify-center text-center min-h-[280px]">
        <div class="text-sm text-text-muted">No skills installed.</div>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
        {#each filteredSkills as skill (skill.name)}
          <SkillCard {skill} onOpen={openSkill} onRun={runSkillFromCard} />
        {/each}
      </div>
    {/if}
  </div>
</section>

{#if selectedSkill}
  <SkillDrawer skill={selectedSkill} onClose={closeDrawer} />
{/if}
