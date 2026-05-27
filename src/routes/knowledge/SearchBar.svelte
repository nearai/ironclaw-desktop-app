<script lang="ts">
  // Debounced text input for memory search. Bubbles up the value via
  // onChange — the parent owns query state so it can clear it from the
  // results panel too.

  interface Props {
    value: string;
    onChange: (next: string) => void;
    /** Called when the user presses Enter — fires immediately, bypassing debounce. */
    onSubmit: (value: string) => void;
    /** When true, show the spinner glyph in the right edge. */
    pending?: boolean;
    /** Disable the input (e.g. when offline). */
    disabled?: boolean;
  }

  let { value, onChange, onSubmit, pending = false, disabled = false }: Props = $props();

  const DEBOUNCE_MS = 250;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function onInput(ev: Event) {
    const next = (ev.target as HTMLInputElement).value;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      onChange(next);
      timer = null;
    }, DEBOUNCE_MS);
  }

  function onKeydown(ev: KeyboardEvent) {
    if (ev.key === 'Enter') {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const v = (ev.currentTarget as HTMLInputElement).value;
      onSubmit(v);
    }
  }
</script>

<div class="relative">
  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
    <svg
      viewBox="0 0 24 24"
      class="w-4 h-4"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  </span>
  <input
    type="text"
    {value}
    {disabled}
    oninput={onInput}
    onkeydown={onKeydown}
    placeholder="Search the knowledge base…"
    class="w-full bg-bg-deep border border-border-subtle rounded-md pl-10 pr-10 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
  />
  {#if pending}
    <span class="absolute right-3 top-1/2 -translate-y-1/2 text-accent-cyan">
      <svg
        viewBox="0 0 24 24"
        class="w-4 h-4 animate-spin"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="9" stroke-opacity="0.25" />
        <path d="M21 12a9 9 0 0 0-9-9" />
      </svg>
    </span>
  {/if}
</div>
