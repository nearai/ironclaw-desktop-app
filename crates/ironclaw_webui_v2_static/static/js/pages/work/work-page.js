import { useQuery } from '@tanstack/react-query';
import { Link, useOutletContext, useSearchParams } from 'react-router';
import { Badge } from '../../design-system/badge.js';
import { Button } from '../../design-system/button.js';
import { Icon } from '../../design-system/icons.js';
import { Popover } from '../../design-system/popover.js';
import { React, html } from '../../lib/html.js';
import { toast } from '../../lib/toast.js';
import { MarkdownRenderer } from '../chat/components/markdown-renderer.js';
import {
  copyWorkProduct,
  downloadDocx,
  downloadHtml,
  downloadJson,
  downloadMarkdown,
  downloadPdf
} from '../chat/lib/work-product-export.js';
import {
  fetchSavedWorkSnapshot,
  mergeSavedWorkSnapshots,
  readSavedWorkSnapshot,
  savedWorkServerReadSupported,
  workArtifactHref
} from '../chat/lib/work-product-save.js';
import {
  buildGeneratedFileBlob,
  generatedFileKindLabel,
  textPreviewForGeneratedFileArtifact
} from '../chat/lib/generated-file-artifacts.js';
import { saveBlob } from '../../lib/save-file.js';
import { workItemSearchMatch } from './lib/work-search.js';
import { buildWorkLedger } from './lib/work-ledger.js';

function safeList(value) {
  return Array.isArray(value) ? value : [];
}

function readableDate(value) {
  if (!value) return 'Saved work';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Saved work';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function fileStem(title) {
  return (
    String(title || 'ironclaw-work-product')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'ironclaw-work-product'
  );
}

function firstReadyArtifact(item) {
  return (
    safeList(item?.artifacts).find(
      (artifact) => artifact?.content || artifact?.data_base64 || artifact?.filename
    ) || null
  );
}

function findArtifact(item, artifactId) {
  // With an explicit id, require an exact match — never silently substitute a
  // different artifact for a deep link that no longer resolves. Only the no-id
  // case falls back to the first ready artifact.
  if (artifactId) {
    return safeList(item?.artifacts).find((artifact) => artifact?.id === artifactId) || null;
  }
  return firstReadyArtifact(item);
}

// One canonical empty/not-found notice. The gold file glyph carries the agent's
// hand (a saved work product is generated agent work); the copy names the exact
// next physical action instead of a dead CTA. Both the full-bleed empty page and
// the in-article dead-deep-link state render this same notice — merged so the two
// never drift apart (a hostile-review finding). `title`/`body`/`testId` vary; the
// treatment does not.
function SavedWorkNotice({ title, body, testId }) {
  return html`
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-10 text-center"
      data-testid=${testId}
    >
      <div
        className="grid h-12 w-12 place-items-center rounded-[14px] border border-[color-mix(in_srgb,var(--v2-gold)_34%,var(--v2-panel-border))] bg-[var(--v2-gold-soft)] text-[var(--v2-gold-text)]"
      >
        <${Icon} name="file" className="h-5 w-5" />
      </div>
      <h1 className="v2-text-title mt-5">${title}</h1>
      <p className="mt-2 max-w-md v2-text-body text-[var(--v2-text-muted)]">${body}</p>
      <div className="mt-6">
        <${Button} as=${Link} to="/chat" variant="primary">Back to chat<//>
      </div>
    </div>
  `;
}

function EmptyWorkState({ savedWorkSnapshot }) {
  const sourceDetail =
    savedWorkSnapshot?.detail ||
    'Saved outputs from this desktop profile appear here after you save them from chat.';
  return html`
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="v2-page-entrance flex-1 p-4 sm:p-6">
        <div className="mx-auto max-w-2xl">
          <${SavedWorkNotice}
            title="No saved work yet"
            body=${sourceDetail}
            testId="saved-work-empty"
          />
        </div>
      </div>
    </div>
  `;
}

