<script lang="ts">
  interface Props {
    source: string;
    display?: boolean;
  }

  let { source, display = false }: Props = $props();
  let html = $state<string | null>(null);
  let error = $state<string | null>(null);

  $effect(() => {
    let cancelled = false;
    html = null;
    error = null;

    (async () => {
      try {
        const katex = (await import('katex')).default;
        await import('katex/dist/katex.min.css');
        const out = katex.renderToString(source, {
          displayMode: display,
          throwOnError: true,
          output: 'html'
        });
        if (!cancelled) html = out;
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
  <code class="text-xs text-red-300" title={`Math render failed: ${error}`}>{source}</code>
{:else if html}
  <span class={display ? 'block my-2' : 'inline'} data-renderer-ready="math">{@html html}</span>
{:else}
  <code class="text-xs text-text-muted">{source}</code>
{/if}
