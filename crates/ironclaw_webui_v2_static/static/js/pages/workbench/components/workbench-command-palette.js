import { Icon } from '../../../design-system/icons.js';
import { React, html } from '../../../lib/html.js';
import { cn } from '../../../utils/cn.js';

// Cmd+K command palette — the single keyboard-first entry point (DESIGN.md
// Law 3: command/search converge into one Bridge surface). It navigates
// (jump to Work / Memory / Library / Chat / Tools / Settings) and composes
// (any free text becomes "Ask IronClaw: …", prefilled into the command box for
// review — never auto-sent). Floating overlay, Esc to dismiss; arrow keys +
// Enter to run. Shadow is intentional here (a genuinely floating element).
export function WorkbenchCommandPalette({ open, onClose, commands, onCompose }) {
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const navMatches = (commands || []).filter(
    (command) =>
      !q ||
      command.label.toLowerCase().includes(q) ||
      (command.keywords || '').toLowerCase().includes(q)
  );
  const results = [...navMatches];
  if (q) {
    results.push({
      id: 'compose',
      label: `Ask IronClaw: “${query.trim()}”`,
      icon: 'spark',
      hint: 'compose',
      run: () => onCompose(query.trim())
    });
  }
  const clamped = Math.max(0, Math.min(active, results.length - 1));

  const runAt = (index) => {
    const result = results[index];
    if (!result) return;
    onClose();
    result.run();
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((value) => Math.min(value + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((value) => Math.max(value - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      runAt(clamped);
    }
  };

  return html`
    <div className="wb13-cmdk" data-testid="workbench-command-palette">
      <button
        type="button"
        className="wb13-cmdk-scrim"
        aria-label="Close command palette"
        onClick=${onClose}
      ></button>
      <div className="wb13-cmdk-panel" role="dialog" aria-label="Command palette" aria-modal="true">
        <div className="wb13-cmdk-input">
          <${Icon} name="search" />
          <input
            ref=${inputRef}
            type="text"
            placeholder="Search, navigate, or ask…"
            value=${query}
            data-testid="workbench-command-input"
            aria-label="Command palette input"
            onInput=${(event) => {
              setQuery(event.currentTarget.value);
              setActive(0);
            }}
            onKeyDown=${onKeyDown}
          />
          <kbd className="wb13-cmdk-esc">esc</kbd>
        </div>
        ${results.length
          ? html`<ul className="wb13-cmdk-list">
              ${results.map(
                (result, index) => html`
                  <li key=${result.id}>
                    <button
                      type="button"
                      className=${cn('wb13-cmdk-item', index === clamped && 'is-active')}
                      data-testid="workbench-command-item"
                      onMouseEnter=${() => setActive(index)}
                      onClick=${() => runAt(index)}
                    >
                      <${Icon} name=${result.icon || 'arrowDown'} />
                      <span className="wb13-cmdk-label">${result.label}</span>
                      ${result.hint
                        ? html`<span className="wb13-cmdk-hint">${result.hint}</span>`
                        : null}
                    </button>
                  </li>
                `
              )}
            </ul>`
          : html`<div className="wb13-cmdk-empty">No matches. Type to ask IronClaw instead.</div>`}
      </div>
    </div>
  `;
}