// Article-pane state for a broken deep link: the sidebar stays visible (so the
// user can pick a real item) while the reader honestly reports the dead link
// instead of substituting an unrelated saved artifact.
function NotFoundArticle() {
  return html`<${SavedWorkNotice}
    title="Saved work not found"
    body="That saved artifact is no longer in this desktop profile. Pick another item from the list, or head back to chat."
    testId="saved-work-not-found"
  />`;
}

function WorkExportActions({ item, artifact }) {
  const [busy, setBusy] = React.useState('');
  const [exportOpen, setExportOpen] = React.useState(false);
  const content = artifactTextContent(artifact);
  const title = artifact?.title || item?.title || 'IronClaw work product';
  const stem = fileStem(title);
  const originalBlob = buildGeneratedFileBlob(artifact);
  const originalFilename =
    artifact?.filename || `${stem}.${generatedFileKindLabel(artifact).toLowerCase()}`;

  const run = async (label, action) => {
    setBusy(label);
    try {
      // saveBlob (and every download helper that routes through it) returns
      // null when the user cancels the native save dialog. Honor that: clear
      // busy and bail before the success toast so we never claim a save the
      // user dismissed. Copy actions return undefined and keep their toast.
      const result = await action();
      if (result === null) {
        setBusy('');
        return;
      }
      toast(`${label} ready`, { tone: 'success' });
    } catch {
      toast(`Could not ${label.toLowerCase()}`, { tone: 'error' });
    } finally {
      setBusy('');
    }
  };

  // De-boxed export bank: one grey Copy + one grey Save original, and a single
  // "Export" overflow that holds the five format writers behind a menu — not the
  // seven-identical-button wall the surface used to open with. Grey/ghost for
  // all of them (no primary here; the surface's single accent is reserved for the
  // reader's own actions). 44px tap-target floor kept.
  const actionClass =
    'inline-flex min-h-[44px] items-center gap-2 rounded-[var(--v2-radius-control)] border border-[var(--v2-panel-border)] bg-[var(--v2-card-bg)] px-3 v2-text-body font-medium text-[var(--v2-text)] hover:border-[color-mix(in_srgb,var(--v2-accent)_36%,var(--v2-panel-border))] hover:text-[var(--v2-text-strong)] disabled:opacity-60';

  const exportFormats = content
    ? [
        ['Markdown', () => downloadMarkdown(content, `${stem}.md`)],
        ['DOCX', () => downloadDocx(content, `${stem}.docx`)],
        ['PDF', () => downloadPdf(content, `${stem}.pdf`)],
        ['HTML', () => downloadHtml(content, `${stem}.html`)],
        // JSON export only when there is text content; for binary artifacts
        // (content === '') it would write a hollow file, so those rely on the
        // "Save original" control to preserve the real bytes.
        [
          'JSON',
          () =>
            downloadJson(
              {
                role: 'assistant',
                content,
                attachments: [
                  {
                    kind: 'work_item',
                    item_id: item?.id,
                    artifact_id: artifact?.id,
                    title,
                    filename: artifact?.filename || null,
                    mime_type: artifact?.mime_type || null,
                    size: artifact?.size || null
                  }
                ]
              },
              `${stem}.json`
            )
        ]
      ]
    : [];

  return html`
    <div className="flex flex-wrap items-center gap-2">
      ${content &&
      html`<button
        type="button"
        className=${actionClass}
        disabled=${Boolean(busy)}
        onClick=${() => run('Copy', () => copyWorkProduct(content))}
      >
        <${Icon} name="copy" className="h-4 w-4" aria-hidden="true" />
        ${busy === 'Copy' ? 'Copying…' : 'Copy'}
      </button>`}
      ${originalBlob &&
      html`<button
        type="button"
        className=${actionClass}
        disabled=${Boolean(busy)}
        onClick=${() => run('Save original', () => saveBlob(originalBlob, originalFilename))}
      >
        <${Icon} name="download" className="h-4 w-4" aria-hidden="true" />
        ${busy === 'Save original' ? 'Saving…' : 'Save original'}
      </button>`}
      ${exportFormats.length > 0 &&
      html`<${Popover}
        open=${exportOpen}
        onClose=${() => setExportOpen(false)}
        align="start"
        side="bottom"
        ariaLabel="Export format"
        className="border-t-2 border-t-[var(--v2-accent)] p-1.5"
        trigger=${html`<button
          type="button"
          aria-haspopup="menu"
          aria-expanded=${exportOpen}
          className=${actionClass}
          disabled=${Boolean(busy)}
          onClick=${() => setExportOpen((open) => !open)}
        >
          <${Icon} name="download" className="h-4 w-4" aria-hidden="true" />
          Export
          <${Icon} name="chevronDown" className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
        </button>`}
      >
        <div role="menu" aria-label="Export format" className="grid gap-0.5">
          ${exportFormats.map(
            ([label, action]) =>
              html`<button
                key=${label}
                type="button"
                role="menuitem"
                disabled=${Boolean(busy)}
                onClick=${() => {
                  setExportOpen(false);
                  run(`Export ${label}`, action);
                }}
                className="flex min-h-[40px] items-center gap-2.5 rounded-[var(--v2-radius-control)] px-2.5 text-left v2-text-body text-[var(--v2-text)] hover:bg-[var(--v2-surface-soft)] hover:text-[var(--v2-text-strong)] disabled:opacity-60"
              >
                <${Icon} name="download" className="h-4 w-4 opacity-70" aria-hidden="true" />
                ${label}
              </button>`
          )}
        </div>
      <//>`}
    </div>
  `;
}

function artifactTextContent(artifact) {
  return String(artifact?.content || textPreviewForGeneratedFileArtifact(artifact) || '');
}

function SavedFileArtifactPreview({ artifact }) {
  const kind = generatedFileKindLabel(artifact);
  return html`
    <div
      className="rounded-[var(--v2-radius-card)] border border-[var(--v2-panel-border)] border-l-2 border-l-[var(--v2-gold)] bg-[var(--v2-surface-soft)] p-6"
      data-testid="saved-work-file-artifact"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--v2-radius-card)] border border-[color-mix(in_srgb,var(--v2-gold)_34%,var(--v2-panel-border))] bg-[var(--v2-gold-soft)] text-[var(--v2-gold-text)]"
        >
          <${Icon} name="file" className="h-5 w-5" />
        </span>
        <span className="min-w-[12rem] flex-1">
          ${
            /* Gold color set inline, not via a text-[…] utility: .v2-text-label
            ships its own color in app.css, which loads after the Tailwind layer
            and (equal specificity, later source order) would otherwise override
            the gold utility and mute this agent-attribution label to grey. */ ''
          }
          <span className="v2-text-label" style=${{ color: 'var(--v2-gold-text)' }}
            >${kind} file artifact</span
          >
          <span className="block truncate v2-text-section text-[var(--v2-text-strong)]">
            ${artifact?.filename || artifact?.title || 'Generated file'}
          </span>
          <span className="block truncate v2-text-meta">
            ${artifact?.mime_type || 'application/octet-stream'}
            ${artifact?.size_label ? ` · ${artifact.size_label}` : ''}
          </span>
        </span>
      </div>
      <p className="mt-4 max-w-2xl v2-text-body text-[var(--v2-text-muted)]">
        Preview is not available for this binary file in the local reader. The original bytes are
        retained and can be saved from the controls above.
      </p>
    </div>
  `;
}

const WORK_LIST_VISIBLE_LIMIT = 30;

// Trust Ledger: a cross-matter, reverse-chron stream of saved-work events and the
// agent receipts behind them. Honest by construction — device-local, saved-work
// scope, stated plainly. Each row links to its matter.
function WorkActivityLedger({ items }) {
  const ledger = buildWorkLedger(items);
  return html`
    <div data-testid="work-activity-ledger">
      <p className="v2-text-body text-[var(--v2-text-muted)]">
        A device-local record of work you have saved and the actions behind it. A full server-side
        audit log is not available on this gateway yet.
      </p>
      ${ledger.length === 0
        ? html`<p className="mt-4 v2-text-body text-[var(--v2-text-muted)]">
            No activity recorded yet.
          </p>`
        : html`<ol className="mt-4 grid grid-cols-1">
            ${ledger.map(
              (entry) => html`
                <li
                  key=${entry.id}
                  className=${`border-t border-[var(--v2-panel-border)] first:border-t-0 ${
                    entry.kind === 'saved' ? '' : 'border-l-2 border-l-[var(--v2-gold)] pl-3'
                  }`}
                >
                  <${Link}
                    to=${workArtifactHref(entry.matterId, entry.artifactId)}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 py-3.5 hover:text-[var(--v2-accent-text)]"
                  >
                    <span
                      className=${`grid h-7 w-7 shrink-0 place-items-center ${
                        entry.kind === 'saved'
                          ? 'text-[var(--v2-text-faint)]'
                          : 'text-[var(--v2-gold-text)]'
                      }`}
                    >
                      <${Icon}
                        name=${entry.kind === 'saved' ? 'file' : 'bolt'}
                        className="h-3.5 w-3.5"
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate v2-text-body text-[var(--v2-text-strong)]">
                        ${entry.kind === 'saved' ? `Saved ${entry.label}` : entry.label}
                      </span>
                      <span className="block truncate v2-text-meta">
                        ${entry.kind === 'saved'
                          ? 'Work product'
                          : `in ${entry.matter}`}${entry.status ? ` · ${entry.status}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 v2-text-meta tabular-nums">
                      ${entry.kind === 'saved' ? readableDate(entry.timestamp) : ''}
                    </span>
                  <//>
                </li>
              `
            )}
          </ol>`}
    </div>
  `;
}

