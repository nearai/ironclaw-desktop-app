<script lang="ts">
  import type { Skill } from '$lib/api/types';

  type Props = {
    skill: Skill;
    onOpen: (skill: Skill) => void;
    onRun: (skill: Skill) => void;
  };

  const { skill, onOpen, onRun }: Props = $props();

  /**
   * Trust badge metadata. The task spec defines three first-class values
   * (`Bundled`, `Verified`, `Unverified`) styled distinctly. Any other value
   * the server emits is ignored so the badge doesn't render — preferable to
   * surfacing a garbled label and pretending it has a meaning we don't know.
   */
  type BadgeClass = {
    label: string;
    classes: string;
    warn: boolean;
  };

  const trustBadge = $derived.by<BadgeClass | null>(() => {
    const t = skill.trust;
    if (!t) return null;
    switch (t) {
      case 'Bundled':
        return {
          label: 'Bundled',
          classes:
            'border-accent-cyan/60 text-accent-cyan bg-accent-cyan/10',
          warn: false
        };
      case 'Verified':
        return {
          label: 'Verified',
          classes:
            'border-emerald-400/60 text-emerald-300 bg-emerald-500/10',
          warn: false
        };
      case 'Unverified':
        return {
          label: 'Unverified',
          classes:
            'border-accent-gold/60 text-accent-gold bg-accent-gold/10',
          warn: true
        };
      default:
        return null;
    }
  });

  /**
   * Pull a slash token out of the server's `usage_hint`. The server emits a
   * sentence like "Type `/foo` in chat to force-activate this skill." — we
   * extract the backtick-delimited token. Falls back to the derived heuristic.
   */
  const usageHint = $derived.by(() => {
    const raw = skill.usage_hint;
    if (raw) {
      const m = raw.match(/`([^`]+)`/);
      if (m) return m[1];
      const trimmed = raw.trim();
      if (trimmed.startsWith('/')) return trimmed.split(/\s+/)[0];
    }
    return `/${skill.name}`;
  });

  function handleRunClick(event: MouseEvent) {
    // Don't bubble up to the card's onclick handler.
    event.stopPropagation();
    onRun(skill);
  }

  function handleKey(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(skill);
    }
  }
</script>

<div
  role="button"
  tabindex="0"
  onclick={() => onOpen(skill)}
  onkeydown={handleKey}
  class="group relative flex flex-col rounded-lg border border-border-subtle bg-bg-surface p-4 cursor-pointer transition-colors hover:bg-[#1a2233] hover:border-[#2a3548] focus:outline-none focus:border-accent-cyan min-h-[160px]"
>
  {#if trustBadge}
    <span
      class={`absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${trustBadge.classes}`}
      title={trustBadge.warn
        ? 'Unverified skill — review the source before running on production data.'
        : `Trust level: ${trustBadge.label}`}
    >
      {#if trustBadge.warn}
        <svg
          viewBox="0 0 24 24"
          class="w-2.5 h-2.5"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      {/if}
      {trustBadge.label}
    </span>
  {/if}

  <div class="mb-2 pr-20">
    <h3 class="text-sm font-semibold text-accent-cyan break-words">
      {skill.name}
    </h3>
  </div>

  <p
    class="text-xs text-text-muted leading-relaxed flex-1 overflow-hidden"
    style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;"
  >
    {skill.description || 'No description available.'}
  </p>

  <div
    class="mt-2 text-[11px] font-mono text-accent-cyan/90 truncate"
    title="Run this skill by typing this in chat."
  >
    {usageHint}
  </div>

  <div class="mt-3 pt-3 border-t border-border-subtle flex items-center justify-between">
    <span class="text-[10px] font-mono text-text-muted bg-bg-deep px-2 py-1 rounded">
      v{skill.version || '—'}
    </span>
    <button
      type="button"
      onclick={handleRunClick}
      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent-gold text-bg-deep text-xs font-semibold hover:brightness-95 transition min-h-[32px]"
      aria-label={`Run ${skill.name}`}
    >
      <svg viewBox="0 0 24 24" class="w-3 h-3" fill="currentColor" stroke="none">
        <polygon points="6 4 20 12 6 20 6 4" />
      </svg>
      Run
    </button>
  </div>
</div>
