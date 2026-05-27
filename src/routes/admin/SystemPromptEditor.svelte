<script lang="ts">
  // System-prompt editor.
  //
  // Loads the admin-scoped SYSTEM.md, lets the user edit it in a large
  // monospace textarea, and saves via setSystemPrompt(). Includes:
  //   - Dirty tracking (Save disabled until the draft differs from server).
  //   - Character count with a soft warning approaching the 64 KB cap.
  //   - "Restore default" link (PUTs an empty string → server falls back).
  //   - Preview toggle showing rendered markdown side-by-side, since most
  //     SYSTEM.md content is markdown-formatted instructions.
  //
  // Wire detail: the gateway expects `{content}`, not `{prompt}` — the
  // client maps for us; this surface just talks the convenience name.

  import { onMount } from 'svelte';
  import { connection } from '$lib/stores/connection.svelte';
  import { toasts } from '$lib/stores/toasts.svelte';
  import MarkdownView from '$lib/components/MarkdownView.svelte';

  // Server hard-caps at 64 KB. We surface a soft warning under 64 KB so
  // the user notices before the gateway returns a 413. The exact limit is
  // duplicated here (rather than imported) because the constraint lives
  // on the wire — there's no client config for it.
  const MAX_BYTES = 64 * 1024;
  const SOFT_WARN_BYTES = MAX_BYTES - 1024;

  type LoadState = 'idle' | 'loading' | 'loaded' | 'error';
  type SaveState = 'idle' | 'saving' | 'saved' | 'error';

  let loadState = $state<LoadState>('idle');
  let loadError = $state<string | null>(null);

  let saveState = $state<SaveState>('idle');
  let saveError = $state<string | null>(null);

  let serverPrompt = $state('');
  let draft = $state('');
  let showPreview = $state(false);
  let forbidden = $state(false);

  const isDisconnected = $derived(
    connection.status === 'disconnected' ||
      connection.status === 'idle' ||
      !connection.client
  );

  // Use TextEncoder for an honest byte count — naïve `length` counts UTF-16
  // code units, which under-reports for any multi-byte char (emoji, CJK)
  // and would let the user blow past 64 KB on the wire.
  const byteCount = $derived.by(() => new TextEncoder().encode(draft).length);
  const overLimit = $derived(byteCount > MAX_BYTES);
  const approaching = $derived(byteCount > SOFT_WARN_BYTES && byteCount <= MAX_BYTES);
  const dirty = $derived(draft !== serverPrompt);

  onMount(() => {
    void load();
  });

  async function load() {
    const client = connection.client;
    if (!client) {
      loadState = 'idle';
      return;
    }
    loadState = 'loading';
    loadError = null;
    forbidden = false;
    try {
      const res = await client.getSystemPrompt();
      serverPrompt = res.prompt;
      draft = res.prompt;
      loadState = 'loaded';
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401 || status === 403) {
        forbidden = true;
        loadError =
          "This profile's token doesn't have admin role. Switch profile or use a token with admin permission.";
      } else if (status === 404) {
        loadError =
          'System prompt management is only available in multi-tenant mode on this gateway.';
      } else {
        loadError = (err as Error).message;
      }
      loadState = 'error';
    }
  }

  function discard() {
    draft = serverPrompt;
    saveState = 'idle';
    saveError = null;
  }

  async function save() {
    if (overLimit) {
      toasts.show(`Prompt exceeds the 64 KB limit (${byteCount} bytes)`, 'error');
      return;
    }
    const client = connection.client;
    if (!client) return;
    saveState = 'saving';
    saveError = null;
    try {
      await client.setSystemPrompt(draft);
      serverPrompt = draft;
      saveState = 'saved';
      toasts.show('System prompt saved', 'success');
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401 || status === 403) {
        saveError =
          "This profile's token doesn't have admin role. Switch profile or use a token with admin permission.";
        forbidden = true;
      } else if (status === 413) {
        saveError = 'Server rejected the prompt as too large (64 KB cap).';
      } else {
        saveError = (err as Error).message;
      }
      saveState = 'error';
      toasts.show(`Save failed: ${saveError}`, 'error');
    }
  }

  async function restoreDefault() {
    // PUTing an empty string falls back to the gateway's built-in default —
    // the server reads the empty doc as "no admin instructions" and stops
    // injecting the System Instructions section.
    if (
      !confirm(
        'Restore the gateway default? This clears the admin system prompt; users will see only their per-profile system context.'
      )
    ) {
      return;
    }
    draft = '';
    await save();
  }
</script>

