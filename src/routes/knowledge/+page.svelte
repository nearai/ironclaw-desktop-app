<script lang="ts">
  // Knowledge browser: left tree rail + right detail pane with search.
  //
  // State ownership lives here so the search bar can clear results and
  // restore the tree-selection view in one place. Tree node expansion
  // state is owned per-row by TreeNode itself.

  import { onMount } from 'svelte';
  import { connection } from '$lib/stores/connection.svelte';
  import { toasts } from '$lib/stores/toasts.svelte';
  import type { IronClawClient } from '$lib/api/ironclaw';
  import type { MemoryHit, MemoryNode } from '$lib/api/types';
  import TreeNode from './TreeNode.svelte';
  import SearchBar from './SearchBar.svelte';
  import SearchResults from './SearchResults.svelte';
  import DocViewer from './DocViewer.svelte';
  import NewDocModal, { validateMemoryPath } from './NewDocModal.svelte';

  // ---- Tree state ----
  let rootNodes = $state<MemoryNode[]>([]);
  let rootLoading = $state(false);
  let rootError = $state<string | null>(null);

  // ---- Selected doc state ----
  let selectedPath = $state<string | null>(null);
  let selectedContent = $state<string>('');
  let docLoading = $state(false);
  let docError = $state<string | null>(null);

  // ---- Search state ----
  // We track the *committed* query separately from the raw input so the
  // results header stays stable across keystrokes (debounce drops new
  // values into committedQuery once the timer fires).
  let inputValue = $state('');
  let committedQuery = $state('');
  let searchResults = $state<MemoryHit[]>([]);
  let searchPending = $state(false);
  let searchError = $state<string | null>(null);

  // ---- New-doc modal state ----
  // Modal is mounted only while `newDocOpen` is true so its inputs are
  // freshly seeded on every open. No reset logic needed.
  let newDocOpen = $state(false);

  // Strictly a UI flag: true once we've fired at least one search for
  // the current query. Lets us distinguish "no results" from "didn't
  // search yet".
  const hasActiveSearch = $derived(committedQuery.trim().length > 0);

  // Stash the client into a local $derived so we don't pass `connection`
  // through to children — they only need the IronClawClient.
  const client = $derived(connection.client);

  onMount(async () => {
    // The sidebar mounts first and calls connection.init(), but if the
    // user navigates directly to /knowledge with a still-connecting
    // client we wait one tick to give it a chance.
    if (!connection.client) {
      await connection.init();
    }
    await loadRoot();
  });

  // If the user re-saves the gateway connection, re-fetch the tree.
  $effect(() => {
    if (connection.status === 'connected' && rootNodes.length === 0 && !rootLoading) {
      void loadRoot();
    }
  });

  async function loadRoot() {
    if (!client) {
      rootError = 'IronClaw client unavailable.';
      return;
    }
    rootLoading = true;
    rootError = null;
    try {
      const nodes = await client.listMemory();
      // Sort: directories first, then files, alphabetically within group.
      nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return basename(a.path).localeCompare(basename(b.path));
      });
      rootNodes = nodes;
    } catch (err) {
      rootError = (err as Error).message;
      toasts.show(`Failed to load knowledge tree: ${rootError}`, 'error');
    } finally {
      rootLoading = false;
    }
  }

  function basename(p: string): string {
    const trimmed = p.replace(/\/+$/, '');
    const idx = trimmed.lastIndexOf('/');
    return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
  }

  async function openPath(path: string, c: IronClawClient | null) {
    if (!c) return;
    selectedPath = path;
    docLoading = true;
    docError = null;
    selectedContent = '';
    try {
      const res = await c.readMemory(path);
      selectedContent = res.content;
    } catch (err) {
      docError = (err as Error).message;
      toasts.show(`Failed to load doc: ${docError}`, 'error');
    } finally {
      docLoading = false;
    }
  }

  async function onSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) {
      committedQuery = '';
      searchResults = [];
      searchError = null;
      return;
    }
    if (!client) return;
    committedQuery = trimmed;
    searchPending = true;
    searchError = null;
    try {
      // Bump default limit slightly above the API's 10 so users see more
      // context without a "load more" affordance.
      searchResults = await client.searchMemory(trimmed, 20);
    } catch (err) {
      searchError = (err as Error).message;
      searchResults = [];
      toasts.show(`Search failed: ${searchError}`, 'error');
    } finally {
      searchPending = false;
    }
  }

  function clearSearch() {
    inputValue = '';
    committedQuery = '';
    searchResults = [];
    searchError = null;
  }

  /**
   * Save the in-flight edit of the currently-selected doc.
   *
   * Returns true on success so the viewer can drop out of edit mode.
   * On failure we toast and return false; the viewer keeps the user's
   * draft so they can retry without losing work.
   *
   * After a successful write we re-read the doc so any server-side
   * normalization (trailing newline, layer redirect, etc.) is reflected
   * in the rendered view.
   */
  async function saveDoc(newContent: string): Promise<boolean> {
    if (!client || !selectedPath) return false;
    const path = selectedPath;
    const pathError = validateMemoryPath(path);
    if (pathError) {
      toasts.show(`Save failed: ${pathError}`, 'error');
      return false;
    }
    try {
      const res = await client.writeMemory(path, newContent);
      if (!res.ok) {
        toasts.show(`Save failed: gateway did not confirm write`, 'error');
        return false;
      }
      toasts.show(`Saved: ${path}`, 'info');
      // Re-fetch so the rendered view matches whatever the server stored.
      // We swallow read errors here — the write succeeded, so the worst
      // case is a stale local view that the user can refresh manually.
      try {
        const fresh = await client.readMemory(path);
        if (selectedPath === path) selectedContent = fresh.content;
      } catch {
        /* ignore — write already toasted success */
      }
      return true;
    } catch (err) {
      toasts.show(`Save failed: ${(err as Error).message}`, 'error');
      return false;
    }
  }

  /**
   * Create a new doc from the modal, refresh the tree so the row appears,
   * and select the new doc so the user lands in it ready to edit.
   *
   * The modal pre-validates the path, but we re-run it here in case the
   * caller path ever diverges from the modal's validator.
   */
  async function createDoc(path: string, content: string): Promise<void> {
    if (!client) return;
    const trimmed = path.trim();
    const pathError = validateMemoryPath(trimmed);
    if (pathError) {
      toasts.show(`Create failed: ${pathError}`, 'error');
      return;
    }
    if (content.length === 0) {
      // Allow but warn — empty docs are valid but rarely useful.
      toasts.show('Empty doc created — add content to make it searchable.', 'info');
    }
    try {
      const res = await client.writeMemory(trimmed, content);
      if (!res.ok) {
        toasts.show(`Create failed: gateway did not confirm write`, 'error');
        return;
      }
      toasts.show(`Created: ${trimmed}`, 'success');
      newDocOpen = false;
      // Refresh the tree so the new row appears, then open the doc.
      await loadRoot();
      await openPath(trimmed, client);
    } catch (err) {
      toasts.show(`Create failed: ${(err as Error).message}`, 'error');
    }
  }
