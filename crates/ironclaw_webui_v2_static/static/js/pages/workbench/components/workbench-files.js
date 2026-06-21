import { useQuery } from '@tanstack/react-query';

import { Icon } from '../../../design-system/icons.js';
import { React, html } from '../../../lib/html.js';
import { fetchAttachmentBlob } from '../../../lib/project-files-api.js';
import { saveBlob } from '../../../lib/save-file.js';
import { cn } from '../../../utils/cn.js';
import {
  listFsMounts,
  listWorkspace,
  readWorkspaceFile
} from '../../workspace/lib/workspace-api.js';

function cleanText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function fileName(path) {
  const parts = String(path || '')
    .split('/')
    .filter(Boolean);
  return parts[parts.length - 1] || path || 'workspace';
}

function mimeForText(path) {
  const lower = String(path || '').toLowerCase();
  if (lower.endsWith('.md')) return 'text/markdown';
  if (lower.endsWith('.json')) return 'application/json';
  return 'text/plain';
}

function textFileFromWorkspace(file) {
  const name = fileName(file?.path);
  const type = file?.mime || mimeForText(name);
  return new File([file.content], name, { type });
}

function errorMessage(error, fallback) {
  return cleanText(error?.message || error, fallback);
}

function canAttachText(file) {
  return file?.kind === 'text' && typeof file.content === 'string';
}

function WorkbenchFileError({ title, error }) {
  return html`
    <div className="wb13-empty is-compact" role="alert">
      <strong>${title}</strong>
      <br />
      <span>${errorMessage(error, 'The filesystem request failed.')}</span>
    </div>
  `;
}

