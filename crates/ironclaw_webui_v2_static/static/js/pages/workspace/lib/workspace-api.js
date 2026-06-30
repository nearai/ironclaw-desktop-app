// Read-only filesystem-viewer API client.
//
// Wraps the Reborn WebChat v2 `/fs/*` endpoints as the path-oriented surface
// the workspace tree/viewer consume. A "qualified path" is
// `<mount>/<mount-relative-path>`: the first segment selects the mount
// (memory/workspace/etc.), and the rest is the path inside it. The empty path
// lists available mounts as top-level directories. There is intentionally no
// write/save path on this surface.

import { apiFetch } from '../../../lib/api.js';
import { fetchAttachmentBlob, fetchAttachmentDataUrl } from '../../../lib/project-files-api.js';
import { areaDisplayName } from './workspace-presenters.js';

const FS_BASE = '/api/webchat/v2/fs';
const MAX_INLINE_TEXT_BYTES = 1024 * 1024;
const MAX_INLINE_IMAGE_BYTES = 8 * 1024 * 1024;

function splitQualified(qualifiedPath) {
  const segments = String(qualifiedPath || '')
    .split('/')
    .filter(Boolean);
  const mount = segments.shift() || '';
  return { mount, path: segments.join('/') };
}

function joinQualified(mount, relativePath) {
  return relativePath ? `${mount}/${relativePath}` : mount;
}

function isTextLikeMime(mime) {
  const value = String(mime || '').toLowerCase();
  return (
    value.startsWith('text/') ||
    value === 'application/json' ||
    value === 'application/javascript' ||
    value === 'application/xml' ||
    value.endsWith('+json') ||
    value.endsWith('+xml')
  );
}

function isImageMime(mime) {
  return String(mime || '')
    .toLowerCase()
    .startsWith('image/');
}

function isLikelyBinaryMime(mime) {
  const value = String(mime || '').toLowerCase();
  return (
    value.startsWith('audio/') ||
    value.startsWith('video/') ||
    value.startsWith('font/') ||
    value === 'application/pdf' ||
    value === 'application/zip' ||
    value === 'application/gzip'
  );
}

function looksBinary(bytes) {
  const sample = bytes.subarray(0, Math.min(bytes.length, 8192));
  if (sample.indexOf(0) !== -1) return true;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return false;
  } catch {
    return true;
  }
}

function contentUrl(mount, relativePath) {
  const url = new URL(`${FS_BASE}/content`, window.location.origin);
  url.searchParams.set('mount', mount);
  url.searchParams.set('path', relativePath);
  return url.pathname + url.search;
}

export async function listFsMounts() {
  const response = await apiFetch(`${FS_BASE}/mounts`);
  return response?.mounts || [];
}

export async function listWorkspace(qualifiedPath = '') {
  if (!qualifiedPath) {
    const mounts = await listFsMounts();
    return {
      entries: mounts.map((mount) => ({
        name: areaDisplayName(mount.mount),
        path: mount.mount,
        is_dir: true
      }))
    };
  }

  const { mount, path } = splitQualified(qualifiedPath);
  const url = new URL(`${FS_BASE}/list`, window.location.origin);
  url.searchParams.set('mount', mount);
  if (path) url.searchParams.set('path', path);
  const response = await apiFetch(url.pathname + url.search);
  const entries = (response?.entries || []).map((entry) => ({
    name: entry.name,
    path: joinQualified(mount, entry.path),
    is_dir: entry.kind === 'directory'
  }));
  return { entries };
}

export async function readWorkspaceFile(qualifiedPath) {
  const { mount, path } = splitQualified(qualifiedPath);
  if (!mount || !path) {
    return { kind: 'directory', path: qualifiedPath };
  }

  const statUrl = new URL(`${FS_BASE}/stat`, window.location.origin);
  statUrl.searchParams.set('mount', mount);
  statUrl.searchParams.set('path', path);
  const statResponse = await apiFetch(statUrl.pathname + statUrl.search);
  const stat = statResponse?.stat || {};
  const mime = stat.mime_type || 'application/octet-stream';
  const sizeBytes = Number(stat.size_bytes || 0);
  const download = contentUrl(mount, path);
  const base = { path: qualifiedPath, mime, size_bytes: sizeBytes, download_path: download };

  if (stat.kind && stat.kind !== 'file') {
    return { ...base, kind: 'directory' };
  }

  if (isImageMime(mime)) {
    if (sizeBytes > MAX_INLINE_IMAGE_BYTES) {
      return { ...base, kind: 'binary' };
    }
    const image_data_url = await fetchAttachmentDataUrl(download);
    return { ...base, kind: 'image', image_data_url };
  }

  if (isLikelyBinaryMime(mime) || sizeBytes > MAX_INLINE_TEXT_BYTES) {
    return { ...base, kind: 'binary' };
  }

  const blob = await fetchAttachmentBlob(download);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (!isTextLikeMime(mime) && looksBinary(bytes)) {
    return { ...base, kind: 'binary' };
  }
  const content = new TextDecoder('utf-8').decode(bytes);
  return { ...base, kind: 'text', content };
}
