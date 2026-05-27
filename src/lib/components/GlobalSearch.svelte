<script lang="ts">
  // Cross-surface global search (Cmd+Shift+F). Full-width top-of-viewport
  // modal that fans the query out across six surfaces simultaneously and
  // groups results:
  //   Knowledge · Threads · Jobs · Skills · Routines · Extensions
  //
  // Mounted once at the layout level (`src/routes/+layout.svelte`); summoned
  // via `globalSearch.show()` from `$lib/stores/global-search.svelte`.
  //
  // Behaviour:
  //   - Auto-focus search input on open. Esc closes.
  //   - Debounced 300ms input → fans out via `Promise.allSettled`. One
  //     surface erroring (e.g. /api/memory/search 500) does NOT kill the
  //     other five — the failed surface just shows nothing.
  //   - Each section shows top 3-5 results and a "Show all" link that
  //     navigates to the surface with the query pre-populated where the
  //     surface supports it (knowledge / skills / routines / extensions /
  //     jobs each accept their own filter param in URL or via deep-link).
  //   - Up/Down arrows navigate across ALL visible rows; Enter routes to
  //     the selected hit on the right surface.
  //   - Recent searches: last 10 queries persisted to localStorage; shown
  //     as suggestions when input is empty.
  //
  // What this is NOT:
  //   - NOT a replacement for Cmd+K (CommandPalette) — that's navigation +
  //     actions, not data search.
  //   - NOT a replacement for Cmd+F on /chat — that's find-within-thread.

  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { connection } from '$lib/stores/connection.svelte';
  import { globalSearch } from '$lib/stores/global-search.svelte';
  import { toasts } from '$lib/stores/toasts.svelte';
  import type {
    MemoryHit,
    Thread,
    Job,
    Skill,
    Routine,
    Extension
  } from '$lib/api/types';

  // -- types ----------------------------------------------------------------

  type Surface =
    | 'Knowledge'
    | 'Threads'
    | 'Jobs'
    | 'Skills'
    | 'Routines'
    | 'Extensions';

  interface ResultRow {
    /** Stable id used as keying + arrow-nav target. */
    id: string;
    surface: Surface;
    /** Bold/primary text on the row. */
    label: string;
    /** Optional second-line context. */
    subtitle?: string;
    /** Optional third-line snippet (knowledge hits use this). */
    snippet?: string;
    /** Navigate-to URL when activated. */
    href: string;
  }

  /** Per-surface rendered group. Top N rows visible plus a count for the
   *  "Show all" affordance when the underlying matched-set exceeds the cap. */
  interface Group {
    surface: Surface;
    rows: ResultRow[];
    total: number;
    /** Where to send the user on "Show all" — the surface's list page with
     *  a best-effort filter param (each surface accepts a different one). */
    showAllHref: string;
  }

  // -- caches ---------------------------------------------------------------
  // Threads / jobs / skills / routines / extensions are loaded once on first
  // open and held for the modal's lifetime. The cost of refreshing every
  // open is high (six round-trips on a slow gateway) and the data is
  // already paginated server-side — staleness within a single session is an
  // acceptable trade-off. The modal closes on navigation, but the rune
  // singleton persists, so subsequent opens reuse the caches.

  let threadsCache = $state<Thread[] | null>(null);
  let jobsCache = $state<Job[] | null>(null);
  let skillsCache = $state<Skill[] | null>(null);
  let routinesCache = $state<Routine[] | null>(null);
  let extensionsCache = $state<Extension[] | null>(null);

  /** Knowledge hits come fresh per-query from the server's FTS endpoint —
   *  there's no cacheable "all knowledge" list small enough to filter locally
   *  with confidence. We hold the latest hits as state so the UI can re-render
   *  while a slow request is in flight. */
  let knowledgeHits = $state<MemoryHit[]>([]);

  // Per-surface loading flags so we can show a row-level spinner without
  // blocking the others.
  let loadingKnowledge = $state(false);
  let loadingThreads = $state(false);
  let loadingJobs = $state(false);
  let loadingSkills = $state(false);
  let loadingRoutines = $state(false);
  let loadingExtensions = $state(false);

  /** Per-surface "load failed once this session" flag. We don't aggressively
   *  retry — the user can re-open the modal to retry. Used to suppress the
   *  empty-section render so a transient failure doesn't look like "no
   *  data". */
  let errorKnowledge = $state<string | null>(null);
  let errorThreads = $state<string | null>(null);
  let errorJobs = $state<string | null>(null);
  let errorSkills = $state<string | null>(null);
  let errorRoutines = $state<string | null>(null);
  let errorExtensions = $state<string | null>(null);

  // -- ui state -------------------------------------------------------------

  let query = $state('');
  let debounced = $state('');
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  let activeIndex = $state(0);
  let inputEl = $state<HTMLInputElement | null>(null);
  let listEl = $state<HTMLDivElement | null>(null);

  /** Per-surface row cap on the result panel. Anything beyond this is
   *  hidden but counted; the "Show all" link routes to the surface's own
   *  search. The spec asks for 3-5; we settle at 5 so the panel feels
   *  substantive without overwhelming the modal. */
  const ROWS_PER_GROUP = 5;

  // -- recent searches (localStorage) ---------------------------------------

  const RECENT_KEY = 'ironclaw-global-search-history';
  const RECENT_MAX = 10;

  let recent = $state<string[]>(loadRecent());

  function loadRecent(): string[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
        .slice(0, RECENT_MAX);
    } catch {
      return [];
    }
  }

  function persistRecent(entries: string[]) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(entries));
    } catch {
      // Quota / private mode / disabled — non-fatal.
    }
  }

  /** Push a query to the front of the recent list, dedup, cap. Called on
   *  Enter when activating a row, NOT on every keystroke — only completed
   *  intents are worth remembering. */
  function recordRecent(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    const next = [trimmed, ...recent.filter((v) => v !== trimmed)].slice(
      0,
      RECENT_MAX
    );
    recent = next;
    persistRecent(next);
  }

  // -- lifecycle ------------------------------------------------------------

  $effect(() => {
    if (globalSearch.open) {
      void onOpen();
    } else {
      // Reset transient state on close so the next open is a blank slate.
      // We deliberately keep the data caches around — they're expensive to
      // rebuild and not query-dependent.
      query = '';
      debounced = '';
      activeIndex = 0;
      knowledgeHits = [];
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    }
  });

  async function onOpen() {
    await tick();
    inputEl?.focus();
    // Fan out the non-knowledge surfaces in parallel on first open. Each
    // populates its cache so subsequent queries don't pay the network
    // cost. Failures are stored in per-surface error state but don't
    // surface a toast — the modal is meant to be quiet, and the user
    // already gets a per-section "Failed to load" affordance below.
    if (!connection.client) return;
    const client = connection.client;

    const fetches: Array<Promise<void>> = [];

    if (threadsCache === null && !loadingThreads) {
      loadingThreads = true;
      fetches.push(
        client
          .listThreads()
          .then((t) => {
            threadsCache = t;
          })
          .catch((err: Error) => {
            errorThreads = err.message;
            threadsCache = [];
          })
          .finally(() => {
            loadingThreads = false;
          })
      );
    }

    if (jobsCache === null && !loadingJobs) {
      loadingJobs = true;
      fetches.push(
        client
          .listJobs({ limit: 50 })
          .then((j) => {
            jobsCache = j;
          })
          .catch((err: Error) => {
            errorJobs = err.message;
            jobsCache = [];
          })
          .finally(() => {
            loadingJobs = false;
          })
      );
    }

    if (skillsCache === null && !loadingSkills) {
      loadingSkills = true;
      fetches.push(
        client
          .listSkills()
          .then((s) => {
            skillsCache = s;
          })
          .catch((err: Error) => {
            errorSkills = err.message;
            skillsCache = [];
          })
          .finally(() => {
            loadingSkills = false;
          })
      );
    }

    if (routinesCache === null && !loadingRoutines) {
      loadingRoutines = true;
      fetches.push(
        client
          .listRoutines()
          .then((r) => {
            routinesCache = r;
          })
          .catch((err: Error) => {
            errorRoutines = err.message;
            routinesCache = [];
          })
          .finally(() => {
            loadingRoutines = false;
          })
      );
    }

    if (extensionsCache === null && !loadingExtensions) {
      loadingExtensions = true;
      fetches.push(
        client
          .listExtensions()
          .then((e) => {
            extensionsCache = e;
          })
          .catch((err: Error) => {
            errorExtensions = err.message;
            extensionsCache = [];
          })
          .finally(() => {
            loadingExtensions = false;
          })
      );
    }

    // We don't await these — the modal stays interactive while they resolve.
    // Each fetch updates its own slice of state so the UI re-renders
    // incrementally.
    if (fetches.length > 0) {
      void Promise.allSettled(fetches);
    }
  }

  // -- debounced query ------------------------------------------------------
  // Track the input directly; `debounced` lags by 300ms. The knowledge
  // request only fires off `debounced` so we don't hammer the gateway on
  // every keystroke. Local filters (threads / jobs / skills / routines /
  // extensions) also use `debounced` so all surfaces re-rank in lock-step.

  $effect(() => {
    const next = query;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounced = next;
      debounceTimer = null;
    }, 300);
  });

  // Knowledge search — runs every time `debounced` changes to a non-empty
  // value. Aborts in-flight requests implicitly by tracking a generation
  // counter; only the latest response writes to `knowledgeHits`.
  let knowledgeGeneration = 0;
  $effect(() => {
    const q = debounced.trim();
    if (!q || !connection.client) {
      knowledgeHits = [];
      loadingKnowledge = false;
      return;
    }
    const gen = ++knowledgeGeneration;
    const client = connection.client;
    loadingKnowledge = true;
    errorKnowledge = null;
    void client
      .searchMemory(q, 8)
      .then((hits) => {
        // Drop stale responses — user has typed more by now.
        if (gen !== knowledgeGeneration) return;
        knowledgeHits = hits;
      })
      .catch((err: Error) => {
        if (gen !== knowledgeGeneration) return;
        errorKnowledge = err.message;
        knowledgeHits = [];
      })
      .finally(() => {
        if (gen === knowledgeGeneration) loadingKnowledge = false;
      });
  });

  // -- result builders ------------------------------------------------------
  // Each surface contributes a Group. Empty surfaces (no matches AND no
  // error) are filtered out at render time; surfaces with an error show a
  // "Failed to load" row so the user knows the absence is not authoritative.

  /** Case-insensitive substring filter used for local surfaces. We don't
   *  vendor a fuzzy lib — the surfaces are small and the spec asks for
   *  "filtered locally", which strongly implies substring semantics. */
  function localMatch(haystack: string | undefined | null, needle: string): boolean {
    if (!haystack) return false;
    return haystack.toLowerCase().includes(needle.toLowerCase());
  }

  const groupKnowledge = $derived.by<Group>(() => {
    const rows: ResultRow[] = knowledgeHits.map((h) => ({
      id: `knowledge:${h.path}`,
      surface: 'Knowledge' as const,
      label: h.path,
      subtitle: undefined,
      snippet: h.snippet,
      href: `/knowledge?path=${encodeURIComponent(h.path)}`
    }));
    return {
      surface: 'Knowledge' as const,
      rows: rows.slice(0, ROWS_PER_GROUP),
      total: rows.length,
      // /knowledge has no `?q=` param wired today; just route to the
      // surface so the user can use the in-page search bar.
      showAllHref: `/knowledge`
    };
  });

  const groupThreads = $derived.by<Group>(() => {
    const q = debounced.trim();
    if (!q) {
      return {
        surface: 'Threads' as const,
        rows: [],
        total: 0,
        showAllHref: '/'
      };
    }
    const matched = (threadsCache ?? []).filter((t) => localMatch(t.title, q));
    const rows: ResultRow[] = matched.map((t) => ({
      id: `thread:${t.id}`,
      surface: 'Threads' as const,
      label: t.title || 'Untitled thread',
      subtitle: t.message_count
        ? `${t.message_count} message${t.message_count === 1 ? '' : 's'}`
        : 'Empty',
      href: `/?thread=${encodeURIComponent(t.id)}`
    }));
    return {
      surface: 'Threads' as const,
      rows: rows.slice(0, ROWS_PER_GROUP),
      total: rows.length,
      showAllHref: '/'
    };
  });

  const groupJobs = $derived.by<Group>(() => {
    const q = debounced.trim();
    if (!q) {
      return {
        surface: 'Jobs' as const,
        rows: [],
        total: 0,
        showAllHref: '/jobs'
      };
    }
    const matched = (jobsCache ?? []).filter(
      (j) => localMatch(j.title, q) || localMatch(j.id, q)
    );
    const rows: ResultRow[] = matched.map((j) => ({
      id: `job:${j.id}`,
      surface: 'Jobs' as const,
      label: j.title || j.id.slice(0, 8),
      subtitle: `${j.state}${j.created_at ? ` · ${j.created_at.slice(0, 10)}` : ''}`,
      href: `/jobs?open=${encodeURIComponent(j.id)}`
    }));
    return {
      surface: 'Jobs' as const,
      rows: rows.slice(0, ROWS_PER_GROUP),
      total: rows.length,
      showAllHref: '/jobs'
    };
  });

  const groupSkills = $derived.by<Group>(() => {
    const q = debounced.trim();
    if (!q) {
      return {
        surface: 'Skills' as const,
        rows: [],
        total: 0,
        showAllHref: '/skills'
      };
    }
    const matched = (skillsCache ?? []).filter(
      (s) => localMatch(s.name, q) || localMatch(s.description, q)
    );
    const rows: ResultRow[] = matched.map((s) => ({
      id: `skill:${s.name}`,
      surface: 'Skills' as const,
      label: s.name,
      subtitle: s.description || s.usage_hint || s.version || '',
      href: `/skills?focus=${encodeURIComponent(s.name)}`
    }));
    return {
      surface: 'Skills' as const,
      rows: rows.slice(0, ROWS_PER_GROUP),
      total: rows.length,
      showAllHref: '/skills'
    };
  });

  const groupRoutines = $derived.by<Group>(() => {
    const q = debounced.trim();
    if (!q) {
      return {
        surface: 'Routines' as const,
        rows: [],
        total: 0,
        showAllHref: '/routines'
      };
    }
    const matched = (routinesCache ?? []).filter(
      (r) => localMatch(r.name, q) || localMatch(r.schedule, q)
    );
    const rows: ResultRow[] = matched.map((r) => ({
      id: `routine:${r.id}`,
      surface: 'Routines' as const,
      label: r.name,
      subtitle: r.schedule || (r.enabled ? 'enabled' : 'disabled'),
      // Routines page DOES read `?open=<id>` on mount and selects the
      // detail panel; this deep-link works end-to-end today.
      href: `/routines?open=${encodeURIComponent(r.id)}`
    }));
    return {
      surface: 'Routines' as const,
      rows: rows.slice(0, ROWS_PER_GROUP),
      total: rows.length,
      showAllHref: '/routines'
    };
  });

  const groupExtensions = $derived.by<Group>(() => {
    const q = debounced.trim();
    if (!q) {
      return {
        surface: 'Extensions' as const,
        rows: [],
        total: 0,
        showAllHref: '/extensions'
      };
    }
    const matched = (extensionsCache ?? []).filter(
      (e) =>
        localMatch(e.name, q) ||
        localMatch(e.display_name, q) ||
        localMatch(e.description, q)
    );
    const rows: ResultRow[] = matched.map((e) => ({
      id: `extension:${e.name}`,
      surface: 'Extensions' as const,
      label: e.display_name || e.name,
      subtitle: e.description || (e.installed ? 'installed' : 'available'),
      href: `/extensions?focus=${encodeURIComponent(e.name)}`
    }));
    return {
      surface: 'Extensions' as const,
      rows: rows.slice(0, ROWS_PER_GROUP),
      total: rows.length,
      showAllHref: '/extensions'
    };
  });

  /** Stable surface ordering — knowledge first because the snippet rows are
   *  the most information-dense; threads next because that's typically what
   *  users are looking for; the rest follow in their sidebar order. */
  const groups = $derived<Group[]>([
    groupKnowledge,
    groupThreads,
    groupJobs,
    groupSkills,
    groupRoutines,
    groupExtensions
  ]);

  /** Per-surface "should we render the section header at all?" — we hide a
   *  group only when it has zero rows AND no loading/error state. */
  function shouldRenderGroup(g: Group): boolean {
    if (g.rows.length > 0) return true;
    if (g.surface === 'Knowledge' && (loadingKnowledge || errorKnowledge)) return true;
    if (g.surface === 'Threads' && (loadingThreads || errorThreads)) return true;
    if (g.surface === 'Jobs' && (loadingJobs || errorJobs)) return true;
    if (g.surface === 'Skills' && (loadingSkills || errorSkills)) return true;
    if (g.surface === 'Routines' && (loadingRoutines || errorRoutines)) return true;
    if (g.surface === 'Extensions' && (loadingExtensions || errorExtensions)) return true;
    return false;
  }

  function loadingForSurface(s: Surface): boolean {
    switch (s) {
      case 'Knowledge': return loadingKnowledge;
      case 'Threads': return loadingThreads;
      case 'Jobs': return loadingJobs;
      case 'Skills': return loadingSkills;
      case 'Routines': return loadingRoutines;
      case 'Extensions': return loadingExtensions;
    }
  }

  function errorForSurface(s: Surface): string | null {
    switch (s) {
      case 'Knowledge': return errorKnowledge;
      case 'Threads': return errorThreads;
      case 'Jobs': return errorJobs;
      case 'Skills': return errorSkills;
      case 'Routines': return errorRoutines;
      case 'Extensions': return errorExtensions;
    }
  }

  /** Flat row list used for keyboard navigation. Mirrors the rendered
   *  groups exactly so arrow-key index lines up with the visible row. */
  const flatRows = $derived.by<ResultRow[]>(() => {
    const visible = groups.filter(shouldRenderGroup);
    return visible.flatMap((g) => g.rows);
  });

  // Clamp activeIndex into range whenever the result set shrinks. We don't
  // try to preserve the previously-active row identity — the user's
  // expectation when typing is that the top row is selected, which is what
  // resetting to 0 (below) gives them.
  $effect(() => {
    if (activeIndex >= flatRows.length) {
      activeIndex = Math.max(0, flatRows.length - 1);
    }
  });

  // Reset active index whenever the query changes — top result becomes
  // the default action.
  $effect(() => {
    void debounced;
    activeIndex = 0;
  });

  // Keep the active row scrolled into view.
  $effect(() => {
    void activeIndex;
    void tick().then(() => {
      const el = listEl?.querySelector(
        `[data-row-index="${activeIndex}"]`
      ) as HTMLElement | null;
      el?.scrollIntoView({ block: 'nearest' });
    });
  });

  /** flatRows index lookup so onclick handlers can sync activeIndex to the
   *  hovered/clicked row without rebuilding the list. */
  const flatIndexById = $derived<Record<string, number>>(
    flatRows.reduce<Record<string, number>>((acc, row, i) => {
      acc[row.id] = i;
      return acc;
    }, {})
  );

  // -- substring highlighting ----------------------------------------------
  //
  // We splice the haystack into [pre, match, post] segments around every
  // occurrence of the needle and render `<mark>` for the match. Plain
  // substring match (case-insensitive) — same semantics as the local
  // filters above so what's highlighted lines up with what matched.

  interface Segment {
    text: string;
    /** True if this segment is a match — the renderer tints it gold. */
    hit: boolean;
  }

  function highlight(haystack: string | undefined | null, needle: string): Segment[] {
    if (!haystack) return [];
    if (!needle) return [{ text: haystack, hit: false }];
    const lower = haystack.toLowerCase();
    const target = needle.toLowerCase();
    const segs: Segment[] = [];
    let i = 0;
    while (i < haystack.length) {
      const found = lower.indexOf(target, i);
      if (found < 0) {
        segs.push({ text: haystack.slice(i), hit: false });
        break;
      }
      if (found > i) segs.push({ text: haystack.slice(i, found), hit: false });
      segs.push({ text: haystack.slice(found, found + target.length), hit: true });
      i = found + target.length;
    }
    return segs;
  }

  // -- handlers -------------------------------------------------------------

  function activate(row: ResultRow) {
    recordRecent(debounced || query);
    globalSearch.close();
    void goto(row.href);
  }

  function activateShowAll(group: Group) {
    recordRecent(debounced || query);
    globalSearch.close();
    void goto(group.showAllHref);
  }

  function selectRecent(q: string) {
    query = q;
    debounced = q;
    activeIndex = 0;
    inputEl?.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      globalSearch.close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flatRows.length > 0) activeIndex = (activeIndex + 1) % flatRows.length;
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatRows.length > 0)
        activeIndex = activeIndex === 0 ? flatRows.length - 1 : activeIndex - 1;
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const row = flatRows[activeIndex];
      if (row) activate(row);
    }
  }

  function onBackdropClick(e: MouseEvent) {
    // Only close when the click lands on the backdrop itself.
    if (e.target === e.currentTarget) {
      globalSearch.close();
    }
  }

  // -- surface label icons --------------------------------------------------
  // The `Icon` component takes a `name` prop with a fixed vocabulary; map
  // each surface to its best-fitting glyph. We deliberately use small
  // (text-text-muted) icons so the group headers stay quiet.

  function iconForSurface(s: Surface): string {
    switch (s) {
      case 'Knowledge': return 'file';
      case 'Threads': return 'chat';
      case 'Jobs': return 'list';
      case 'Skills': return 'spark';
      case 'Routines': return 'clock';
      case 'Extensions': return 'plug';
    }
  }

  // Aggregate readiness — true if at least one surface is still loading on
  // first open. Used to render a quiet hint while the caches warm.
  const initialLoading = $derived(
    loadingKnowledge ||
      loadingThreads ||
      loadingJobs ||
      loadingSkills ||
      loadingRoutines ||
      loadingExtensions
  );

  // Total visible rows (informational; not load-bearing for keyboard nav).
  const totalRows = $derived(flatRows.length);

  onMount(() => {
    // Nothing to do — opening triggers data fetches via $effect.
  });

  // Surface a single connection-missing warning when the modal opens
  // without a live client. Without this, the user sees an empty modal and
  // no explanation. We only toast once per open to avoid spamming.
  let toastedNoClient = false;
  $effect(() => {
    if (!globalSearch.open) {
      toastedNoClient = false;
      return;
    }
    if (!connection.client && !toastedNoClient) {
      toasts.show('Not connected — search results will be empty.', 'info');
      toastedNoClient = true;
    }
  });
