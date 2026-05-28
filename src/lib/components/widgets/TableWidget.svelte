<script lang="ts">
  import type { Widget as WidgetModel } from '$lib/api/types';
  import Widget from './Widget.svelte';

  interface TablePayload {
    headers?: unknown[];
    rows?: unknown[][];
  }

  interface Props {
    widget: WidgetModel;
    surface: 'dashboard' | 'canvas' | 'chat';
  }

  let { widget, surface }: Props = $props();

  function cellText(value: unknown): string {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  }

  const table = $derived.by(() => {
    const payload = widget.payload as TablePayload;
    const headers = Array.isArray(payload?.headers) ? payload.headers.map(cellText) : [];
    const rows = Array.isArray(payload?.rows)
      ? payload.rows.map((row) => (Array.isArray(row) ? row.map(cellText) : []))
      : [];
    return { headers, rows };
  });
</script>

<Widget {widget} {surface}>
  {#if table.headers.length > 0}
    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-left text-xs">
        <thead class="bg-accent-cyan/5 text-text-primary">
          <tr>
            {#each table.headers as header}
              <th class="border-b border-border-subtle px-2 py-1.5 font-semibold">{header}</th>
            {/each}
          </tr>
        </thead>
        <tbody class="text-text-muted">
          {#each table.rows as row}
            <tr class="hover:bg-white/[0.025]">
              {#each table.headers as _, i}
                <td class="border-b border-border-subtle px-2 py-1.5 align-top">
                  {row[i] ?? ''}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <pre class="overflow-x-auto rounded-md bg-bg-surface p-2 text-xs text-text-muted">{cellText(
        widget.payload
      )}</pre>
  {/if}
</Widget>
