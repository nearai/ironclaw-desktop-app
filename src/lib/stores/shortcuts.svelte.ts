// Rune singleton that tracks the global command-palette visibility.
//
// The palette mounts once at the layout level (`src/routes/+layout.svelte`)
// and reads `palette.open` to render/teardown. Keyboard shortcuts wired in
// the same layout call into this store; per-surface buttons (none yet, but
// e.g. a "press ⌘K" hint in the header) would also import it.

class PaletteStore {
  open = $state<boolean>(false);

  openPalette(): void {
    this.open = true;
  }

  closePalette(): void {
    this.open = false;
  }

  togglePalette(): void {
    this.open = !this.open;
  }
}

/** Global singleton — import this anywhere. */
export const palette = new PaletteStore();
