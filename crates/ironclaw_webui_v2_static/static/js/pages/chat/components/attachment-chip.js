import { React, html } from '../../../lib/html.js';
import { Icon } from '../../../design-system/icons.js';
import { fetchAttachmentBlob, fetchAttachmentDataUrl } from '../../../lib/api.js';
import { saveBlob } from '../../../lib/save-file.js';
import { toast } from '../../../lib/toast.js';
import { useT } from '../../../lib/i18n.js';

/* Thumbnail for one attachment. Persisted images are bearer-protected, so the
   bytes are fetched and turned into a data URL instead of using <img src> on
   the protected route directly. */
export function AttachmentThumbnail({ att }) {
  const isImage = att.kind === 'image' || (att.mime_type || '').toLowerCase().startsWith('image/');
  const [resolvedUrl, setResolvedUrl] = React.useState(() =>
    isImage ? att.preview_url || null : null
  );

  React.useEffect(() => {
    if (!isImage) {
      setResolvedUrl(null);
      return undefined;
    }
    if (att.preview_url) {
      setResolvedUrl(att.preview_url);
      return undefined;
    }
    if (!att.fetch_url) {
      setResolvedUrl(null);
      return undefined;
    }
    setResolvedUrl(null);
    let cancelled = false;
    fetchAttachmentDataUrl(att.fetch_url)
      .then((url) => {
        if (!cancelled) setResolvedUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isImage, att.preview_url, att.fetch_url]);

  if (isImage && resolvedUrl) {
    return html`<img
      src=${resolvedUrl}
      alt=${att.filename || 'attachment'}
      className="h-9 w-9 shrink-0 rounded object-cover"
    />`;
  }
  return html`<${Icon}
    name="file"
    className="h-3.5 w-3.5 shrink-0 text-[var(--v2-accent-text)]"
  />`;
}

const ATTACHMENT_CHIP_BASE =
  'flex items-stretch rounded-[7px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] text-xs';
const ATTACHMENT_CHIP_PADDING = 'px-3 py-2';

export function AttachmentChip({ att, onPreview, testId, dataPath, downloadTestId }) {
  const t = useT();
  const [downloading, setDownloading] = React.useState(false);

  const onDownload = React.useCallback(async () => {
    if (!att.fetch_url) return;
    setDownloading(true);
    try {
      const blob = await fetchAttachmentBlob(att.fetch_url);
      const saved = await saveBlob(blob, att.filename || 'download');
      if (saved) toast(`Saved ${String(saved).split('/').pop()}`, { tone: 'success' });
    } catch (_) {
      toast(t('chat.fileDownloadFailed'), { tone: 'error' });
    } finally {
      setDownloading(false);
    }
  }, [att.fetch_url, att.filename, t]);

  const inner = html`
    <${AttachmentThumbnail} att=${att} />
    <span className="truncate">${att.filename || 'attachment'}</span>
    <span className="ml-auto shrink-0 text-[var(--v2-text-muted)]"
      >${att.mime_type}${att.size_label ? ' / ' + att.size_label : ''}</span
    >
  `;

  if (!att.fetch_url && !att.preview_url) {
    return html`<div
      className=${`${ATTACHMENT_CHIP_BASE} ${ATTACHMENT_CHIP_PADDING} items-center gap-2`}
      data-testid=${testId}
      data-file-path=${dataPath}
    >
      ${inner}
    </div>`;
  }

  return html`<div className=${`${ATTACHMENT_CHIP_BASE} overflow-hidden`}>
    <button
      type="button"
      onClick=${() => onPreview(att)}
      aria-label=${`Preview ${att.filename || 'attachment'}`}
      data-testid=${testId}
      data-file-path=${dataPath}
      className=${`flex min-w-0 flex-1 items-center gap-2 ${ATTACHMENT_CHIP_PADDING} text-left transition-colors hover:bg-[var(--v2-surface-muted)]`}
    >
      ${inner}
    </button>
    ${att.fetch_url &&
    html`<button
      type="button"
      onClick=${onDownload}
      disabled=${downloading}
      aria-label=${`Download ${att.filename || 'attachment'}`}
      data-testid=${downloadTestId}
      className="flex shrink-0 items-center border-l border-[var(--v2-panel-border)] px-2.5 text-[var(--v2-text-muted)] transition-colors hover:bg-[var(--v2-surface-muted)] hover:text-[var(--v2-text-strong)] disabled:opacity-50"
    >
      <${Icon} name="download" className="h-3.5 w-3.5" />
    </button>`}
  </div>`;
}
