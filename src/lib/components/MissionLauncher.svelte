<script lang="ts">
  import { goto } from '$app/navigation';
  import { FIRST_RUN_MISSIONS, type Mission } from '$lib/data/missions';
  import { composerInsert } from '$lib/stores/templates.svelte';

  interface Props {
    onlaunch?: (missionId: string) => void;
  }

  let { onlaunch }: Props = $props();

  const missions: Mission[] = FIRST_RUN_MISSIONS;

  const connectorLabels: Record<string, string> = {
    google: 'Google',
    notion: 'Notion',
    slack: 'Slack'
  };

  function connectorLabel(id: string): string {
    return (
      connectorLabels[id] ??
      id
        .split(/[-_]/)
        .filter(Boolean)
        .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
        .join(' ')
    );
  }

  function launchMission(mission: Mission): void {
    composerInsert.push(mission.prompt);
    void goto('/');
    onlaunch?.(mission.id);
  }
</script>

<section class="w-full" aria-label="First-run missions">
  {#if missions.length > 0}
    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="mission-grid">
      {#each missions as mission (mission.id)}
        <button
          type="button"
          onclick={() => launchMission(mission)}
          class="group flex min-h-[180px] w-full flex-col rounded-lg border border-border-subtle bg-bg-surface/70 p-4 text-left transition-colors hover:border-accent-cyan/70 hover:bg-bg-hover focus:outline-none focus-visible:border-accent-cyan focus-visible:ring-2 focus-visible:ring-accent-cyan/30"
          aria-labelledby={`mission-title-${mission.id}`}
          aria-describedby={`mission-description-${mission.id}`}
          data-testid={`mission-card-${mission.id}`}
        >
          <div class="flex items-start gap-3">
            <div class="min-w-0 flex-1">
              <h3
                id={`mission-title-${mission.id}`}
                class="text-sm font-semibold text-text-primary transition-colors group-hover:text-accent-cyan"
              >
                {mission.title}
              </h3>
              <p
                id={`mission-description-${mission.id}`}
                class="mt-2 text-sm leading-5 text-text-muted"
              >
                {mission.description}
              </p>
            </div>
            <span
              class="shrink-0 rounded-full border border-accent-cyan/30 bg-accent-cyan/10 px-2 py-1 text-[11px] font-medium text-accent-cyan"
            >
              {mission.mode === 'approval' ? 'Approval mode' : 'Dry run'}
            </span>
          </div>

          <div class="mt-auto flex flex-wrap gap-2 pt-4" aria-label="Required connectors">
            {#if mission.required_connectors.length > 0}
              {#each mission.required_connectors as connector}
                <span
                  class="rounded-md border border-border-subtle bg-bg-deep/60 px-2 py-1 text-[11px] font-medium text-text-muted"
                >
                  {connectorLabel(connector)}
                </span>
              {/each}
            {:else}
              <span
                class="rounded-md border border-border-subtle bg-bg-deep/60 px-2 py-1 text-[11px] font-medium text-text-muted"
              >
                No connectors required
              </span>
            {/if}
          </div>
        </button>
      {/each}
    </div>
  {:else}
    <div
      class="rounded-lg border border-border-subtle bg-bg-surface/70 px-4 py-5 text-sm text-text-muted"
      role="status"
    >
      No missions are available yet.
    </div>
  {/if}
</section>
