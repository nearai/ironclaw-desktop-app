<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import ConnectorPacks from '$lib/components/ConnectorPacks.svelte';
  import MissionLauncher from '$lib/components/MissionLauncher.svelte';
  import type { ConnectorPackStatus } from '$lib/data/connector-packs';
  import { connection } from '$lib/stores/connection.svelte';
  import { getStartedProgress } from '$lib/stores/get-started-progress.svelte';

  type Props = {
    onconnected?: (id: string) => void;
    onlaunch?: (id: string) => void;
  };

  type StepState = 'done' | 'current' | 'locked';

  let { onconnected, onlaunch }: Props = $props();
  let packStatuses = $state<Record<string, ConnectorPackStatus>>({});

  onMount(() => {
    getStartedProgress.hydrate(connection.activeProfile?.id);
  });

  $effect(() => {
    const profileId = connection.activeProfile?.id ?? 'default';
    untrack(() => getStartedProgress.bindProfile(profileId));
  });

  const runnerConnected = $derived(connection.client !== null);
  const liveConnectedPackIds = $derived(
    Object.entries(packStatuses)
      .filter(([, status]) => status === 'connected')
      .map(([packId]) => packId)
  );
  const workspaceDone = $derived(
    getStartedProgress.snapshot.connectedPackIds.length > 0 || liveConnectedPackIds.length > 0
  );
  const missionDone = $derived(getStartedProgress.snapshot.launchedMissionIds.length > 0);
  const allDone = $derived(runnerConnected && workspaceDone && missionDone);
  const collapsed = $derived(getStartedProgress.snapshot.collapsed && allDone);

  $effect(() => {
    for (const packId of liveConnectedPackIds) {
      untrack(() => getStartedProgress.markPackConnected(packId));
    }
  });

  function stepState(step: 1 | 2 | 3): StepState {
    if (step === 1) return runnerConnected ? 'done' : 'current';
    if (step === 2) {
      if (workspaceDone) return 'done';
      return runnerConnected ? 'current' : 'locked';
    }
    if (missionDone) return 'done';
    return runnerConnected && workspaceDone ? 'current' : 'locked';
  }

  function statusLabel(state: StepState): string {
    if (state === 'done') return 'Done';
    if (state === 'current') return 'Current';
    return 'Locked';
  }

  function statusClass(state: StepState): string {
    if (state === 'done') return 'border-accent-cyan/60 bg-accent-cyan/10 text-accent-cyan';
    if (state === 'current') return 'border-yellow-500/50 bg-yellow-500/10 text-yellow-300';
    return 'border-border-subtle bg-bg-deep text-text-muted';
  }

  function handleReadinessChange(statuses: Record<string, ConnectorPackStatus>): void {
    packStatuses = statuses;
  }

  function handleConnected(id: string): void {
    getStartedProgress.markPackConnected(id);
    onconnected?.(id);
  }

  function handleLaunch(id: string): void {
    getStartedProgress.markMissionLaunched(id);
    onlaunch?.(id);
  }

  function collapse(): void {
    if (!allDone) return;
    getStartedProgress.setCollapsed(true);
  }

  function expand(): void {
    getStartedProgress.setCollapsed(false);
  }
</script>

{#if collapsed}
  <section
    class="mb-6 rounded-lg border border-border-subtle bg-bg-surface px-4 py-3 shadow-sm shadow-black/10"
    aria-labelledby="get-started-heading"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-xs font-mono uppercase tracking-widest text-accent-cyan/80">
          Setup complete
        </p>
        <h2 id="get-started-heading" class="mt-1 text-base font-semibold text-text-primary">
          Chief-of-staff loop is ready
        </h2>
      </div>
      <button
        type="button"
        class="inline-flex min-h-[36px] items-center justify-center rounded-md border border-border-subtle px-3 py-1.5 text-sm font-semibold text-text-muted transition hover:border-accent-cyan hover:text-text-primary focus:outline-none focus-visible:border-accent-cyan focus-visible:ring-2 focus-visible:ring-accent-cyan/30"
        onclick={expand}
      >
        Show setup
      </button>
    </div>
  </section>
{:else}
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

      {#if allDone}
        <button
          type="button"
          class="inline-flex min-h-[40px] shrink-0 items-center justify-center rounded-md border border-border-subtle px-3 py-2 text-sm font-semibold text-text-muted transition hover:border-accent-cyan hover:text-text-primary focus:outline-none focus-visible:border-accent-cyan focus-visible:ring-2 focus-visible:ring-accent-cyan/30"
          aria-label="Collapse setup tracker"
          onclick={collapse}
        >
          Collapse
        </button>
      {/if}
    </div>

    <ol class="mt-5 grid gap-2 text-sm md:grid-cols-3" aria-label="Setup progress">
      {#each [{ id: 1 as const, label: 'Runner connected' }, { id: 2 as const, label: 'Workspace packs' }, { id: 3 as const, label: 'Mission launcher' }] as step (step.id)}
        {@const state = stepState(step.id)}
        <li class="rounded-md border border-border-subtle bg-bg-base/30 p-3">
          <div class="flex items-center justify-between gap-3">
            <span class="font-semibold text-text-primary">{step.id}. {step.label}</span>
            <span
              class={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-mono ${statusClass(state)}`}
            >
              {statusLabel(state)}
            </span>
          </div>
        </li>
      {/each}
    </ol>

    <div class="mt-6 space-y-6">
      <section
        class="rounded-lg border border-border-subtle bg-bg-base/35 p-4"
        aria-labelledby="get-started-runner-heading"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="get-started-runner-heading" class="text-sm font-semibold text-text-primary">
              1 · Runner connected
            </h3>
            <p class="mt-1 text-sm text-text-muted">
              {runnerConnected
                ? `Connected to ${connection.apiVersion.toUpperCase()} on ${connection.activeProfile?.name ?? 'active profile'}`
                : 'Connect IronClaw before installing packs or launching missions.'}
            </p>
          </div>
          <span
            class={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-mono ${runnerConnected ? 'border-accent-cyan/60 bg-accent-cyan/10 text-accent-cyan' : 'border-border-subtle bg-bg-deep text-text-muted'}`}
          >
            {runnerConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </section>

      <section
        class="rounded-lg border border-border-subtle bg-bg-base/35 p-4"
        aria-labelledby="get-started-connect-heading"
      >
        <h3 id="get-started-connect-heading" class="mb-4 text-sm font-semibold text-text-primary">
          2 · Connect a workspace pack
        </h3>
        <ConnectorPacks onconnected={handleConnected} onreadinesschange={handleReadinessChange} />
      </section>

      <section
        class="rounded-lg border border-border-subtle bg-bg-base/35 p-4"
        aria-labelledby="get-started-mission-heading"
      >
        <h3 id="get-started-mission-heading" class="mb-4 text-sm font-semibold text-text-primary">
          3 · Run your first mission
        </h3>
        <MissionLauncher onlaunch={handleLaunch} {packStatuses} />
      </section>
    </div>
  </section>
{/if}