</script>

<section class="p-8 h-full flex flex-col min-h-0">
  <header class="mb-6">
    <h1 class="text-2xl font-semibold text-text-primary">Knowledge</h1>
    <p class="text-text-muted text-sm mt-1">Docs, transcripts, and RAG sources.</p>
  </header>

  {#if connection.status !== 'connected'}
    <div class="surface flex-1 flex flex-col items-center justify-center text-center px-6">
      <svg
        viewBox="0 0 24 24"
        class="w-10 h-10 text-text-muted mb-3"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div class="text-sm text-text-primary mb-1">IronClaw is offline</div>
      <div class="text-xs text-text-muted">
        Check Settings to configure or restart the gateway.
      </div>
      {#if connection.lastError}
        <div class="mt-3 text-xs text-red-400 font-mono max-w-md break-all">
          {connection.lastError}
        </div>
      {/if}
    </div>
  {:else}
    <div class="flex-1 min-h-0 flex gap-4">
      <!-- Left rail: tree -->
      <aside
        class="w-[320px] shrink-0 surface flex flex-col min-h-0"
      >
        <div class="px-3 py-3 border-b border-border-subtle flex items-center justify-between gap-2">
          <span class="text-xs font-semibold text-text-primary uppercase tracking-wider">
            Workspace
          </span>
          <div class="flex items-center gap-1">
            <button
              type="button"
              onclick={() => (newDocOpen = true)}
              disabled={!client}
              title="New document"
              aria-label="New document"
              class="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md border border-border-subtle text-text-muted hover:text-accent-cyan hover:border-accent-cyan transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg
                viewBox="0 0 24 24"
                class="w-3 h-3"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New
            </button>
            <button
              type="button"
              onclick={loadRoot}
              disabled={rootLoading}
              title="Refresh tree"
              aria-label="Refresh tree"
              class="inline-flex items-center justify-center w-7 h-7 rounded-md text-text-muted hover:text-accent-cyan transition-colors disabled:opacity-50"
            >
              <svg
                viewBox="0 0 24 24"
                class="w-3.5 h-3.5"
                class:animate-spin={rootLoading}
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          </div>
        </div>
        <div class="flex-1 overflow-auto py-2">
          {#if rootLoading && rootNodes.length === 0}
            <div class="text-xs text-text-muted px-3 py-2">Loading…</div>
          {:else if rootError}
            <div class="text-xs text-red-400 px-3 py-2 break-words">{rootError}</div>
          {:else if rootNodes.length === 0}
            <div class="text-xs text-text-muted px-3 py-2 italic">Empty workspace.</div>
          {:else if client}
            {#each rootNodes as node (node.path)}
              <TreeNode
                {node}
                depth={0}
                {selectedPath}
                {client}
                onSelect={(p) => openPath(p, client)}
              />
            {/each}
          {/if}
        </div>
      </aside>

      <!-- Right pane: search + content -->
      <div class="flex-1 min-w-0 flex flex-col gap-4 min-h-0">
        <SearchBar
          value={inputValue}
          onChange={(v) => {
            inputValue = v;
            void onSearch(v);
          }}
          onSubmit={(v) => {
            inputValue = v;
            void onSearch(v);
          }}
          pending={searchPending}
        />

        {#if hasActiveSearch}
          {#if searchPending && searchResults.length === 0}
            <div class="text-xs text-text-muted">Searching…</div>
          {:else if searchError}
            <div class="surface p-4 text-sm text-red-400">{searchError}</div>
          {:else}
            <SearchResults
              results={searchResults}
              query={committedQuery}
              onClear={clearSearch}
              onOpen={(p) => openPath(p, client)}
              {selectedPath}
            />
          {/if}

          {#if selectedPath}
            <div class="flex-1 min-h-0">
              <DocViewer
                path={selectedPath}
                content={selectedContent}
                loading={docLoading}
                error={docError}
                onsave={saveDoc}
              />
            </div>
          {/if}
        {:else if selectedPath}
          <div class="flex-1 min-h-0">
            <DocViewer
              path={selectedPath}
              content={selectedContent}
              loading={docLoading}
              error={docError}
              onsave={saveDoc}
            />
          </div>
        {:else}
          <div class="surface flex-1 flex items-center justify-center">
            <div class="text-text-muted text-sm">
              Select a doc or search the knowledge base.
            </div>
          </div>
        {/if}
      </div>
    </div>

    {#if newDocOpen}
      <NewDocModal
        onclose={() => (newDocOpen = false)}
        oncreate={createDoc}
      />
    {/if}
  {/if}
</section>
