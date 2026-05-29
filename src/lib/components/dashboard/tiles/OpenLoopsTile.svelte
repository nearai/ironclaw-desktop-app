<script lang="ts">
  // OpenLoopsTile — dashboard widget for the user's tracked commitments
  // (R100/R103). Surfaces the same open-loops store the daily brief reads,
  // so the "Today" surface shows what you're carrying at a glance and lets
  // you add / complete / clear without opening the brief panel.
  //
  // The "Brief me" button navigates to the chat route with `?brief=1`, which
  // the chat page turns into a Chief of Staff agenda over these loops + your
  // recent threads. App-side only — this tile never touches the gateway.

  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { openLoops } from '$lib/stores/open-loops.svelte';
  import Icon from '$lib/components/Icon.svelte';

  let draft = $state('');

  // The store hydrates from localStorage in the root layout, but the
  // dashboard route can land first on a cold open — init() is idempotent.
  onMount(() => openLoops.init());

  function addLoop(): void {
    if (openLoops.add(draft)) draft = '';
  }

  function onDraftKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addLoop();
    }
  }

  function briefMe(): void {
    void goto('/?brief=1');
  }
</script>

<div class="flex flex-col gap-2 h-full" data-testid="open-loops-tile">
  {#if openLoops.active.length > 0}
    <ul class="space-y-1 overflow-auto max-h-40" data-testid="open-loops-list">
      {#each openLoops.active as loop (loop.id)}
        <li class="flex items-center gap-2 group px-1">
          <button
            type="button"
            onclick={() => openLoops.toggleDone(loop.id)}
            class="shrink-0 w-4 h-4 rounded border border-border-subtle text-text-muted
                   hover:border-accent-cyan hover:text-accent-cyan transition-colors
                   flex items-center justify-center"
            aria-label="Complete: {loop.text}"
            title="Mark done"
          >
          </button>
          <span class="flex-1 truncate text-sm text-text-primary" title={loop.text}>
            {loop.text}
          </span>
          <button
            type="button"
            onclick={() => openLoops.remove(loop.id)}
            class="shrink-0 text-text-muted opacity-0 group-hover:opacity-100
                   hover:text-red-300 transition-all"
            aria-label="Remove: {loop.text}"
            title="Remove"
          >
            <Icon name="trash" class="w-3.5 h-3.5" />
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="text-xs text-text-muted px-1">
      No open loops. Track a commitment and your brief will fold it into today's priorities.
    </p>
  {/if}

  <div class="flex items-center gap-2 mt-auto pt-1">
    <input
      type="text"
      bind:value={draft}
      onkeydown={onDraftKey}
      placeholder="Add a commitment…"
      class="flex-1 rounded-md border border-border-subtle bg-bg-base px-2.5 py-1.5 text-sm
             text-text-primary placeholder:text-text-muted
             focus:outline-none focus:border-accent-cyan transition-colors"
      aria-label="Add a commitment"
    />
    <button
      type="button"
      onclick={addLoop}
      disabled={draft.trim().length === 0}
      class="shrink-0 flex items-center gap-1 rounded-md border border-border-subtle px-2.5 py-1.5
             text-sm text-text-primary hover:bg-bg-base/60 transition-colors
             disabled:opacity-40 disabled:cursor-not-allowed"
      aria-label="Add commitment"
    >
      <Icon name="plus" class="w-3.5 h-3.5" />
    </button>
  </div>

  <button
    type="button"
    onclick={briefMe}
    class="flex items-center justify-center gap-1.5 rounded-md bg-accent-cyan/10 border border-accent-cyan/30
           px-3 py-1.5 text-sm text-accent-cyan hover:bg-accent-cyan/20 transition-colors"
    data-testid="open-loops-brief"
  >
    <Icon name="shield" class="w-3.5 h-3.5" />
    Brief me
  </button>
</div>
