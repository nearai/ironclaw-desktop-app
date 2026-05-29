<script lang="ts">
  // "The Desk" — the proactive chief-of-staff home. This first increment is the
  // "Needs you" approval-gate inbox: pending gates render as cards the user
  // approves/denies in place, with a calm "all caught up" empty state when
  // there's nothing awaiting them. Later increments add the "while you were
  // away" activity feed, open-loop commitments, and standing routines, and make
  // this the default landing surface.
  //
  // The Desk store is injected (defaulting to the app-wide singleton) so the
  // render tests can drive it with a seeded controller and no I/O.

  import { rebornDesk, RebornDesk } from '$lib/stores/reborn-desk.svelte';

  interface Props {
    desk?: RebornDesk;
  }
  let { desk = rebornDesk }: Props = $props();

  const gateCards = $derived(desk.gateCards);
  const caughtUp = $derived(desk.caughtUp);
  const loopCards = $derived(desk.loopCards);

  let loopDraft = $state('');

  function addLoop() {
    const text = loopDraft.trim();
    if (!text) return;
    desk.addLoop(text);
    loopDraft = '';
  }
</script>

<div class="desk" data-testid="reborn-desk">
  <header class="desk__head">
    <h1 class="desk__title">The Desk</h1>
    <p class="desk__sub">What needs you, and what your chief of staff handled.</p>
  </header>

  <section class="desk__section" aria-label="Needs you">
    <h2 class="desk__section-title">
      Needs you
      {#if gateCards.length > 0}<span class="desk__count">{gateCards.length}</span>{/if}
    </h2>

    {#if caughtUp}
      <div class="desk__empty" data-testid="desk-caught-up">
        <p class="desk__empty-title">You're all caught up</p>
        <p class="desk__empty-sub">Nothing is waiting on your approval right now.</p>
        <a class="desk__empty-action" href="/">Start a conversation →</a>
      </div>
    {:else}
      {#each gateCards as card (card.id)}
        <article class="desk-card" class:desk-card--auth={card.kind === 'auth_required'}>
          <div class="desk-card__body">
            <span class="desk-card__kind">
              {card.kind === 'auth_required' ? 'Authorization' : 'Approval'}
            </span>
            <p class="desk-card__headline">{card.headline}</p>
            {#if card.body}<p class="desk-card__detail">{card.body}</p>{/if}
          </div>
          <div class="desk-card__actions">
            <button type="button" class="desk-btn desk-btn--primary" onclick={() => desk.approve()}>
              Approve
            </button>
            <button type="button" class="desk-btn" onclick={() => desk.deny()}>Deny</button>
          </div>
        </article>
      {/each}
    {/if}
  </section>

  <section class="desk__section" aria-label="Open loops">
    <h2 class="desk__section-title">
      Open loops
      {#if loopCards.length > 0}<span class="desk__count desk__count--muted"
          >{loopCards.length}</span
        >{/if}
    </h2>
    <form
      class="desk-loop-add"
      onsubmit={(e) => {
        e.preventDefault();
        addLoop();
      }}
    >
      <input
        class="desk-loop-add__input"
        bind:value={loopDraft}
        placeholder="Track a commitment…"
        aria-label="Track a commitment"
      />
      <button
        type="submit"
        class="desk-btn desk-btn--primary"
        disabled={loopDraft.trim().length === 0}
      >
        Add
      </button>
    </form>
    {#each loopCards as loop (loop.id)}
      <article class="desk-card desk-card--loop">
        <div class="desk-card__body">
          <p class="desk-card__headline">{loop.text}</p>
        </div>
        <div class="desk-card__actions">
          <button
            type="button"
            class="desk-btn desk-btn--primary"
            onclick={() => desk.resolveLoop(loop.id)}
          >
            Done
          </button>
          <button type="button" class="desk-btn" onclick={() => desk.dismissLoop(loop.id)}>
            Dismiss
          </button>
        </div>
      </article>
    {/each}
  </section>
</div>

<style>
  .desk {
    height: 100%;
    overflow-y: auto;
    padding: 1.5rem 1.75rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .desk__head {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .desk__title {
    font-size: 1.35rem;
    font-weight: 650;
    color: var(--v2-text, #e6ebf2);
  }
  .desk__sub {
    font-size: 0.875rem;
    color: var(--v2-text-muted, #8a93a6);
  }
  .desk__section {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .desk__section-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--v2-text-muted, #8a93a6);
  }
  .desk__count {
    display: inline-flex;
    min-width: 1.25rem;
    height: 1.25rem;
    padding: 0 0.35rem;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: var(--v2-accent, #4ca7e6);
    color: #fff;
    font-size: 0.7rem;
    font-weight: 700;
  }
  .desk__count--muted {
    background: var(--v2-surface-2, rgba(255, 255, 255, 0.12));
    color: var(--v2-text-muted, #8a93a6);
  }
  .desk__empty {
    padding: 1.5rem;
    border: 1px dashed var(--v2-border, rgba(255, 255, 255, 0.12));
    border-radius: 0.8rem;
    text-align: center;
  }
  .desk__empty-title {
    font-weight: 600;
    color: var(--v2-text, #e6ebf2);
  }
  .desk__empty-sub {
    font-size: 0.85rem;
    color: var(--v2-text-muted, #8a93a6);
  }
  .desk__empty-action {
    display: inline-block;
    margin-top: 0.75rem;
    font-size: 0.85rem;
    font-weight: 550;
    color: var(--v2-accent-text, #8fc8f2);
    text-decoration: none;
  }
  .desk__empty-action:hover {
    text-decoration: underline;
  }
  .desk-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.9rem 1rem;
    border: 1px solid var(--v2-accent, #4ca7e6);
    border-radius: 0.8rem;
    background: var(--v2-accent-soft, rgba(76, 167, 230, 0.14));
  }
  .desk-card--auth {
    border-color: var(--v2-warning, #e6b04c);
    background: var(--v2-warning-soft, rgba(230, 176, 76, 0.14));
  }
  .desk-card--loop {
    border-color: var(--v2-border, rgba(255, 255, 255, 0.12));
    background: var(--v2-surface, rgba(255, 255, 255, 0.04));
  }
  .desk-card__body {
    min-width: 0;
  }
  .desk-card__kind {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--v2-text-muted, #8a93a6);
  }
  .desk-card__headline {
    margin-top: 0.15rem;
    color: var(--v2-text, #e6ebf2);
    font-weight: 550;
    word-break: break-word;
  }
  .desk-card__detail {
    margin-top: 0.25rem;
    font-size: 0.85rem;
    color: var(--v2-text-muted, #8a93a6);
    word-break: break-word;
  }
  .desk-card__actions {
    display: flex;
    gap: 0.5rem;
    flex: 0 0 auto;
  }
  .desk-loop-add {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .desk-loop-add__input {
    flex: 1 1 auto;
    padding: 0.5rem 0.7rem;
    border-radius: 0.55rem;
    border: 1px solid var(--v2-border, rgba(255, 255, 255, 0.12));
    background: var(--v2-surface, rgba(255, 255, 255, 0.04));
    color: var(--v2-text, #e6ebf2);
    font: inherit;
  }
  .desk-btn {
    padding: 0.5rem 0.9rem;
    border-radius: 0.55rem;
    border: 1px solid var(--v2-border, rgba(255, 255, 255, 0.14));
    background: var(--v2-surface-2, rgba(255, 255, 255, 0.06));
    color: var(--v2-text, #e6ebf2);
    cursor: pointer;
  }
  .desk-btn--primary {
    background: var(--v2-accent, #4ca7e6);
    border-color: var(--v2-accent, #4ca7e6);
    color: #fff;
  }
</style>
