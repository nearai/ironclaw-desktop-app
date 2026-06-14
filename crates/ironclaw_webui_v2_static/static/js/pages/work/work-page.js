import { Link, useSearchParams } from 'react-router';
import { Button } from '../../design-system/button.js';
import { Icon } from '../../design-system/icons.js';
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
import { readSavedWorkItems, workArtifactHref } from '../chat/lib/work-product-save.js';
import {
  buildGeneratedFileBlob,
  generatedFileKindLabel,
  textPreviewForGeneratedFileArtifact
} from '../chat/lib/generated-file-artifacts.js';
import { saveBlob } from '../../lib/save-file.js';

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

function EmptyWorkState({ missing }) {
  return html`
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="v2-page-entrance flex-1 p-4 sm:p-6">
        <div
          className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center text-center"
        >
          <div
            className="grid h-12 w-12 place-items-center rounded-[14px] border border-[var(--v2-panel-border)] bg-[var(--v2-card-bg)] text-[var(--v2-accent-text)]"
          >
            <${Icon} name="file" className="h-5 w-5" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-[var(--v2-text-strong)]">
            ${missing ? 'Saved work not found' : 'No saved work yet'}
          </h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-[var(--v2-text-muted)]">
            ${missing
              ? 'That saved artifact is no longer in this desktop profile.'
              : 'Generated documents you save from chat will appear here with copy and export controls.'}
          </p>
          <div className="mt-6">
            <${Button} as=${Link} to="/chat" variant="primary">Back to chat<//>
          </div>
        </div>
      </div>
    </div>
  `;
}

function WorkExportActions({ item, artifact }) {
  const [busy, setBusy] = React.useState('');
  const content = artifactTextContent(artifact);
  const title = artifact?.title || item?.title || 'IronClaw work product';
  const stem = fileStem(title);
  const originalBlob = buildGeneratedFileBlob(artifact);
  const originalFilename =
    artifact?.filename || `${stem}.${generatedFileKindLabel(artifact).toLowerCase()}`;

  const run = async (label, action) => {
    setBusy(label);
    try {
      await action();
      toast(`${label} ready`, { tone: 'success' });
    } catch {
      toast(`Could not ${label.toLowerCase()}`, { tone: 'error' });
    } finally {
      setBusy('');
    }
  };

  const actionClass =
    'inline-flex h-9 items-center gap-2 rounded-[8px] border border-[var(--v2-panel-border)] bg-[var(--v2-card-bg)] px-3 text-sm font-medium text-[var(--v2-text)] hover:border-[color-mix(in_srgb,var(--v2-accent)_36%,var(--v2-panel-border))] hover:text-[var(--v2-text-strong)] disabled:opacity-60';

  return html`
    <div className="flex flex-wrap gap-2">
      ${originalBlob &&
      html`<button
        type="button"
        className=${actionClass}
        disabled=${Boolean(busy)}
        onClick=${() => run('Save original', () => saveBlob(originalBlob, originalFilename))}
      >
        <${Icon} name="download" className="h-4 w-4" />
        ${busy === 'Save original' ? 'Saving...' : 'Save original'}
      </button>`}
      ${content &&
      html`<button
        type="button"
        className=${actionClass}
        disabled=${Boolean(busy)}
        onClick=${() => run('Copy', () => copyWorkProduct(content))}
      >
        <${Icon} name="copy" className="h-4 w-4" />
        ${busy === 'Copy' ? 'Copying...' : 'Copy'}
      </button>`}
      ${(content
        ? [
            ['Markdown', 'download', () => downloadMarkdown(content, `${stem}.md`)],
            ['DOCX', 'download', () => downloadDocx(content, `${stem}.docx`)],
            ['PDF', 'download', () => downloadPdf(content, `${stem}.pdf`)],
            ['HTML', 'download', () => downloadHtml(content, `${stem}.html`)],
            // JSON export only when there is text content; for binary artifacts
            // (content === '') it would write a hollow file, so those rely on
            // the "Save original" control above to preserve the real bytes.
            [
              'JSON',
              'download',
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
        : []
      ).map(
        ([label, icon, action]) => html`
          <button
            key=${label}
            type="button"
            className=${actionClass}
            disabled=${Boolean(busy)}
            onClick=${() => run(`Export ${label}`, action)}
          >
            <${Icon} name=${icon} className="h-4 w-4" />
            ${label}
          </button>
        `
      )}
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
      className="rounded-[12px] border border-dashed border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] p-6 text-sm"
      data-testid="saved-work-file-artifact"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] border border-[color-mix(in_srgb,var(--v2-gold)_34%,var(--v2-panel-border))] bg-[var(--v2-gold-soft)] text-[var(--v2-gold-text)]"
        >
          <${Icon} name="file" className="h-5 w-5" />
        </span>
        <span className="min-w-[12rem] flex-1">
          <span
            className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--v2-gold-text)]"
          >
            ${kind} file artifact
          </span>
          <span className="block truncate text-base font-semibold text-[var(--v2-text-strong)]">
            ${artifact?.filename || artifact?.title || 'Generated file'}
          </span>
          <span className="block truncate text-xs text-[var(--v2-text-muted)]">
            ${artifact?.mime_type || 'application/octet-stream'}
            ${artifact?.size_label ? ` · ${artifact.size_label}` : ''}
          </span>
        </span>
      </div>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--v2-text-muted)]">
        Preview is not available for this binary file in the local reader. The original bytes are
        retained and can be saved from the controls above.
      </p>
    </div>
  `;
}

