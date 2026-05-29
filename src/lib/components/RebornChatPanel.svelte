<script lang="ts">
  // Self-contained IronClaw Reborn (WebChat v2) chat surface — a two-pane
  // layout: a thread rail (browse/resume/new) + the conversation. Mounted by
  // the chat route when the active profile speaks v2. Deliberately isolated
  // from the large v1 chat body in `+page.svelte`.
  //
  // The active thread is owned by the injected `RebornThreadStore`
  // (`threads.currentId`) — the single source of truth — and the conversation
  // is driven by the `RebornChatController` (send / timeline / SSE stream /
  // gate / cancel). Both stores are injected (defaulting to the app-wide
  // singletons) so the render tests can drive them with mock-client instances
  // and pre-seeded state without standing up the connection store.

  import { onDestroy, onMount } from 'svelte';
  import MarkdownView from './MarkdownView.svelte';
  import { rebornChat, RebornChatController } from '$lib/stores/reborn-chat.svelte';
  import { rebornThreads, RebornThreadStore } from '$lib/stores/reborn-threads.svelte';
  import type { ThreadSummary } from '$lib/api/reborn';
  import { relativeTime } from '$lib/util/format-time';
  import { groupThreadsByRecency } from '$lib/util/thread-groups';

  interface Props {
    /** Injectable for tests; default to the app-wide singletons. */
    controller?: RebornChatController;
    threads?: RebornThreadStore;
  }
  let { controller = rebornChat, threads = rebornThreads }: Props = $props();

  let draft = $state('');

  // Which tool/capability cards are expanded (progressive disclosure —
  // collapsed by default; keyed by message id).
  let expandedTools = $state<Record<string, boolean>>({});
  function toggleTool(id: string) {
    expandedTools = { ...expandedTools, [id]: !expandedTools[id] };
  }

  // Scroll-pin: keep the conversation pinned to the newest turn unless the
  // user scrolls up, in which case a "Jump to latest" pill appears.
  let scrollEl = $state<HTMLDivElement>();
  let atBottom = $state(true);
  const BOTTOM_THRESHOLD_PX = 80;
  function onScroll() {
    if (!scrollEl) return;
    atBottom =
      scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < BOTTOM_THRESHOLD_PX;
  }
  function jumpToLatest() {
    if (!scrollEl) return;
    scrollEl.scrollTop = scrollEl.scrollHeight;
    atBottom = true;
  }

  // Composer auto-grow: the textarea grows with content up to a cap, then
  // scrolls. Bound so we can measure scrollHeight on input; reset to one row
  // after a send clears the draft.
  let composerEl = $state<HTMLTextAreaElement>();
  const COMPOSER_MAX_PX = 144; // ~9rem cap (matches the CSS max-height)
  function autoGrowComposer() {
    if (!composerEl) return;
    composerEl.style.height = 'auto';
    composerEl.style.height = `${Math.min(composerEl.scrollHeight, COMPOSER_MAX_PX)}px`;
  }
  function resetComposerHeight() {
    if (composerEl) composerEl.style.height = 'auto';
  }

  // Conversation state, derived off the controller's reactive state. (Avoid a
  // local `state` alias — that name collides with the `$state` rune.)
  const messages = $derived(controller.state.messages);
  const isProcessing = $derived(controller.state.isProcessing);
  const pendingGate = $derived(controller.state.pendingGate);
  const canSend = $derived(draft.trim().length > 0 && !isProcessing);

  // Thread rail state.
  const threadList = $derived(threads.threads);
  const threadGroups = $derived(groupThreadsByRecency(threadList));
  const activeThreadId = $derived(threads.currentId);
  const isLoading = $derived(threads.isLoading);

  /** Relative "last active" label for a thread row, or null when the
   *  server omitted both timestamps (don't fabricate a "just now"). */
  function rowTime(t: ThreadSummary): string | null {
    const ts = t.updated_at || t.created_at;
    return ts ? relativeTime(ts) : null;
  }

  onMount(() => {
    // Populate the rail. Resilient (the store swallows transport failures).
    void threads.load();
  });

  // Bind the controller to the selected thread. `boundThread` is a plain
  // (non-reactive) instance field so the effect only re-runs on a real
  // selection change — not on its own writes. Initial mount loads+streams the
  // current selection without a reset (so injected test state survives); a
  // later switch resets first. `undefined` = "never bound yet".
  let boundThread: string | null | undefined = undefined;
  $effect(() => {
    const tid = activeThreadId ?? null;
    if (tid === boundThread) return;
    const isInitial = boundThread === undefined;
    boundThread = tid;
    if (!isInitial) controller.reset();
    if (tid) {
      void controller.loadTimeline(tid);
      void controller.openStream(tid);
    }
  });

  onDestroy(() => controller.closeStream());

  // Keep the selected thread visible: when the active id changes, scroll its
  // row into view inside the rail (no-op in jsdom / when off-screen logic is
  // unavailable). Runs after the DOM applies `.is-active`.
  let listEl: HTMLElement | undefined = $state();
  $effect(() => {
    const id = activeThreadId;
    if (!id || !listEl) return;
    const row = listEl.querySelector('.is-active');
    if (row && typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ block: 'nearest' });
    }
  });

  // Auto-pin to the newest content — but only while the user is already at the
  // bottom, so reading scrollback isn't yanked away by an incoming token.
  $effect(() => {
    messages.length; // track new turns
    isProcessing; // and the streaming indicator appearing/leaving
    if (atBottom && scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
  });

  /** Start a fresh conversation (the bind effect resets the controller). */
  function newChat() {
    threads.select(null);
  }

  function selectThread(id: string) {
    if (id !== activeThreadId) threads.select(id);
  }

  async function handleSend() {
    const content = draft.trim();
    if (!content || isProcessing) return;
    draft = '';
    resetComposerHeight();
    try {
      if (activeThreadId) {
        // Existing thread — its stream is already open (bound on selection).
        await controller.send(content, activeThreadId);
      } else {
        // New conversation: create the thread and OPEN ITS STREAM BEFORE
        // sending, so early run events (accepted / gate / terminal) emitted
        // before we subscribe aren't missed (which used to leave the UI stuck
        // "processing"). Set boundThread before select so the bind effect
        // doesn't reset the just-prepared conversation or double-subscribe.
        const tid = await controller.ensureThread();
        if (tid) {
          boundThread = tid;
          threads.upsert({ thread_id: tid });
          threads.select(tid);
          void controller.openStream(tid);
        }
        await controller.send(content, tid ?? undefined);
      }
    } catch {
      // The controller already surfaced the failure as an error bubble.
    }
  }

  function onComposerKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  /** Keyboard-accelerated approval while a gate is pending: ⌘⏎ (or Ctrl+Enter)
   *  approves, Esc denies — the elite inline-approval pattern. No-op when no
   *  gate is open so it never steals keys from the composer. */
  function onGateKeydown(e: KeyboardEvent) {
    if (!pendingGate) return;
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void controller.resolveGate('approved');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      void controller.resolveGate('denied');
    }
  }

  /** Roving keyboard nav in the thread rail: ↑/↓ moves DOM focus between
   *  thread rows (in flat visible order, across date groups). Enter selects
   *  natively (focused row is a <button>). Scoped to the rail — the handler
   *  only fires while focus is inside the list, so it never hijacks arrows
   *  from the composer or conversation. */
  function onRailKeydown(e: KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    if (!listEl) return;
    const items = Array.from(listEl.querySelectorAll<HTMLButtonElement>('.reborn-rail__item'));
    if (items.length === 0) return;
    e.preventDefault();
    const cur = items.findIndex((b) => b === document.activeElement);
    const delta = e.key === 'ArrowDown' ? 1 : -1;
    const next =
      cur < 0
        ? delta === 1
          ? 0
          : items.length - 1
        : Math.min(items.length - 1, Math.max(0, cur + delta));
    items[next]?.focus();
  }
