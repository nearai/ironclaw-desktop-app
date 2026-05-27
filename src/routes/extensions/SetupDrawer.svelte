<script lang="ts">
  import { onMount } from 'svelte';
  import { open as openUrl } from '@tauri-apps/plugin-shell';
  import { connection } from '$lib/stores/connection.svelte';
  import { toasts } from '$lib/stores/toasts.svelte';
  import type { Extension, ExtensionSetupSchema } from '$lib/api/types';

  type Props = {
    extension: Extension;
    onClose: () => void;
    onSaved: () => void;
  };

  const { extension, onClose, onSaved }: Props = $props();

  type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

  let loadState = $state<LoadState>('idle');
  let loadError = $state<string | null>(null);
  let schema = $state<ExtensionSetupSchema | null>(null);
  /** Field values keyed by `key`. Stringly typed; coerced at submit time. */
  let values = $state<Record<string, string | boolean>>({});
  let submitting = $state(false);

  // Required fields satisfied?
  const canSubmit = $derived.by(() => {
    if (!schema || submitting) return false;
    for (const f of schema.fields) {
      if (!f.required) continue;
      const v = values[f.key];
      if (typeof v === 'boolean') continue; // boolean always has a value
      if (!v || (typeof v === 'string' && v.trim().length === 0)) return false;
    }
    return true;
  });

  const title = $derived(extension.display_name ?? extension.name);

  onMount(() => {
    void loadSchema();
  });

  async function loadSchema() {
    const client = connection.client;
    if (!client) {
      loadState = 'error';
      loadError = 'Not connected to IronClaw.';
      return;
    }
    loadState = 'loading';
    loadError = null;
    try {
      schema = await client.getExtensionSetup(extension.name);
      // Seed defaults so toggles and selects start with the server's intent.
      const seed: Record<string, string | boolean> = {};
      for (const f of schema.fields) {
        if (f.type === 'boolean') {
          seed[f.key] = f.default === 'true' || (f.default as unknown) === true;
        } else if (f.default !== undefined) {
          seed[f.key] = String(f.default);
        } else {
          seed[f.key] = '';
        }
      }
      values = seed;
      loadState = 'loaded';
    } catch (err) {
      loadError = (err as Error).message;
      loadState = 'error';
    }
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    const client = connection.client;
    if (!client || !schema) return;
    submitting = true;
    try {
      // Pass values through verbatim — we don't know the gateway's per-field
      // type, so the only coercion is boolean handling (already correct).
      const res = await client.submitExtensionSetup(extension.name, values);
      if (res.ok) {
        toasts.show(`Saved setup for ${title}`, 'success');
        onSaved();
        onClose();
      } else {
        toasts.show(`Saved setup for ${title}, but the server didn't confirm`, 'info');
        onSaved();
        onClose();
      }
    } catch (err) {
      toasts.show(`Failed to save: ${(err as Error).message}`, 'error');
    } finally {
      submitting = false;
    }
  }

  async function launchOAuth(url: string) {
    try {
      await openUrl(url);
    } catch (err) {
      toasts.show(`Could not open browser: ${(err as Error).message}`, 'error');
    }
  }

  function handleBackdropKey(event: KeyboardEvent) {
    if (event.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={handleBackdropKey} />

<!-- Backdrop -->
<button
  type="button"
  aria-label="Close drawer"
  onclick={onClose}
  class="fixed inset-0 z-40 bg-black/40 cursor-default"
></button>

<!-- Drawer -->
<div
  class="fixed top-0 right-0 z-50 h-full w-full md:w-[40%] min-w-[360px] max-w-[640px] bg-[#0d121f] border-l border-border-subtle shadow-[-12px_0_32px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden"
  role="dialog"
  aria-modal="true"
  aria-labelledby="extension-setup-title"
>
  <!-- Header -->
  <header
    class="flex items-start justify-between gap-4 px-6 py-5 border-b border-border-subtle"
  >
    <div class="min-w-0">
      <h2
        id="extension-setup-title"
        class="text-lg font-semibold text-accent-cyan break-words"
      >
        {title}
      </h2>
      <div class="mt-1 flex flex-wrap items-center gap-2">
        {#if extension.version}
          <span class="text-[10px] font-mono text-text-muted bg-bg-deep px-2 py-0.5 rounded">
            v{extension.version}
          </span>
        {/if}
        {#if extension.category}
          <span class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border border-border-subtle text-text-muted">
            {extension.category}
          </span>
        {/if}
      </div>
    </div>
    <button
      type="button"
      onclick={onClose}
      aria-label="Close"
      class="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-md border border-border-subtle text-text-muted hover:text-text-primary hover:border-accent-cyan transition"
    >
      <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  </header>

  <!-- Body -->
  <div class="flex-1 overflow-auto px-6 py-5">
    {#if loadState === 'loading' || loadState === 'idle'}
      <div class="space-y-4 animate-pulse">
        <div class="h-3 w-1/4 bg-border-subtle rounded"></div>
        <div class="h-10 w-full bg-border-subtle rounded"></div>
        <div class="h-3 w-1/3 bg-border-subtle rounded"></div>
        <div class="h-10 w-full bg-border-subtle rounded"></div>
      </div>
    {:else if loadState === 'error'}
      <div class="surface p-6 flex flex-col items-center justify-center text-center">
        <div class="text-sm text-red-400 mb-2">Failed to load setup</div>
        <div class="text-xs text-text-muted font-mono mb-4 max-w-md break-words">
          {loadError ?? 'Unknown error'}
        </div>
        <button
          type="button"
          onclick={loadSchema}
          class="px-4 py-2 rounded-md border border-accent-cyan text-accent-cyan text-sm font-semibold hover:bg-accent-cyan hover:text-bg-deep transition min-h-[40px]"
        >
          Retry
        </button>
      </div>
    {:else if schema && schema.fields.length === 0 && !schema.oauth_url}
      <div class="surface p-6 text-sm text-text-muted">
        This extension has no setup fields. {extension.ready ? 'It is ready to use.' : 'Activate it from the card to enable.'}
      </div>
    {:else if schema}
      <form onsubmit={handleSubmit} class="space-y-5">
        {#if schema.notes}
          <p class="text-xs text-text-muted leading-relaxed">{schema.notes}</p>
        {/if}

        {#if schema.oauth_url}
          <button
            type="button"
            onclick={() => launchOAuth(schema!.oauth_url!)}
            class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-accent-gold text-bg-deep text-sm font-semibold hover:brightness-95 transition min-h-[44px]"
          >
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Connect with OAuth
          </button>
        {/if}

        {#each schema.fields as field (field.key)}
          <div class="space-y-1.5">
            <label for={`ext-field-${field.key}`} class="block text-xs font-semibold text-text-primary">
              {field.label}
              {#if field.required}
                <span class="text-accent-cyan" aria-label="required">*</span>
              {/if}
            </label>
            {#if field.description}
              <p class="text-[11px] text-text-muted leading-relaxed">{field.description}</p>
            {/if}

            {#if field.type === 'boolean'}
              <label class="inline-flex items-center gap-2 cursor-pointer">
                <input
                  id={`ext-field-${field.key}`}
                  type="checkbox"
                  checked={Boolean(values[field.key])}
                  onchange={(e) => (values = { ...values, [field.key]: (e.currentTarget as HTMLInputElement).checked })}
                  class="sr-only peer"
                />
                <span
                  class="relative inline-block w-9 h-5 bg-border-subtle rounded-full transition peer-checked:bg-accent-cyan after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-text-primary after:rounded-full after:transition peer-checked:after:translate-x-4"
                ></span>
                <span class="text-xs text-text-muted">
                  {values[field.key] ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            {:else if field.type === 'select'}
              <select
                id={`ext-field-${field.key}`}
                value={String(values[field.key] ?? '')}
                onchange={(e) => (values = { ...values, [field.key]: (e.currentTarget as HTMLSelectElement).value })}
                class="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-cyan transition-colors min-h-[40px]"
              >
                {#if !field.required}
                  <option value="">— select —</option>
                {/if}
                {#each field.options ?? [] as opt (opt.value)}
                  <option value={opt.value}>{opt.label}</option>
                {/each}
              </select>
            {:else if field.type === 'oauth'}
              <!--
                A bare oauth field on a per-field level (rare — the top-level
                oauth_url covers the common case). We give it a button that
                opens whatever URL the server stored as the field value /
                default; if neither is present we render a disabled stub.
              -->
              {@const url = String(values[field.key] ?? field.default ?? '')}
              <button
                type="button"
                onclick={() => url && launchOAuth(url)}
                disabled={!url}
                class="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-accent-gold/60 text-accent-gold text-sm font-semibold hover:bg-accent-gold hover:text-bg-deep transition min-h-[40px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Connect
              </button>
            {:else}
              <input
                id={`ext-field-${field.key}`}
                type={field.type === 'password' ? 'password' : 'text'}
                value={String(values[field.key] ?? '')}
                oninput={(e) => (values = { ...values, [field.key]: (e.currentTarget as HTMLInputElement).value })}
                placeholder={field.placeholder ?? ''}
                autocomplete={field.type === 'password' ? 'new-password' : 'off'}
                class="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-accent-cyan transition-colors min-h-[40px] font-mono"
              />
            {/if}
          </div>
        {/each}

        <div class="pt-3 flex items-center justify-end gap-2 border-t border-border-subtle">
          <button
            type="button"
            onclick={onClose}
            class="px-4 py-2 rounded-md border border-border-subtle text-text-muted hover:text-text-primary hover:border-accent-cyan transition text-sm min-h-[40px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            class="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent-cyan text-bg-deep text-sm font-semibold hover:brightness-95 transition min-h-[40px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if submitting}
              <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" opacity="0.25" />
                <path d="M22 12a10 10 0 0 0-10-10" />
              </svg>
              Saving…
            {:else}
              Save
            {/if}
          </button>
        </div>
      </form>
    {/if}
  </div>
</div>
