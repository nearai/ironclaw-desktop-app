<script lang="ts">
  // Renders the body of a memory doc. Markdown files (.md) are routed
  // through the shared MarkdownView component (which handles marked +
  // DOMPurify + syntax highlighting + callouts + anchor links); everything
  // else falls into a <pre> so raw structure is preserved.
  //
  // The component also owns an inline-edit mode: pencil flips the body
  // into a full-height monospace textarea, Save POSTs to /api/memory/write
  // via the parent's `onsave` callback (the parent then reloads the doc
  // and toasts), and Cancel reverts with an unsaved-changes confirm.

  import MarkdownView from '$lib/components/MarkdownView.svelte';

  interface Props {
    path: string;
    content: string;
    loading: boolean;
    error: string | null;
    /** Called when the user clicks Save. Parent does the network write,
     *  toasts on success/failure, and re-reads the doc; the modal stays
     *  in edit mode until the promise resolves, then drops out of edit
     *  mode on success.  Resolves true on success, false on failure. */
    onsave?: (newContent: string) => Promise<boolean>;
    /** Whether the current path is currently bookmarked. */
    bookmarked?: boolean;
    /** Called when the star icon is clicked. Parent owns the bookmark
     *  store + persistence. */
    onToggleBookmark?: () => void;
  }

  let {
    path,
    content,
    loading,
    error,
    onsave,
    bookmarked = false,
    onToggleBookmark
  }: Props = $props();

  const isMarkdown = $derived(/\.(md|mdx|markdown)$/i.test(path));

  // ---- Edit mode -------------------------------------------------------

  let editing = $state(false);
  /** Draft text bound to the textarea; seeded from `content` on entry. */
  let draft = $state('');
  /** Snapshot of `content` at the moment edit mode opened — used for the
   *  unsaved-changes confirm so we don't compare against a stale prop. */
  let originalAtEditStart = $state('');
  let saving = $state(false);
  let textareaEl: HTMLTextAreaElement | undefined = $state();

  const dirty = $derived(editing && draft !== originalAtEditStart);
  // Disable the pencil while loading/error or when there is no doc loaded.
  // The parent only renders this component when a path is selected, but
  // we still guard against the empty-content + still-loading case.
  const canEdit = $derived(!loading && !error && !!path);

  // If the parent swaps to a different path while we're editing, exit
  // edit mode silently — the old draft no longer makes sense for the new
  // file, and any unsaved work was on the old path.
  let lastEditPath = $state('');
  $effect(() => {
    if (editing && path !== lastEditPath) {
      editing = false;
      draft = '';
      originalAtEditStart = '';
    }
  });

  function enterEdit() {
    if (!canEdit) return;
    draft = content;
    originalAtEditStart = content;
    lastEditPath = path;
    editing = true;
    // Focus the textarea after the DOM updates. The microtask hop is
    // enough; we don't need requestAnimationFrame here.
    queueMicrotask(() => textareaEl?.focus());
  }

  function cancelEdit() {
    if (dirty) {
      const ok = window.confirm('Discard unsaved changes?');
      if (!ok) return;
    }
    editing = false;
    draft = '';
    originalAtEditStart = '';
  }

  async function handleSave() {
    if (saving || !onsave) return;
    saving = true;
    try {
      const ok = await onsave(draft);
      if (ok) {
        // Parent will re-fetch and update `content`; drop out of edit mode
        // so the user sees the fresh render. Don't reset originalAtEditStart
        // here — it's only meaningful while editing.
        editing = false;
        draft = '';
        originalAtEditStart = '';
      }
      // On failure, stay in edit mode so the user doesn't lose their work.
      // The parent is responsible for the error toast.
    } finally {
      saving = false;
    }
  }

  function handleKey(event: KeyboardEvent) {
    if (!editing) return;
    // Cmd+S / Ctrl+S → save. We capture both so a Linux/Windows webview
    // behaves the same as macOS without depending on Tauri platform info.
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void handleSave();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEdit();
    }
  }

  // TODO(2026-05-27): add a "Delete" button to the header (red on hover, next
  // to Edit) once the gateway implements `DELETE /api/memory?path=...` or
  // `POST /api/memory/delete`. Live-server probe today returns 404 for both
  // shapes. The client method `client.deleteMemory(path)` is pre-wired in
  // `src/lib/api/ironclaw.ts`. Wiring plan: add an `ondelete?: (path:
  // string) => Promise<void>` prop on this component, click → styled
  // confirm dialog ("Delete this document? This can't be undone."), then
  // call `ondelete(path)`; the parent (knowledge/+page.svelte) clears
  // `selectedPath`, refreshes the tree, and toasts.
