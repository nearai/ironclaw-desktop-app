<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { connection, type ConnectionStatus } from '$lib/stores/connection.svelte';
  import NewProfileModal from '$lib/components/NewProfileModal.svelte';

  type NavItem = {
    href: string;
    label: string;
    icon:
      | 'chat'
      | 'knowledge'
      | 'logs'
      | 'routines'
      | 'settings'
      | 'skills'
      | 'extensions';
    /** Optional shortcut hint shown to the right of the label. Mirrors the
     *  global shortcuts wired in `src/routes/+layout.svelte`. */
    shortcut?: string;
  };

  const items: NavItem[] = [
    { href: '/', label: 'Chat', icon: 'chat', shortcut: '⌘1' },
    { href: '/knowledge', label: 'Knowledge', icon: 'knowledge', shortcut: '⌘2' },
    { href: '/skills', label: 'Skills', icon: 'skills', shortcut: '⌘3' },
    { href: '/routines', label: 'Routines', icon: 'routines', shortcut: '⌘4' },
    { href: '/logs', label: 'Logs', icon: 'logs', shortcut: '⌘5' },
    { href: '/extensions', label: 'Extensions', icon: 'extensions', shortcut: '⌘6' },
    { href: '/settings', label: 'Settings', icon: 'settings', shortcut: '⌘,' }
  ];

  const isActive = $derived((href: string) => {
    const path = page.url.pathname;
    if (href === '/') return path === '/';
    return path === href || path.startsWith(href + '/');
  });

  // ---- Profile dropdown state -------------------------------------------
  //
  // The dropdown lives above the connection-status pill. Click the chip to
  // toggle the popover; the popover lists every profile + a "+ New profile"
  // affordance + a "Manage profiles" link that scrolls to /settings#profiles.
  //
  // Popover is dismissed on:
  //   - Picking a profile.
  //   - Pressing Esc.
  //   - Clicking outside the chip+popover (window listener).

  let popoverOpen = $state(false);
  let newProfileModalOpen = $state(false);
  let chipRef: HTMLButtonElement | undefined = $state();
  let popoverRef: HTMLDivElement | undefined = $state();

  function togglePopover() {
    popoverOpen = !popoverOpen;
  }

  function closePopover() {
    popoverOpen = false;
  }

  async function pickProfile(id: string) {
    closePopover();
    if (id === connection.activeProfile.id) return;
    await connection.switchProfile(id);
  }

  function openNewProfile() {
    closePopover();
    newProfileModalOpen = true;
  }

  async function gotoManageProfiles() {
    closePopover();
    await goto('/settings#profiles');
  }

  onMount(() => {
    void connection.init();

    function onWindowClick(e: MouseEvent) {
      if (!popoverOpen) return;
      const t = e.target as Node | null;
      if (!t) return;
      if (chipRef?.contains(t)) return;
      if (popoverRef?.contains(t)) return;
      closePopover();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (popoverOpen && e.key === 'Escape') {
        e.preventDefault();
        closePopover();
      }
    }
    window.addEventListener('mousedown', onWindowClick);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onWindowClick);
      window.removeEventListener('keydown', onKeyDown);
      connection.stopPolling();
    };
  });

  function pillLabel(s: ConnectionStatus): string {
    switch (s) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting…';
      case 'error':
        return 'Error';
      case 'disconnected':
      case 'idle':
      default:
        return 'Disconnected';
    }
  }
</script>

<aside
  class="w-56 shrink-0 h-full bg-bg-base/80 border-r border-border-subtle flex flex-col pt-10"
