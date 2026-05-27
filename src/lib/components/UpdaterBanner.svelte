<script lang="ts">
  // Top-of-layout banner driven by the global `updater` store. Renders
  // when an update is available, while it's downloading/installing, or
  // when the last check errored — hidden in idle / up-to-date states so
  // the chrome stays quiet on a healthy launch.
  //
  // Notes:
  //   - The release-notes popover uses a tiny inline markdown render
  //     (paragraphs split on blank line, line breaks preserved) so we
  //     don't pay the cost of MarkdownView for a few lines of changelog.
  //   - Touch targets stay >= 44px tall per the global mobile-first rule.

  import { updater } from '$lib/stores/updater.svelte';

  let showNotes = $state(false);

  // Compose a short label for each non-idle state.
  const label = $derived.by(() => {
    switch (updater.status) {
      case 'available':
        return updater.update ? `IronClaw v${updater.update.version} is available` : 'Update available';
      case 'downloading':
        return updater.progress != null ? `Downloading ${updater.progress}%…` : 'Downloading…';
      case 'installing':
        return 'Installing — restart the app to apply.';
      case 'error':
        return updater.error ?? 'Update failed';
      default:
        return '';
    }
  });

  // Render only when state is interesting. Idle / checking / up-to-date
  // stays out of the user's way.
  const visible = $derived(
    updater.status === 'available' ||
      updater.status === 'downloading' ||
      updater.status === 'installing' ||
      updater.status === 'error'
  );

  async function onInstall() {
    showNotes = false;
    await updater.install();
  }

  function onLater() {
    showNotes = false;
    updater.dismiss();
  }

  async function onRetry() {
    showNotes = false;
    await updater.check();
  }
</script>

{#if visible}
  <div
    class="w-full border-b text-xs flex items-center gap-3 px-4 py-2 z-30 relative"
    class:bg-bg-surface={updater.status !== 'error'}
    class:border-border-subtle={updater.status !== 'error'}
    class:text-text-primary={updater.status !== 'error'}
    class:bg-red-950={updater.status === 'error'}
    class:border-red-800={updater.status === 'error'}
    class:text-red-200={updater.status === 'error'}
    role="status"
  >
    <span class="flex-1 truncate" title={updater.error ?? undefined}>
      {label}
      {#if updater.status === 'available' && updater.update?.notes}
        <button
          type="button"
          onclick={() => (showNotes = !showNotes)}
          class="ml-2 underline text-accent-cyan hover:brightness-110"
        >
          release notes
        </button>
      {/if}
    </span>

    {#if updater.status === 'downloading' && updater.progress != null}
      <!-- Linear progress bar -->
      <div class="w-32 h-1.5 bg-bg-deep rounded overflow-hidden">
        <div
          class="h-full bg-accent-cyan transition-[width] duration-150"
          style:width="{updater.progress}%"
        ></div>
      </div>
    {/if}

    {#if updater.status === 'available'}
      <button
        type="button"
        onclick={onInstall}
        class="px-3 py-1.5 rounded-md bg-accent-cyan text-bg-deep text-xs font-semibold hover:brightness-110 transition min-h-[32px]"
      >
        Install now
      </button>
      <button
        type="button"
        onclick={onLater}
        class="text-text-muted hover:text-text-primary transition-colors text-xs"
      >
        Later
      </button>
    {:else if updater.status === 'error'}
      <button
        type="button"
        onclick={onRetry}
        class="px-3 py-1.5 rounded-md border border-red-400 text-red-200 text-xs font-semibold hover:bg-red-900 transition min-h-[32px]"
      >
        Retry
      </button>
      <button
        type="button"
        onclick={onLater}
        class="text-red-300 hover:text-red-100 transition-colors text-xs"
      >
        Dismiss
      </button>
    {/if}
  </div>

  {#if showNotes && updater.update?.notes}
    <!-- Release-notes popover. Anchored just below the banner so the
         user can scan changelog without leaving the app. Click anywhere
         in the dim background to close. -->
    <div
      class="fixed inset-0 z-40"
      role="presentation"
      onclick={() => (showNotes = false)}
      onkeydown={(e) => {
        if (e.key === 'Escape') showNotes = false;
      }}
    >
      <div
        class="absolute top-12 left-1/2 -translate-x-1/2 w-[min(640px,90vw)] max-h-[60vh] overflow-auto bg-bg-surface border border-border-subtle rounded-lg shadow-2xl p-5"
        role="dialog"
        aria-label="Release notes"
        tabindex="-1"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
      >
        <header class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-text-primary">
            Release notes — v{updater.update.version}
          </h2>
          <button
            type="button"
            onclick={() => (showNotes = false)}
            class="text-text-muted hover:text-text-primary"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>
        <div class="text-xs text-text-primary whitespace-pre-wrap leading-relaxed">
          {updater.update.notes}
        </div>
      </div>
    </div>
  {/if}
{/if}
