<script lang="ts">
  interface Props {
    source: string;
  }

  interface PlotlySpec {
    data?: unknown[];
    layout?: Record<string, unknown>;
    config?: Record<string, unknown>;
  }

  interface PlotlyApi {
    newPlot: (
      host: HTMLDivElement,
      data: unknown[],
      layout: Record<string, unknown>,
      config: Record<string, unknown>
    ) => Promise<unknown>;
    purge?: (host: HTMLDivElement) => void;
  }

  let { source }: Props = $props();
  let host = $state<HTMLDivElement | null>(null);
  let error = $state<string | null>(null);

  $effect(() => {
    if (!host) return;

    let cancelled = false;
    let plotly: PlotlyApi | null = null;
    error = null;

    (async () => {
      try {
        const spec = JSON.parse(source) as PlotlySpec;
        if (!Array.isArray(spec.data)) {
          throw new Error('Plotly spec must include a data array');
        }

        // plotly.js-dist-min does not consistently ship declarations across versions.
        // @ts-ignore
        const mod = (await import('plotly.js-dist-min')) as { default: PlotlyApi };
        plotly = mod.default;
        if (cancelled || !host) return;

        await plotly.newPlot(host, spec.data, spec.layout ?? {}, {
          responsive: true,
          displayModeBar: false,
          ...(spec.config ?? {})
        });
      } catch (err) {
        if (!cancelled) error = (err as Error).message;
      }
    })();

    return () => {
      cancelled = true;
      if (plotly && host) plotly.purge?.(host);
    };
  });
</script>

{#if error}
  <div class="mb-2 text-xs text-red-300">Plotly render failed: {error}</div>
  <pre data-renderer-error="plotly"><code>{source}</code></pre>
{:else}
  <div bind:this={host} class="w-full plotly" data-renderer-ready="plotly"></div>
{/if}
