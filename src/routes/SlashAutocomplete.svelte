<script lang="ts">
  // Slash-command autocomplete for the chat composer. Shows a dropdown
  // anchored above the textarea when the user has typed a `/` token at
  // the start of the message or after whitespace. Filter is a fuzzy
  // subsequence match on the skill name + usage_hint; keyboard cycles
  // (↓/↑ Enter Tab Esc), mouse clicks insert.
  //
  // The parent owns the textarea, the textual `input` value, and the
  // current `caret` position. We compute the slash slice ourselves so
  // the parent doesn't have to know about token boundaries, and we
  // return a replacement instruction (start/end indices + text) on
  // `onPick` so the parent's draft-save effect runs through its normal
  // input pipeline.

  import { untrack } from 'svelte';
  import type { Skill } from '$lib/api/types';

  interface Props {
    /** Composer textarea — used to anchor the dropdown above its top edge. */
    anchor: HTMLTextAreaElement | null;
    /** Current composer text. Read-only from this component's perspective. */
    value: string;
    /** Caret offset in `value`. */
    caret: number;
    /** Full skill list (already cached by the parent). */
    skills: Skill[];
    /**
     * Notify parent that a pick happened. The parent splices
     * `value[0..start] + text + value[end..]` and moves the caret to
     * `start + text.length`.
     */
    onPick: (
      start: number,
      end: number,
      text: string
    ) => void;
  }

  let { anchor, value, caret, skills, onPick }: Props = $props();

  // -- token detection -------------------------------------------------------
  /**
   * Locate the active slash token. Returns the start index of the `/` and
   * the query characters that follow it (up to the caret), or null if the
   * caret isn't sitting inside a slash token. A token only counts when the
   * `/` is the FIRST character of the buffer or is preceded by whitespace,
   * and the query so far contains no whitespace.
   */
  function findSlashToken(
    text: string,
    pos: number
  ): { start: number; query: string } | null {
    if (pos <= 0 || pos > text.length) return null;
    // Walk backwards from the caret looking for the `/` that anchors this
    // token. Stop at any whitespace, which would terminate the token.
    let i = pos - 1;
    while (i >= 0) {
      const ch = text[i];
      if (ch === '/') {
        // Validate the boundary BEFORE the slash.
        if (i === 0 || /\s/u.test(text[i - 1] ?? '')) {
          return { start: i, query: text.slice(i + 1, pos) };
        }
        return null;
      }
      if (/\s/u.test(ch ?? '')) return null;
      i -= 1;
    }
    return null;
  }

  const token = $derived(findSlashToken(value, caret));
  const open = $derived(token !== null);

  // -- filtering -------------------------------------------------------------
  // Subsequence match: query chars must appear in order inside `target`
  // (case-insensitive). Returns the matched index array for highlight
  // rendering, or null if no match.
  function subseq(target: string, query: string): number[] | null {
    if (query.length === 0) return [];
    const t = target.toLowerCase();
    const q = query.toLowerCase();
    const idx: number[] = [];
    let j = 0;
    for (let i = 0; i < t.length && j < q.length; i += 1) {
      if (t[i] === q[j]) {
        idx.push(i);
        j += 1;
      }
    }
    return j === q.length ? idx : null;
  }

  interface Match {
    skill: Skill;
    /** Display label — usage_hint preferred, falls back to `/${name}`. */
    label: string;
    /** Highlighted indices on the label. */
    labelMatches: number[];
    /** Quick rank — lower is better. */
    rank: number;
  }

  function rankMatch(
    label: string,
    name: string,
    query: string
  ): { matches: number[] | null; rank: number } {
    // Match against the label first because that's what the user sees and
    // most commonly types (`/code-review` not `code-review`). Fall back
    // to the skill name (without the leading `/`) for skills that don't
    // ship a usage_hint.
    const stripped = label.startsWith('/') ? label.slice(1) : label;
    const q = query.replace(/^\//u, '');
    // Try several targets — pick the one with the tightest match.
    const targets = [stripped, name];
    let best: { matches: number[]; rank: number } | null = null;
    for (const target of targets) {
      const m = subseq(target, q);
      if (m === null) continue;
      // Rank: prefix-match beats sparse match. Use the gap between the
      // first and last matched index as a rough tightness metric, with
      // a strong bonus for matching at index 0.
      const tightness = m.length > 0 ? m[m.length - 1] - m[0] : 0;
      const prefixBonus = m.length > 0 && m[0] === 0 ? 0 : 1;
      const rank = prefixBonus * 100 + tightness;
      if (!best || rank < best.rank) {
        // Translate name-matches back to label-matches if we used the
        // label target. For name matches we don't highlight on the label
        // (the label is the primary display, but the name fallback only
        // fires when the labels were ALL non-matching, so this is rare).
        const labelMatches = target === stripped ? m.map((i) => i + (label.startsWith('/') ? 1 : 0)) : [];
        best = { matches: labelMatches, rank };
      }
    }
    return best ? { matches: best.matches, rank: best.rank } : { matches: null, rank: 0 };
  }

  const matches = $derived<Match[]>(
    !token
      ? []
      : skills
          .map((s) => {
            const label = s.usage_hint && s.usage_hint.startsWith('/') ? s.usage_hint : `/${s.name}`;
            const { matches: m, rank } = rankMatch(label, s.name, token.query);
            if (m === null) return null;
            return { skill: s, label, labelMatches: m, rank };
          })
          .filter((m): m is Match => m !== null)
          .sort((a, b) => a.rank - b.rank)
          .slice(0, 8)
  );

  // -- keyboard navigation ---------------------------------------------------
  let active = $state(0);

  // Reset selection whenever the candidate list shrinks underneath us so
  // `active` doesn't point past the end. We only depend on the list
  // length; the read of `active` is wrapped in `untrack` to prevent a
  // self-retriggering effect.
  $effect(() => {
    const len = matches.length;
    untrack(() => {
      if (active >= len) active = 0;
    });
  });

  /**
   * Public-ish: parent calls this in the textarea's keydown handler
   * BEFORE its own logic runs. Returns true if we consumed the event
   * (so the parent should preventDefault + skip its own send-on-Enter).
   */
  export function handleKey(e: KeyboardEvent): boolean {
    if (!open) return false;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (matches.length > 0) active = (active + 1) % matches.length;
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (matches.length > 0) active = (active - 1 + matches.length) % matches.length;
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      // Only consume if we actually have a match to insert. An empty list
      // (e.g. user typed `/zzzzz`) should fall through so Enter still sends.
      if (matches.length === 0) return false;
      e.preventDefault();
      pick(active);
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      // We have no internal close state — caret-position changes drive
      // visibility. Pretend the parent consumed the event by moving the
      // dropdown out of the way: we re-emit `onPick` with the same range
      // and no change so the parent re-renders without a token? Simpler:
      // we expose a `dismiss` flag that the parent reads.
      dismissed = true;
      return true;
    }
    return false;
  }

  // Esc dismissal — sticky until the user types something new or moves
  // the caret out of the token. Re-enables when the token boundary shifts.
  let dismissed = $state(false);
  let lastTokenStart = $state<number | null>(null);
  $effect(() => {
    const start = token?.start ?? null;
    if (start !== lastTokenStart) {
      dismissed = false;
      lastTokenStart = start;
    }
  });

  const visible = $derived(open && !dismissed && matches.length > 0);

  // -- pick handler ----------------------------------------------------------
  function pick(i: number) {
    if (!token) return;
    const m = matches[i];
    if (!m) return;
    // Replace [token.start .. caret] with the canonical label. Append a
    // trailing space so the user can keep typing arguments without
    // re-triggering the dropdown.
    const replacement = `${m.label} `;
    onPick(token.start, caret, replacement);
    dismissed = true;
  }

  function truncate(s: string | undefined, n: number): string {
    if (!s) return '';
    return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
  }

  // -- rendering helpers -----------------------------------------------------
  // Pre-compute a highlight segments array for each match label so the
  // template stays declarative. Each segment is { text, hit }.
  interface Seg {
    text: string;
    hit: boolean;
  }
  function highlightSegments(label: string, hits: number[]): Seg[] {
    if (hits.length === 0) return [{ text: label, hit: false }];
    const segs: Seg[] = [];
    let cursor = 0;
    for (const idx of hits) {
      if (idx > cursor) segs.push({ text: label.slice(cursor, idx), hit: false });
      segs.push({ text: label.charAt(idx), hit: true });
      cursor = idx + 1;
    }
    if (cursor < label.length) segs.push({ text: label.slice(cursor), hit: false });
    return segs;
  }

  // -- positioning -----------------------------------------------------------
  // The dropdown is rendered inside this component but absolutely positioned
  // RELATIVE TO ITS PARENT WRAPPER, which the consumer places adjacent to
  // the textarea. We don't measure the textarea ourselves — the parent
  // composer sets `position: relative` on the immediate ancestor, and we
  // anchor `bottom: 100%` so the dropdown grows upward. The `anchor` prop
  // is unused today; kept on the API for future caret-anchored positioning.
  $effect(() => {
    void anchor;
  });
