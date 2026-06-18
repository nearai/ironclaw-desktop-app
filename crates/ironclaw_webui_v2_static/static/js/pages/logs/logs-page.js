import { Link } from 'react-router';
import { Button } from '../../design-system/button.js';
import { EmptyPanel } from '../../design-system/primitives.js';
import { React, html } from '../../lib/html.js';
import { useT } from '../../lib/i18n.js';
import { useLogs } from './hooks/useLogs.js';

const LEVELS = ['all', 'trace', 'debug', 'info', 'warn', 'error'];
const SERVER_LEVELS = ['trace', 'debug', 'info', 'warn', 'error'];

const LEVEL_COLORS = {
  trace: 'text-[var(--v2-text-muted)]',
  debug: 'text-[color-mix(in_srgb,var(--v2-accent)_80%,white)]',
  info: 'text-[var(--v2-text-strong)]',
  warn: 'text-[var(--v2-warning-text)]',
  error: 'text-[var(--v2-danger-text)]'
};

const LEVEL_BG = {
  warn: 'bg-[var(--v2-warning-soft)]',
  error: 'bg-[var(--v2-danger-soft)]'
};

function LogEntry({ entry }) {
  const t = useT();
  const [expanded, setExpanded] = React.useState(false);
  const ts = entry.timestamp ? entry.timestamp.substring(11, 23) : '';
  const levelColor = LEVEL_COLORS[entry.level] || LEVEL_COLORS.info;
  const rowBg = LEVEL_BG[entry.level] || '';
  const contextItems = [
    { key: 'thread_id', labelKey: 'logs.scope.thread', value: entry.threadId },
    { key: 'run_id', labelKey: 'logs.scope.run', value: entry.runId },
    { key: 'turn_id', labelKey: 'logs.scope.turn', value: entry.turnId },
    { key: 'tool_call_id', labelKey: 'logs.scope.toolCall', value: entry.toolCallId },
    { key: 'tool_name', labelKey: 'logs.scope.tool', value: entry.toolName },
    { key: 'source', labelKey: 'logs.scope.source', value: entry.source }
  ].filter((item) => Boolean(item.value));

  return html`
    <div data-testid="logs-entry" className=${rowBg}>
      <div
        data-testid="logs-entry-row"
        onClick=${() => setExpanded((v) => !v)}
        className=${[
          'grid cursor-pointer select-none gap-x-3 border-b border-[color-mix(in_srgb,var(--v2-panel-border)_58%,transparent)] px-4 py-1.5 font-mono text-xs hover:bg-[var(--v2-surface-soft)]',
          'grid-cols-[7rem_3rem_minmax(10rem,18rem)_1fr]'
        ].join(' ')}
      >
        <span className="text-[var(--v2-text-muted)] tabular-nums">${ts}</span>
        <span className=${['font-semibold uppercase', levelColor].join(' ')}> ${entry.level} </span>
        <span className="truncate text-[var(--v2-text-muted)]">${entry.target}</span>
        <span
          data-testid="logs-entry-message"
          className=${[
            'min-w-0 text-[var(--v2-text)]',
            expanded ? 'whitespace-pre-wrap break-all' : 'truncate'
          ].join(' ')}
        >
          ${entry.message}
        </span>
      </div>
      ${expanded &&
      contextItems.length > 0 &&
      html`
        <div
          data-testid="logs-entry-context"
          className="flex flex-wrap gap-1.5 px-4 pb-2 pl-[calc(7rem+3rem+2.5rem)] font-mono text-[11px] text-[var(--v2-text-muted)]"
        >
          ${contextItems.map(
            (item) => html`
              <span
                key=${item.key}
                data-testid="logs-context-chip"
                data-context-key=${item.key}
                className="inline-flex max-w-full items-center gap-1 rounded-[6px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] px-2 py-0.5"
              >
                <span>${t(item.labelKey)}</span>
                <span className="max-w-[18rem] truncate text-[var(--v2-text)]">
                  ${item.value}
                </span>
              </span>
            `
          )}
        </div>
      `}
    </div>
  `;
}

