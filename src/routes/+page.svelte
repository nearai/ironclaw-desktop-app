<script lang="ts">
  // Chat surface — three-column layout: thread rail, message stream + composer,
  // optional tool-inspector rail. Wires the SSE stream from the gateway into
  // the `messages` store and reconciles with /api/chat/history once a stream
  // completes.

  import { onMount, tick, untrack } from 'svelte';
  import { connection } from '$lib/stores/connection.svelte';
  import { threads } from '$lib/stores/threads.svelte';
  import { messages, type ToolInvocation } from '$lib/stores/messages.svelte';
  import MarkdownView from '$lib/components/MarkdownView.svelte';
  import { toasts } from '$lib/stores/toasts.svelte';
  import { notifications } from '$lib/stores/notifications.svelte';
  import { windowFocus } from '$lib/stores/window-focus.svelte';
  import { loadSettings } from '$lib/stores/settings.svelte';
  import {
    buildThreadJsonText,
    buildThreadMarkdown,
    sanitizeFilenameStem,
    saveTextDialog
  } from '$lib/api/files';
  import type { ChatEvent, Message, Skill } from '$lib/api/types';
  import SlashAutocomplete from './SlashAutocomplete.svelte';
  import ChatSearch from './ChatSearch.svelte';

  // -- local state ------------------------------------------------------------
  let composerEl = $state<HTMLTextAreaElement | null>(null);
  let scrollEl = $state<HTMLDivElement | null>(null);
  let input = $state('');
  let sending = $state(false);
  let abortController: AbortController | null = null;
  let rightRailOpen = $state(false);
  let renaming = $state(false);
  let titleDraft = $state('');
  let expandedTools = $state<Record<string, boolean>>({});
  let retryingIds = $state<Record<string, boolean>>({});

  // Scroll-to-bottom FAB state. The threshold mirrors the prompt: any drift
  // >100px from the bottom of the stream counts as "scrolled up". We only
  // surface the FAB during streaming or when new history arrives below the
  // user's current viewport.
  const SCROLL_BOTTOM_THRESHOLD = 100;
  let isAtBottom = $state(true);
  let showScrollFab = $state(false);

  // Lazy history load: when the user scrolls within this many pixels of the
  // top of the message stream AND the thread has more pages to fetch, pull
  // the next page of older messages. 200px gives a smooth "as you approach
  // the top, the next page is already there" feel without firing the load
  // on every micro-scroll.
  const SCROLL_TOP_THRESHOLD = 200;

  // Draft persistence — sessionStorage so drafts survive thread switching
  // and page reloads in the same tab, but don't bleed across tabs/windows.
  // Key prefix mirrors the prompt; the `__new__` slot is used before a
  // real thread id exists and is promoted on first successful send.
  const DRAFT_PREFIX = 'ironclaw-draft:';
  const DRAFT_NEW_KEY = `${DRAFT_PREFIX}__new__`;
  const DRAFT_DEBOUNCE_MS = 300;
  let draftSaveTimer: ReturnType<typeof setTimeout> | null = null;
  let draftLoadedFor: string | null = null;
  let suppressDraftSave = false;

  // Slash-command autocomplete state. The cached `skillCatalog` is loaded
  // once on chat mount (lazily, so we don't block first paint) and reused
  // across thread switches. `caret` mirrors composerEl.selectionStart so
  // the SlashAutocomplete component can locate the active `/token`.
  let skillCatalog = $state<Skill[]>([]);
  let skillCatalogLoaded = $state(false);
  let caret = $state(0);
  // Svelte 5: `bind:this` on a component yields its export object, not a
  // class instance. Use the shape (handleKey) directly so the type-checker
  // stops trying to instantiate the new `Component<...>` type.
  let slashAutoEl = $state<{ handleKey: (e: KeyboardEvent) => boolean } | null>(null);

  // Cmd/Ctrl+F find-in-thread state. `contentVersion` is incremented on
  // every render-relevant signal so the embedded search bar knows when
  // to rebuild its <mark> overlay; that rebuild is debounced inside the
  // component to keep streaming smooth.
  let searchOpen = $state(false);
  let contentVersion = $state(0);

  // -- derived ----------------------------------------------------------------
  const currentThread = $derived(threads.current);
  const currentId = $derived(threads.currentId);
  const history = $derived<Message[]>(currentId ? messages.get(currentId) : []);
  const streamingBuffer = $derived(currentId ? messages.getStreaming(currentId) : '');
  const isStreaming = $derived(currentId ? messages.isStreaming(currentId) : false);
  const streamError = $derived(currentId ? messages.getError(currentId) : null);
  const tools = $derived<ToolInvocation[]>(currentId ? messages.getTools(currentId) : []);

  const canSend = $derived(
    !!connection.client && input.trim().length > 0 && !sending && !isStreaming
  );

  const isLoadingMore = $derived(currentId ? messages.isLoadingMore(currentId) : false);
  const hasNoMoreHistory = $derived(currentId ? messages.hasNoMoreHistory(currentId) : false);

  // -- draft helpers ----------------------------------------------------------
  // sessionStorage is browser-only; the SvelteKit prerender pass would crash
  // without these guards even though the route is CSR-only in prod.
  function draftKey(id: string | null): string {
    return id ? `${DRAFT_PREFIX}${id}` : DRAFT_NEW_KEY;
  }

  function loadDraft(id: string | null): string {
    if (typeof window === 'undefined') return '';
    try {
      return window.sessionStorage.getItem(draftKey(id)) ?? '';
    } catch {
      return '';
    }
  }

  function writeDraft(id: string | null, value: string): void {
    if (typeof window === 'undefined') return;
    try {
      if (value.length === 0) {
        window.sessionStorage.removeItem(draftKey(id));
      } else {
        window.sessionStorage.setItem(draftKey(id), value);
      }
    } catch {
      // Storage may be full or disabled; non-fatal — drafts are best-effort.
    }
  }

  function scheduleDraftSave(): void {
    if (suppressDraftSave) return;
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    const id = threads.currentId;
    const value = input;
    draftSaveTimer = setTimeout(() => {
      writeDraft(id, value);
      draftSaveTimer = null;
    }, DRAFT_DEBOUNCE_MS);
  }

  /**
   * Apply a stored draft to the textarea without scheduling another save —
   * setting `input` would otherwise re-trigger the `$effect` watching it.
   */
  function applyDraft(value: string): void {
    suppressDraftSave = true;
    input = value;
    // tick to let auto-grow size the textarea, then re-enable saves.
    void tick().then(() => {
      autoGrow();
      suppressDraftSave = false;
    });
  }

  // -- scroll helpers ---------------------------------------------------------
  function computeAtBottom(): boolean {
    if (!scrollEl) return true;
    const drift = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
    return drift <= SCROLL_BOTTOM_THRESHOLD;
  }

  function onScroll(): void {
    isAtBottom = computeAtBottom();
    if (isAtBottom && showScrollFab) showScrollFab = false;
    // Fire-and-forget lazy load — guards inside maybeLoadMore() handle
    // already-loading, no-more-pages, and missing-thread cases. Async work
    // happens off this synchronous scroll callback so we don't stall paint.
    void maybeLoadMore();
  }

  /**
   * If the user has scrolled near the top and the current thread plausibly
   * has more older messages on the server, fetch the next page and prepend
   * it without jumping the viewport.
   *
   * Scroll preservation: we measure `scrollHeight` BEFORE the prepend, await
   * the store mutation + a `tick()` so the new DOM nodes lay out, then
   * advance `scrollTop` by the height delta. The user's view stays anchored
   * on the same message they were reading.
   *
   * Edge cases handled here (so the heuristic in the prompt holds without
   * a separate "modulo page size" check):
   *   - `hasNoMoreHistory` — server already returned a short page; bail.
   *   - `isLoadingMore`  — one fetch in flight at a time per thread.
   *   - `history.length === 0` — nothing to anchor against yet.
   *   - `scrollEl` cleared between threads — destructure-safe.
   */
  async function maybeLoadMore(): Promise<void> {
    if (!scrollEl) return;
    const id = currentId;
    if (!id) return;
    if (isLoadingMore || hasNoMoreHistory) return;
    if (history.length === 0) return;
    if (scrollEl.scrollTop > SCROLL_TOP_THRESHOLD) return;
    // Snapshot scrollHeight at the moment we decide to fetch. The user might
    // keep scrolling while the request is in flight; that's fine — the diff
    // we apply below still reflects "rows that were inserted above the
    // current viewport during this load".
    const prevScrollHeight = scrollEl.scrollHeight;
    const prevScrollTop = scrollEl.scrollTop;
    const added = await messages.loadMoreHistory(id);
    if (added === 0) return;
    await tick();
    if (!scrollEl) return;
    const delta = scrollEl.scrollHeight - prevScrollHeight;
    if (delta > 0) {
      scrollEl.scrollTop = prevScrollTop + delta;
    }
  }

  function scrollToBottom(smooth = true): void {
    if (!scrollEl) return;
    scrollEl.scrollTo({
      top: scrollEl.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
    isAtBottom = true;
    showScrollFab = false;
  }

  // -- mount ------------------------------------------------------------------
  onMount(() => {
    void boot();
    // Hydrate the composer from whichever draft matches the current thread
    // (or the __new__ slot if no thread is selected yet).
    const id = threads.currentId;
    const stored = loadDraft(id);
    if (stored) applyDraft(stored);
    draftLoadedFor = id;

    // Lazily prime the skill catalog for slash autocomplete. We don't
    // block boot on it — the dropdown simply has no candidates until
    // the catalog lands, and re-fetches are skipped via the loaded flag.
    void loadSkillCatalog();

    // Cmd/Ctrl+F → open find bar. Captured at the document level so the
    // shortcut still fires when focus is in the textarea or any sidebar
    // control. We swallow the event so the browser's native find doesn't
    // run inside the Tauri webview.
    const onGlobalKey = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && (e.key === 'f' || e.key === 'F') && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        searchOpen = true;
      }
    };
    document.addEventListener('keydown', onGlobalKey);

    return () => {
      if (draftSaveTimer) clearTimeout(draftSaveTimer);
      document.removeEventListener('keydown', onGlobalKey);
    };
  });

  async function loadSkillCatalog(): Promise<void> {
    if (skillCatalogLoaded) return;
    if (!connection.client) return;
    try {
      const skills = await connection.client.listSkills();
      skillCatalog = skills;
      skillCatalogLoaded = true;
    } catch {
      // Non-fatal — slash autocomplete just won't have candidates. We
      // intentionally don't toast here; the user hasn't asked for skills
      // yet and a noisy error on mount would be hostile.
    }
  }

  async function boot() {
    // Connection store is initialized by the sidebar's onMount; if the user
    // landed here first we still want a client, so init defensively.
    await connection.init();
    if (connection.client) {
      await threads.loadThreads();
      if (threads.currentId) {
        await messages.loadHistory(threads.currentId);
      }
      // Retry the catalog after init resolves — onMount fires before
      // `connection.client` is non-null on a cold load.
      void loadSkillCatalog();
    }
  }

  // -- effects ----------------------------------------------------------------
  // Whenever the selected thread changes, fetch its history if we don't have
  // it cached. (Avoid a clobber if we already have local optimistic content.)
  $effect(() => {
    const id = threads.currentId;
    if (!id) return;
    if (messages.get(id).length === 0) {
      void messages.loadHistory(id);
    }
  });

  // Draft hydration on thread switch. Save whatever is currently in the
  // composer back to the previous thread's slot, then load the new slot.
  $effect(() => {
    const id = threads.currentId;
    if (draftLoadedFor === id) return;
    untrack(() => {
      // Flush any pending debounced save against the OUTGOING thread first.
      if (draftSaveTimer) {
        clearTimeout(draftSaveTimer);
        draftSaveTimer = null;
        writeDraft(draftLoadedFor, input);
      }
      const next = loadDraft(id);
      applyDraft(next);
      draftLoadedFor = id;
    });
  });

  // Auto-scroll to the bottom of the stream as new content appears IFF the
  // user was already pinned to the bottom. If they've scrolled up, surface
  // the FAB instead so we don't yank them back mid-read.
  $effect(() => {
    // touch the values that should retrigger
    const histLen = history.length;
    const streamLen = streamingBuffer.length;
    const toolsLen = tools.length;
    const streaming = isStreaming;
    void histLen;
    void streamLen;
    void toolsLen;
    void tick().then(() => {
      if (!scrollEl) return;
      if (isAtBottom) {
        scrollEl.scrollTop = scrollEl.scrollHeight;
        showScrollFab = false;
      } else if (streaming || streamLen > 0 || histLen > 0) {
        // New content arrived but the user isn't at the bottom — flag it.
        showScrollFab = true;
      }
    });
  });

  // Bump the find-in-thread version counter whenever the rendered tree
  // could have changed. ChatSearch debounces its rebuild internally so
  // we don't pay a tree-walk per streaming token. We `untrack` the read
  // side of the counter so this effect only retriggers on its real deps.
  $effect(() => {
    void history.length;
    void streamingBuffer.length;
    void isStreaming;
    untrack(() => {
      contentVersion += 1;
    });
  });

  // -- handlers ---------------------------------------------------------------
  async function onNewChat() {
    if (!connection.client) return;
    const id = await threads.createThread();
    if (id) {
      // Hydrate the composer from the new thread's draft slot (if any was
      // previously stashed). The effect above also handles this, but we set
      // it explicitly so focus lands with the right content already in place.
      const stored = loadDraft(id);
      applyDraft(stored);
      draftLoadedFor = id;
      // No history yet — clear any stale stream state on a fresh thread.
      composerEl?.focus();
    }
  }

  function onSelectThread(id: string) {
    if (id === threads.currentId) return;
    // Don't yank an in-progress stream out from under itself.
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    threads.selectThread(id);
    // Reset scroll state — the new thread starts pinned to the bottom.
    isAtBottom = true;
    showScrollFab = false;
  }

  // TODO(2026-05-27): wire up per-thread delete affordance once the gateway
  // implements `DELETE /api/chat/threads/{id}`. Live-server probe today
  // returns 404 — no matching route in `src/channels/web/platform/router.rs`.
  // The client method `client.deleteThread(id)` is pre-wired in
  // `src/lib/api/ironclaw.ts`. UI plan: trash icon on hover in each thread
  // row in the left rail (red on hover), styled confirm dialog ("Delete
  // this conversation? This can't be undone."), then `toasts.show()`,
  // `void threads.refresh()`, and navigate to the next-most-recent thread
  // (or clear `threads.currentId` for the empty state).

  function onKeyDown(e: KeyboardEvent) {
    // Slash autocomplete consumes arrow keys / Enter / Tab / Esc when its
    // dropdown is open and has candidates. If it claims the event, we
    // bail before the send-on-Enter path runs.
    if (slashAutoEl && slashAutoEl.handleKey(e)) {
      // Keep caret in sync after the component splices in a pick — the
      // pick callback already wrote the new value + repositioned the
      // caret via a microtask.
      return;
    }
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        return; // newline
      }
      // Enter or Cmd/Ctrl+Enter both send.
      e.preventDefault();
      if (canSend) void onSend();
    }
  }

  // Mirror the textarea's caret position into reactive state. Called on
  // every relevant event — keyup catches arrow-key navigation, input
  // catches typing, click handles a manual caret reposition.
  function syncCaret() {
    if (!composerEl) return;
    caret = composerEl.selectionStart ?? input.length;
  }

  /**
   * Splice in a slash-command pick. Called by SlashAutocomplete with the
   * span of `input` to replace (the active `/token`) and the new text.
   * We update both the bound model and the textarea's caret/selection so
   * the user keeps typing from immediately after the inserted command.
   */
  function applySlashPick(start: number, end: number, text: string) {
    const next = `${input.slice(0, start)}${text}${input.slice(end)}`;
    input = next;
    const pos = start + text.length;
    // Run after the bind:value write propagates so the textarea's value
    // is in sync before we move the caret.
    void tick().then(() => {
      if (!composerEl) return;
      composerEl.focus();
      composerEl.setSelectionRange(pos, pos);
      caret = pos;
      autoGrow();
      scheduleDraftSave();
    });
  }

  function autoGrow() {
    if (!composerEl) return;
    composerEl.style.height = 'auto';
    const max = 8 * 24; // ~8 rows at 24px line-height
    composerEl.style.height = `${Math.min(composerEl.scrollHeight, max)}px`;
  }

  async function onSend() {
    if (!connection.client) return;
    const content = input.trim();
    if (!content) return;

    sending = true;
    try {
      // Auto-create a thread if none is selected.
      let threadId = threads.currentId;
      const fromNewSlot = !threadId;
      if (!threadId) {
        threadId = await threads.createThread();
        if (!threadId) {
          sending = false;
          toasts.show('Failed to create thread', 'error');
          return;
        }
      }

      // Append the optimistic user message — keep its id so we can mark it
      // failed (and offer retry) if the send/stream pair errors out.
      const localId = messages.appendUserMessage(threadId, content);

      // Clear the composer + persisted draft. Suppress the debounced save
      // that would otherwise fire from the `input = ''` write.
      suppressDraftSave = true;
      input = '';
      autoGrow();
      writeDraft(threadId, '');
      // If we promoted from the __new__ slot, drop that key too so the next
      // fresh chat doesn't pick up this content.
      if (fromNewSlot) writeDraft(null, '');
      draftLoadedFor = threadId;
      suppressDraftSave = false;

      await runSendAndStream(threadId, content, localId);
    } finally {
      sending = false;
    }
  }

  /**
   * Send + stream a single user turn. Used by both the initial send path
   * and the retry button on a previously-failed user-message bubble.
   *
   * Two streaming paths are supported:
   *   1. Responses API (`POST /api/v1/responses` with `stream: true`) —
   *      preferred when the user setting `useResponsesApi` is on AND the
   *      gateway exposes the route (probed once via `getServerCapabilities`).
   *      This path delivers real incremental `response.output_text.delta`
   *      chunks, so the UI feels smooth instead of clobbering on each
   *      `text_response` event.
   *   2. Legacy `POST /api/chat/send` + `GET /api/chat/events` — fallback
   *      for older gateways or when the user has pinned the legacy path
   *      via Settings → Advanced. The server sends the full assistant
   *      content per event; the messages-store heuristic handles that.
   *
   * On failure, the optimistic user-message row (localId) is marked failed
   * via the messages store so the bubble can render the retry affordance.
   * On success the failed flag is cleared (no-op on first attempt).
   */
  async function runSendAndStream(
    threadId: string,
    content: string,
    localId: string
  ): Promise<void> {
    if (!connection.client) return;

    // Decide path. The setting is loaded fresh per send rather than cached
    // in a module variable so toggling the Advanced switch takes effect on
    // the very next send without a route reload. `loadSettings()` hits the
    // in-memory cache after the first call so the cost is negligible.
    let useResponsesApi = true;
    try {
      const s = await loadSettings();
      useResponsesApi = s.useResponsesApi !== false;
    } catch {
      // Defensive — fall back to the default (on) if settings can't be
      // read (would only happen outside Tauri during a dev preview).
      useResponsesApi = true;
    }

    let responsesAvailable = false;
    if (useResponsesApi) {
      try {
        const caps = await connection.client.getServerCapabilities();
        responsesAvailable = caps.responses_api;
      } catch {
        responsesAvailable = false;
      }
    }

    abortController = new AbortController();
    const signal = abortController.signal;

    let streamErrored = false;
    let replyForNotify = '';
    let usedPath: 'responses' | 'legacy' = 'legacy';

    try {
      if (useResponsesApi && responsesAvailable) {
        usedPath = 'responses';
        messages.beginStream(threadId);
        try {
          for await (const ev of connection.client.streamResponse(content, threadId, signal)) {
            handleEvent(threadId, ev);
          }
        } catch (err) {
          // Soft-fall-back: a 404 / 405 / "not available" at the start of
          // the stream means the gateway dropped the route between probe
          // and use (or the probe was wrong about this build). Fall back
          // to the legacy path so the user's send doesn't drop on the floor.
          const msg = (err as Error).message;
          const isMissing =
            /\b(404|405|not[- ]?found|method not allowed|not available)\b/i.test(msg);
          if (!signal.aborted && isMissing) {
            // eslint-disable-next-line no-console
            console.info(
              '[chat] Responses API stream failed, falling back to legacy /api/chat:',
              msg
            );
            // Reset the partial stream state — the legacy path will rebegin.
            messages.commitAssistantMessage(threadId);
            await runLegacySendAndStream(threadId, content, localId, signal);
            usedPath = 'legacy';
            replyForNotify = messages.getStreaming(threadId);
            return; // commit + reconcile already handled in legacy path
          }
          if (!signal.aborted) {
            messages.setError(threadId, msg);
            messages.markFailed(localId, content);
            toasts.show(`Stream error: ${msg}`, 'error');
            streamErrored = true;
          }
        }
      } else {
        usedPath = 'legacy';
        await runLegacySendAndStream(threadId, content, localId, signal);
        // legacy helper does NOT call commit here — we still want the
        // shared finally{} to run the post-stream reconcile.
      }
    } finally {
      // For the responses path, capture + commit happens here. The legacy
      // helper opens its own beginStream → commit cycle, but we leave the
      // finally{} chain in place so reconcile + notification fire once.
      if (usedPath === 'responses') {
        replyForNotify = messages.getStreaming(threadId);
        messages.commitAssistantMessage(threadId);
      } else {
        replyForNotify = replyForNotify || messages.getStreaming(threadId);
      }
      abortController = null;
      // Reconcile with the server's canonical history.
      await messages.loadHistory(threadId);
      await threads.refresh();
      if (!streamErrored) messages.clearFailed(localId);

      // Lightweight observability — debug-only console signal so a power
      // user can confirm which transport ran without firing a toast at
      // every send. Avoid `console.log` (noisy in prod); `debug` is
      // filtered out of the Tauri stdout by default.
      // eslint-disable-next-line no-console
      console.debug(`[chat] streaming path: ${usedPath}`);

      if (
        !streamErrored &&
        !signal.aborted &&
        replyForNotify.trim().length > 0 &&
        notifications.enabled &&
        notifications.chatReplies &&
        !windowFocus.focused
      ) {
        const body = replyForNotify.slice(0, 100).trim();
        void notifications.notify({
          title: 'IronClaw replied',
          body,
          sound: 'default'
        });
      }
    }
  }

  /**
   * Legacy send + stream pipeline. Posts to `/api/chat/send` then drains
   * `/api/chat/events`. Used directly when the user has disabled the
   * Responses API path, and as a soft-fallback when the Responses API
   * route 404s mid-send. The caller's finally{} handles reconcile and
   * notification so this helper only owns the per-attempt error surface.
   */
  async function runLegacySendAndStream(
    threadId: string,
    content: string,
    localId: string,
    signal: AbortSignal
  ): Promise<void> {
    if (!connection.client) return;
    try {
      await connection.client.sendMessage(threadId, content);
    } catch (err) {
      const msg = (err as Error).message;
      messages.setError(threadId, msg);
      messages.markFailed(localId, content);
      toasts.show(`Send failed: ${msg}`, 'error');
      return;
    }

    messages.beginStream(threadId);
    try {
      for await (const ev of connection.client.streamEvents(threadId, signal)) {
        handleEvent(threadId, ev);
      }
    } catch (err) {
      if (!signal.aborted) {
        const msg = (err as Error).message;
        messages.setError(threadId, msg);
        messages.markFailed(localId, content);
        toasts.show(`Stream error: ${msg}`, 'error');
      }
    }
    // Commit the buffer here — the responses-path branch is the only one
    // that defers commit to the shared finally{}, because it doesn't go
    // through this helper.
    messages.commitAssistantMessage(threadId);
  }

  /**
   * Retry a failed user message in-place. Drops the failed marker, removes
   * the old optimistic row, and re-runs the same send + stream pipeline.
   */
  async function onRetry(threadId: string, failedMessageId: string): Promise<void> {
    if (!connection.client) return;
    if (retryingIds[failedMessageId]) return;
    const meta = messages.getMeta(failedMessageId);
    const content = meta.retryContent;
    if (!content) return;
    retryingIds = { ...retryingIds, [failedMessageId]: true };
    sending = true;
    try {
      // Drop the previous failed bubble + meta so we don't render duplicates.
      messages.removeMessage(threadId, failedMessageId);
      const newId = messages.appendUserMessage(threadId, content);
      await runSendAndStream(threadId, content, newId);
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [failedMessageId]: _drop, ...rest } = retryingIds;
      retryingIds = rest;
      sending = false;
    }
  }

  function handleEvent(threadId: string, ev: ChatEvent) {
    switch (ev.type) {
      case 'message_start':
        // No-op today — the gateway doesn't emit these.
        break;
      case 'content_delta':
        messages.appendStreamingChunk(threadId, ev.delta);
        break;
      case 'tool_call':
        messages.recordToolStart(threadId, ev.name, ev.args);
        if (!rightRailOpen) rightRailOpen = true;
        break;
      case 'tool_call_delta':
        // Forward-compat: the Responses API may stream tool-argument deltas
        // in a future gateway build. Today's gateway packs arguments in the
        // final output_item.done envelope so this branch is never hit; left
        // as a no-op rather than throwing so the union stays exhaustive.
        break;
      case 'tool_result':
        messages.recordToolResult(threadId, ev.name, ev.result);
        break;
      case 'message_end':
        // No-op — commit happens in the finally{} of onSend().
        break;
      case 'error':
        messages.setError(threadId, ev.message);
        toasts.show(`Gateway error: ${ev.message}`, 'error');
        break;
    }
  }

  function onStop() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  }

  // -- title rename ----------------------------------------------------------
  function startRename() {
    if (!currentThread) return;
    titleDraft = currentThread.title;
    renaming = true;
  }

  function commitRename() {
    if (!currentThread) {
      renaming = false;
      return;
    }
    const next = titleDraft.trim();
    if (next && next !== currentThread.title) {
      // Local-only: gateway has no rename endpoint in v0.29.0.
      threads.renameLocal(currentThread.id, next);
    }
    renaming = false;
  }

  function cancelRename() {
    renaming = false;
  }

  // -- export ----------------------------------------------------------------
  // Per-thread export from the chat header. The popover anchors to the
  // Export button and closes on outside click or Escape. We fetch the full
  // history fresh (limit=10000) rather than relying on the in-memory store
  // so the export captures everything the server has, not just what the
  // UI has scrolled into view.
  let exportOpen = $state(false);
  let exporting = $state(false);
  let exportButtonEl = $state<HTMLButtonElement | null>(null);
  let exportPopoverEl = $state<HTMLDivElement | null>(null);

  const canExport = $derived(
    !!currentThread &&
      connection.status === 'connected' &&
      !exporting
  );

  function toggleExportMenu() {
    if (!canExport && !exportOpen) return;
    exportOpen = !exportOpen;
  }

  function closeExportMenu() {
    exportOpen = false;
  }

  /**
   * Pull the full history for the active thread and write it to disk in
   * the requested format. Toasts on success/cancel/error.
   */
  async function onExportThread(format: 'markdown' | 'json'): Promise<void> {
    if (!connection.client || !currentThread) return;
    exportOpen = false;
    exporting = true;
    try {
      const all = await connection.client.getHistory(currentThread.id, 10000);
      const ext = format === 'markdown' ? 'md' : 'json';
      const stem = sanitizeFilenameStem(currentThread.title);
      const filename = `${stem}.${ext}`;
      const text =
        format === 'markdown'
          ? buildThreadMarkdown(currentThread, all)
          : buildThreadJsonText(currentThread, all);
      const saved = await saveTextDialog(filename, text);
      if (saved === null) {
        toasts.show('Export cancelled', 'info');
      } else {
        toasts.show(`Exported to ${saved}`, 'success');
      }
    } catch (err) {
      toasts.show(`Export failed: ${(err as Error).message}`, 'error');
    } finally {
      exporting = false;
    }
  }

  // Outside-click + Esc handling for the export popover. We bind on the
  // document because the popover is anchor-positioned and not inside the
  // button's DOM subtree — a relative-position click handler on the
  // header would race against the button's own onclick.
  $effect(() => {
    if (!exportOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (exportPopoverEl && exportPopoverEl.contains(target)) return;
      if (exportButtonEl && exportButtonEl.contains(target)) return;
      closeExportMenu();
    };
    const onDocKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeExportMenu();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onDocKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onDocKey);
    };
  });

  // -- helpers ----------------------------------------------------------------
  function relativeTime(iso: string | undefined): string {
    if (!iso) return '';
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return '';
    const diff = Date.now() - t;
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(t).toLocaleDateString();
  }

  function toggleTool(id: string) {
    expandedTools = { ...expandedTools, [id]: !expandedTools[id] };
  }

  function fmtJson(v: unknown): string {
    if (v === undefined) return '—';
    if (typeof v === 'string') return v;
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return String(v);
    }
  }