// "What IronClaw did" — the trust centerpiece, not chrome. Each receipt is a
// structured hairline row (action · target/detail · status), clay-marked on the
// left edge because these are agent-provenance receipts. Clay is reserved for
// exactly this: the cooled record of what the agent's hand actually did. No
// filled status pills — status is quiet text; a genuine in-flight receipt breathes.
function WorkReceipts({ receipts }) {
  return html`
    <section className="border-l-2 border-l-[var(--v2-gold)] pl-4" data-testid="dossier-receipts">
      ${
        /* Gold color set inline, not via a text-[…] utility: .v2-text-label ships
        its own color in app.css, which loads after the Tailwind layer and (equal
        specificity, later source order) would otherwise override the gold utility
        and mute this agent-attribution header to grey. */ ''
      }
      <div className="v2-text-label" style=${{ color: 'var(--v2-gold-text)' }}>
        What IronClaw did
      </div>
      <ul className="mt-2.5 grid grid-cols-1">
        ${receipts.map((receipt, index) => {
          const inFlight = /run|progress|working|pending/i.test(String(receipt.status || ''));
          return html`
            <li
              key=${index}
              className="grid grid-cols-[auto_1fr_auto] items-baseline gap-x-3 gap-y-0.5 border-t border-[var(--v2-panel-border)] py-2.5 first:border-t-0"
            >
              <span className="grid h-5 w-5 place-items-center text-[var(--v2-gold-text)]">
                <${Icon} name="bolt" className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block v2-text-body font-medium text-[var(--v2-text-strong)]">
                  ${receipt.label}
                </span>
                ${receipt.detail
                  ? html`<span
                      className="mt-0.5 block truncate v2-text-meta"
                      title=${receipt.detail}
                      >${receipt.detail}</span
                    >`
                  : ''}
              </span>
              ${receipt.status
                ? html`<span
                    className="flex shrink-0 items-center gap-1.5 v2-text-meta text-[var(--v2-text-faint)]"
                  >
                    ${inFlight &&
                    html`<span
                      aria-hidden="true"
                      className="v2-breathing-dot h-1.5 w-1.5 shrink-0 rounded-full bg-current"
                    ></span>`}
                    ${receipt.status}
                  </span>`
                : html`<span></span>`}
            </li>
          `;
        })}
      </ul>
    </section>
  `;
}

