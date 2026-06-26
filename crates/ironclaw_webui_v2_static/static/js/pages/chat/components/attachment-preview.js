/**
 * AttachmentPreviewModal — click a chip, see the document.
 *
 * Three data situations, in order of fidelity:
 *   1. Composer / just-sent (sourceFile present): PDFs render as real pages
 *      via the shared pdf.js loader; everything else shows extracted text.
 *   2. Reload (embedded_text captured from the durable manifest): text view —
 *      exactly what the model received, including the truncation banner.
 *   3. Nothing retained (raw binary, pre-embed sends): an honest empty state.
 *
 * Dependency-free; hosted by the design-system Modal.
 */
import { React, html } from '../../../lib/html.js';
import { Modal, ModalBody } from '../../../design-system/modal.js';
import { Icon } from '../../../design-system/icons.js';
import { useT } from '../../../lib/i18n.js';
import { fetchAttachmentBlob } from '../../../lib/project-files-api.js';
import { loadPdfjs, isPdfAttachment } from '../lib/extract-attachment-text.js';
import { saveBlob } from '../../../lib/save-file.js';
import { toast } from '../../../lib/toast.js';

const PDF_PREVIEW_MAX_PAGES = 8;
const PDF_PREVIEW_WIDTH = 720;
const MAX_TEXT_PREVIEW_BYTES = 128_000;

// Tab-separated extractions (spreadsheets, CSV-ish) read better in a mono
// grid; prose documents read better in the product face.
function looksTabular(filename, text) {
  const name = String(filename || '').toLowerCase();
  if (/\.(xlsx?|xlsm|csv|tsv)$/.test(name)) return true;
  const sample = String(text || '').slice(0, 2000);
  return sample.split('\n').filter((line) => line.includes('\t')).length > 3;
}

function statusBanner(att, t) {
  const status = String(att.extraction_status || '');
  if (status === 'extracted_text_truncated') {
    return { tone: 'warning', label: t('chat.previewTruncated') };
  }
  if (status === 'content_omitted_message_budget') {
    return { tone: 'warning', label: t('chat.previewOmitted') };
  }
  return null;
}

function attachmentPreviewMode(mime) {
  const normalized = String(mime || '').toLowerCase();
  if (normalized.startsWith('image/')) return 'image';
  if (normalized.startsWith('audio/')) return 'audio';
  if (normalized.startsWith('video/')) return 'video';
  if (normalized === 'application/pdf') return 'pdf';
  if (
    normalized.startsWith('text/') ||
    normalized === 'application/json' ||
    normalized === 'application/xml' ||
    normalized === 'application/csv' ||
    normalized.endsWith('+json') ||
    normalized.endsWith('+xml')
  ) {
    return 'text';
  }
  return 'download';
}

function PdfPagesPreview({ sourceFile }) {
  const t = useT();
  const containerRef = React.useRef(null);
  const [state, setState] = React.useState({ status: 'rendering', pages: 0, total: 0 });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const bytes = new Uint8Array(await sourceFile.arrayBuffer());
        const pdfjs = await loadPdfjs();
        // pdf.js transfers (detaches) the buffer it is given — always hand
        // it a copy so re-opening the preview still has the original.
        const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
        const total = Math.min(doc.numPages, PDF_PREVIEW_MAX_PAGES);
        setState({ status: 'rendering', pages: 0, total, numPages: doc.numPages });
        for (let pageNo = 1; pageNo <= total; pageNo += 1) {
          if (cancelled || !containerRef.current) return;
          const page = await doc.getPage(pageNo);
          const viewport = page.getViewport({ scale: 1 });
          const scale = PDF_PREVIEW_WIDTH / viewport.width;
          const scaled = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(scaled.width);
          canvas.height = Math.ceil(scaled.height);
          canvas.className = 'mb-3 w-full rounded-[12px] border border-[var(--v2-panel-border)]';
          await page.render({ canvasContext: canvas.getContext('2d'), viewport: scaled }).promise;
          if (cancelled || !containerRef.current) return;
          containerRef.current.appendChild(canvas);
          setState((prev) => ({ ...prev, pages: pageNo }));
        }
        if (!cancelled) setState((prev) => ({ ...prev, status: 'done' }));
      } catch (_) {
        if (!cancelled) setState((prev) => ({ ...prev, status: 'error' }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sourceFile]);

  return html`
    <div>
      ${state.status === 'rendering' &&
      html`<p className="mb-3 text-xs text-[var(--v2-text-muted)]">
        ${t('chat.previewRenderingPages', {
          done: String(state.pages),
          total: String(state.total || '…')
        })}
      </p>`}
      ${state.status === 'error' &&
      html`<p className="mb-3 text-xs text-[var(--v2-danger-text)]">
        ${t('chat.previewRenderFailed')}
      </p>`}
      <div ref=${containerRef}></div>
      ${state.status === 'done' &&
      state.numPages > state.total &&
      html`<p className="text-xs text-[var(--v2-text-muted)]">
        ${t('chat.previewMorePages', {
          shown: String(state.total),
          total: String(state.numPages)
        })}
      </p>`}
    </div>
  `;
}

