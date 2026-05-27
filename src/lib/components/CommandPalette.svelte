<script lang="ts">
  // Global command palette (Cmd+K). Centered overlay with backdrop blur,
  // grouped fuzzy-matched results across five surfaces: Navigate, Threads,
  // Skills, Routines, Docs. Mounted once at the layout level so any route
  // can summon it via `palette.openPalette()` from
  // `$lib/stores/shortcuts.svelte`.
  //
  // Loading strategy: data is fetched lazily the first time the palette
  // opens, then cached for the modal's lifetime (i.e. as long as the app
  // is running — there's no eviction). Threads are read from the existing
  // `threads` store only if already loaded; we never trigger a network
  // request for threads here. Skills / Routines / Docs hit
  // `connection.client` once and cache.

  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { connection } from '$lib/stores/connection.svelte';
  import { threads } from '$lib/stores/threads.svelte';
  import { palette } from '$lib/stores/shortcuts.svelte';
  import { toasts } from '$lib/stores/toasts.svelte';
  import type { MemoryNode, Routine, Skill, Thread } from '$lib/api/types';

  // -- types ----------------------------------------------------------------

  type Category = 'Navigate' | 'Threads' | 'Skills' | 'Routines' | 'Docs';

  interface Item {
    id: string;
    category: Category;
    label: string;
    subtitle?: string;
    keybind?: string;
    /** Called when the row is activated (Enter or click). */
    run: () => void;
  }

  // -- caches ---------------------------------------------------------------

  let skillsCache = $state<Skill[] | null>(null);
  let routinesCache = $state<Routine[] | null>(null);
  let docsCache = $state<MemoryNode[] | null>(null);

  let loadingSkills = $state(false);
  let loadingRoutines = $state(false);
  let loadingDocs = $state(false);

  // -- ui state -------------------------------------------------------------

  let query = $state('');
  let activeIndex = $state(0);
  let inputEl = $state<HTMLInputElement | null>(null);
  let listEl = $state<HTMLDivElement | null>(null);

  // -- hardcoded nav --------------------------------------------------------
  // These never change at runtime; the keybinds match the layout shortcuts
  // exactly (see `src/routes/+layout.svelte`). Onboarding intentionally has
  // no shortcut — it's a first-run takeover.
  const navItems: Item[] = [
    {
      id: 'nav:/',
      category: 'Navigate',
      label: 'Chat',
      subtitle: '/',
      keybind: '⌘1',
      run: () => void goto('/')
    },
    {
      id: 'nav:/knowledge',
      category: 'Navigate',
      label: 'Knowledge',
      subtitle: '/knowledge',
      keybind: '⌘2',
      run: () => void goto('/knowledge')
    },
    {
      id: 'nav:/skills',
      category: 'Navigate',
      label: 'Skills',
      subtitle: '/skills',
      keybind: '⌘3',
      run: () => void goto('/skills')
    },
    {
      id: 'nav:/routines',
      category: 'Navigate',
      label: 'Routines',
      subtitle: '/routines',
      keybind: '⌘4',
      run: () => void goto('/routines')
    },
    {
      id: 'nav:/logs',
      category: 'Navigate',
      label: 'Logs',
      subtitle: '/logs',
      keybind: '⌘5',
      run: () => void goto('/logs')
    },
    {
      id: 'nav:/extensions',
      category: 'Navigate',
      label: 'Extensions',
      subtitle: '/extensions',
      keybind: '⌘6',
      run: () => void goto('/extensions')
    },
    {
      id: 'nav:/settings',
      category: 'Navigate',
      label: 'Settings',
      subtitle: '/settings',
      keybind: '⌘,',
      run: () => void goto('/settings')
    },
    {
      id: 'nav:/onboarding',
      category: 'Navigate',
      label: 'Onboarding',
      subtitle: '/onboarding',
      run: () => void goto('/onboarding')
    }
  ];

  // -- lifecycle ------------------------------------------------------------

  // Open-driven loading. The first time `palette.open` flips to true we
  // kick off the lazy fetches for skills/routines/docs in parallel. The
  // palette stays usable while they load — nav results are always there.
  $effect(() => {
    if (palette.open) {
      void onOpen();
    } else {
      // Reset transient state when closing so the next open is a blank slate.
      query = '';
      activeIndex = 0;
    }
  });

  async function onOpen() {
    await tick();
    inputEl?.focus();

    if (!connection.client) return;

    if (skillsCache === null && !loadingSkills) {
      loadingSkills = true;
      try {
        skillsCache = await connection.client.listSkills();
      } catch (err) {
        toasts.show(`Failed to load skills: ${(err as Error).message}`, 'error');
        skillsCache = [];
      } finally {
        loadingSkills = false;
      }
    }
    if (routinesCache === null && !loadingRoutines) {
      loadingRoutines = true;
      try {
        routinesCache = await connection.client.listRoutines();
      } catch (err) {
        toasts.show(`Failed to load routines: ${(err as Error).message}`, 'error');
        routinesCache = [];
      } finally {
        loadingRoutines = false;
      }
    }
    if (docsCache === null && !loadingDocs) {
      loadingDocs = true;
      try {
        docsCache = await connection.client.listMemory();
      } catch (err) {
        toasts.show(`Failed to load docs: ${(err as Error).message}`, 'error');
        docsCache = [];
      } finally {
        loadingDocs = false;
      }
    }
  }

  // -- items ----------------------------------------------------------------

  // Threads come from the in-memory store. We intentionally do NOT call
  // `threads.loadThreads()` here — only show what's already cached. If the
  // user hasn't visited the chat surface yet, this list is empty.
  const threadItems = $derived<Item[]>(
    threads.threads.map((t: Thread) => ({
      id: `thread:${t.id}`,
      category: 'Threads' as const,
      label: t.title || 'Untitled thread',
      subtitle: t.message_count
        ? `${t.message_count} message${t.message_count === 1 ? '' : 's'}`
        : 'Empty',
      run: () => {
        threads.selectThread(t.id);
        void goto('/');
      }
    }))
  );

  const skillItems = $derived<Item[]>(
    (skillsCache ?? []).map((s) => ({
      id: `skill:${s.name}`,
      category: 'Skills' as const,
      label: s.name,
      subtitle: s.description || s.usage_hint || '',
      run: () => {
        const hint = s.usage_hint ?? `/${s.name}`;
        void goto(`/?prefill=${encodeURIComponent(hint)}`);
      }
    }))
  );

  // TODO(routines): `/routines/+page.svelte` should read `?open=<id>` on
  // mount and open the matching detail panel. Currently this just navigates
  // to the list — the param is set but unused.
  const routineItems = $derived<Item[]>(
    (routinesCache ?? []).map((r) => ({
      id: `routine:${r.id}`,
      category: 'Routines' as const,
      label: r.name,
      subtitle: r.schedule || (r.enabled ? 'enabled' : 'disabled'),
      run: () => {
        void goto(`/routines?open=${encodeURIComponent(r.id)}`);
      }
    }))
  );

  // TODO(knowledge): `/knowledge/+page.svelte` should read `?path=<encoded>`
  // on mount and select the matching tree node + open the viewer. Currently
  // this just navigates to the root — the param is set but unused.
  const docItems = $derived<Item[]>(
    (docsCache ?? []).map((d) => ({
      id: `doc:${d.path}`,
      category: 'Docs' as const,
      label: d.path,
      subtitle: d.type === 'dir' ? 'folder' : 'file',
      run: () => {
        void goto(`/knowledge?path=${encodeURIComponent(d.path)}`);
      }
    }))
  );

  /** All items concatenated, then filtered + ranked by the active query. */
  const allItems = $derived<Item[]>([
    ...navItems,
    ...threadItems,
    ...skillItems,
    ...routineItems,
    ...docItems
  ]);

  const filtered = $derived<Item[]>(rankAndFilter(allItems, query));

  /** Results bucketed by category in the prescribed display order. */
  const grouped = $derived.by<Array<{ category: Category; items: Item[] }>>(() => {
    const order: Category[] = ['Navigate', 'Threads', 'Skills', 'Routines', 'Docs'];
    const buckets = new Map<Category, Item[]>();
    for (const item of filtered) {
      const arr = buckets.get(item.category) ?? [];
      arr.push(item);
      buckets.set(item.category, arr);
    }
    return order
      .filter((c) => (buckets.get(c) ?? []).length > 0)
      .map((c) => ({ category: c, items: buckets.get(c) ?? [] }));
  });

  // Flat ordered view used for keyboard navigation. Mirrors `grouped`
  // exactly so arrow-key index lines up with the row a user is looking at.
  const flat = $derived<Item[]>(grouped.flatMap((g) => g.items));

  // Clamp activeIndex into range whenever the result set shrinks beneath it.
  $effect(() => {
    if (activeIndex >= flat.length) {
      activeIndex = Math.max(0, flat.length - 1);
    }
  });

  // Keep the active row scrolled into view as the user arrows through.
  $effect(() => {
    void activeIndex;
    void tick().then(() => {
      const el = listEl?.querySelector(
        `[data-row-index="${activeIndex}"]`
      ) as HTMLElement | null;
      el?.scrollIntoView({ block: 'nearest' });
    });
  });

  // -- handlers -------------------------------------------------------------

  function activate(item: Item) {
    item.run();
    palette.closePalette();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      palette.closePalette();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flat.length > 0) activeIndex = (activeIndex + 1) % flat.length;
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flat.length > 0)
        activeIndex = activeIndex === 0 ? flat.length - 1 : activeIndex - 1;
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = flat[activeIndex];
      if (item) activate(item);
    }
  }

  function onBackdropClick(e: MouseEvent) {
    // Only close when the click lands on the backdrop itself, not on a
    // child that bubbled up.
    if (e.target === e.currentTarget) {
      palette.closePalette();
    }
  }

  // -- search ---------------------------------------------------------------
  // Subsequence + prefix/substring scoring. Higher score = better match.
  // We deliberately avoid a vendored fuzzy lib — the surface is small
  // (a few hundred items at most) and the scoring is easy to tune.
  function rankAndFilter(items: Item[], q: string): Item[] {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;

    const scored: Array<{ score: number; item: Item }> = [];
    for (const item of items) {
      const hay = item.label.toLowerCase();
      const sub = (item.subtitle ?? '').toLowerCase();
      const labelScore = scoreMatch(hay, needle);
      const subScore = scoreMatch(sub, needle);
      // Subtitle hits count for half — primary signal is the label.
      const score = Math.max(labelScore, subScore * 0.5);
      if (score > 0) scored.push({ score, item });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.item);
  }

  /** Exact-prefix > exact-substring > subsequence; 0 = no match. */
  function scoreMatch(hay: string, needle: string): number {
    if (!hay) return 0;
    if (hay.startsWith(needle)) return 1000 - (hay.length - needle.length);
    const sub = hay.indexOf(needle);
    if (sub >= 0) return 500 - sub;
    // Subsequence: characters of needle appear in hay in order.
    let i = 0;
    let lastIdx = -1;
    let gaps = 0;
    for (const ch of hay) {
      if (ch === needle[i]) {
        if (lastIdx >= 0) gaps += hay.indexOf(ch, lastIdx + 1) - lastIdx - 1;
        lastIdx = hay.indexOf(ch, lastIdx + 1);
        i++;
        if (i === needle.length) return 100 - Math.min(gaps, 99);
      }
    }
    return 0;
  }

  // Row-index lookup for click handlers — items are addressed by id but
  // keyboard nav is indexed, so we maintain a parallel map.
  const flatIndexById = $derived<Record<string, number>>(
    flat.reduce<Record<string, number>>((acc, item, i) => {
      acc[item.id] = i;
      return acc;
    }, {})
  );

  onMount(() => {
    // Nothing to do — opening triggers data fetches via $effect. We could
    // pre-warm here, but the user may never hit Cmd+K in a given session.
  });
