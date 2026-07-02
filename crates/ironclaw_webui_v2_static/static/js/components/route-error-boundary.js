import { React, html } from '../lib/html.js';
import { appScopedPath } from '../lib/app-path.js';

/**
 * RouteErrorBoundary — a single surface throwing during render must never blank
 * the whole app. This catches render/lifecycle errors from the routed content,
 * keeps the shell (sidebar + header) alive, and shows a recoverable, legible
 * error in the content pane instead of an empty window. Key it on the pathname
 * so navigating to another surface resets it.
 */
export class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    try {
      // Surfaced to the WebKit console (and any log forwarder) for diagnosis.
      // eslint-disable-next-line no-console
      console.error('[ironclaw] surface render error:', error, info?.componentStack || '');
    } catch (_) {
      /* ignore */
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const message = String((error && error.message) || error || 'Unknown error');
    const stack = String((error && error.stack) || '');

    return html`
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
        <div
          className="mx-auto w-full max-w-2xl rounded-[var(--v2-radius-card)] border border-[color-mix(in_srgb,var(--v2-danger-text)_34%,var(--v2-panel-border))] bg-[var(--v2-surface)] p-5"
        >
          <div className="v2-text-label text-[var(--v2-danger-text)]">This screen hit an error</div>
          <p className="mt-2 v2-text-body text-[var(--v2-text-muted)]">
            The rest of the app is fine — the details below name what failed.
          </p>
          <pre
            className="mt-3 max-h-64 overflow-auto rounded-[var(--v2-radius-control)] border border-[var(--v2-panel-border)] bg-[var(--v2-canvas)] p-3 font-mono text-xs leading-5 text-[var(--v2-text)]"
          >
${message}${stack ? `\n\n${stack}` : ''}</pre
          >
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick=${() => this.setState({ error: null })}
              className="inline-flex min-h-[40px] items-center rounded-[var(--v2-radius-control)] bg-[var(--v2-accent-btn)] px-4 text-sm font-medium text-white v2-force-white"
            >
              Try again
            </button>
            <a
              href=${appScopedPath('/chat')}
              className="inline-flex min-h-[40px] items-center rounded-[var(--v2-radius-control)] border border-[var(--v2-panel-border)] px-4 text-sm font-medium text-[var(--v2-text-strong)] hover:bg-[var(--v2-surface-muted)]"
            >
              Back to chat
            </a>
          </div>
        </div>
      </div>
    `;
  }
}