</script>

{#if visible}
  <div
    class="absolute left-0 right-0 bottom-full mb-2 z-30 max-h-72 overflow-y-auto rounded-md border border-border-subtle bg-bg-surface shadow-xl"
    role="listbox"
    aria-label="Slash commands"
  >
    <ul class="py-1">
      {#each matches as m, i (m.skill.name)}
        {@const isActive = i === active}
        {@const segs = highlightSegments(m.label, m.labelMatches)}
        <li>
          <button
            type="button"
            role="option"
            aria-selected={isActive}
            onmousedown={(e) => {
              // Prevent the textarea from losing focus before the click
              // fires — the blur would otherwise close the dropdown.
              e.preventDefault();
            }}
            onclick={() => pick(i)}
            onmouseenter={() => (active = i)}
            class="w-full flex items-start gap-2 px-3 py-2 text-left transition-colors"
            class:bg-accent-cyan={isActive}
            class:text-bg-deep={isActive}
            class:hover:bg-bg-deep={!isActive}
            class:text-text-primary={!isActive}
          >
            <svg
              viewBox="0 0 24 24"
              class="w-4 h-4 mt-0.5 shrink-0"
              class:text-bg-deep={isActive}
              class:text-accent-gold={!isActive}
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            <div class="flex-1 min-w-0">
              <div class="font-mono text-xs truncate"
                class:text-bg-deep={isActive}
                class:text-accent-cyan={!isActive}
              >
                {#each segs as seg, idx (idx)}
                  {#if seg.hit}
                    <span
                      class="font-bold"
                      class:underline={isActive}
                    >{seg.text}</span>
                  {:else}
                    <span>{seg.text}</span>
                  {/if}
                {/each}
              </div>
              <div
                class="text-[11px] truncate"
                class:text-bg-deep={isActive}
                class:text-text-muted={!isActive}
              >
                {truncate(m.skill.description, 60)}
              </div>
            </div>
          </button>
        </li>
      {/each}
    </ul>
  </div>
{/if}
