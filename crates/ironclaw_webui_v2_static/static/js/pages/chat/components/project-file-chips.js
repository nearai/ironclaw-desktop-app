import { React, html } from '../../../lib/html.js';
import { projectFileContentUrl, statProjectFile } from '../../../lib/project-files-api.js';
import { AttachmentChip } from './attachment-chip.js';
import { AttachmentPreviewModal } from './attachment-preview.js';
import { basename, extractWorkspaceFilePaths, formatSize } from '../lib/project-file-paths.js';

function ProjectFileChip({ threadId, path, onPreview }) {
  const [meta, setMeta] = React.useState({ mime_type: '', size_label: '' });

  // Best-effort size for the chip; a stat failure (missing file, race) just
  // leaves the metadata blank rather than surfacing an error.
  React.useEffect(() => {
    let active = true;
    statProjectFile({ threadId, path })
      .then((response) => {
        if (!active || !response?.stat) return;
        setMeta({
          mime_type: response.stat.mime_type || '',
          size_label: formatSize(response.stat.size_bytes)
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [threadId, path]);

  const att = {
    filename: basename(path),
    mime_type: meta.mime_type,
    size_label: meta.size_label,
    fetch_url: projectFileContentUrl({ threadId, path })
  };

  return html`<${AttachmentChip}
    att=${att}
    onPreview=${onPreview}
    testId="project-file-chip"
    dataPath=${path}
    downloadTestId="project-file-download"
  />`;
}

// Render a chip row for every workspace file path referenced in `content`.
// Renders nothing when there are no references or no thread context.
export function ProjectFileChips({ threadId, content }) {
  const paths = React.useMemo(() => extractWorkspaceFilePaths(content), [content]);
  const [previewAttachment, setPreviewAttachment] = React.useState(null);
  if (!threadId || paths.length === 0) return null;
  return html`
    <div className="mt-2 flex flex-col gap-1.5">
      ${paths.map(
        (path) =>
          html`<${ProjectFileChip}
            key=${path}
            threadId=${threadId}
            path=${path}
            onPreview=${setPreviewAttachment}
          />`
      )}
      <${AttachmentPreviewModal}
        open=${Boolean(previewAttachment)}
        onClose=${() => setPreviewAttachment(null)}
        attachment=${previewAttachment}
      />
    </div>
  `;
}