</script>

<svelte:window onkeydown={handleKey} />

<div class="flex flex-col h-full">
  <div class="flex items-center gap-2 px-1 mb-3">
    <svg
      viewBox="0 0 16 16"
      class="w-4 h-4 text-accent-cyan shrink-0"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M9 1.5H4a1 1 0 0 0-1 1V13.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.5z" />
      <polyline points="9 1.5 9 5.5 13 5.5" />
    </svg>
    <span class="text-xs font-mono text-text-primary truncate flex-1 min-w-0" title={path}>{path}</span>

    <!-- Bookmark toggle. Always visible (even in edit mode) so the user can
         star a doc while drafting changes without losing their place. The
         star fills gold when active; outlined otherwise. -->
    {#if onToggleBookmark}
      <button
        type="button"
        onclick={onToggleBookmark}
        title={bookmarked ? 'Remove bookmark' : 'Bookmark document'}
        aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark document'}
        aria-pressed={bookmarked}
        class="inline-flex items-center justify-center w-7 h-7 rounded-md border border-border-subtle hover:border-accent-gold transition disabled:opacity-40 disabled:cursor-not-allowed"
        class:text-accent-gold={bookmarked}
        class:text-text-muted={!bookmarked}
        class:hover:text-accent-gold={!bookmarked}
      >
        <svg
          viewBox="0 0 24 24"
          class="w-3.5 h-3.5"
          fill={bookmarked ? 'currentColor' : 'none'}
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9 12 2" />
        </svg>
      </button>
    {/if}

    <!-- Header actions: Edit (idle) or Save+Cancel (editing). -->
    {#if editing}
      <button
        type="button"
        onclick={cancelEdit}
        disabled={saving}
        class="text-[11px] px-2.5 py-1 rounded-md border border-border-subtle text-text-muted hover:text-text-primary hover:border-accent-cyan transition disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="button"
        onclick={handleSave}
        disabled={saving}
        class="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-accent-cyan text-bg-deep font-semibold hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {#if saving}
          <svg viewBox="0 0 24 24" class="w-3 h-3 animate-spin" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" opacity="0.25" />
            <path d="M22 12a10 10 0 0 0-10-10" />
          </svg>
          Saving…
        {:else}
          <!-- Floppy disk save icon. -->
          <svg
            viewBox="0 0 24 24"
            class="w-3 h-3"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          Save
        {/if}
      </button>
    {:else}
      <button
        type="button"
        onclick={enterEdit}
        disabled={!canEdit}
        title="Edit document"
        aria-label="Edit document"
        class="inline-flex items-center justify-center w-7 h-7 rounded-md border border-border-subtle text-text-muted hover:text-accent-cyan hover:border-accent-cyan transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <!-- Pencil icon. -->
        <svg
          viewBox="0 0 24 24"
          class="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      </button>
    {/if}
  </div>

  <div class="surface flex-1 min-h-0 overflow-auto p-6">
    {#if loading}
      <div class="flex items-center justify-center gap-2 py-12 text-text-muted text-sm">
        <svg
          viewBox="0 0 24 24"
          class="w-4 h-4 animate-spin text-accent-cyan"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="9" stroke-opacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" />
        </svg>
        Loading…
      </div>
    {:else if error}
      <div class="text-sm text-red-400">{error}</div>
    {:else if editing}
      <!--
        Edit mode: full-height monospace textarea, no border so the surface
        provides the chrome. Padding is deliberately zero on the textarea
        because the surrounding .surface already gives 24px of breathing room.
      -->
      <textarea
        bind:this={textareaEl}
        value={draft}
        oninput={(e) => (draft = (e.currentTarget as HTMLTextAreaElement).value)}
        spellcheck="false"
        class="block w-full h-[70vh] bg-bg-deep text-text-primary text-xs font-mono leading-relaxed resize-none border-0 focus:outline-none focus:ring-0 px-3 py-2 rounded-md"
      ></textarea>
    {:else if isMarkdown}
      <MarkdownView markdown={content} />
    {:else}
      <pre
        class="text-xs font-mono text-text-primary whitespace-pre-wrap break-words leading-relaxed">{content}</pre>
    {/if}
  </div>
</div>