</script>

<svelte:window onkeydown={onGateKeydown} />

<div class="reborn-shell" data-testid="reborn-chat-panel">
  <aside class="reborn-rail" aria-label="Conversations">
    <div class="reborn-rail__head">
      <button
        type="button"
        class="reborn-btn reborn-btn--primary reborn-rail__new"
        onclick={newChat}
      >
        New chat
      </button>
    </div>
    {#if isLoading && threadList.length === 0}
      <div class="reborn-rail__skeleton" aria-hidden="true" data-testid="reborn-rail-skeleton">
        <div class="reborn-skel-row"></div>
        <div class="reborn-skel-row"></div>
        <div class="reborn-skel-row"></div>
        <div class="reborn-skel-row"></div>
        <div class="reborn-skel-row"></div>
      </div>
    {:else if threadList.length === 0}
      <p class="reborn-rail__empty">No conversations yet.</p>
    {:else}
      <div class="reborn-rail__list" bind:this={listEl}>
        {#each threadGroups as group (group.label)}
          <div class="reborn-rail__group">
            <div class="reborn-rail__group-head">{group.label}</div>
            <ul class="reborn-rail__group-items">
              {#each group.threads as t (t.thread_id)}
                {@const time = rowTime(t)}
                <li>
                  <button
                    type="button"
                    class="reborn-rail__item"
                    class:is-active={t.thread_id === activeThreadId}
                    aria-current={t.thread_id === activeThreadId ? 'true' : undefined}
                    onclick={() => selectThread(t.thread_id)}
                    onkeydown={onRailKeydown}
                    title={t.title || 'Untitled conversation'}
                  >
                    <span class="reborn-rail__item-title">{t.title || 'Untitled conversation'}</span
                    >
                    {#if time}<span class="reborn-rail__item-time">{time}</span>{/if}
                  </button>
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>
    {/if}
    {#if threads.hasMore}
      <button type="button" class="reborn-rail__more" onclick={() => threads.loadMore()}>
        Load more
      </button>
    {/if}
  </aside>

  <div class="reborn-chat">
    <div class="reborn-chat__scroll" bind:this={scrollEl} onscroll={onScroll}>
      {#if messages.length === 0}
        <div class="reborn-chat__empty">
          <p class="reborn-chat__empty-title">IronClaw Reborn</p>
          <p class="reborn-chat__empty-sub">Send a message to start a conversation.</p>
        </div>
      {/if}

      {#each messages as msg (msg.id)}
        {#if msg.role === 'tool_activity'}
          {@const toolHasDetail = !!(msg.toolDetail || msg.toolError)}
          {@const toolOpen = !!expandedTools[msg.id]}
          <div class="reborn-tool" class:is-error={msg.toolStatus === 'error'}>
            <button
              type="button"
              class="reborn-tool__head"
              class:is-static={!toolHasDetail}
              disabled={!toolHasDetail}
              aria-expanded={toolHasDetail ? toolOpen : undefined}
              onclick={() => toolHasDetail && toggleTool(msg.id)}
            >
              <span class="reborn-tool__dot" data-status={msg.toolStatus}></span>
              <span class="reborn-tool__name">{msg.toolName || 'tool'}</span>
              <span class="reborn-tool__status">{msg.toolStatus}</span>
              {#if toolHasDetail}
                <span class="reborn-tool__chevron" class:is-open={toolOpen} aria-hidden="true"
                  >▸</span
                >
              {/if}
            </button>
            {#if toolHasDetail && toolOpen}
              <div class="reborn-tool__detail">
                {#if msg.toolDetail}<p class="reborn-tool__detail-line">{msg.toolDetail}</p>{/if}
                {#if msg.toolError}
                  <p class="reborn-tool__detail-line is-error">{msg.toolError}</p>
                {/if}
              </div>
            {/if}
          </div>
        {:else if msg.role === 'error'}
          <div class="reborn-msg reborn-msg--error">{msg.content}</div>
        {:else if msg.role === 'system'}
          <div class="reborn-msg reborn-msg--system">{msg.content}</div>
        {:else if msg.role === 'user'}
          <div class="reborn-msg reborn-msg--user" class:is-optimistic={msg.isOptimistic}>
            {msg.content}
            {#if msg.status === 'error'}
              <span class="reborn-msg__send-error" title={msg.error}>failed to send</span>
            {/if}
          </div>
        {:else}
          <div class="reborn-msg reborn-msg--assistant">
            <MarkdownView markdown={msg.content ?? ''} />
          </div>
        {/if}
      {/each}

      {#if isProcessing}
        <div
          class="reborn-msg reborn-msg--assistant reborn-streaming"
          aria-label="Assistant is responding"
        >
          <span class="reborn-caret"></span>
        </div>
      {/if}

      {#if !atBottom}
        <button type="button" class="reborn-jump" onclick={jumpToLatest}>↓ Jump to latest</button>
      {/if}
    </div>

    {#if pendingGate}
      <div class="reborn-gate" role="alertdialog" aria-label="Approval required">
        <div class="reborn-gate__text">
          <strong>{pendingGate.headline || 'Approval required'}</strong>
          {#if pendingGate.body}<p>{pendingGate.body}</p>{/if}
        </div>
        <div class="reborn-gate__actions">
          <button
            type="button"
            class="reborn-btn reborn-btn--primary"
            onclick={() => controller.resolveGate('approved')}
          >
            Approve <kbd class="reborn-gate__hint">⌘⏎</kbd>
          </button>
          <button type="button" class="reborn-btn" onclick={() => controller.resolveGate('denied')}>
            Deny <kbd class="reborn-gate__hint">Esc</kbd>
          </button>
        </div>
      </div>
    {/if}

    <div class="reborn-composer">
      <textarea
        class="reborn-composer__input"
        bind:this={composerEl}
        bind:value={draft}
        onkeydown={onComposerKeydown}
        oninput={autoGrowComposer}
        placeholder="Message IronClaw…"
        rows="1"
        aria-label="Message input"
      ></textarea>
      {#if isProcessing}
        <button
          type="button"
          class="reborn-btn reborn-btn--danger"
          onclick={() => controller.cancel()}
        >
          Stop
        </button>
      {:else}
        <button
          type="button"
          class="reborn-btn reborn-btn--primary"
          disabled={!canSend}
          onclick={handleSend}
        >
          Send
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .reborn-shell {
    display: flex;
    height: 100%;
    min-height: 0;
  }
  .reborn-rail {
    flex: 0 0 13rem;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-right: 1px solid var(--v2-border, rgba(255, 255, 255, 0.08));
    background: var(--v2-surface, rgba(255, 255, 255, 0.02));
  }
  .reborn-rail__head {
    padding: 0.75rem;
    border-bottom: 1px solid var(--v2-border, rgba(255, 255, 255, 0.06));
  }
  .reborn-rail__new {
    width: 100%;
  }
  .reborn-rail__empty {
    padding: 1rem 0.75rem;
    font-size: 0.8rem;
    color: var(--v2-text-muted, #8a93a6);
  }
  .reborn-rail__list {
    flex: 1 1 auto;
    overflow-y: auto;
    margin: 0;
    padding: 0.35rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .reborn-rail__group-head {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: 0.45rem 0.6rem 0.25rem;
    background: var(--v2-rail);
    font-size: 0.66rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--v2-text-faint);
  }
  .reborn-rail__group-items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }
  .reborn-rail__item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.1rem;
    width: 100%;
    text-align: left;
    padding: 0.4rem 0.6rem;
    border: none;
    border-radius: 0.45rem;
    background: transparent;
    color: var(--v2-text, #e6ebf2);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    transition:
      background var(--v2-dur-fast) var(--v2-ease-out),
      color var(--v2-dur-fast) var(--v2-ease-out);
  }
  .reborn-rail__item-title {
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .reborn-rail__item-time {
    font-size: 0.7rem;
    color: var(--v2-text-faint);
  }
  .reborn-rail__item:hover {
    background: var(--v2-surface-2, rgba(255, 255, 255, 0.05));
  }
  .reborn-rail__item.is-active {
    background: var(--v2-accent-soft, rgba(76, 167, 230, 0.14));
    color: var(--v2-accent-text, #8fc8f2);
  }
  .reborn-rail__skeleton {
    padding: 0.35rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .reborn-skel-row {
    height: 1.9rem;
    border-radius: 0.45rem;
    background: var(--v2-surface-2);
    animation: v2-breathe 1.6s var(--v2-ease-in-out) infinite;
  }
  .reborn-skel-row:nth-child(2) {
    width: 82%;
  }
  .reborn-skel-row:nth-child(3) {
    width: 90%;
  }
  .reborn-skel-row:nth-child(4) {
    width: 74%;
  }
  .reborn-skel-row:nth-child(5) {
    width: 86%;
  }
  .reborn-rail__more {
    margin: 0.35rem;
    padding: 0.45rem;
    border: 1px solid var(--v2-border, rgba(255, 255, 255, 0.12));
    border-radius: 0.45rem;
    background: transparent;
    color: var(--v2-text-muted, #8a93a6);
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
  }
  .reborn-chat {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .reborn-chat__scroll {
    flex: 1 1 auto;
    overflow-y: auto;
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    /* ~24px between turns — elite agentic-chat rhythm (rows breathe). */
    gap: 1.5rem;
  }
  .reborn-chat__empty {
    margin: auto;
    text-align: center;
    color: var(--v2-text-muted, #8a93a6);
  }
  .reborn-chat__empty-title {
    font-weight: 600;
    color: var(--v2-accent-text, #8fc8f2);
  }
  .reborn-chat__empty-sub {
    font-size: 0.875rem;
  }
  /* "Jump to latest" pill — sticks to the bottom of the scrollport while the
     user is reading scrollback; clicking pins back to the newest turn. */
  .reborn-jump {
    position: sticky;
    bottom: 0.5rem;
    align-self: center;
    margin-top: -0.5rem;
    padding: 0.35rem 0.85rem;
    border: 1px solid var(--v2-border);
    border-radius: 999px;
    background: var(--v2-surface-2);
    color: var(--v2-accent-text);
    font: inherit;
    font-size: 0.78rem;
    cursor: pointer;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
    transition:
      background var(--v2-dur-fast) var(--v2-ease-out),
      transform var(--v2-dur-fast) var(--v2-ease-out);
  }
  .reborn-jump:hover {
    background: var(--v2-surface-muted);
    transform: translateY(-1px);
  }
  .reborn-msg {
    max-width: 80%;
    padding: 0.55rem 0.8rem;
    border-radius: 0.7rem;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .reborn-msg--user {
    /* Subtle right-aligned bubble — the accent is reserved for interactive
       affordances, not chat fills (one-accent discipline). */
    align-self: flex-end;
    max-width: min(80%, 32rem);
    background: var(--v2-surface-2);
    color: var(--v2-text-strong);
    border: 1px solid var(--v2-border);
  }
  .reborn-msg--user.is-optimistic {
    opacity: 0.6;
  }
  .reborn-msg__send-error {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: var(--v2-danger-text);
  }
  .reborn-msg--assistant {
    /* Full-width plain row (no bubble), capped to a readable ~68ch measure
       and left-aligned — the elite agentic-chat reading rhythm. */
    align-self: stretch;
    max-width: 68ch;
    padding: 0;
    background: transparent;
    color: var(--v2-text);
  }
  .reborn-msg--system {
    align-self: center;
    background: transparent;
    color: var(--v2-text-muted, #8a93a6);
    font-size: 0.8rem;
  }
  .reborn-msg--error {
    align-self: center;
    background: rgba(220, 80, 80, 0.14);
    color: #ff9d9d;
    font-size: 0.85rem;
  }
  .reborn-tool {
    align-self: flex-start;
    width: 100%;
    max-width: 68ch;
    border: 1px solid var(--v2-border);
    border-radius: 0.5rem;
    background: var(--v2-surface-2);
    overflow: hidden;
    font-size: 0.8rem;
  }
  .reborn-tool__head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.45rem 0.6rem;
    border: none;
    background: transparent;
    color: var(--v2-text);
    font: inherit;
    font-size: 0.8rem;
    text-align: left;
    cursor: pointer;
    transition: background var(--v2-dur-fast) var(--v2-ease-out);
  }
  .reborn-tool__head:not(.is-static):hover {
    background: var(--v2-surface-muted);
  }
  .reborn-tool__head.is-static {
    cursor: default;
  }
  .reborn-tool__dot {
    flex: 0 0 auto;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--v2-text-faint);
  }
  .reborn-tool__dot[data-status='running'] {
    background: var(--v2-accent);
    animation: v2-breathe 1.4s var(--v2-ease-in-out) infinite;
  }
  .reborn-tool__dot[data-status='success'] {
    background: var(--v2-positive-text);
  }
  .reborn-tool__dot[data-status='error'] {
    background: var(--v2-danger-text);
  }
  .reborn-tool__name {
    font-family: var(--v2-mono);
    color: var(--v2-text-strong);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .reborn-tool__status {
    color: var(--v2-text-faint);
    text-transform: capitalize;
  }
  .reborn-tool__chevron {
    margin-left: auto;
    color: var(--v2-text-faint);
    transition: transform var(--v2-dur-fast) var(--v2-ease-out);
  }
  .reborn-tool__chevron.is-open {
    transform: rotate(90deg);
  }
  .reborn-tool__detail {
    padding: 0 0.6rem 0.5rem 1.35rem;
    border-top: 1px solid var(--v2-border);
  }
  .reborn-tool__detail-line {
    margin: 0.4rem 0 0;
    color: var(--v2-text-muted);
    font-family: var(--v2-mono);
    white-space: pre-wrap;
    word-break: break-word;
  }
  .reborn-tool__detail-line.is-error {
    color: var(--v2-danger-text);
  }
  .reborn-streaming {
    align-self: stretch;
    max-width: 68ch;
    padding: 0;
    background: transparent;
  }
  /* Streaming block caret — sits where the assistant's next token lands.
     Blinks via steps() so it reads as a cursor, not a fade. The global
     prefers-reduced-motion reset holds it steady for users who opt out. */
  .reborn-caret {
    display: inline-block;
    width: 0.5rem;
    height: 1.05em;
    vertical-align: text-bottom;
    background: var(--v2-accent);
    border-radius: 1px;
    animation: reborn-caret-blink 1s steps(1, end) infinite;
  }
  @keyframes reborn-caret-blink {
    0%,
    50% {
      opacity: 1;
    }
    50.01%,
    100% {
      opacity: 0;
    }
  }
  .reborn-gate {
    /* Gold = "needs you" (one-accent discipline reserves the blue accent for
       interactive affordances; approval gates wear the warning hue). */
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin: 0 1rem;
    padding: 0.7rem 0.9rem;
    border: 1px solid var(--v2-warning);
    border-radius: 0.6rem;
    background: var(--v2-warning-soft);
  }
  .reborn-gate__text strong {
    color: var(--v2-text, #e6ebf2);
  }
  .reborn-gate__text p {
    margin: 0.25rem 0 0;
    font-size: 0.85rem;
    color: var(--v2-text-muted, #8a93a6);
  }
  .reborn-gate__actions {
    display: flex;
    gap: 0.5rem;
    flex: 0 0 auto;
  }
  .reborn-gate__hint {
    margin-left: 0.4rem;
    padding: 0.05rem 0.3rem;
    border-radius: 0.25rem;
    background: rgba(255, 255, 255, 0.16);
    font-family: var(--v2-mono);
    font-size: 0.7rem;
  }
  .reborn-composer {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
    padding: 0.75rem 1rem 1rem;
    border-top: 1px solid var(--v2-border, rgba(255, 255, 255, 0.08));
  }
  .reborn-composer__input {
    flex: 1 1 auto;
    resize: none;
    max-height: 9rem;
    overflow-y: auto;
    transition: height var(--v2-dur-fast) var(--v2-ease-out);
    padding: 0.6rem 0.75rem;
    border-radius: 0.6rem;
    border: 1px solid var(--v2-border, rgba(255, 255, 255, 0.12));
    background: var(--v2-surface, rgba(255, 255, 255, 0.04));
    color: var(--v2-text, #e6ebf2);
    font: inherit;
  }
  .reborn-btn {
    flex: 0 0 auto;
    padding: 0.55rem 0.9rem;
    border-radius: 0.6rem;
    border: 1px solid var(--v2-border, rgba(255, 255, 255, 0.12));
    background: var(--v2-surface-2, rgba(255, 255, 255, 0.06));
    color: var(--v2-text, #e6ebf2);
    cursor: pointer;
  }
  .reborn-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .reborn-btn--primary {
    background: var(--v2-accent, #4ca7e6);
    border-color: var(--v2-accent, #4ca7e6);
    color: #fff;
  }
  .reborn-btn--danger {
    background: rgba(220, 80, 80, 0.18);
    border-color: rgba(220, 80, 80, 0.5);
    color: #ff9d9d;
  }
</style>
