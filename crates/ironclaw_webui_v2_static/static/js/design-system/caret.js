/**
 * Caret — the product's single sign of life.
 *
 * A square block glyph (▌) in the one accent that marks where a hand is acting,
 * the same semantic everywhere it appears:
 *   state="live"   — the focused composer (your prompt) or a live gate awaiting
 *                    your key. Blinks (one opacity step).
 *   state="dimmed" — the agent's in-flight run. Solid, lowered opacity.
 *   state="solid"  — a static marker (e.g. a cooled receipt preview). No blink.
 *
 * The blink lives in app.css (.v2-caret--live) behind prefers-reduced-motion,
 * so reduced-motion users always get a solid lit caret. This is the whole
 * motion budget — there is no other blinking element in the product.
 */
import { html } from '../lib/html.js';
import { cn } from '../utils/cn.js';

const GLYPH = '▌';

export function Caret({ state = 'live', className = '', ariaLabel = '' }) {
  const stateClass =
    state === 'dimmed'
      ? 'v2-caret v2-caret--dimmed'
      : state === 'solid'
        ? 'v2-caret'
        : 'v2-caret v2-caret--live';
  return html`
    <span
      aria-hidden=${ariaLabel ? undefined : 'true'}
      aria-label=${ariaLabel || undefined}
      role=${ariaLabel ? 'img' : undefined}
      className=${cn('inline-block', stateClass, className)}
      >${GLYPH}</span
    >
  `;
}