<div class="flex flex-col flex-1 min-h-0">
  {#if isDisconnected}
    <div class="surface p-10 flex flex-col items-center justify-center text-center min-h-[280px]">
      <div class="text-sm text-text-primary mb-2">IronClaw is offline</div>
      <div class="text-xs text-text-muted">
        Check <a href="/settings" class="text-accent-cyan hover:underline">Settings</a> to configure the connection.
      </div>
    </div>
  {:else if loadState === 'loading'}
    <div class="surface p-10 flex flex-col items-center justify-center text-center min-h-[280px]">
      <div class="text-sm text-text-muted">Loading system prompt…</div>
    </div>
  {:else if loadState === 'error'}
    <div class="surface p-10 flex flex-col items-center justify-center text-center min-h-[280px]">
      <div class="text-sm text-red-400 mb-2">
        {forbidden ? 'Admin permission required' : 'Failed to load system prompt'}
      </div>
      <div class="text-xs text-text-muted font-mono mb-4 max-w-md break-words">
        {loadError ?? 'Unknown error'}
      </div>
      {#if !forbidden}
        <button
          type="button"
          onclick={() => void load()}
          class="px-4 py-2 rounded-md border border-accent-cyan text-accent-cyan text-sm font-semibold hover:bg-accent-cyan hover:text-bg-deep transition min-h-[40px]"
        >
          Retry
        </button>
      {/if}
    </div>
  {:else}
    <!-- Toolbar: preview toggle on the left, dirty/save status on the right. -->
    <div class="flex items-center gap-3 mb-3">
      <label class="inline-flex items-center gap-2 cursor-pointer text-xs text-text-muted">
        <input
          type="checkbox"
          bind:checked={showPreview}
          class="accent-accent-cyan w-3.5 h-3.5"
        />
        <span>Preview</span>
      </label>
      <span class="text-[10px] text-text-muted font-mono">
        Markdown rendered side-by-side for SYSTEM.md
      </span>
      <span class="ml-auto text-xs">
        {#if dirty}
          <span class="text-accent-gold">Unsaved changes.</span>
        {:else if saveState === 'saved'}
          <span class="text-accent-cyan">Saved.</span>
        {:else}
          <span class="text-text-muted">Up to date with the server.</span>
        {/if}
      </span>
    </div>

    <!-- Editor + (optional) preview, side-by-side. The grid template
         collapses to a single column when preview is off. Both panes
         flex to fill the route's remaining vertical space. -->
    <div
      class="flex-1 min-h-0 grid gap-4"
      class:grid-cols-1={!showPreview}
      class:grid-cols-2={showPreview}
    >
      <textarea
        bind:value={draft}
        spellcheck="false"
        placeholder="# System Instructions&#10;&#10;Write the admin SYSTEM.md content here. Markdown supported."
        class="surface w-full h-full p-4 bg-bg-deep border border-border-subtle rounded-md text-sm font-mono text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-cyan transition-colors resize-none"
      ></textarea>

      {#if showPreview}
        <div class="surface p-4 overflow-auto text-sm">
          {#if draft.trim()}
            <MarkdownView markdown={draft} />
          {:else}
            <div class="text-xs text-text-muted italic">Nothing to preview.</div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Footer: char count + save controls + restore-default link. -->
    <div class="mt-4 flex items-center gap-3 flex-wrap">
      <span
        class="text-xs font-mono"
        class:text-text-muted={!approaching && !overLimit}
        class:text-accent-gold={approaching}
        class:text-red-400={overLimit}
      >
        {byteCount.toLocaleString()} / {MAX_BYTES.toLocaleString()} bytes
        {#if overLimit}
          <span class="ml-2">— exceeds the 64 KB limit</span>
        {:else if approaching}
          <span class="ml-2">— approaching the 64 KB limit</span>
        {/if}
      </span>

      <button
        type="button"
        onclick={() => void restoreDefault()}
        class="text-xs text-text-muted hover:text-accent-gold transition-colors ml-auto"
        title="Clear the admin SYSTEM.md so the gateway falls back to the built-in default"
      >
        Restore default
      </button>

      <button
        type="button"
        onclick={discard}
        disabled={!dirty || saveState === 'saving'}
        class="px-4 py-2 rounded-md border border-border-subtle text-sm text-text-primary hover:border-accent-gold hover:text-accent-gold transition disabled:opacity-30 disabled:hover:border-border-subtle disabled:hover:text-text-primary min-h-[40px]"
      >
        Discard
      </button>
      <button
        type="button"
        onclick={() => void save()}
        disabled={!dirty || saveState === 'saving' || overLimit}
        class="px-4 py-2 rounded-md bg-accent-cyan text-bg-deep text-sm font-semibold hover:brightness-110 transition disabled:opacity-50 min-h-[40px]"
      >
        {saveState === 'saving' ? 'Saving…' : 'Save changes'}
      </button>
    </div>

    {#if saveError && saveState === 'error'}
      <div class="mt-2 text-xs text-red-400 font-mono break-words">
        {saveError}
      </div>
    {/if}
  {/if}
</div>