</script>

{#if globalSearch.open}
  <!-- Backdrop. Click-outside closes. -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-[70] flex items-start justify-center pt-[6vh] bg-black/60 backdrop-blur-sm"
    onclick={onBackdropClick}
    role="presentation"
  >
    <div
      class="w-[860px] max-w-[94vw] max-h-[80vh] flex flex-col bg-bg-deep border border-accent-gold/40 rounded-xl shadow-2xl overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
    >
      <!-- Search input. Auto-focus handled in onOpen via tick → inputEl.focus. -->
      <div class="flex items-center gap-3 px-5 py-4 border-b border-border-subtle">
        <svg
          viewBox="0 0 24 24"
          class="w-4 h-4 text-accent-gold shrink-0"
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
          placeholder="Search everywhere — knowledge, threads, jobs, skills, routines, extensions"
          aria-label="Global search across all surfaces"
          class="flex-1 bg-transparent border-0 outline-none font-mono text-base text-text-primary placeholder:text-text-muted/60"
          spellcheck="false"
          autocomplete="off"
        />
        {#if initialLoading}
          <span class="text-[10px] text-text-muted font-mono">Loading…</span>
        {/if}
        <kbd
          class="hidden sm:inline-block text-[10px] text-text-muted border border-border-subtle rounded px-1.5 py-0.5 font-mono"
        >
          ESC
        </kbd>
      </div>

      <!-- Results panel — vertical scroll, grouped by surface. -->
      <div bind:this={listEl} class="flex-1 overflow-y-auto py-2">
        {#if !query.trim() && recent.length > 0}
          <!-- Empty-input state: surface recent queries. -->
          <div class="mb-1">
            <div
              class="px-5 pt-2 pb-1 text-[10px] font-mono uppercase tracking-widest text-text-muted/70"
            >
              Recent searches
            </div>
            {#each recent as q (q)}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                onclick={() => selectRecent(q)}
                class="mx-2 px-3 py-2 rounded-md flex items-center gap-3 cursor-pointer hover:bg-bg-surface border-l-2 border-transparent transition-colors"
              >
                <span class="text-text-muted shrink-0">
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
                </span>
                <span class="text-sm text-text-muted font-mono">{q}</span>
              </div>
            {/each}
          </div>
        {:else if !query.trim()}
          <!-- Empty-input + no history: stub hint. -->
          <div class="px-5 py-8 text-center text-sm text-text-muted">
            Type to search across knowledge, threads, jobs, skills, routines, and extensions.
          </div>
        {:else if totalRows === 0 && !initialLoading && !loadingKnowledge}
          <div class="px-5 py-8 text-center text-sm text-text-muted">
            No matches for <span class="text-text-primary">{query}</span>
          </div>
        {:else}
          {#each groups as group (group.surface)}
            {#if shouldRenderGroup(group)}
              <div class="mb-2">
                <!-- Section header -->
                <div
                  class="px-5 pt-3 pb-1 flex items-center justify-between gap-3"
                >
                  <div
                    class="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-text-muted/70"
                  >
                    <span class="text-text-muted">
                      <!-- Inline glyph per surface — kept inline so we don't
                           pull the Icon component for a single SVG render. -->
                      {#if iconForSurface(group.surface) === 'file'}
                        <svg
                          viewBox="0 0 24 24"
                          class="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      {:else if iconForSurface(group.surface) === 'chat'}
                        <svg
                          viewBox="0 0 24 24"
                          class="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      {:else if iconForSurface(group.surface) === 'list'}
                        <svg
                          viewBox="0 0 24 24"
                          class="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <line x1="8" y1="6" x2="21" y2="6" />
                          <line x1="8" y1="12" x2="21" y2="12" />
                          <line x1="8" y1="18" x2="21" y2="18" />
                          <line x1="3" y1="6" x2="3.01" y2="6" />
                          <line x1="3" y1="12" x2="3.01" y2="12" />
                          <line x1="3" y1="18" x2="3.01" y2="18" />
                        </svg>
                      {:else if iconForSurface(group.surface) === 'spark'}
                        <svg
                          viewBox="0 0 24 24"
                          class="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path d="M12 3 14 10l6.5 2-6.5 2-2 6.5-2-6.5-6.5-2 6.5-2 2-7Z" />
                        </svg>
                      {:else if iconForSurface(group.surface) === 'clock'}
                        <svg
                          viewBox="0 0 24 24"
                          class="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      {:else if iconForSurface(group.surface) === 'plug'}
                        <svg
                          viewBox="0 0 24 24"
                          class="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path d="M9 2v6M15 2v6" />
                          <path d="M7 8h10v4a5 5 0 0 1-10 0z" />
                          <path d="M12 17v5" />
                        </svg>
                      {/if}
                    </span>
                    <span>{group.surface}</span>
                    {#if group.total > group.rows.length}
                      <span class="text-text-muted/60">
                        ({group.rows.length} of {group.total})
                      </span>
                    {/if}
                  </div>
                  {#if group.total > group.rows.length}
                    <button
                      type="button"
                      onclick={() => activateShowAll(group)}
                      class="text-[10px] font-mono uppercase tracking-widest text-accent-cyan hover:text-accent-gold transition-colors"
                    >
                      Show all
                    </button>
                  {/if}
                </div>

                <!-- Loading / error / empty states for this surface. -->
                {#if loadingForSurface(group.surface) && group.rows.length === 0}
                  <div class="mx-2 px-3 py-2 text-xs text-text-muted/70 font-mono">
                    Loading {group.surface.toLowerCase()}…
                  </div>
                {:else if errorForSurface(group.surface) && group.rows.length === 0}
                  <div class="mx-2 px-3 py-2 text-xs text-text-muted/70 font-mono">
                    Failed to load {group.surface.toLowerCase()}: {errorForSurface(
                      group.surface
                    )}
                  </div>
                {:else}
                  {#each group.rows as row (row.id)}
                    {@const idx = flatIndexById[row.id]}
                    {@const active = idx === activeIndex}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      data-row-index={idx}
                      onclick={() => activate(row)}
                      onmouseenter={() => (activeIndex = idx)}
                      class="mx-2 px-3 py-2 rounded-md flex items-start gap-3 cursor-pointer border-l-2 transition-colors"
                      class:bg-bg-surface={active}
                      class:border-accent-gold={active}
                      class:border-transparent={!active}
                      class:hover:bg-bg-surface={!active}
                    >
                      <span class="flex-1 min-w-0">
                        <span
                          class="text-sm truncate block"
                          class:text-text-primary={active}
                          class:text-text-muted={!active}
                        >
                          {#each highlight(row.label, debounced.trim()) as seg, i (i)}
                            {#if seg.hit}
                              <mark
                                class="bg-accent-gold/20 text-accent-gold rounded-sm px-0.5"
                              >
                                {seg.text}
                              </mark>
                            {:else}
                              <span>{seg.text}</span>
                            {/if}
                          {/each}
                        </span>
                        {#if row.subtitle}
                          <span class="text-xs text-text-muted/70 truncate block">
                            {#each highlight(row.subtitle, debounced.trim()) as seg, i (i)}
                              {#if seg.hit}
                                <mark
                                  class="bg-accent-gold/20 text-accent-gold rounded-sm px-0.5"
                                >
                                  {seg.text}
                                </mark>
                              {:else}
                                <span>{seg.text}</span>
                              {/if}
                            {/each}
                          </span>
                        {/if}
                        {#if row.snippet}
                          <!-- Knowledge hits render a short snippet preview;
                               other surfaces don't set this field. -->
                          <span
                            class="text-xs text-text-muted/60 block mt-0.5 line-clamp-2"
                          >
                            {#each highlight(row.snippet, debounced.trim()) as seg, i (i)}
                              {#if seg.hit}
                                <mark
                                  class="bg-accent-gold/20 text-accent-gold rounded-sm px-0.5"
                                >
                                  {seg.text}
                                </mark>
                              {:else}
                                <span>{seg.text}</span>
                              {/if}
                            {/each}
                          </span>
                        {/if}
                      </span>
                    </div>
                  {/each}
                {/if}
              </div>
            {/if}
          {/each}
        {/if}
      </div>

      <!-- Footer hint strip -->
      <div
        class="px-5 py-2 border-t border-border-subtle flex items-center gap-4 text-[10px] text-text-muted/70 font-mono"
      >
        <span><kbd class="text-text-muted">↑ ↓</kbd> navigate</span>
        <span><kbd class="text-text-muted">↵</kbd> open</span>
        <span><kbd class="text-text-muted">esc</kbd> close</span>
        <span class="ml-auto">
          <kbd class="text-text-muted">⌘⇧F</kbd> toggle
        </span>
      </div>
    </div>
  </div>
{/if}