</script>

<section class="flex h-full w-full">
  <!-- ============================ Left: thread rail ====================== -->
  <aside
    class="w-[260px] shrink-0 h-full border-r border-border-subtle flex flex-col bg-bg-base/40"
  >
    <div class="p-3 border-b border-border-subtle">
      <button
        type="button"
        onclick={onNewChat}
        disabled={!connection.client}
        title={connection.client ? 'Start a new chat' : 'Configure the IronClaw connection in Settings first.'}
        class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-accent-cyan text-bg-deep text-sm font-semibold hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed min-h-[40px]"
      >
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        New Chat
      </button>
    </div>

    <div class="flex-1 overflow-y-auto py-2">
      {#if threads.loading && threads.threads.length === 0}
        <div class="px-4 py-6 text-xs text-text-muted">Loading threads…</div>
      {:else if threads.error}
        <div class="px-4 py-6 text-xs text-red-400">{threads.error}</div>
      {:else if threads.sorted.length === 0}
        <div class="px-4 py-6 text-xs text-text-muted">
          {#if connection.client}
            No conversations yet. Start a new chat to begin.
          {:else}
            <span class="text-text-muted">Not connected.</span>
            <a href="/settings" class="text-accent-cyan hover:underline">Configure in Settings →</a>
          {/if}
        </div>
      {:else}
        <!--
          Thread rail. Not virtualized — typical users carry <50 threads and
          each row is a single button with two text spans (~48px tall), so
          even at 200 threads the DOM cost is small. Threshold to revisit
          this and virtualize the rail with the same windowing approach used
          on the logs page: ~300 threads, or any user report of lag scrolling
          this list. When you do, treat each row as a fixed ~48px height,
          mount onscroll on the outer .overflow-y-auto wrapper above, and
          mirror the spacer-pair pattern from src/routes/logs/+page.svelte.
        -->
        <ul class="space-y-0.5 px-2">
          {#each threads.sorted as t (t.id)}
            {@const active = t.id === currentId}
            <li>
              <button
                type="button"
                onclick={() => onSelectThread(t.id)}
                class="w-full text-left px-3 py-2 rounded-md text-sm transition-colors border-l-2 flex flex-col gap-0.5"
                class:border-accent-cyan={active}
                class:bg-bg-surface={active}
                class:text-text-primary={active}
                class:border-transparent={!active}
                class:text-text-muted={!active}
                class:hover:bg-bg-surface={!active}
                class:hover:text-text-primary={!active}
              >
                <span class="truncate block">{t.title || 'Untitled'}</span>
                <span class="text-[10px] text-text-muted">{relativeTime(t.updated_at)}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </aside>

  <!-- =========================== Main: stream + composer ================== -->
  <div class="flex-1 flex flex-col min-w-0 h-full">
    <header
      class="h-12 shrink-0 px-5 flex items-center justify-between border-b border-border-subtle bg-bg-base/40"
    >
      <div class="flex items-center gap-3 min-w-0 flex-1">
        {#if currentThread}
          {#if renaming}
            <input
              type="text"
              bind:value={titleDraft}
              onblur={commitRename}
              onkeydown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitRename();
                } else if (e.key === 'Escape') {
                  cancelRename();
                }
              }}
              class="bg-bg-deep border border-border-subtle rounded-md px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-accent-cyan w-full max-w-md"
              aria-label="Rename thread"
            />
          {:else}
            <button
              type="button"
              onclick={startRename}
              class="text-sm font-medium text-text-primary truncate hover:text-accent-cyan transition-colors text-left"
              title="Click to rename"
            >
              {currentThread.title || 'Untitled'}
            </button>
          {/if}
        {:else}
          <span class="text-sm text-text-muted">No conversation selected</span>
        {/if}
      </div>

      <button
        type="button"
        onclick={() => (rightRailOpen = !rightRailOpen)}
        class="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-surface transition-colors"
        class:text-accent-cyan={rightRailOpen}
        aria-label="Toggle tool inspector"
        title="Tool inspector"
      >
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      </button>

      <!-- Per-thread export. Sits to the right of rename + tool-rail toggle so
           those existing controls don't shift position. Disabled until we
           have an active thread and a healthy connection. -->
      <div class="relative ml-1">
        <button
          type="button"
          bind:this={exportButtonEl}
          onclick={toggleExportMenu}
          disabled={!canExport}
          class="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          class:text-accent-cyan={exportOpen}
          aria-haspopup="menu"
          aria-expanded={exportOpen}
          aria-label="Export conversation"
          title={canExport ? 'Export this conversation' : 'Connect and select a conversation to export'}
        >
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>

        {#if exportOpen}
          <div
            bind:this={exportPopoverEl}
            class="absolute right-0 top-full mt-1 z-20 min-w-[160px] rounded-md border border-border-subtle bg-bg-deep shadow-lg overflow-hidden"
            role="menu"
            aria-label="Export format"
          >
            <button
              type="button"
              role="menuitem"
              onclick={() => void onExportThread('markdown')}
              class="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-surface transition-colors"
            >
              <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 text-text-muted" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Markdown
            </button>
            <button
              type="button"
              role="menuitem"
              onclick={() => void onExportThread('json')}
              class="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-surface transition-colors border-t border-border-subtle"
            >
              <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 text-text-muted" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M8 17v-4M12 17v-4M16 17v-4" />
              </svg>
              JSON
            </button>
          </div>
        {/if}
      </div>
    </header>

    <!-- message stream (wrapper hosts the floating "new messages" FAB
         and the optional find-in-thread bar) -->
    <div class="flex-1 min-h-0 relative">
      <!-- find-in-thread bar — opens with Cmd/Ctrl+F. Positioned absolute
           at the top of the stream so it floats over the first messages
           without pushing the layout. -->
      {#if searchOpen}
        <div class="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-full max-w-md px-3">
          <ChatSearch
            scrollRoot={scrollEl}
            {contentVersion}
            onClose={() => (searchOpen = false)}
          />
        </div>
      {/if}
    <div
      bind:this={scrollEl}
      onscroll={onScroll}
      class="absolute inset-0 overflow-y-auto px-6 py-5"
    >
      {#if !currentThread && history.length === 0 && !streamingBuffer}
        <div class="h-full flex flex-col items-center justify-center text-center">
          <svg viewBox="0 0 24 24" class="w-12 h-12 text-accent-cyan/30 mb-4" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M4 7l8-4 8 4-8 4-8-4z" stroke-linejoin="round" />
            <path d="M4 12l8 4 8-4" stroke-linejoin="round" />
            <path d="M4 17l8 4 8-4" stroke-linejoin="round" />
          </svg>
          <p class="text-sm text-text-muted">Start a conversation</p>
          <p class="text-xs text-text-muted mt-1">Press Enter to send, Shift+Enter for newline</p>
        </div>
      {:else}
        <div class="max-w-4xl mx-auto space-y-4">
          <!--
            Lazy-history indicator. Renders only while a paginated fetch is
            in flight. The container scroll position is anchored around the
            prepend in maybeLoadMore(), so this row appears briefly, the new
            page lays out above the existing list, and the scrollTop is
            pushed down by the inserted height — the user's view stays
            fixed on the message they were reading.
          -->
          {#if isLoadingMore}
            <div class="flex justify-center py-2">
              <span class="inline-flex items-center gap-2 text-xs text-text-muted">
                <span class="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" aria-hidden="true"></span>
                Loading older messages…
              </span>
            </div>
          {/if}
          {#each history as msg (msg.id)}
            {#if msg.role === 'user'}
              {@const meta = messages.getMeta(msg.id)}
              {@const failed = !!meta.failed}
              <div class="flex flex-col items-end gap-1">
                <div
                  class="search-target max-w-[75%] rounded-lg border px-4 py-2.5 text-sm text-text-primary whitespace-pre-wrap"
                  style={failed
                    ? 'background:rgba(239,68,68,0.08);border-color:rgba(239,68,68,0.45);'
                    : 'background:rgba(0,212,255,0.10);border-color:rgba(251,191,36,0.4);'}
                >
                  {msg.content}
                </div>
                {#if failed && currentId}
                  {@const isRetrying = !!retryingIds[msg.id]}
                  <div class="flex items-center gap-2 text-[11px] text-red-300 max-w-[75%]">
                    <svg viewBox="0 0 24 24" class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>Failed to send</span>
                    <button
                      type="button"
                      onclick={() => void onRetry(currentId!, msg.id)}
                      disabled={isRetrying || sending || isStreaming}
                      class="px-2 py-0.5 rounded border border-red-500/50 bg-red-500/10 text-red-200 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Retry sending this message"
                    >
                      {isRetrying ? 'Retrying…' : 'Retry'}
                    </button>
                  </div>
                {/if}
              </div>
            {:else if msg.role === 'assistant'}
              <div class="flex justify-start">
                <div
                  class="search-target max-w-[85%] rounded-lg border surface px-4 py-2.5 text-sm text-text-primary"
                >
                  <MarkdownView markdown={msg.content} />
                </div>
              </div>
            {:else}
              <!-- tool message (rare today; gateway doesn't emit these in history) -->
              <div class="flex justify-start">
                <div
                  class="search-target max-w-[85%] rounded-md border border-border-subtle bg-bg-deep px-3 py-2 text-xs text-text-muted font-mono"
                >
                  tool · {msg.content}
                </div>
              </div>
            {/if}
          {/each}

          <!-- in-flight assistant turn -->
          {#if isStreaming || streamingBuffer}
            <div class="flex justify-start">
              <div
                class="search-target max-w-[85%] rounded-lg border surface px-4 py-2.5 text-sm text-text-primary"
              >
                {#if streamingBuffer}
                  <MarkdownView markdown={streamingBuffer} />
                {:else}
                  <span class="inline-flex items-center gap-1.5 text-text-muted">
                    <span class="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse"></span>
                    <span class="text-xs">Thinking…</span>
                  </span>
                {/if}
              </div>
            </div>
          {/if}

          {#if streamError}
            <div class="flex justify-start">
              <div
                class="max-w-[85%] rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300"
              >
                {streamError}
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>

      <!-- scroll-to-bottom FAB — shown when new content arrives off-screen -->
      {#if showScrollFab}
        <button
          type="button"
          onclick={() => scrollToBottom(true)}
          class="absolute left-1/2 -translate-x-1/2 bottom-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-cyan text-bg-deep text-xs font-semibold shadow-lg hover:brightness-110 transition-all"
          aria-label="Scroll to newest message"
          title="Jump to bottom"
        >
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
          </svg>
          <span>New messages</span>
        </button>
      {/if}
    </div>

    <!-- composer -->
    <div class="shrink-0 border-t border-border-subtle bg-bg-base/40 px-6 py-4">
      <div class="max-w-4xl mx-auto relative">
        <!-- slash-command autocomplete — anchored to this wrapper so the
             dropdown grows upward from the composer's top edge. -->
        <SlashAutocomplete
          bind:this={slashAutoEl}
          anchor={composerEl}
          value={input}
          {caret}
          skills={skillCatalog}
          onPick={applySlashPick}
        />
        <div
          class="flex items-end gap-2 bg-bg-deep border border-border-subtle rounded-lg px-3 py-2 focus-within:border-accent-cyan transition-colors"
        >
          <textarea
            bind:this={composerEl}
            bind:value={input}
            oninput={() => {
              autoGrow();
              scheduleDraftSave();
              syncCaret();
            }}
            onkeyup={syncCaret}
            onclick={syncCaret}
            onkeydown={onKeyDown}
            placeholder={connection.client
              ? 'Message IronClaw…'
              : 'Configure connection in Settings to start chatting'}
            disabled={!connection.client}
            rows="1"
            class="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none resize-none leading-6 max-h-48 min-h-[24px] py-1 disabled:cursor-not-allowed"
          ></textarea>

          {#if isStreaming}
            <button
              type="button"
              onclick={onStop}
              class="shrink-0 w-9 h-9 rounded-md bg-bg-surface border border-accent-gold/50 text-accent-gold hover:bg-accent-gold/10 transition-colors flex items-center justify-center"
              aria-label="Stop"
              title="Stop"
            >
              <svg viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="1.5" />
              </svg>
            </button>
          {:else}
            <button
              type="button"
              onclick={onSend}
              disabled={!canSend}
              class="shrink-0 w-9 h-9 rounded-md bg-accent-cyan text-bg-deep hover:brightness-110 transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Send"
              title="Send (Enter)"
            >
              <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- ====================== Right: tool inspector ======================== -->
  {#if rightRailOpen && tools.length > 0}
    <aside
      class="w-[240px] shrink-0 h-full border-l border-border-subtle bg-bg-base/40 flex flex-col"
    >
      <div class="h-12 shrink-0 px-4 flex items-center justify-between border-b border-border-subtle">
        <span class="text-xs font-semibold text-text-primary uppercase tracking-wide">
          Tool Calls
        </span>
        <button
          type="button"
          onclick={() => (rightRailOpen = false)}
          class="p-1 rounded text-text-muted hover:text-text-primary"
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-3 space-y-2">
        {#each tools as t (t.id)}
          {@const open = !!expandedTools[t.id]}
          <div class="rounded-md border border-border-subtle bg-bg-deep">
            <button
              type="button"
              onclick={() => toggleTool(t.id)}
              class="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-bg-surface transition-colors"
            >
              <div class="flex items-center gap-2 min-w-0">
                <span
                  class="w-1.5 h-1.5 rounded-full shrink-0"
                  class:bg-accent-gold={!t.done}
                  class:bg-accent-cyan={t.done}
                ></span>
                <span class="text-xs font-mono text-text-primary truncate">
                  {t.name}
                </span>
              </div>
              <svg
                viewBox="0 0 24 24"
                class="w-3 h-3 text-text-muted shrink-0 transition-transform"
                class:rotate-90={open}
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            {#if open}
              <div class="border-t border-border-subtle px-3 py-2 space-y-2">
                <div>
                  <div class="text-[10px] uppercase tracking-wider text-text-muted mb-1">Args</div>
                  <pre class="text-[11px] font-mono text-text-primary whitespace-pre-wrap break-all bg-bg-base/60 rounded p-2 overflow-x-auto">{fmtJson(t.args)}</pre>
                </div>
                {#if t.done}
                  <div>
                    <div class="text-[10px] uppercase tracking-wider text-text-muted mb-1">Result</div>
                    <pre class="text-[11px] font-mono text-text-primary whitespace-pre-wrap break-all bg-bg-base/60 rounded p-2 overflow-x-auto">{fmtJson(t.result)}</pre>
                  </div>
                {:else}
                  <div class="text-[11px] text-accent-gold">Running…</div>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </aside>
  {/if}
</section>
