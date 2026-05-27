<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Toasts from '$lib/components/Toasts.svelte';
  import CommandPalette from '$lib/components/CommandPalette.svelte';
  import UpdaterBanner from '$lib/components/UpdaterBanner.svelte';
  import { connection } from '$lib/stores/connection.svelte';
  import { palette } from '$lib/stores/shortcuts.svelte';
  import { tray } from '$lib/stores/tray.svelte';
  import { updater } from '$lib/stores/updater.svelte';
  import { windowFocus } from '$lib/stores/window-focus.svelte';
  import { notifications } from '$lib/stores/notifications.svelte';
  import { toasts } from '$lib/stores/toasts.svelte';

  let { children } = $props();

  // Hide the sidebar (and the top padding it implies) on the full-screen
  // onboarding takeover. `page.url.pathname` from `$app/state` is reactive
  // under Svelte 5 runes, so this re-renders on navigation.
  const isOnboarding = $derived(page.url.pathname.startsWith('/onboarding'));

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

    if (mod && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      palette.togglePalette();
      return;
    }

    // Cmd-comma → settings (macOS convention).
    if (mod && e.key === ',') {
      e.preventDefault();
      void goto('/settings');
      return;
    }

    // Cmd+1..7 → top-level routes. Match by `e.key` so the digit is correct
    // across keyboard layouts; modifiers aren't required to interpret it.
    // Cmd+7 is gated on `settings.adminMode` so the chord stays a no-op
    // when the admin surface isn't enabled — same visibility contract as
    // the sidebar row.
    if (mod && !e.shiftKey && !e.altKey) {
      const target = ROUTES_BY_DIGIT[e.key];
      if (target) {
        if (target === '/admin' && !connection.settings.adminMode) return;
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
    '5': '/logs',
    '6': '/extensions',
    '7': '/admin'
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

  onMount(() => {
    // Boot the focus tracker + hydrate notification prefs early so any
    // surface that fires a notification on first render (e.g. routine
    // completion catching up on poll #1) sees the user's saved toggles.
    windowFocus.init();
    notifications.hydrate();
    // Wire the menu-bar tray listeners (Show window, Open settings,
    // Restart sidecar). Safe outside the Tauri webview — the store
    // detects that and no-ops.
    tray.init();

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
  <div class="flex flex-1 overflow-hidden">
    {#if !isOnboarding}
      <Sidebar />
    {/if}
    <main class="flex-1 overflow-auto" class:pt-8={!isOnboarding}>
      {@render children()}
    </main>
  </div>
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