>
  <div class="px-5 pb-6 flex items-center gap-2">
    <svg viewBox="0 0 24 24" class="w-6 h-6 text-accent-cyan" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M4 7l8-4 8 4-8 4-8-4z" stroke-linejoin="round" />
      <path d="M4 12l8 4 8-4" stroke-linejoin="round" />
      <path d="M4 17l8 4 8-4" stroke-linejoin="round" />
    </svg>
    <span class="text-lg font-semibold tracking-tight text-accent-cyan">IronClaw</span>
  </div>

  <nav class="flex-1 px-2 space-y-1">
    {#each items as item (item.href)}
      {@const active = isActive(item.href)}
      <a
        href={item.href}
        class="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors min-h-[44px] border-l-2"
        class:border-accent-cyan={active}
        class:border-transparent={!active}
        class:bg-bg-surface={active}
        class:text-text-primary={active}
        class:text-text-muted={!active}
        class:hover:bg-bg-surface={!active}
        class:hover:text-text-primary={!active}
      >
        {#if item.icon === 'chat'}
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        {:else if item.icon === 'knowledge'}
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        {:else if item.icon === 'skills'}
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        {:else if item.icon === 'extensions'}
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <!-- Puzzle piece glyph -->
            <path d="M19.4 7H17V4.6c0-.88-.72-1.6-1.6-1.6h-2.8c-.88 0-1.6.72-1.6 1.6V7H8.6C7.72 7 7 7.72 7 8.6v2.8h2.4c.88 0 1.6.72 1.6 1.6s-.72 1.6-1.6 1.6H7v2.8c0 .88.72 1.6 1.6 1.6h2.8v-2.4c0-.88.72-1.6 1.6-1.6s1.6.72 1.6 1.6V19h2.8c.88 0 1.6-.72 1.6-1.6V15h2.4c.88 0 1.6-.72 1.6-1.6v-2.8c0-.88-.72-1.6-1.6-1.6H21V8.6c0-.88-.72-1.6-1.6-1.6z" />
          </svg>
        {:else if item.icon === 'routines'}
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        {:else if item.icon === 'logs'}
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
        {:else if item.icon === 'settings'}
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        {/if}
        <span class="flex-1 truncate">{item.label}</span>
        {#if item.shortcut}
          <span
            class="text-[10px] font-mono opacity-50 tracking-wider shrink-0"
            aria-hidden="true"
          >
            {item.shortcut}
          </span>
        {/if}
      </a>
    {/each}
  </nav>

  <!-- Profile chip + popover. Sits above the connection-status pill so the
       eye scans profile → status from top to bottom. The chip is wrapped in
       `relative` so the popover can position itself just above using
       `absolute bottom-full`. -->
  <div class="px-3 pt-3 border-t border-border-subtle">
    <div class="relative">
      <button
        bind:this={chipRef}
        type="button"
        onclick={togglePopover}
        class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-bg-surface transition-colors min-h-[36px] border border-transparent"
        class:border-accent-cyan={popoverOpen}
        aria-haspopup="listbox"
        aria-expanded={popoverOpen}
        title="Switch profile"
      >
        <!-- Profile glyph (stacked-disks) -->
        <svg
          viewBox="0 0 24 24"
          class="w-3.5 h-3.5 text-accent-cyan shrink-0"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
        <span class="flex-1 text-left truncate text-text-primary">
          {connection.activeProfile.name}
        </span>
        <!-- Chevron rotates with popover state -->
        <svg
          viewBox="0 0 24 24"
          class="w-3 h-3 opacity-60 transition-transform shrink-0"
          class:rotate-180={popoverOpen}
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {#if popoverOpen}
        <!-- Popover. Anchored to the chip via `bottom-full + mb-1` so it
             grows upward — the sidebar bottom is already crowded by the
             status pill below. Width matches the chip (`left-0 right-0`)
             so it stays inside the 224px sidebar. -->
        <div
          bind:this={popoverRef}
          class="absolute left-0 right-0 bottom-full mb-1 z-40 surface border border-border-subtle p-1 shadow-xl"
          role="listbox"
          aria-label="Profiles"
        >
          {#each connection.settings.profiles as profile (profile.id)}
            {@const isActiveProfile = profile.id === connection.activeProfile.id}
            <button
              type="button"
              onclick={() => void pickProfile(profile.id)}
              class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left hover:bg-bg-surface transition-colors min-h-[32px]"
              role="option"
              aria-selected={isActiveProfile}
            >
              <!-- Radio indicator -->
              <span
                class="w-3 h-3 rounded-full border-2 shrink-0 flex items-center justify-center"
                class:border-accent-cyan={isActiveProfile}
                class:border-border-subtle={!isActiveProfile}
              >
                {#if isActiveProfile}
                  <span class="w-1.5 h-1.5 rounded-full bg-accent-cyan"></span>
                {/if}
              </span>
              <span
                class="flex-1 truncate"
                class:text-text-primary={isActiveProfile}
                class:text-text-muted={!isActiveProfile}
              >
                {profile.name}
              </span>
              <span
                class="text-[9px] uppercase tracking-wider opacity-60 font-mono shrink-0"
                aria-hidden="true"
              >
                {profile.mode === 'local' ? 'L' : 'R'}
              </span>
            </button>
          {/each}

          <div class="my-1 border-t border-border-subtle"></div>

          <button
            type="button"
            onclick={openNewProfile}
            class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left hover:bg-bg-surface text-accent-cyan transition-colors min-h-[32px]"
          >
            <svg
              viewBox="0 0 24 24"
              class="w-3.5 h-3.5 shrink-0"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span class="flex-1">New profile</span>
          </button>

          <button
            type="button"
            onclick={() => void gotoManageProfiles()}
            class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left hover:bg-bg-surface text-text-muted hover:text-text-primary transition-colors min-h-[32px]"
          >
            <svg
              viewBox="0 0 24 24"
              class="w-3.5 h-3.5 shrink-0"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span class="flex-1">Manage profiles</span>
          </button>
        </div>
      {/if}
    </div>
  </div>

  <div class="px-3 py-4 border-t border-border-subtle">
    <div
      class="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs"
      title={connection.lastError ?? undefined}
    >
      <span
        class="w-2 h-2 rounded-full"
        class:bg-green-500={connection.status === 'connected'}
        class:bg-accent-gold={connection.status === 'connecting'}
        class:bg-red-500={connection.status === 'error' ||
          connection.status === 'disconnected' ||
          connection.status === 'idle'}
      ></span>
      <span
        class:text-text-primary={connection.status === 'connected'}
        class:text-accent-gold={connection.status === 'connecting'}
        class:text-red-400={connection.status === 'error'}
        class:text-text-muted={connection.status === 'disconnected' ||
          connection.status === 'idle'}
      >
        {pillLabel(connection.status)}
      </span>
    </div>
  </div>
</aside>

<NewProfileModal
  bind:open={newProfileModalOpen}
  onClose={() => (newProfileModalOpen = false)}
/>
