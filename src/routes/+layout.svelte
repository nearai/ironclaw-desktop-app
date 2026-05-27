<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Toasts from '$lib/components/Toasts.svelte';
  import CommandPalette from '$lib/components/CommandPalette.svelte';
  import GlobalSearch from '$lib/components/GlobalSearch.svelte';
  import ThreadSwitcher from '$lib/components/ThreadSwitcher.svelte';
  import UpdaterBanner from '$lib/components/UpdaterBanner.svelte';
  import AboutDialog from '$lib/components/AboutDialog.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import { connection } from '$lib/stores/connection.svelte';
  import { palette } from '$lib/stores/shortcuts.svelte';
  import { globalSearch } from '$lib/stores/global-search.svelte';
  import { threadSwitcher } from '$lib/stores/thread-switcher.svelte';
  import { tray } from '$lib/stores/tray.svelte';
  import { updater } from '$lib/stores/updater.svelte';
  import { windowFocus } from '$lib/stores/window-focus.svelte';
  import { notifications } from '$lib/stores/notifications.svelte';
  import { toasts } from '$lib/stores/toasts.svelte';
  import { aboutStore } from '$lib/stores/about.svelte';
  import { broadcast } from '$lib/stores/broadcast.svelte';
  import { pins } from '$lib/stores/pins.svelte';

  let { children } = $props();

  // Hide the sidebar (and the top padding it implies) on the full-screen
  // onboarding takeover. `page.url.pathname` from `$app/state` is reactive
  // under Svelte 5 runes, so this re-renders on navigation.
  const isOnboarding = $derived(page.url.pathname.startsWith('/onboarding'));

  // ---- Bottom status bar (Cmd+/) --------------------------------------
  // Visibility is persisted in localStorage so the saved preference
  // survives reloads. We default to true on a fresh install — power
  // users coming to this feature for the first time should see the bar
  // before knowing the toggle exists. The localStorage read is guarded
  // for SSR safety even though `ssr = false` for this app, to keep the
  // module testable under jsdom.
  const STATUSBAR_VISIBLE_KEY = 'ironclaw-statusbar-visible';
  let statusBarVisible = $state(true);

  function loadStatusBarVisible(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) return true;
    const raw = window.localStorage.getItem(STATUSBAR_VISIBLE_KEY);
    // Treat any non-`"false"` value (including unset) as visible. We
    // serialize the boolean directly so the key reads cleanly in
    // devtools.
    return raw !== 'false';
  }

  function persistStatusBarVisible(v: boolean): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(STATUSBAR_VISIBLE_KEY, v ? 'true' : 'false');
    } catch {
      // Quota / private-mode failures are non-fatal.
    }
  }

  // First-run guard. We wait for `connection.init()` to load settings off
  // disk (it caches via `initialized`, so this is cheap on subsequent
  // mounts) and then redirect to /onboarding exactly once if the flag is
  // false. Tracked via `redirected` so navigating BACK to `/` after
  // skipping doesn't loop us through the wizard again in the same
  // session — once the user has been there (or finished it), we trust
  // settings.json as the source of truth.
  let redirected = $state(false);

  // Global keyboard shortcuts. Lives at the layout level so every route
  // gets them for free. The palette itself owns Escape + arrow keys; here
  // we only handle the open-or-jump shortcuts.
  //
  // Rules:
  //   - Cmd-combos (and Ctrl on non-Mac) always fire, even from inputs.
  //   - Bare letter keys (no modifier) are suppressed when focus is in a
  //     text-y element so the user can actually type.
  //   - Onboarding takes over the whole screen; we still allow the palette
  //     to open there so the user can navigate out if they get stuck, but
  //     the palette component itself is hidden via `showPalette` below.
  function isEditableTarget(t: EventTarget | null): boolean {
    if (!(t instanceof HTMLElement)) return false;
    const tag = t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (t.isContentEditable) return true;
    return false;
  }

  function onWindowKeyDown(e: KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey;

    // Bare keys: ignore when typing.
    if (!mod && isEditableTarget(e.target)) return;

    // Cmd+Shift+F → cross-surface global search. Must come BEFORE the bare
    // Cmd+K check so the Shift modifier disambiguates. Distinct from the
    // chat surface's Cmd+F (find-in-thread, no Shift) — that listener
    // lives in `src/routes/+page.svelte` and we deliberately don't
    // contend with it here. Onboarding is unaffected; the modal can still
    // be summoned and dismissed but the user typically has no client
    // connected yet — the modal renders an empty state and a toast.
    if (mod && e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      globalSearch.toggle();
      return;
    }

    if (mod && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      palette.togglePalette();
      return;
    }

    // Cmd+T → quick thread switcher. Distinct from Cmd+K (palette: nav +
    // actions) and Cmd+Shift+F (global search): laser-focused on jumping
    // between existing chat threads. Suppressed on the onboarding takeover
    // — the wizard owns the screen and the user has no threads yet anyway.
    // We use `e.code === 'KeyT'` rather than `e.key` so the chord stays
    // stable under non-QWERTY layouts (Dvorak/Colemak users still get
    // Cmd+T on the physical T key).
    if (mod && !e.shiftKey && !e.altKey && e.code === 'KeyT' && !isOnboarding) {
      e.preventDefault();
      threadSwitcher.toggle();
      return;
    }

    // Cmd-comma → settings (macOS convention).
    if (mod && e.key === ',') {
      e.preventDefault();
      void goto('/settings');
      return;
    }

    // Cmd+1..9 → top-level routes. Match by `e.key` so the digit is correct
    // across keyboard layouts; modifiers aren't required to interpret it.
    // Cmd+8 is gated on `settings.adminMode` and Cmd+9 on
    // `settings.engineV2Enabled` so the chord stays a no-op when the
    // corresponding surface isn't enabled — same visibility contract as
    // the sidebar rows.
    //
    // Note (2026-05-27): Jobs surface added at Cmd+5. Logs/Extensions/Admin
    // shifted down by one slot. Cmd+5 used to map to /logs — users who
    // press Cmd+5 expecting Logs will now hit Jobs; documented in the
    // changelog and the sidebar's shortcut hints render the new chord so
    // discoverability is intact.
    // Note (2026-05-27): Missions (Engine v2) added at Cmd+9, gated on
    // `settings.engineV2Enabled`. Slot 9 was previously unused so no
    // shortcut renumber was needed.
    if (mod && !e.shiftKey && !e.altKey) {
      const target = ROUTES_BY_DIGIT[e.key];
      if (target) {
        if (target === '/admin' && !connection.settings.adminMode) return;
        if (target === '/missions' && !connection.settings.engineV2Enabled) return;
        e.preventDefault();
        void goto(target);
      }
    }
  }

  const ROUTES_BY_DIGIT: Record<string, string> = {
    '1': '/',
    '2': '/knowledge',
    '3': '/skills',
    '4': '/routines',
    '5': '/jobs',
    '6': '/logs',
    '7': '/extensions',
    '8': '/admin',
    '9': '/missions'
  };

  // Hide-on-disable guard for /admin. If the user toggled adminMode off
  // (in /settings) while sitting on the admin route, kick them out to
  // /settings so they don't see a stranded page. Lives as a top-level
  // $effect so it reacts to BOTH adminMode flips and route changes (both
  // are tracked because they read from $state-backed sources).
  $effect(() => {
    if (
      connection.settings.adminMode === false &&
      page.url.pathname.startsWith('/admin')
    ) {
      void goto('/settings');
    }
  });

  // Window focus → mark unseen notifications as seen. When the user
  // surfaces the app (Cmd-Tab, clicking the dock, clicking the tray
  // icon) the badge count drops to 0 and the Rust tray clears the title.
  // Lives at the layout level so it's wired exactly once — the
  // notifications singleton is global, so this effect speaks for every
  // route. We push a badge update on the same edge to flush the cleared
  // count immediately rather than waiting for the next trigger.
  $effect(() => {
    if (windowFocus.focused) {
      notifications.markAllSeen();
      void notifications.pushBadge();
    }
  });

  // Same hide-on-disable guard for /missions (Engine v2 surface). When the
  // user flips `engineV2Enabled` off from /settings → Advanced while
  // sitting on the route, bounce them to /settings so they don't see a
  // stranded page.
  $effect(() => {
    if (
      connection.settings.engineV2Enabled !== true &&
      page.url.pathname.startsWith('/missions')
    ) {
      void goto('/settings');
    }
  });

  onMount(() => {
    // Boot the focus tracker + hydrate notification prefs early so any
    // surface that fires a notification on first render (e.g. routine
    // completion catching up on poll #1) sees the user's saved toggles.
    windowFocus.init();
    notifications.hydrate();
    // Hydrate the cross-surface pin store. Cheap localStorage read, but
    // we want it done before any surface mounts so the first render
    // shows the user's saved pins without a flash of empty stars.
    pins.init();
    // Wire the menu-bar tray listeners (Show window, Open settings,
    // Restart sidecar). Safe outside the Tauri webview — the store
    // detects that and no-ops.
    tray.init();
    // Open the cross-window state-sync channel so settings saved in
    // any window propagate to the others. Safe outside Tauri (and in
    // jsdom): no-ops when BroadcastChannel is unavailable. Paired
    // with `broadcast.teardown()` in the cleanup return below so
    // remounts (HMR, layout pivot) don't stack listeners.
    broadcast.init();

    void connection.init().then(() => {
      if (
        !redirected &&
        !connection.settings.onboardingComplete &&
        !page.url.pathname.startsWith('/onboarding')
      ) {
        redirected = true;
        void goto('/onboarding');
      }
    });

    // Auto-check for updates once per launch — and then arm the cadence
    // timer for ongoing rechecks. We want the launch path quiet on
    // success AND on failure: an empty pubkey or transient network blip
    // should not splash a red banner on every launch. The manual check
    // in /settings still surfaces the error verbosely so the user can
    // debug there. Pattern: check, then dismiss on error.
    //
    // The cadence setting (never / launch / launch+6h / launch+1h) is
    // hydrated from localStorage on first read. `never` skips the launch
    // check entirely so a user who opted out stays opted out; the manual
    // button in Settings is the only way to trigger a check.
    updater.hydrate();
    if (updater.cadence !== 'never') {
      void updater.check({ respectSkip: true }).then(() => {
        if (updater.status === 'error') updater.dismiss();
        updater.armTimer();
      });
    }

    window.addEventListener('keydown', onWindowKeyDown);

    // Global last-resort net for async errors that escape both the
    // SvelteKit `handleError` hook (which only fires for load/render)
    // AND any per-call try/catch. We don't navigate or destroy state —
    // the route-level `+error.svelte` already handles catastrophic
    // render failures. Here we just surface a toast so the user knows
    // something went sideways, and log so devtools has the full trace.
    function onWindowError(e: ErrorEvent) {
      // eslint-disable-next-line no-console
      console.error('[ironclaw] window error:', e.error ?? e.message);
      toasts.show('An error occurred — check console for details.', 'error');
    }
    function onUnhandledRejection(e: PromiseRejectionEvent) {
      // eslint-disable-next-line no-console
      console.error('[ironclaw] unhandled rejection:', e.reason);
      toasts.show('An error occurred — check console for details.', 'error');
    }
    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('keydown', onWindowKeyDown);
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      // Mirror of `broadcast.init()` above — close the channel and
      // detach the message listener so a layout remount (HMR, route
      // pivot in dev) does not stack handlers.
      broadcast.teardown();
    };
  });
