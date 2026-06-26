/**
 * Card / Panel
 *
 * Replaces the old .v2-panel CSS class with a proper React component.
 * All styling is via Tailwind arbitrary values backed by CSS variables so
 * light ↔ dark theme switching is automatic.
 *
 * Props
 *   variant   "default" | "bordered" | "subtle" | "inset"
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
 *   <CardLabel>    — mono-caps eyebrow label
 */
import { html } from '../lib/html.js';
import { cn } from '../utils/cn.js';

/* ─── Variant ─────────────────────────────────────────────────────── */
// --v2-card-bg     : solid panel surface
// --v2-card-border : transparent in dark (shadow-only), subtle in light
// --v2-card-shadow : generally none; panels lift through borders/surface only

const VARIANTS = {
  default:
    'bg-[var(--v2-card-bg)] border border-[var(--v2-card-border)] shadow-[var(--v2-card-shadow)]',
  bordered:
    'bg-[var(--v2-card-bg)] border border-[var(--v2-panel-border)] shadow-[var(--v2-card-shadow)]',
  subtle: 'bg-[var(--v2-surface-soft)] border border-[var(--v2-panel-border)]',
  inset: 'bg-[var(--v2-surface-muted)] border border-[var(--v2-panel-border)]'
};

/* ─── Radius ──────────────────────────────────────────────────────── */

const RADII = {
  sm: 'rounded-[6px]',
  md: 'rounded-[8px]',
  lg: 'rounded-[10px]'
};

/* ─── Padding ─────────────────────────────────────────────────────── */

const PADDINGS = {
  none: '',
  sm: 'p-3.5',
  md: 'p-4',
  lg: 'p-5 md:p-6'
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

export function CardHeader({ children, className = '', divider = false }) {
  return html`
    <div
      className=${cn(
        'px-4 py-3.5 md:px-6 md:py-4',
        divider && 'border-b border-[var(--v2-panel-border)]',
        className
      )}
    >
      ${children}
    </div>
  `;
}

/* ─── CardBody ────────────────────────────────────────────────────── */

export function CardBody({ children, className = '' }) {
  return html` <div className=${cn('px-4 py-3.5 md:px-6 md:py-4', className)}>${children}</div> `;
}

/* ─── CardFooter ──────────────────────────────────────────────────── */

export function CardFooter({ children, className = '', divider = true }) {
  return html`
    <div
      className=${cn(
        'px-4 py-3.5 md:px-6 md:py-4',
        divider && 'border-t border-[var(--v2-panel-border)]',
        className
      )}
    >
      ${children}
    </div>
  `;
}

/* ─── CardLabel ───────────────────────────────────────────────────── */

/** Mono-caps eyebrow label — sits above section headings. */
export function CardLabel({ children, className = '' }) {
  return html`
    <div
      className=${cn(
        'font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--v2-text-faint)]',
        className
      )}
    >
      ${children}
    </div>
  `;
}