function ToolbarSelect({ value, onChange, options, labelKey, ariaLabel, t }) {
  return html`
    <select
      aria-label=${ariaLabel}
      value=${value}
      onChange=${(e) => onChange(e.target.value)}
      className="v2-select h-11 min-w-0 rounded-[7px] px-2.5 py-0 text-xs"
    >
      ${options.map((opt) => html`<option key=${opt} value=${opt}>${t(labelKey(opt))}</option>`)}
    </select>
  `;
}

function ScopeChip({ label, value, scopeKey }) {
  return html`
    <span
      data-testid="logs-scope-chip"
      data-scope-key=${scopeKey}
      className="inline-flex max-w-full items-center gap-1 rounded-[6px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] px-2 py-1 font-mono text-[11px] text-[var(--v2-text-muted)]"
      title=${`${label}: ${value}`}
    >
      <span className="uppercase tracking-[0.08em]">${label}</span>
      <span className="max-w-[18rem] truncate text-[var(--v2-text)]">${value}</span>
    </span>
  `;
}

export function LogsPage() {
  const t = useT();
  const {
    entries,
    totalCount,
    paused,
    togglePause,
    clearEntries,
    levelFilter,
    setLevelFilter,
    targetFilter,
    setTargetFilter,
    autoScroll,
    setAutoScroll,
    serverLevel,
    changeServerLevel,
    scope,
    isLoading,
    error,
    isUnsupported
  } = useLogs();

  const outputRef = React.useRef(null);
  const followLatestRef = React.useRef(true);

  React.useEffect(() => {
    if (autoScroll && followLatestRef.current && outputRef.current) {
      outputRef.current.scrollTop = 0;
    }
  }, [entries, autoScroll]);

  const handleOutputScroll = React.useCallback((event) => {
    followLatestRef.current = event.currentTarget.scrollTop <= 48;
  }, []);

  const hasEntries = entries.length > 0;
  const activeScope = scope?.active || [];
  const errorMessage = error?.message || error?.statusText || 'Request failed';
  const emptyDescription = isUnsupported ? t('logs.unsupported') : t('logs.empty');

  return html`
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--v2-panel-border)] bg-[var(--v2-canvas-strong)] px-4 py-2"
      >
        <${ToolbarSelect}
          value=${levelFilter}
          onChange=${setLevelFilter}
          options=${LEVELS}
          labelKey=${(opt) => (opt === 'all' ? 'logs.levelAll' : `logs.level.${opt}`)}
          ariaLabel="Log level filter"
          t=${t}
        />

        <input
          type="text"
          value=${targetFilter}
          onInput=${(e) => setTargetFilter(e.target.value)}
          placeholder=${t('logs.filterTarget')}
          className="h-11 min-w-[10rem] flex-1 rounded-[7px] border border-[var(--v2-panel-border)] bg-[var(--v2-input-bg)] px-3 text-xs text-[var(--v2-text)] placeholder:text-[var(--v2-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--v2-accent)]"
        />

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden tabular-nums text-xs text-[var(--v2-text-muted)] sm:inline">
            ${t('logs.entryCount', { count: totalCount })}
          </span>

          <label
            className="flex h-11 cursor-pointer items-center gap-1.5 text-xs text-[var(--v2-text-muted)]"
          >
            <input
              type="checkbox"
              checked=${autoScroll}
              onChange=${(e) => setAutoScroll(e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--v2-accent)]"
            />
            ${t('logs.autoScroll')}
          </label>

          <button
            type="button"
            onClick=${togglePause}
            className=${[
              'h-11 rounded-[7px] px-3 text-xs font-medium',
              paused
                ? 'bg-[var(--v2-accent-soft)] text-[var(--v2-accent-text)] hover:bg-[color-mix(in_srgb,var(--v2-accent)_18%,transparent)]'
                : 'border border-[var(--v2-panel-border)] text-[var(--v2-text-muted)] hover:bg-[var(--v2-surface-muted)] hover:text-[var(--v2-text-strong)]'
            ].join(' ')}
          >
            ${paused ? t('logs.resume') : t('logs.pause')}
          </button>

          <button
            type="button"
            onClick=${() => {
              if (confirm(t('logs.confirmClear'))) clearEntries();
            }}
            className="h-11 rounded-[7px] border border-[var(--v2-panel-border)] px-3 text-xs text-[var(--v2-text-muted)] hover:bg-[var(--v2-surface-muted)] hover:text-[var(--v2-text-strong)]"
          >
            ${t('logs.clear')}
          </button>
        </div>

        ${activeScope.length > 0 &&
        html`
          <div
            data-testid="logs-scope-toolbar"
            className="flex w-full flex-wrap items-center gap-2 border-t border-[var(--v2-panel-border)] pt-2 text-xs text-[var(--v2-text-muted)]"
          >
            <span className="font-medium text-[var(--v2-text-strong)]">${t('logs.scoped')}</span>
            ${activeScope.map(
              (item) => html`
                <${ScopeChip}
                  key=${item.param}
                  scopeKey=${item.param}
                  label=${t(item.labelKey)}
                  value=${item.value}
                />
              `
            )}
            <${Link}
              to="/logs"
              className="ml-auto min-h-[36px] rounded-[6px] px-2 py-1 text-xs text-[var(--v2-text-muted)] hover:bg-[var(--v2-surface-muted)] hover:text-[var(--v2-text-strong)]"
            >
              ${t('logs.clearScope')}
            <//>
          </div>
        `}
        ${serverLevel != null &&
        html`
          <div
            className="flex w-full items-center gap-2 border-t border-[var(--v2-panel-border)] pt-2 text-xs text-[var(--v2-text-muted)]"
          >
            <span>${t('logs.serverLevel')}</span>
            <${ToolbarSelect}
              value=${serverLevel}
              onChange=${changeServerLevel}
              options=${SERVER_LEVELS}
              labelKey=${(opt) => `logs.level.${opt}`}
              ariaLabel="Server log level"
              t=${t}
            />
            <span className="ml-auto tabular-nums">
              ${t('logs.entryCount', { count: totalCount })}
              ${paused
                ? html`<span className="ml-1 text-[var(--v2-warning-text)]"
                    >${t('logs.pausedBadge')}</span
                  >`
                : null}
            </span>
          </div>
        `}
      </div>

      <div
        ref=${outputRef}
        onScroll=${handleOutputScroll}
        className="min-h-0 flex-1 overflow-y-auto bg-[var(--v2-canvas)]"
      >
        ${error && hasEntries
          ? html`
              <div
                className="sticky top-0 z-10 border-b border-[color-mix(in_srgb,var(--v2-danger-text)_30%,var(--v2-panel-border))] bg-[var(--v2-danger-soft)] px-4 py-2 text-xs text-[var(--v2-danger-text)]"
              >
                ${t('error.loadFailed', { what: t('nav.logs'), message: errorMessage })}
              </div>
            `
          : null}
        ${error && !hasEntries
          ? html`
              <div
                className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--v2-danger-text)]"
              >
                ${t('error.loadFailed', { what: t('nav.logs'), message: errorMessage })}
              </div>
            `
          : isLoading && !hasEntries
            ? html`
                <div
                  className="flex h-full items-center justify-center text-sm text-[var(--v2-text-muted)]"
                >
                  ${t('common.loading')}
                </div>
              `
            : !hasEntries
              ? html`
                  <div className="flex h-full items-center justify-center px-6">
                    <${EmptyPanel}
                      boxed=${false}
                      title=${t('nav.logs')}
                      description=${emptyDescription}
                    >
                      <${Button} as=${Link} to="/chat" variant="primary">${t('nav.chat')}<//>
                    <//>
                  </div>
                `
              : entries.map((entry) => html`<${LogEntry} key=${entry.id} entry=${entry} />`)}
      </div>
    </div>
  `;
}
