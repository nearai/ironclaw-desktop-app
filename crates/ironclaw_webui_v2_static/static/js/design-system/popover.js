import { React, html } from '../lib/html.js';
import { cn } from '../utils/cn.js';

const FOCUSABLE = 'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])';

// Anchored floating panel: renders relative to its trigger's wrapper,
// closes on outside click and Escape. Geometry per DESIGN.md: panels use
// 12px radius, hairline border, quiet shadow.
//
// Usage:
//   <${Popover}
//     open=${open}
//     onClose=${() => setOpen(false)}
//     trigger=${html`<button onClick=${() => setOpen(!open)}>…</button>`}
//     align="end"            // "start" | "end" (horizontal)
//     side="top"             // "top" | "bottom"
//   >…panel content…<//>
export function Popover({
  open,
  onClose,
  trigger,
  align = 'end',
  side = 'top',
  children,
  className,
  ariaLabel = 'Popover'
}) {
  const rootRef = React.useRef(null);
  const panelRef = React.useRef(null);
  const restoreFocusRef = React.useRef(null);
  const [panelStyle, setPanelStyle] = React.useState(null);

  const updatePanelPosition = React.useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const gap = 8;
    const margin = 8;
    const maxPanelWidth = Math.min(340, viewportWidth - margin * 2);
    const style = {
      maxHeight: `${
        side === 'top'
          ? Math.max(180, rect.top - gap - margin)
          : Math.max(180, viewportHeight - rect.bottom - gap - margin)
      }px`,
      maxWidth: `calc(100vw - ${margin * 2}px)`,
      overflowY: 'auto'
    };

    if (side === 'top') {
      style.bottom = `${Math.max(margin, viewportHeight - rect.top + gap)}px`;
    } else {
      style.top = `${Math.min(viewportHeight - margin, rect.bottom + gap)}px`;
    }

    if (align === 'end') {
      style.right = `${Math.max(margin, viewportWidth - rect.right)}px`;
    } else {
      style.left = `${Math.min(
        Math.max(margin, rect.left),
        Math.max(margin, viewportWidth - maxPanelWidth - margin)
      )}px`;
    }

    setPanelStyle(style);
  }, [align, side]);

  React.useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null);
      return undefined;
    }
    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);
    return () => {
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [open, updatePanelPosition]);

  React.useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) onClose?.();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  /* Move focus into the panel on open and return it to the opener on close, so
     keyboard users are never stranded behind the open dialog (mirrors Modal). */
  React.useEffect(() => {
    if (!open) return undefined;
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const id = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target = panel.querySelector(FOCUSABLE);
      (target instanceof HTMLElement ? target : panel).focus();
    });
    return () => {
      window.cancelAnimationFrame(id);
      restoreFocusRef.current?.focus?.();
      restoreFocusRef.current = null;
    };
  }, [open]);

  /* Trap Tab / Shift-Tab inside the panel while open. */
  const onPanelKeyDown = React.useCallback((event) => {
    if (event.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const items = Array.from(panel.querySelectorAll(FOCUSABLE)).filter(
      (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
    );
    if (items.length === 0) {
      event.preventDefault();
      panel.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const activeEl = document.activeElement;
    if (event.shiftKey && (activeEl === first || activeEl === panel)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && activeEl === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  const position = [
    'fixed z-50 min-w-[260px] max-w-[340px]',
    panelStyle ? '' : 'invisible pointer-events-none'
  ].join(' ');

  return html`
    <div ref=${rootRef} className="relative inline-flex">
      ${trigger}
      ${open &&
      html`
        <div
          ref=${panelRef}
          tabindex=${-1}
          role="dialog"
          aria-label=${ariaLabel}
          onKeyDown=${onPanelKeyDown}
          style=${panelStyle || undefined}
          className=${cn(
            position,
            'rounded-[12px] border border-[var(--v2-panel-border)] bg-[var(--v2-card-bg)] shadow-[var(--v2-card-shadow)] outline-none',
            className
          )}
        >
          ${children}
        </div>
      `}
    </div>
  `;
}
