<script lang="ts">
  // Renders the body of a memory doc. Markdown files (.md) are piped
  // through marked + DOMPurify; everything else falls into a <pre> so
  // raw structure is preserved.
  //
  // The component also owns an inline-edit mode: pencil flips the body
  // into a full-height monospace textarea, Save POSTs to /api/memory/write
  // via the parent's `onsave` callback (the parent then reloads the doc
  // and toasts), and Cancel reverts with an unsaved-changes confirm.
  //
  // TODO: when src/lib/components/MarkdownView.svelte lands (the chat
  // agent is creating it concurrently), import it and replace the
  // marked.parse/DOMPurify pipeline here so the two surfaces share one
  // implementation of HTML sanitization and prose styling.

  import { marked } from 'marked';
  import DOMPurify from 'dompurify';

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
  }

  let { path, content, loading, error, onsave }: Props = $props();

  const isMarkdown = $derived(/\.(md|mdx|markdown)$/i.test(path));

  // marked is configured for GitHub-flavoured defaults; we run the
  // output through DOMPurify because the doc tree includes user-authored
  // notes that may contain arbitrary HTML embeds.
  const rendered = $derived(isMarkdown ? sanitize(marked.parse(content) as string) : '');

  function sanitize(html: string): string {
    // ADD_ATTR allows <a target> so links open in a new context if
    // authored that way; the host webview still mediates navigation.
    return DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'rel'] });
  }

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
      <div class="prose-doc">
        {@html rendered}
      </div>
    {:else}
      <pre
        class="text-xs font-mono text-text-primary whitespace-pre-wrap break-words leading-relaxed">{content}</pre>
    {/if}
  </div>
</div>

<style>
  /* Scoped prose styles for the markdown surface. Kept terse — the
     design system's gold/cyan accents apply, and we don't want a full
     tailwind/typography plugin pull-in for a single view. */
  .prose-doc :global(h1) {
    font-size: 1.5rem;
    font-weight: 600;
    color: #e5e7eb;
    margin: 0 0 1rem;
  }
  .prose-doc :global(h2) {
    font-size: 1.125rem;
    font-weight: 600;
    color: #e5e7eb;
    margin: 1.5rem 0 0.75rem;
  }
  .prose-doc :global(h3),
  .prose-doc :global(h4) {
    font-size: 1rem;
    font-weight: 600;
    color: #e5e7eb;
    margin: 1.25rem 0 0.5rem;
  }
  .prose-doc :global(p) {
    color: #e5e7eb;
    margin: 0 0 0.75rem;
    line-height: 1.6;
    font-size: 0.875rem;
  }
  .prose-doc :global(a) {
    color: #00d4ff;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .prose-doc :global(a:hover) {
    color: #fbbf24;
  }
  .prose-doc :global(code) {
    background: #050810;
    border: 1px solid #1f2937;
    border-radius: 3px;
    padding: 0.05rem 0.3rem;
    font-size: 0.8rem;
    font-family: 'SF Mono', Menlo, monospace;
    color: #fbbf24;
  }
  .prose-doc :global(pre) {
    background: #050810;
    border: 1px solid #1f2937;
    border-radius: 6px;
    padding: 0.875rem 1rem;
    overflow-x: auto;
    margin: 0 0 1rem;
  }
  .prose-doc :global(pre code) {
    background: transparent;
    border: 0;
    padding: 0;
    color: #e5e7eb;
    font-size: 0.8rem;
  }
  .prose-doc :global(ul),
  .prose-doc :global(ol) {
    color: #e5e7eb;
    margin: 0 0 0.75rem 1.25rem;
    font-size: 0.875rem;
    line-height: 1.6;
  }
  .prose-doc :global(li) {
    margin: 0.15rem 0;
  }
  .prose-doc :global(blockquote) {
    border-left: 2px solid #00d4ff;
    padding-left: 0.875rem;
    margin: 0 0 0.75rem;
    color: #9ca3af;
    font-style: italic;
  }
  .prose-doc :global(table) {
    border-collapse: collapse;
    margin: 0 0 1rem;
    font-size: 0.8rem;
  }
  .prose-doc :global(th),
  .prose-doc :global(td) {
    border: 1px solid #1f2937;
    padding: 0.4rem 0.75rem;
    text-align: left;
    color: #e5e7eb;
  }
  .prose-doc :global(th) {
    background: #121826;
    font-weight: 600;
  }
  .prose-doc :global(hr) {
    border: 0;
    border-top: 1px solid #1f2937;
    margin: 1.25rem 0;
  }
</style>