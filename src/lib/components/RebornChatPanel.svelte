<script lang="ts">
  // Self-contained IronClaw Reborn (WebChat v2) chat surface. Mounted by the
  // chat route when the active profile speaks v2 (`connection.apiVersion`).
  // Deliberately isolated from the large v1 chat body in `+page.svelte`: it
  // drives the projection-based `RebornChatController` (send / timeline / SSE
  // stream / gate / cancel) and renders its reactive `RebornChatState`.
  //
  // The controller is injected (defaulting to the app-wide singleton) so the
  // render tests can drive it with a mock-client controller and pre-seeded
  // state without standing up the connection store.

  import { onDestroy } from 'svelte';
  import MarkdownView from './MarkdownView.svelte';
  import { rebornChat, RebornChatController } from '$lib/stores/reborn-chat.svelte';

  interface Props {
    /** Active v2 thread id, or null for a fresh (unsent) conversation. */
    threadId?: string | null;
    /** Injectable for tests; defaults to the app-wide singleton. */
    controller?: RebornChatController;
  }
  let { threadId = null, controller = rebornChat }: Props = $props();

  let draft = $state('');

  // Derive each field directly off the controller's reactive state. (Avoid a
  // local `state` alias — that name collides with the `$state` rune.)
  const messages = $derived(controller.state.messages);
  const isProcessing = $derived(controller.state.isProcessing);
  const pendingGate = $derived(controller.state.pendingGate);
  const canSend = $derived(draft.trim().length > 0 && !isProcessing);

  // Bind to the active thread. `boundThread` is a plain (non-reactive)
  // instance field so the effect only re-runs on a real `threadId` change —
  // not on its own writes. The initial mount loads+streams the current thread
  // without a reset (so injected test state survives); a later switch resets
  // first. `undefined` = "never bound yet".
  let boundThread: string | null | undefined = undefined;
  $effect(() => {
    const tid = threadId ?? null;
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

  async function handleSend() {
    const content = draft.trim();
    if (!content || isProcessing) return;
    draft = '';
    try {
      await controller.send(content, threadId ?? undefined);
      // A first send may have created a thread; make sure its stream is open.
      const tid = controller.threadId;
      if (tid && tid !== boundThread) {
        boundThread = tid;
        void controller.openStream(tid);
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
</script>

<div class="reborn-chat" data-testid="reborn-chat-panel">
  <div class="reborn-chat__scroll">
    {#if messages.length === 0}
      <div class="reborn-chat__empty">
        <p class="reborn-chat__empty-title">IronClaw Reborn</p>
        <p class="reborn-chat__empty-sub">Send a message to start a conversation.</p>
      </div>
    {/if}

    {#each messages as msg (msg.id)}
      {#if msg.role === 'tool_activity'}
        <div class="reborn-msg reborn-msg--tool" class:is-error={msg.toolStatus === 'error'}>
          <span class="reborn-tool__name">{msg.toolName || 'tool'}</span>
          <span class="reborn-tool__status">{msg.toolStatus}</span>
          {#if msg.toolError}
            <span class="reborn-tool__error">{msg.toolError}</span>
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
        class="reborn-msg reborn-msg--assistant reborn-typing"
        aria-label="Assistant is responding"
      >
        <span></span><span></span><span></span>
      </div>
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
          Approve
        </button>
        <button type="button" class="reborn-btn" onclick={() => controller.resolveGate('denied')}>
          Deny
        </button>
      </div>
    </div>
  {/if}

  <div class="reborn-composer">
    <textarea
      class="reborn-composer__input"
      bind:value={draft}
      onkeydown={onComposerKeydown}
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

<style>
  .reborn-chat {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .reborn-chat__scroll {
    flex: 1 1 auto;
    overflow-y: auto;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
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
  .reborn-msg {
    max-width: 80%;
    padding: 0.55rem 0.8rem;
    border-radius: 0.7rem;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .reborn-msg--user {
    align-self: flex-end;
    background: var(--v2-accent, #4ca7e6);
    color: #fff;
  }
  .reborn-msg--user.is-optimistic {
    opacity: 0.6;
  }
  .reborn-msg__send-error {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: #ffd0d0;
  }
  .reborn-msg--assistant {
    align-self: flex-start;
    background: var(--v2-surface-2, rgba(255, 255, 255, 0.05));
    color: var(--v2-text, #e6ebf2);
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
  .reborn-msg--tool {
    align-self: flex-start;
    display: inline-flex;
    gap: 0.5rem;
    align-items: center;
    background: var(--v2-surface-2, rgba(255, 255, 255, 0.05));
    font-size: 0.8rem;
    font-family: var(--v2-mono, ui-monospace, monospace);
  }
  .reborn-msg--tool.is-error {
    color: #ff9d9d;
  }
  .reborn-tool__status {
    color: var(--v2-text-muted, #8a93a6);
  }
  .reborn-typing {
    display: inline-flex;
    gap: 0.25rem;
  }
  .reborn-typing span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--v2-text-muted, #8a93a6);
    animation: reborn-blink 1.2s infinite ease-in-out both;
  }
  .reborn-typing span:nth-child(2) {
    animation-delay: 0.2s;
  }
  .reborn-typing span:nth-child(3) {
    animation-delay: 0.4s;
  }
  @keyframes reborn-blink {
    0%,
    80%,
    100% {
      opacity: 0.2;
    }
    40% {
      opacity: 1;
    }
  }
  .reborn-gate {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin: 0 1rem;
    padding: 0.7rem 0.9rem;
    border: 1px solid var(--v2-accent, #4ca7e6);
    border-radius: 0.6rem;
    background: var(--v2-accent-soft, rgba(76, 167, 230, 0.14));
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