</script>

{#if palette.open}
  <!-- Backdrop. Click-outside closes. svelte-a11y: this is a modal dialog,
       the input traps focus implicitly via autofocus + global listener. -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-[60] flex items-start justify-center pt-[10vh] bg-black/60 backdrop-blur-sm"
    onclick={onBackdropClick}
    role="presentation"
  >
    <div
      class="w-[640px] max-w-[92vw] h-[50vh] max-h-[640px] flex flex-col bg-bg-deep border border-accent-cyan/40 rounded-xl shadow-2xl overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <!-- Search input -->
      <div class="flex items-center gap-3 px-5 py-4 border-b border-border-subtle">
        <svg
          viewBox="0 0 24 24"
          class="w-4 h-4 text-accent-cyan shrink-0"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          bind:this={inputEl}
          bind:value={query}
          onkeydown={onKeyDown}
          type="text"
          placeholder="Search commands, threads, skills, routines, docs…"
          class="flex-1 bg-transparent border-0 outline-none font-mono text-base text-text-primary placeholder:text-text-muted/60"
          spellcheck="false"
          autocomplete="off"
        />
        <kbd
          class="hidden sm:inline-block text-[10px] text-text-muted border border-border-subtle rounded px-1.5 py-0.5 font-mono"
        >
          ESC
        </kbd>
      </div>

      <!-- Results -->
      <div bind:this={listEl} class="flex-1 overflow-y-auto py-2">
        {#if flat.length === 0}
          <div class="px-5 py-8 text-center text-sm text-text-muted">
            {#if loadingSkills || loadingRoutines || loadingDocs}
              Loading…
            {:else if query.trim()}
              No matches for <span class="text-text-primary">{query}</span>
            {:else}
              No items.
            {/if}
          </div>
        {:else}
          {#each grouped as group (group.category)}
            <div class="mb-1">
              <div
                class="px-5 pt-2 pb-1 text-[10px] font-mono uppercase tracking-widest text-text-muted/70"
              >
                {group.category}
              </div>
              {#each group.items as item (item.id)}
                {@const idx = flatIndexById[item.id]}
                {@const active = idx === activeIndex}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  data-row-index={idx}
                  onclick={() => activate(item)}
                  onmouseenter={() => (activeIndex = idx)}
                  class="mx-2 px-3 py-2 rounded-md flex items-center gap-3 cursor-pointer border-l-2 transition-colors"
                  class:bg-bg-surface={active}
                  class:border-accent-cyan={active}
                  class:border-transparent={!active}
                  class:hover:bg-bg-surface={!active}
                >
                  <span class="text-text-muted shrink-0">
                    {#if item.category === 'Navigate'}
                      <svg
                        viewBox="0 0 24 24"
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    {:else if item.category === 'Threads'}
                      <svg
                        viewBox="0 0 24 24"
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    {:else if item.category === 'Skills'}
                      <svg
                        viewBox="0 0 24 24"
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path
                          d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
                        />
                      </svg>
                    {:else if item.category === 'Routines'}
                      <svg
                        viewBox="0 0 24 24"
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    {:else if item.category === 'Docs'}
                      <svg
                        viewBox="0 0 24 24"
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path
                          d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
                        />
                      </svg>
                    {/if}
                  </span>
                  <span class="flex-1 min-w-0">
                    <span
                      class="text-sm truncate block"
                      class:text-text-primary={active}
                      class:text-text-muted={!active}
                    >
                      {item.label}
                    </span>
                    {#if item.subtitle}
                      <span class="text-xs text-text-muted/70 truncate block">
                        {item.subtitle}
                      </span>
                    {/if}
                  </span>
                  {#if item.keybind}
                    <kbd
                      class="text-[10px] text-text-muted border border-border-subtle rounded px-1.5 py-0.5 font-mono shrink-0"
                    >
                      {item.keybind}
                    </kbd>
                  {/if}
                </div>
              {/each}
            </div>
          {/each}
        {/if}
      </div>

      <!-- Footer hint strip -->
      <div
        class="px-5 py-2 border-t border-border-subtle flex items-center gap-4 text-[10px] text-text-muted/70 font-mono"
      >
        <span><kbd class="text-text-muted">↑ ↓</kbd> navigate</span>
        <span><kbd class="text-text-muted">↵</kbd> select</span>
        <span><kbd class="text-text-muted">esc</kbd> close</span>
      </div>
    </div>
  </div>
{/if}
