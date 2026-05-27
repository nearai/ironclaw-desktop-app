<script lang="ts">
  import { page } from '$app/state';

  type NavItem = {
    href: string;
    label: string;
    icon: 'chat' | 'knowledge' | 'skills' | 'routines' | 'settings';
  };

  const items: NavItem[] = [
    { href: '/', label: 'Chat', icon: 'chat' },
    { href: '/knowledge', label: 'Knowledge', icon: 'knowledge' },
    { href: '/skills', label: 'Skills', icon: 'skills' },
    { href: '/routines', label: 'Routines', icon: 'routines' },
    { href: '/settings', label: 'Settings', icon: 'settings' }
  ];

  const isActive = $derived((href: string) => {
    const path = page.url.pathname;
    if (href === '/') return path === '/';
    return path === href || path.startsWith(href + '/');
  });

  // Connection status — will be wired to Tauri backend later
  const connected = $state(false);
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
        {:else if item.icon === 'routines'}
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        {:else if item.icon === 'settings'}
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        {/if}
        <span>{item.label}</span>
      </a>
    {/each}
  </nav>

  <div class="px-3 py-4 border-t border-border-subtle">
    <div
      class="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs"
      class:text-text-muted={!connected}
    >
      <span
        class="w-2 h-2 rounded-full"
        class:bg-red-500={!connected}
        class:bg-accent-cyan={connected}
      ></span>
      <span>{connected ? 'Connected' : 'Disconnected'}</span>
    </div>
  </div>
</aside>