export function WorkPage() {
  const [params] = useSearchParams();
  const outletContext = useOutletContext() || {};
  const { gatewayStatus } = outletContext;
  const [savedWorkSnapshot, setSavedWorkSnapshot] = React.useState(() => readSavedWorkSnapshot());
  const savedWorkReadEnabled = savedWorkServerReadSupported(gatewayStatus);
  const serverSavedWorkQuery = useQuery({
    queryKey: ['work-saved-work-server'],
    queryFn: ({ signal }) => fetchSavedWorkSnapshot({ signal }),
    enabled: savedWorkReadEnabled,
    staleTime: 30_000,
    retry: 1,
    throwOnError: false
  });
  const items = savedWorkSnapshot.items || [];
  // The saved-work store holds up to 500 items; without a filter + expander the
  // sidebar list hard-capped at 30 and everything older was unreachable.
  const [workFilter, setWorkFilter] = React.useState('');
  const [showAllWork, setShowAllWork] = React.useState(false);
  // 'saved' = per-matter reader; 'activity' = the cross-matter Trust Ledger.
  const [view, setView] = React.useState('saved');

  React.useEffect(() => {
    setSavedWorkSnapshot(readSavedWorkSnapshot());
  }, []);

  React.useEffect(() => {
    if (!savedWorkReadEnabled || !serverSavedWorkQuery.data) return;
    setSavedWorkSnapshot((localSnapshot) =>
      mergeSavedWorkSnapshots(serverSavedWorkQuery.data, localSnapshot)
    );
  }, [savedWorkReadEnabled, serverSavedWorkQuery.data]);

  const requestedItemId = params.get('item') || '';
  const requestedArtifactId = params.get('artifact') || '';
  const requestedItem =
    items.find((item) => item?.id === requestedItemId) || (!requestedItemId ? items[0] : null);
  const requestedArtifact = findArtifact(requestedItem, requestedArtifactId);
  // "missing" = a deep link pointed at something that no longer resolves: an
  // item id with no matching item, or an artifact id with no matching artifact.
  // We never substitute a different doc into the reader; instead the article
  // pane shows an honest "not found" notice while the sidebar stays visible so
  // the user is not stranded on a dead page.
  const missing = Boolean(
    (requestedItemId && !requestedItem) || (requestedArtifactId && !requestedArtifact)
  );

  // With no saved work at all there is nothing to frame, so keep the full-bleed
  // empty state. Once items exist, always render the two-pane layout (sidebar +
  // article) — a broken deep link only changes what the article pane shows.
  if (!items.length) {
    return html`<${EmptyWorkState} savedWorkSnapshot=${savedWorkSnapshot} />`;
  }

  // When the deep link resolves, read that item/artifact; when it does not,
  // anchor the sidebar selection on the first item but render the not-found
  // notice in the article pane rather than its content.
  const selectedItem = missing ? null : requestedItem;
  const selectedArtifact = missing ? null : requestedArtifact;

  const content = selectedArtifact ? artifactTextContent(selectedArtifact) : '';
  const linkedThread = safeList(selectedItem?.links).find((link) => link?.kind === 'thread');
  const provenance = safeList(selectedArtifact?.provenance).join(', ') || 'chat';
  // Dossier provenance captured at save time (work-product-save.dossierFromMessages):
  // the original ask + the receipts of what the agent actually did.
  const askEntry = safeList(selectedItem?.dossier).find((entry) => entry?.kind === 'ask');
  const receipts = safeList(selectedItem?.receipts);

  // Filter by title, then page: show the first N and let the user expand the
  // rest so saved work past the 30th item is always reachable (search finds it
  // even unexpanded).
  const filterQuery = workFilter.trim();
  // Title + body search: match the query against each item's title and artifact
  // text, keeping a one-line snippet for body-only hits so saved work is findable
  // by content, not just name.
  const searchResults = filterQuery
    ? items
        .map((item) => ({ item, ...workItemSearchMatch(item, filterQuery) }))
        .filter((r) => r.match)
    : null;
  const filteredItems = searchResults ? searchResults.map((r) => r.item) : items;
  const snippetById = new Map(
    (searchResults || []).filter((r) => r.snippet).map((r) => [r.item.id, r.snippet])
  );
  const visibleItems = showAllWork
    ? filteredItems
    : filteredItems.slice(0, WORK_LIST_VISIBLE_LIMIT);
  const hiddenItemCount = filteredItems.length - visibleItems.length;

  return html`
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="v2-page-entrance flex-1 p-4 sm:p-6">
        <div
          className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-7 xl:grid-cols-[300px_minmax(0,1fr)]"
        >
          <aside className="h-fit" aria-label="Saved work">
            <div className="px-1 py-2">
              <div className="v2-text-label">Saved work</div>
              <p className="mt-1 v2-text-body text-[var(--v2-text-faint)]">
                ${savedWorkSnapshot.detail || 'Local artifacts saved from chat.'}
              </p>
              <${Badge}
                tone="muted"
                dot=${false}
                size="sm"
                label=${savedWorkSnapshot.statusLabel || savedWorkSnapshot.label || 'Local profile'}
                className="mt-2"
              />
            </div>
            ${items.length > 8 &&
            html`<div className="relative mb-1 px-1">
              <span
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--v2-text-faint)]"
              >
                <${Icon} name="search" className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                aria-label="Search saved work"
                value=${workFilter}
                onInput=${(event) => {
                  setWorkFilter(event.currentTarget.value);
                  setShowAllWork(false);
                }}
                placeholder="Search saved work…"
                className="min-h-[44px] w-full rounded-[var(--v2-radius-control)] border border-[var(--v2-panel-border)] bg-[var(--v2-input-bg)] pl-8 pr-2 v2-text-body text-[var(--v2-text-strong)] outline-none placeholder:text-[var(--v2-text-faint)] focus:border-[var(--v2-accent)]"
              />
            </div>`}
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-0.5">
              ${visibleItems.map((item) => {
                const artifact = firstReadyArtifact(item);
                const href = artifact ? workArtifactHref(item.id, artifact.id) : '/work';
                const active = item.id === selectedItem?.id;
                const snippet = snippetById.get(item.id);
                return html`
                  <${Link}
                    key=${item.id}
                    to=${href}
                    className=${[
                      'rounded-[var(--v2-radius-control)] px-3 py-3 text-left',
                      active
                        ? 'bg-[var(--v2-accent-soft)] text-[var(--v2-text-strong)]'
                        : 'text-[var(--v2-text-muted)] hover:bg-[var(--v2-surface-soft)] hover:text-[var(--v2-text)]'
                    ].join(' ')}
                  >
                    <span className="block truncate v2-text-body font-semibold">
                      ${item.title || 'Untitled work'}
                    </span>
                    <span className="mt-1 block v2-text-meta">
                      ${readableDate(item.updated_at || item.created_at)}
                    </span>
                    ${snippet &&
                    html`<span
                      className="mt-1 block v2-text-body text-[var(--v2-text-muted)] line-clamp-2"
                      >${snippet}</span
                    >`}
                  <//>
                `;
              })}
            </div>
            ${filteredItems.length === 0 &&
            html`<p className="px-3 py-3 v2-text-meta">
              No saved work matches “${workFilter.trim()}”.
            </p>`}
            ${hiddenItemCount > 0 &&
            html`<button
              type="button"
              onClick=${() => setShowAllWork(true)}
              className="mt-1 inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--v2-radius-control)] border border-[var(--v2-panel-border)] px-3 v2-text-body font-medium text-[var(--v2-accent-text)] hover:bg-[var(--v2-surface-soft)]"
            >
              Show all ${filteredItems.length}
            </button>`}
          </aside>

          <article className="min-w-0">
            ${missing
              ? html`<${NotFoundArticle} />`
              : html`
                  <div
                    className="border-b border-[var(--v2-panel-border)] pb-5 sm:flex sm:items-start sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 v2-text-meta">
                        ${
                          /* Gold = the agent's hand (DESIGN.md color meaning). A saved
                    work product is generated agent work, so the eyebrow is gold to
                    match the "Generated document" chip in chat and the file-artifact
                    preview below — not success-green, which is a status this surface
                    cannot prove and read inconsistently against the gold body chip. */ ''
                        }
                        ${
                          /* Gold color set inline, not via a text-[…] utility:
                          .v2-text-label ships its own color in app.css, which
                          loads after the Tailwind layer and (equal specificity,
                          later source order) would otherwise override the gold
                          utility and mute the agent-attribution eyebrow to grey. */ ''
                        }
                        <span className="v2-text-label" style=${{ color: 'var(--v2-gold-text)' }}>
                          ${selectedArtifact.type === 'file' || selectedArtifact.data_base64
                            ? `${generatedFileKindLabel(selectedArtifact)} artifact`
                            : selectedArtifact.type === 'document'
                              ? 'Saved document'
                              : 'Saved note'}
                        </span>
                        <span
                          >${readableDate(selectedItem.updated_at || selectedItem.created_at)}</span
                        >
                        <span>Source: ${provenance}</span>
                      </div>
                      <h1 className="mt-3 truncate v2-text-title">
                        ${selectedArtifact.title || selectedItem.title || 'Saved work product'}
                      </h1>
                      <p className="mt-1 v2-text-body text-[var(--v2-text-muted)]">
                        ${selectedItem.objective || 'Saved work product from chat.'}
                      </p>
                    </div>
                    <div className="mt-4 flex shrink-0 gap-2 sm:mt-0">
                      ${linkedThread?.ref
                        ? html`
                            <${Button}
                              as=${Link}
                              to=${`/chat/${encodeURIComponent(linkedThread.ref)}`}
                              variant="secondary"
                              className="min-h-[44px]"
                            >
                              Open thread
                            <//>
                          `
                        : html`<${Button}
                            as=${Link}
                            to="/chat"
                            variant="secondary"
                            className="min-h-[44px]"
                          >
                            Back to chat
                          <//>`}
                    </div>
                  </div>

                  <div className="space-y-6 pt-6">
                    <div
                      role="group"
                      aria-label="Work view"
                      className="inline-flex rounded-[var(--v2-radius-control)] border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] p-0.5"
                    >
                      ${['saved', 'activity'].map(
                        (mode) =>
                          html`<button
                            key=${mode}
                            type="button"
                            aria-pressed=${view === mode}
                            onClick=${() => setView(mode)}
                            className=${[
                              'min-h-[44px] rounded-[var(--v2-radius-control)] px-3 v2-text-body font-medium',
                              view === mode
                                ? 'bg-[var(--v2-accent-soft)] text-[var(--v2-accent-text)]'
                                : 'text-[var(--v2-text-muted)] hover:text-[var(--v2-text-strong)]'
                            ].join(' ')}
                          >
                            ${mode === 'saved' ? 'Saved' : 'Activity'}
                          </button>`
                      )}
                    </div>
                    ${view === 'activity'
                      ? html`<${WorkActivityLedger} items=${items} />`
                      : html`
                          <${WorkExportActions} item=${selectedItem} artifact=${selectedArtifact} />
                          ${askEntry?.text &&
                          html`<section
                            className="border-t border-[var(--v2-panel-border)] pt-4"
                            data-testid="dossier-ask"
                          >
                            <div className="v2-text-label">The ask</div>
                            <p
                              className="mt-2 whitespace-pre-wrap v2-text-body text-[var(--v2-text)]"
                            >
                              ${askEntry.text}
                            </p>
                          </section>`}
                          ${receipts.length > 0 && html`<${WorkReceipts} receipts=${receipts} />`}
                          ${
                            /* The document body itself: framed by whitespace, not a
                          --v2-canvas card box. The reader is the focal content, so it
                          reads as prose on the desk rather than a nested panel. */ ''
                          }
                          <div className="pt-2" data-testid="saved-work-artifact">
                            ${content
                              ? html`<${MarkdownRenderer}
                                  content=${content}
                                  className="max-w-none text-[14px] leading-7 text-[var(--v2-text)]"
                                />`
                              : html`<${SavedFileArtifactPreview} artifact=${selectedArtifact} />`}
                          </div>
                        `}
                  </div>
                `}
          </article>
        </div>
      </div>
    </div>
  `;
}
