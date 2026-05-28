<script lang="ts">
  // Spatial canvas route (R84 / lane W7).
  //
  // The research-mode surface: an infinite, pannable, zoomable workspace
  // where notes / threads / widgets become draggable node cards connected
  // by arrows. See docs/WORKSPACE-OS.md §"Spatial canvas".
  //
  // Implementation note (commit body has the full rationale): this is a
  // LIGHTWEIGHT native-Svelte canvas, NOT a tldraw embed. tldraw is ~600 KB
  // with a heavy React runtime that doesn't compose with Svelte 5 runes
  // without a brittle React-in-Svelte bridge. A CSS-transform viewport +
  // absolute-positioned cards + an SVG arrow overlay gives the same
  // research-graph UX with zero new deps and no interop layer.
  //
  // This route owns the surface-level orchestration: the floating toolbar
  // (+ Note / zoom / Fit), the pending-arrow handshake between two nodes,
  // and the "Ask this node…" stub (toasts "coming soon" until the gateway
  // wire lands as a follow-up). All node/edge/viewport state lives in the
  // canvas store; the components are thin views over it.

  import CanvasArrows from '$lib/components/canvas/CanvasArrows.svelte';
  import CanvasNode from '$lib/components/canvas/CanvasNode.svelte';
  import CanvasViewport from '$lib/components/canvas/CanvasViewport.svelte';
  import {
    canvas,
    DEFAULT_NODE_HEIGHT,
    DEFAULT_NODE_WIDTH,
    MAX_ZOOM,
    MIN_ZOOM
  } from '$lib/stores/canvas.svelte';
  import { toasts } from '$lib/stores/toasts.svelte';

  // The viewport fills the route; we read its size to centre new notes and
  // to compute the Fit transform.
  let stageEl = $state<HTMLDivElement | null>(null);

  function stageSize(): { w: number; h: number } {
    const r = stageEl?.getBoundingClientRect();
    return { w: r?.width ?? 1000, h: r?.height ?? 700 };
  }

  /** Convert the centre of the current viewport into canvas-space coords,
   *  so a new note lands where the user is looking regardless of pan/zoom. */
  function viewportCentreInCanvas(): { x: number; y: number } {
    const { w, h } = stageSize();
    const z = canvas.zoom || 1;
    return {
      x: (w / 2 - canvas.panX) / z - DEFAULT_NODE_WIDTH / 2,
      y: (h / 2 - canvas.panY) / z - DEFAULT_NODE_HEIGHT / 2
    };
  }

  // Cascade successive adds a little so they don't stack pixel-perfect.
  let addNudge = 0;

  function addNote(): void {
    const c = viewportCentreInCanvas();
    const off = (addNudge % 5) * 26;
    addNudge += 1;
    canvas.addNote(c.x + off, c.y + off);
  }

  // ---- Pending-arrow handshake ------------------------------------------
  // ⋮ → "Start arrow" sets a source; clicking another card completes it.
  let arrowFrom = $state<string | null>(null);

  function onStartArrow(id: string): void {
    arrowFrom = id;
    toasts.show('Click another node to connect', 'info');
  }

  function onPick(id: string): void {
    if (!arrowFrom) return;
    if (arrowFrom === id) {
      // Clicking the source again cancels.
      arrowFrom = null;
      return;
    }
    canvas.connect(arrowFrom, id);
    arrowFrom = null;
  }

  function onAsk(_id: string, _prompt: string): void {
    // v1 stub — the actual gateway send is a follow-up. Surface intent.
    toasts.show('Ask-this-node is coming soon', 'info');
  }

  // ---- Zoom controls ----------------------------------------------------
  const zoomPct = $derived(Math.round(canvas.zoom * 100));

  function zoomBy(factor: number): void {
    // Zoom about the viewport centre so the focus point is stable.
    const { w, h } = stageSize();
    const oldZoom = canvas.zoom || 1;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * factor));
    if (newZoom === oldZoom) return;
    const cx = w / 2;
    const cy = h / 2;
    const worldX = (cx - canvas.panX) / oldZoom;
    const worldY = (cy - canvas.panY) / oldZoom;
    canvas.setPan(cx - worldX * newZoom, cy - worldY * newZoom);
    canvas.setZoom(newZoom);
  }

  /** Frame all nodes: reset zoom to 1 and pan so the nodes' bounding box is
   *  centred. With no nodes, recentre the origin. */
  function fit(): void {
    const { w, h } = stageSize();
    if (canvas.nodes.length === 0) {
      canvas.setZoom(1);
      canvas.setPan(w / 2, h / 2);
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of canvas.nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }
    const pad = 80;
    const bw = maxX - minX + pad * 2;
    const bh = maxY - minY + pad * 2;
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(w / bw, h / bh, 1)));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    canvas.setZoom(z);
    canvas.setPan(w / 2 - cx * z, h / 2 - cy * z);
  }

  function clearAll(): void {
    if (canvas.nodes.length === 0) return;
    canvas.clear();
    arrowFrom = null;
    toasts.show('Canvas cleared', 'info');
  }
