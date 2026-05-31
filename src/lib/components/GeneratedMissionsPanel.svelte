<script lang="ts">
  // Generative missions panel — the agent proposes grounded actions from what
  // the user actually has in front of them, instead of a static menu. Paste in
  // what just came in (a contract, call notes, an email thread); the connected
  // agent reads it and proposes specific next actions, each runnable
  // approval-first via the chat composer.
  import { goto } from '$app/navigation';
  import { generatedMissions } from '$lib/stores/generated-missions.svelte';
  import type { ContextItem } from '$lib/util/mission-generator';

  const gm = generatedMissions;
  let pasted = $state('');

  const canGenerate = $derived(
    gm.available && pasted.trim().length > 0 && gm.status !== 'generating'
  );

  async function generate() {
    const items: ContextItem[] = [{ kind: 'note', label: 'Pasted into the Desk', body: pasted }];
    await gm.generateFrom(items);
  }

  function runMission(id: string) {
    const m = gm.missions.find((x) => x.id === id);
    if (!m) return;
    gm.run(m);
    void goto('/');
  }
</script>

<section
  aria-label="Generated actions"
  class="surface border border-border-subtle rounded-lg p-4 space-y-3"
>
  <header class="space-y-1">
    <h2 class="text-sm font-semibold text-text-primary">What just came in</h2>
    <p class="text-xs text-text-muted">
      Paste a contract, call notes, or an email thread. IronClaw reads it and proposes the specific
      next actions to put on your Desk — nothing is sent or written without your approval.
    </p>
  </header>

  <textarea
    bind:value={pasted}
    rows="5"
    placeholder="Paste what landed — a contract to review, notes from a call, an email thread…"
    aria-label="Context for the agent to propose actions from"
    class="w-full resize-y rounded-md border border-border-subtle bg-bg-deep/60 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-cyan focus:outline-none"
  ></textarea>

  <div class="flex items-center gap-3">
    <button
      type="button"
      onclick={generate}
      disabled={!canGenerate}
      class="inline-flex items-center gap-2 rounded-md bg-accent-cyan px-3 py-2 text-sm font-semibold text-bg-deep transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 min-h-[40px]"
    >
      {#if gm.status === 'generating'}
        <span
          class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-bg-deep/40 border-t-bg-deep"
          aria-hidden="true"
        ></span>
        Generating…
      {:else}
        Generate actions
      {/if}
    </button>
    {#if gm.missions.length > 0 || gm.status === 'error' || gm.status === 'empty'}
      <button
        type="button"
        onclick={() => gm.reset()}
        class="text-xs text-text-muted hover:text-text-primary transition-colors min-h-[40px]"
      >
        Clear
      </button>
    {/if}
  </div>

  {#if !gm.available}
    <p class="text-xs text-accent-gold">
      Not connected to a gateway — connect one in Settings to generate actions.
    </p>
  {/if}

  {#if gm.status === 'error'}
    <p class="text-xs text-danger" role="alert">{gm.error}</p>
  {:else if gm.status === 'empty'}
    <p class="text-xs text-text-muted">
      The agent didn't find a clear action in that. Try pasting more of the item.
    </p>
  {:else if gm.status === 'ready'}
    <ul class="space-y-2" aria-label="Proposed actions">
      {#each gm.missions as m (m.id)}
        <li class="rounded-md border border-border-subtle bg-bg-surface/40 p-3 space-y-1.5">
          <div class="flex items-start justify-between gap-2">
            <h3 class="text-sm font-medium text-text-primary">{m.title}</h3>
            <span
              class="shrink-0 rounded-full border border-border-subtle px-2 py-0.5 text-[10px] uppercase tracking-wide"
              class:text-accent-gold={m.mode === 'approval'}
              class:text-accent-cyan={m.mode === 'dry-run'}
            >
              {m.mode === 'approval' ? 'needs approval' : 'read-only'}
            </span>
          </div>
          {#if m.why}<p class="text-xs text-text-muted">{m.why}</p>{/if}
          {#if m.deliverable}
            <p class="text-xs text-text-muted">
              <span class="text-text-primary">Gives you:</span>
              {m.deliverable}
            </p>
          {/if}
          <div class="flex items-center gap-2 pt-1">
            <button
              type="button"
              onclick={() => runMission(m.id)}
              class="rounded-md border border-accent-cyan/60 px-2.5 py-1 text-xs text-accent-cyan hover:bg-accent-cyan/10 transition-colors min-h-[36px]"
            >
              Run in chat
            </button>
            <button
              type="button"
              onclick={() => gm.dismiss(m.id)}
              class="rounded-md px-2.5 py-1 text-xs text-text-muted hover:text-text-primary transition-colors min-h-[36px]"
            >
              Dismiss
            </button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>
