<script lang="ts">
  interface Props {
    source: string;
  }

  let { source }: Props = $props();
  let svg = $state<string | null>(null);
  let error = $state<string | null>(null);

  $effect(() => {
    let cancelled = false;
    svg = null;
    error = null;

    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, theme: 'dark' });
        const id = `mmd-${Math.random().toString(36).slice(2, 10)}`;
        const { svg: out } = await mermaid.render(id, source);
        if (!cancelled) svg = out;
      } catch (err) {
        if (!cancelled) error = (err as Error).message;
      }
    })();

    return () => {
      cancelled = true;
    };
  });
</script>

{#if error}
  <div class="mb-2 text-xs text-red-300">Mermaid render failed: {error}</div>
  <pre data-renderer-error="mermaid"><code>{source}</code></pre>
{:else if svg}
  <div class="md-mermaid" data-renderer-ready="mermaid">
    {@html svg}
  </div>
{:else}
  <div class="text-xs text-text-muted italic">Rendering diagram...</div>
{/if}