export function WorkbenchWorkspaceFiles({ onAttachFile }) {
  const [open, setOpen] = React.useState(false);
  const [selectedPath, setSelectedPath] = React.useState('');
  const [selectedFilePath, setSelectedFilePath] = React.useState('');
  const [downloadingPath, setDownloadingPath] = React.useState('');
  const [downloadError, setDownloadError] = React.useState('');

  const mountsQuery = useQuery({
    queryKey: ['workbench-fs-mounts'],
    queryFn: listFsMounts,
    retry: false,
    staleTime: 30_000
  });
  const mounts = Array.isArray(mountsQuery.data) ? mountsQuery.data : [];
  const activeMount = mounts[0]?.mount || '';

  React.useEffect(() => {
    if (!selectedPath && activeMount) setSelectedPath(activeMount);
  }, [activeMount, selectedPath]);

  const listQuery = useQuery({
    queryKey: ['workbench-fs-list', selectedPath],
    queryFn: () => listWorkspace(selectedPath),
    enabled: Boolean(selectedPath),
    retry: false,
    staleTime: 15_000
  });
  const entries = Array.isArray(listQuery.data?.entries) ? listQuery.data.entries : [];

  React.useEffect(() => {
    if (selectedFilePath || !entries.length) return;
    const firstFile = entries.find((entry) => !entry.is_dir);
    if (firstFile?.path) setSelectedFilePath(firstFile.path);
  }, [entries, selectedFilePath]);

  const fileQuery = useQuery({
    queryKey: ['workbench-fs-file', selectedFilePath],
    queryFn: () => readWorkspaceFile(selectedFilePath),
    enabled: Boolean(selectedFilePath),
    retry: false,
    staleTime: 15_000
  });
  const file = fileQuery.data;
  const unavailable = Boolean(mountsQuery.error) || (!mountsQuery.isLoading && mounts.length === 0);
  const canAttachSelectedFile = canAttachText(file);

  React.useEffect(() => {
    setDownloadError('');
  }, [selectedFilePath]);

  const handleDownload = React.useCallback(async (workspaceFile) => {
    if (!workspaceFile?.download_path) return;
    const downloadKey = workspaceFile.path || workspaceFile.download_path;
    setDownloadingPath(downloadKey);
    setDownloadError('');
    try {
      const blob = await fetchAttachmentBlob(workspaceFile.download_path);
      await saveBlob(blob, fileName(workspaceFile.path));
    } catch (error) {
      setDownloadError(errorMessage(error, 'Download failed.'));
    } finally {
      setDownloadingPath('');
    }
  }, []);

  const renderPreviewHead = (workspaceFile, { attach = false } = {}) => html`
    <div className="wb13-file-preview-head">
      <span><${Icon} name="file" />${fileName(workspaceFile.path)}</span>
      ${attach
        ? html`
            <button
              type="button"
              className="wb13-button is-sm"
              onClick=${() => onAttachFile?.(textFileFromWorkspace(workspaceFile))}
            >
              Attach to Ask
            </button>
          `
        : workspaceFile.download_path
          ? html`
              <button
                type="button"
                className="wb13-button is-sm"
                disabled=${downloadingPath === (workspaceFile.path || workspaceFile.download_path)}
                onClick=${() => handleDownload(workspaceFile)}
              >
                Download
              </button>
            `
          : null}
    </div>
  `;

  return html`
    <div className="wb13-section wb13-files-drawer" data-testid="workbench-workspace-files">
      <button
        type="button"
        className="wb13-files-toggle"
        aria-expanded=${open}
        onClick=${() => setOpen((value) => !value)}
      >
        <span>
          <strong>Local files</strong>
          <small>Attach from this workspace when the request needs it.</small>
        </span>
        <${Icon} name=${open ? 'chevronUp' : 'chevronDown'} />
      </button>
      ${open && unavailable
        ? html`<div className="wb13-empty">
            Local workspace browsing is not available from the gateway right now. Saved Work items
            still render above.
          </div>`
        : open
          ? html`
              <div className="wb13-files">
                <div className="wb13-files-list">
                  <div className="wb13-files-title">
                    ${mountsQuery.isLoading
                      ? 'Checking mounts'
                      : cleanText(activeMount, 'Workspace')}
                  </div>
                  ${listQuery.isLoading
                    ? html`<div className="wb13-empty is-compact">Loading workspace files...</div>`
                    : listQuery.error
                      ? html`<${WorkbenchFileError}
                          title="Could not load workspace files."
                          error=${listQuery.error}
                        />`
                      : entries.length
                        ? entries.map(
                            (entry) => html`
                              <button
                                key=${entry.path}
                                type="button"
                                className=${cn(
                                  'wb13-file-row',
                                  selectedFilePath === entry.path && 'is-active'
                                )}
                                onClick=${() => {
                                  if (entry.is_dir) {
                                    setSelectedPath(entry.path);
                                    setSelectedFilePath('');
                                  } else {
                                    setSelectedFilePath(entry.path);
                                  }
                                }}
                              >
                                <${Icon} name=${entry.is_dir ? 'folder' : 'file'} />
                                <span>${entry.name || fileName(entry.path)}</span>
                              </button>
                            `
                          )
                        : html`<div className="wb13-empty is-compact">
                            This workspace mount has no visible files.
                          </div>`}
                </div>
                <div className="wb13-files-viewer">
                  ${fileQuery.isLoading
                    ? html`<div className="wb13-empty is-compact">Loading preview...</div>`
                    : fileQuery.error
                      ? html`<${WorkbenchFileError}
                          title="Could not read this file."
                          error=${fileQuery.error}
                        />`
                      : file?.kind === 'text' && canAttachSelectedFile
                        ? html`
                            ${renderPreviewHead(file, { attach: true })}
                            <pre>${file.content}</pre>
                          `
                        : file?.kind === 'text'
                          ? html`<${WorkbenchFileError}
                              title="Could not read this file."
                              error="Readable text content is unavailable."
                            />`
                          : file?.kind === 'image'
                            ? html`
                                ${renderPreviewHead(file)}
                                <img src=${file.image_data_url} alt="" />
                              `
                            : file?.kind === 'binary'
                              ? html`
                                  ${renderPreviewHead(file)}
                                  <div className="wb13-empty is-compact">
                                    ${file.download_path
                                      ? `${fileName(file.path)} can be downloaded, but it is not previewable or attachable from here.`
                                      : `${fileName(file.path)} is not previewable or attachable from here.`}
                                  </div>
                                `
                              : html`<div className="wb13-empty is-compact">
                                  Select a workspace file to preview it.
                                </div>`}
                  ${downloadError
                    ? html`<div className="wb13-empty is-compact" role="alert">
                        ${downloadError}
                      </div>`
                    : null}
                </div>
              </div>
            `
          : null}
    </div>
  `;
}
