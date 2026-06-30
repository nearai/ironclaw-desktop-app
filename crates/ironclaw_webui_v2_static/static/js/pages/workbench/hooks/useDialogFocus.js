import { React } from '../../../lib/html.js';

const FOCUSABLE = 'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])';

function focusableItems(panel) {
  return Array.from(panel.querySelectorAll(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
  );
}

/**
 * Accessible dialog/overlay focus management, mirroring design-system/modal.js.
 *
 * While `active`, moves focus into the panel on open and restores it to the
 * opener on close, so keyboard users are never stranded behind the overlay or
 * on <body>. Pass `{ trap: true }` for true modal dialogs to also keep Tab /
 * Shift+Tab cycling inside the panel; leave it off for non-modal drawers.
 *
 * Apply the returned `panelRef` (and `tabindex="-1"`) to the panel element, and
 * `onKeyDown` to the dialog root when trapping.
 */
export function useDialogFocus(active, { trap = false } = {}) {
  const panelRef = React.useRef(null);
  const restoreFocusRef = React.useRef(null);

  React.useEffect(() => {
    if (!active) return undefined;
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const id = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      // Target the first enabled, visible control; fall back to the panel itself
      // (tabindex=-1) so focus never silently stays on a disabled button or <body>.
      (focusableItems(panel)[0] || panel).focus();
    });
    return () => {
      window.cancelAnimationFrame(id);
      restoreFocusRef.current?.focus?.();
      restoreFocusRef.current = null;
    };
  }, [active]);

  const onKeyDown = React.useCallback(
    (event) => {
      if (!trap || event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = focusableItems(panel);
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
    },
    [trap]
  );

  return { panelRef, onKeyDown };
}