</script>

<svelte:head><title>Canvas · IronClaw</title></svelte:head>

<div class="relative w-full h-full" bind:this={stageEl}>
  <CanvasViewport>
    <CanvasArrows />
    {#each canvas.nodes as node (node.id)}
      <CanvasNode
        {node}
        arrowSource={arrowFrom === node.id}
        onstartarrow={onStartArrow}
        onpick={onPick}
        onask={onAsk}
      />
    {/each}
  </CanvasViewport>

  <!-- Floating toolbar (top-left). -->
  <div
    class="absolute top-4 left-4 z-30 flex items-center gap-1.5 rounded-lg border
           border-border-subtle bg-bg-surface/90 backdrop-blur px-2 py-1.5 shadow-xl"
  >
    <button
      type="button"
      class="text-xs px-2.5 py-1 rounded bg-accent-cyan/15 text-accent-cyan
             hover:bg-accent-cyan/25 font-medium"
      onclick={addNote}
    >
      + Note
    </button>

    <div class="w-px h-5 bg-border-subtle"></div>

    <button
      type="button"
      class="text-xs w-6 py-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-deep"
      onclick={() => zoomBy(1 / 1.2)}
      aria-label="Zoom out"
    >
      −
    </button>
    <button
      type="button"
      class="text-xs w-12 py-1 rounded text-text-muted hover:text-text-primary tabular-nums"
      onclick={() => canvas.setZoom(1)}
      title="Reset zoom to 100%"
    >
      {zoomPct}%
    </button>
    <button
      type="button"
      class="text-xs w-6 py-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-deep"
      onclick={() => zoomBy(1.2)}
      aria-label="Zoom in"
    >
      +
    </button>

    <div class="w-px h-5 bg-border-subtle"></div>

    <button
      type="button"
      class="text-xs px-2.5 py-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-deep"
      onclick={fit}
    >
      Fit
    </button>
    {#if canvas.nodes.length > 0}
      <button
        type="button"
        class="text-xs px-2.5 py-1 rounded text-text-muted hover:text-danger hover:bg-danger/10"
        onclick={clearAll}
      >
        Clear
      </button>
    {/if}
  </div>

  <!-- Pending-arrow hint. -->
  {#if arrowFrom}
    <div
      class="absolute top-4 left-1/2 -translate-x-1/2 z-30 rounded-full border border-accent-gold/50
             bg-bg-surface/90 backdrop-blur px-3 py-1 text-xs text-accent-gold shadow-lg"
    >
      Click a node to connect · Esc cancels
    </div>
  {/if}

  <!-- Empty-state hint. -->
  {#if canvas.nodes.length === 0}
    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div class="text-center max-w-sm px-6">
        <div class="text-sm text-text-primary font-medium mb-1">Your canvas is empty</div>
        <p class="text-xs text-text-muted leading-relaxed">
          Add a note to start mapping ideas. Drag cards to arrange them, use the ⋮ menu to draw
          arrows between them, and scroll to pan — hold ⌘ and scroll to zoom.
        </p>
      </div>
    </div>
  {/if}
</div>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape' && arrowFrom) arrowFrom = null;
  }}
/>
