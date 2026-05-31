<script lang="ts">
  import { onMount } from 'svelte';
  import ConnectorPacks from '$lib/components/ConnectorPacks.svelte';
  import MissionLauncher from '$lib/components/MissionLauncher.svelte';

  type Props = {
    onconnected?: (id: string) => void;
    onlaunch?: (id: string) => void;
  };

  const DISMISSED_KEY = 'ironclaw-getstarted-dismissed';

  let { onconnected, onlaunch }: Props = $props();
  let dismissed = $state(false);

  onMount(() => {
    try {
      dismissed = localStorage.getItem(DISMISSED_KEY) === '1';
    } catch {
      dismissed = false;
    }
  });

  function dismiss(): void {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Dismiss locally even when storage is unavailable.
    }
    dismissed = true;
  }
</script>

{#if !dismissed}
  <section
    class="mb-6 rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-sm shadow-black/10 sm:p-5"
    aria-labelledby="get-started-heading"
  >
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <p class="text-xs font-mono uppercase tracking-widest text-accent-cyan/80">Get started</p>
        <h2 id="get-started-heading" class="mt-2 text-xl font-semibold text-text-primary">
          Set up your chief of staff
        </h2>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-text-muted">
          Connect the workspace context IronClaw can use, then launch a first mission in approval
          mode.
        </p>
      </div>

      <button
        type="button"
        class="inline-flex min-h-[40px] shrink-0 items-center justify-center rounded-md border border-border-subtle px-3 py-2 text-sm font-semibold text-text-muted transition hover:border-accent-cyan hover:text-text-primary focus:outline-none focus-visible:border-accent-cyan focus-visible:ring-2 focus-visible:ring-accent-cyan/30"
        aria-label="Dismiss"
        onclick={dismiss}
      >
        Dismiss
      </button>
    </div>

    <div class="mt-6 space-y-6">
      <section
        class="rounded-lg border border-border-subtle bg-bg-base/35 p-4"
        aria-labelledby="get-started-connect-heading"
      >
        <h3 id="get-started-connect-heading" class="mb-4 text-sm font-semibold text-text-primary">
          1 · Connect your workspace
        </h3>
        <ConnectorPacks {onconnected} />
      </section>

      <section
        class="rounded-lg border border-border-subtle bg-bg-base/35 p-4"
        aria-labelledby="get-started-mission-heading"
      >
        <h3 id="get-started-mission-heading" class="mb-4 text-sm font-semibold text-text-primary">
          2 · Run your first mission
        </h3>
        <MissionLauncher {onlaunch} />
      </section>
    </div>
  </section>
{/if}