/**
 * @param {{ open: boolean, onClose: () => void, attachment: any }} props
 *   attachment: { filename, mime_type, size_label?, extraction_status?,
 *                 embedded_text?, sourceFile?, extractedText? }
 */
export function AttachmentPreviewModal({ open, onClose, attachment }) {
  const t = useT();
  const [remoteState, setRemoteState] = React.useState({
    status: 'idle',
    blob: null,
    objectUrl: '',
    dataUrl: '',
    text: '',
    truncated: false
  });
  const isOpen = Boolean(open && attachment);
  const mode = attachment ? attachmentPreviewMode(attachment.mime_type) : 'download';

  React.useEffect(() => {
    if (!isOpen || !attachment?.fetch_url) {
      setRemoteState({
        status: 'idle',
        blob: null,
        objectUrl: '',
        dataUrl: '',
        text: '',
        truncated: false
      });
      return undefined;
    }

    const controller = new AbortController();
    let cancelled = false;
    let objectUrl = '';
    setRemoteState({
      status: 'loading',
      blob: null,
      objectUrl: '',
      dataUrl: '',
      text: '',
      truncated: false
    });

    fetchAttachmentBlob(attachment.fetch_url, { signal: controller.signal })
      .then(async (blob) => {
        objectUrl = URL.createObjectURL(blob);
        const next = {
          status: 'ready',
          blob,
          objectUrl,
          dataUrl: '',
          text: '',
          truncated: false
        };
        if (mode === 'image' || mode === 'audio' || mode === 'video') {
          next.dataUrl = objectUrl;
        } else if (mode === 'text') {
          const sliced = blob.slice(0, MAX_TEXT_PREVIEW_BYTES);
          next.truncated = blob.size > MAX_TEXT_PREVIEW_BYTES;
          next.text = await sliced.text();
        }
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setRemoteState(next);
      })
      .catch(() => {
        if (!cancelled) {
          setRemoteState({
            status: 'error',
            blob: null,
            objectUrl: '',
            dataUrl: '',
            text: '',
            truncated: false
          });
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isOpen, attachment?.fetch_url, mode]);

  if (!isOpen) return null;

  const text = attachment.extractedText || attachment.embedded_text || remoteState.text || '';
  const canRenderPdfPages =
    attachment.sourceFile && isPdfAttachment({ ...attachment, filename: attachment.filename });
  const banner = statusBanner(attachment, t);
  const canSave = Boolean(attachment.sourceFile || text || attachment.fetch_url);

  const saveAttachment = async () => {
    try {
      const name = attachment.filename || 'attachment';
      let blob;
      let suggested = name;
      if (attachment.sourceFile) {
        blob = attachment.sourceFile;
      } else if (remoteState.blob) {
        blob = remoteState.blob;
      } else if (attachment.fetch_url) {
        blob = await fetchAttachmentBlob(attachment.fetch_url);
      } else {
        blob = new Blob([text], { type: 'text/plain' });
        suggested = `${name}.txt`;
      }
      const saved = await saveBlob(blob, suggested);
      if (saved) toast(`Saved ${String(saved).split('/').pop()}`, { tone: 'success' });
    } catch (_) {
      toast(t('chat.fileDownloadFailed'), { tone: 'error' });
    }
  };

  return html`
    <${Modal}
      open=${open}
      onClose=${onClose}
      size="xl"
      title=${attachment.filename || t('chat.previewTitle')}
    >
      <${ModalBody} className="bg-[var(--v2-surface)]">
        <div className="mb-3 flex items-center gap-2 text-xs text-[var(--v2-text-muted)]">
          <${Icon} name="file" className="h-3.5 w-3.5 text-[var(--v2-accent-text)]" />
          <span>${attachment.mime_type || ''}</span>
          ${attachment.size_label && html`<span>· ${attachment.size_label}</span>`}
          ${text && html`<span className="ml-auto">${t('chat.previewModelNote')}</span>`}
          ${canSave &&
          html`<button
            type="button"
            onClick=${saveAttachment}
            data-testid="attachment-download"
            className=${`${text ? '' : 'ml-auto '}shrink-0 rounded-[6px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] px-2 py-1 text-[var(--v2-text)] hover:bg-[var(--v2-surface-muted)]`}
          >
            ${t('chat.previewSave')}
          </button>`}
        </div>
        ${banner &&
        html`<p
          className="mb-3 rounded-[6px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] px-3 py-2 text-xs text-[var(--v2-warning-text)]"
        >
          ${banner.label}
        </p>`}
        ${canRenderPdfPages
          ? html`<${PdfPagesPreview} sourceFile=${attachment.sourceFile} />`
          : attachment.fetch_url
            ? html`<${RemotePreviewBody}
                mode=${mode}
                remoteState=${remoteState}
                filename=${attachment.filename || t('chat.previewTitle')}
                t=${t}
              />`
            : text
              ? html`<pre
                  className=${`max-w-full whitespace-pre-wrap break-words rounded-[12px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] p-4 text-[13px] leading-relaxed text-[var(--v2-text)] ${
                    looksTabular(attachment.filename, text) ? 'font-mono text-xs' : ''
                  }`}
                  data-testid="attachment-preview-text"
                >
${text}</pre
                >`
              : html`<div
                  className="rounded-[12px] border border-dashed border-[var(--v2-panel-border)] p-8 text-center text-sm text-[var(--v2-text-muted)]"
                >
                  ${t('chat.previewUnavailable')}
                </div>`}
      <//>
    <//>
  `;
}

function RemotePreviewBody({ mode, remoteState, filename, t }) {
  if (remoteState.status === 'loading') {
    return html`<div
      className="rounded-[12px] border border-dashed border-[var(--v2-panel-border)] p-8 text-center text-sm text-[var(--v2-text-muted)]"
    >
      ${t('common.loading')}
    </div>`;
  }
  if (remoteState.status === 'error') {
    return html`<div
      className="rounded-[12px] border border-dashed border-[var(--v2-panel-border)] p-8 text-center text-sm text-[var(--v2-text-muted)]"
    >
      ${t('chat.previewUnavailable')}
    </div>`;
  }
  if (remoteState.status !== 'ready') return null;

  switch (mode) {
    case 'image':
      return html`<img
        src=${remoteState.dataUrl}
        alt=${filename}
        className="mx-auto max-h-[70vh] w-auto rounded object-contain"
      />`;
    case 'audio':
      return html`<audio controls src=${remoteState.dataUrl} className="w-full" />`;
    case 'video':
      return html`<video
        controls
        src=${remoteState.dataUrl}
        className="max-h-[70vh] w-full rounded"
      />`;
    case 'pdf':
      return html`<iframe
        src=${remoteState.objectUrl}
        title=${filename}
        className="h-[70vh] w-full rounded border border-[var(--v2-panel-border)] bg-white"
      />`;
    case 'text':
      return html`<div className="w-full">
        <pre
          className="max-h-[70vh] w-full overflow-auto whitespace-pre-wrap break-words rounded-[12px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] p-4 text-xs leading-relaxed text-[var(--v2-text)]"
          data-testid="attachment-preview-text"
        >
${remoteState.text}</pre
        >
        ${remoteState.truncated &&
        html`<div className="mt-2 text-xs text-[var(--v2-text-muted)]">
          ${t('chat.previewTruncated')}
        </div>`}
      </div>`;
    default:
      return html`<div
        className="flex flex-col items-center gap-2 rounded-[12px] border border-dashed border-[var(--v2-panel-border)] p-8 text-center text-sm text-[var(--v2-text-muted)]"
      >
        <${Icon} name="file" className="h-10 w-10 text-[var(--v2-accent-text)]" />
        <div>${t('chat.previewUnavailable')}</div>
      </div>`;
  }
}