</script>

<div class="flex flex-col h-screen w-screen overflow-hidden">
  <!-- Updater banner spans the full width above the sidebar+main split.
       The banner itself returns null when status is idle / up-to-date,
       so this slot collapses cleanly in the common case. Hidden during
       the onboarding takeover so the wizard owns the chrome. -->
  {#if !isOnboarding}
    <UpdaterBanner />
  {/if}
  <!-- About dialog. Mounted at the root so any surface can summon it via
       `aboutStore.show()` (command palette, settings link, future Help
       menu). Renders nothing until `open` flips, so it's free when idle.
       Placed outside the onboarding guard so it stays reachable even on
       the wizard takeover if a future entry point fires while it's up. -->
  <AboutDialog open={aboutStore.open} onclose={() => aboutStore.close()} />
  <div class="flex flex-1 overflow-hidden">
    {#if !isOnboarding}
      <Sidebar />
    {/if}
    <main class="flex-1 overflow-auto" class:pt-8={!isOnboarding}>
      {@render children()}
    </main>
  </div>

  <!-- Slim bottom status bar. Sits in-flow below the sidebar+main split
       so it takes its own 28px of vertical real estate rather than
       overlaying scrolling content. Hidden on the onboarding takeover
       to match the rest of the chrome. Visibility (Cmd+/) is persisted
       in localStorage and hydrated on mount. -->
  {#if !isOnboarding}
    <StatusBar visible={statusBarVisible} />
  {/if}
</div>

<!-- Mounted once at the root so every route shares one toast viewport.
     Lives outside <main> so it floats over scrolling content. -->
<Toasts />

<!-- Command palette is rendered everywhere except the onboarding takeover.
     The store still allows toggling there, but the modal stays hidden so
     the wizard owns the whole screen. -->
{#if !isOnboarding}
  <CommandPalette />
{/if}

<!-- Global cross-surface search (Cmd+Shift+F). Same onboarding gate as the
     palette — the wizard owns the whole screen, but the rune can still
     toggle (no-op render) so a stray shortcut press doesn't leak into the
     wizard's keyboard handlers. -->
{#if !isOnboarding}
  <GlobalSearch />
{/if}

<!-- Quick thread switcher (Cmd+T). Laser-focused on jumping between chat
     threads — sibling to the palette and global search above. Same
     onboarding gate; the Cmd+T handler itself also short-circuits on the
     wizard, but the gate here keeps the DOM clean. -->
{#if !isOnboarding}
  <ThreadSwitcher />
{/if}
