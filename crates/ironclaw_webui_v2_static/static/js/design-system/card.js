/**
 * Card / Panel
 *
 * Replaces the old .v2-panel CSS class with a proper React component.
 * All styling is via Tailwind arbitrary values backed by CSS variables so
 * light ↔ dark theme switching is automatic.
 *
 * Props
 *   variant   "default" | "bordered" | "subtle" | "inset" | "plain" | "soft"
 *   radius    "sm" | "md" (default) | "lg"
 *   padding   "none" (default) | "sm" | "md" | "lg"
 *   as        element tag, default "div"
 *   className string — layout / spacing additions
 *   children
 *
 * Sub-components (all optional, compose freely)
 *   <CardHeader>   — top section, optional bottom divider
 *   <CardBody>     — main content area
 *   <CardFooter>   — bottom section, optional top divider
 *   <CardLabel>    — quiet sentence-case eyebrow label
 *
 * Header/Body/Footer take a padding="none" | "md" (default) prop. Default
 * "md" keeps the standard section gutter; pair padding="none" with a
 * padding="none" Card to control gutters manually and avoid double-padding.
 */
import { html } from '../lib/html.js';
import { cn } from '../utils/cn.js';

/* ─── Variant ─────────────────────────────────────────────────────── */
// --v2-card-bg     : solid panel surface
// --v2-card-border : transparent in dark (shadow-only), subtle in light
// --v2-card-shadow : generally none; panels lift through borders/surface only

// Warm-light default: surfaces lean on whitespace + hairlines, not heavy boxes.
// `plain` is the de-boxed default (no border, no fill — pure layout container);
// `soft` is the ONE allowed soft framed surface per region (e.g. a composer).
const VARIANTS = {
  default: 'bg-[var(--v2-card-bg)] border border-[var(--v2-card-border)]',
  bordered: 'bg-[var(--v2-card-bg)] border border-[var(--v2-panel-border)]',
  subtle: 'bg-[var(--v2-surface-soft)] border border-[var(--v2-panel-border)]',
  inset: 'bg-[var(--v2-surface-muted)] border border-[var(--v2-panel-border)]',
  plain: 'bg-transparent border border-transparent',
  soft: 'bg-[var(--v2-surface-soft)] border border-[var(--v2-panel-border)]'
};

/* ─── Radius ──────────────────────────────────────────────────────── */

const RADII = {
  sm: 'rounded-[var(--v2-radius-control)]',
  md: 'rounded-[var(--v2-radius-card)]',
  lg: 'rounded-[var(--v2-radius-shell)]'
};

/* ─── Padding ─────────────────────────────────────────────────────── */

const PADDINGS = {
  none: '',
  sm: 'p-3.5',
  md: 'p-4',
  lg: 'p-5 md:p-6'
};

/* ─── Section padding ─────────────────────────────────────────────────
   Gutters for CardHeader/CardBody/CardFooter. A `padding='none'` Card with
   `padding='none'` sub-components renders a single, manually-controlled
   gutter instead of double-padding. */

const SECTION_PADDINGS = {
  none: '',
  md: 'px-5 py-4 md:px-7 md:py-5'
};

/* ─── Card ────────────────────────────────────────────────────────── */

export function Card({
  children,
  className = '',
  variant = 'default',
  radius = 'md',
  padding = 'none',
  as: Tag = 'div',
  ...rest
}) {
  return html`
    <${Tag}
      className=${cn(
        VARIANTS[variant] ?? VARIANTS.default,
        RADII[radius] ?? RADII.md,
        PADDINGS[padding] ?? '',
        className
      )}
      ...${rest}
    >
      ${children}
    <//>
  `;
}

/* ─── CardHeader ──────────────────────────────────────────────────── */

export function CardHeader({ children, className = '', divider = false, padding = 'md' }) {
  return html`
    <div
      className=${cn(
        SECTION_PADDINGS[padding] ?? SECTION_PADDINGS.md,
        divider && 'border-b border-[var(--v2-panel-border)]',
        className
      )}
    >
      ${children}
    </div>
  `;
}

/* ─── CardBody ────────────────────────────────────────────────────── */

export function CardBody({ children, className = '', padding = 'md' }) {
  return html`
    <div className=${cn(SECTION_PADDINGS[padding] ?? SECTION_PADDINGS.md, className)}>
      ${children}
    </div>
  `;
}

/* ─── CardFooter ──────────────────────────────────────────────────── */

export function CardFooter({ children, className = '', divider = true, padding = 'md' }) {
  return html`
    <div
      className=${cn(
        SECTION_PADDINGS[padding] ?? SECTION_PADDINGS.md,
        divider && 'border-t border-[var(--v2-panel-border)]',
        className
      )}
    >
      ${children}
    </div>
  `;
}

/* ─── CardLabel ───────────────────────────────────────────────────── */

/** Quiet sentence-case eyebrow label — sits above section headings. */
export function CardLabel({ children, className = '' }) {
  return html`
    <div className=${cn('text-[13px] font-medium text-[var(--v2-text-muted)]', className)}>
      ${children}
    </div>
  `;
}