export function WorkPage() {
  const [params] = useSearchParams();
  const [items, setItems] = React.useState(() => readSavedWorkItems());

  React.useEffect(() => {
    setItems(readSavedWorkItems());
  }, []);

  const requestedItemId = params.get('item') || '';
  const requestedArtifactId = params.get('artifact') || '';
  const selectedItem =
    items.find((item) => item?.id === requestedItemId) || (!requestedItemId ? items[0] : null);
  const selectedArtifact = findArtifact(selectedItem, requestedArtifactId);
  // "missing" = a deep link pointed at something that no longer resolves: an
  // item id with no matching item, or an artifact id with no matching artifact.
  // Either way we show the "not found" state instead of substituting a doc.
  const missing = Boolean(
    (requestedItemId && !selectedItem) || (requestedArtifactId && !selectedArtifact)
  );

  if (!items.length || missing || !selectedItem || !selectedArtifact) {
    return html`<${EmptyWorkState} missing=${missing} />`;
  }

  const content = artifactTextContent(selectedArtifact);
  const linkedThread = safeList(selectedItem.links).find((link) => link?.kind === 'thread');
  const provenance = safeList(selectedArtifact.provenance).join(', ') || 'chat';

  return html`
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="v2-page-entrance flex-1 p-4 sm:p-6">
        <div className="mx-auto grid max-w-7xl gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside
            className="h-fit rounded-[14px] border border-[var(--v2-panel-border)] bg-[var(--v2-card-bg)] p-3 shadow-[var(--v2-card-shadow)]"
            aria-label="Saved work"
          >
            <div className="px-2 py-2">
              <div
                className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--v2-text-faint)]"
              >
                Saved work
              </div>
              <p className="mt-1 text-sm leading-5 text-[var(--v2-text-muted)]">
                Local artifacts saved from chat.
              </p>
            </div>
            <div className="mt-2 grid gap-1">
              ${items.slice(0, 30).map((item) => {
                const artifact = firstReadyArtifact(item);
                const href = artifact ? workArtifactHref(item.id, artifact.id) : '/work';
                const active = item.id === selectedItem.id;
                return html`
                  <${Link}
                    key=${item.id}
                    to=${href}
                    className=${[
                      'rounded-[10px] border px-3 py-3 text-left text-sm transition',
                      active
                        ? 'border-[color-mix(in_srgb,var(--v2-accent)_45%,var(--v2-panel-border))] bg-[var(--v2-accent-soft)] text-[var(--v2-text-strong)]'
                        : 'border-transparent text-[var(--v2-text-muted)] hover:border-[var(--v2-panel-border)] hover:bg-[var(--v2-surface-soft)] hover:text-[var(--v2-text)]'
                    ].join(' ')}
                  >
                    <span className="block truncate font-semibold">
                      ${item.title || 'Untitled work'}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--v2-text-faint)]">
                      ${readableDate(item.updated_at || item.created_at)}
                    </span>
                  <//>
                `;
              })}
            </div>
          </aside>

          <article
            className="min-w-0 rounded-[14px] border border-[var(--v2-panel-border)] bg-[var(--v2-card-bg)] shadow-[var(--v2-card-shadow)]"
          >
            <div
              className="border-b border-[var(--v2-panel-border)] px-5 py-4 sm:flex sm:items-start sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <div
                  className="flex flex-wrap items-center gap-2 text-xs text-[var(--v2-text-muted)]"
                >
                  <span
                    className="rounded-full border border-[color-mix(in_srgb,var(--v2-success-text)_34%,var(--v2-panel-border))] bg-[var(--v2-success-soft)] px-2 py-1 text-[var(--v2-success-text)]"
                  >
                    ${selectedArtifact.type === 'file' || selectedArtifact.data_base64
                      ? `${generatedFileKindLabel(selectedArtifact)} artifact`
                      : 'Ready artifact'}
                  </span>
                  <span>${readableDate(selectedItem.updated_at || selectedItem.created_at)}</span>
                  <span>Source: ${provenance}</span>
                </div>
                <h1 className="mt-3 truncate text-xl font-semibold text-[var(--v2-text-strong)]">
                  ${selectedArtifact.title || selectedItem.title || 'Saved work product'}
                </h1>
                <p className="mt-1 text-sm leading-6 text-[var(--v2-text-muted)]">
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
                        size="sm"
                      >
                        Open thread
                      <//>
                    `
                  : html`<${Button} as=${Link} to="/chat" variant="secondary" size="sm">
                      Back to chat
                    <//>`}
              </div>
            </div>

            <div className="space-y-5 px-5 py-5">
              <${WorkExportActions} item=${selectedItem} artifact=${selectedArtifact} />
              <div
                className="rounded-[12px] border border-[var(--v2-panel-border)] bg-[var(--v2-canvas)] p-4 sm:p-6"
                data-testid="saved-work-artifact"
              >
                ${content
                  ? html`<${MarkdownRenderer}
                      content=${content}
                      className="max-w-none text-[14px] leading-7 text-[var(--v2-text)]"
                    />`
                  : html`<${SavedFileArtifactPreview} artifact=${selectedArtifact} />`}
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  `;
}
