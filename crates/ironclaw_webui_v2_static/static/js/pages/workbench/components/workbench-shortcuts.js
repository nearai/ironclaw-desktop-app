import { html } from '../../../lib/html.js';

// Keyboard-shortcut help overlay (the critique's §7 "? to discover them").
// Static reference for the Workbench keyboard layer; opened with ? and
// dismissed with Esc or a scrim click. Pairs with the Cmd+K palette.
const SHORTCUTS = [
  { keys: ['⌘', 'K'], label: 'Command palette — navigate, compose, or ask' },
  { keys: ['/'], label: 'Jump to the command box' },
  { keys: ['G', 'then', 'W'], label: 'Go to Work' },
  { keys: ['G', 'then', 'M'], label: 'Go to Memory' },
  { keys: ['G', 'then', 'L'], label: 'Go to Library' },
  { keys: ['G', 'then', 'T'], label: 'Go to Tools & connectors' },
  { keys: ['⌘', '⏎'], label: 'Ask / send the current request' },
  { keys: ['?'], label: 'Show this list' },
  { keys: ['Esc'], label: 'Dismiss a panel or overlay' }
];

export function WorkbenchShortcuts({ open, onClose }) {
  if (!open) return null;
  return html`
    <div className="wb13-cmdk" data-testid="workbench-shortcuts">
      <button
        type="button"
        className="wb13-cmdk-scrim"
        aria-label="Close keyboard shortcuts"
        onClick=${onClose}
      ></button>
      <div
        className="wb13-shortcuts-panel"
        role="dialog"
        aria-label="Keyboard shortcuts"
        aria-modal="true"
      >
        <div className="wb13-shortcuts-head">
          <span>Keyboard shortcuts</span>
          <kbd className="wb13-cmdk-esc">esc</kbd>
        </div>
        <ul className="wb13-shortcuts-list">
          ${SHORTCUTS.map(
            (row, index) => html`
              <li key=${index} className="wb13-shortcuts-row">
                <span className="wb13-shortcuts-keys">
                  ${row.keys.map((key, keyIndex) =>
                    key === 'then'
                      ? html`<span key=${keyIndex} className="wb13-shortcuts-then">then</span>`
                      : html`<kbd key=${keyIndex}>${key}</kbd>`
                  )}
                </span>
                <span className="wb13-shortcuts-label">${row.label}</span>
              </li>
            `
          )}
        </ul>
      </div>
    </div>
  `;
}
