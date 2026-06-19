import {
  ApiError,
  V2_BASE,
  apiFetch,
  describeApiError,
  gatewayFetch,
  gatewayOrigin,
  gatewayUrl,
  parseErrorBody,
  readStoredToken
} from './api.js';

function projectFilesBase(threadId) {
  return `${V2_BASE}/threads/${encodeURIComponent(threadId)}/files`;
}

export function listProjectFiles({ threadId, path } = {}) {
  if (!threadId) return Promise.reject(new Error('threadId is required'));
  const url = new URL(projectFilesBase(threadId), window.location.origin);
  if (path) url.searchParams.set('path', path);
  return apiFetch(url.pathname + url.search);
}

export function statProjectFile({ threadId, path } = {}) {
  if (!threadId || !path) {
    return Promise.reject(new Error('threadId and path are required'));
  }
  const url = new URL(`${projectFilesBase(threadId)}/stat`, window.location.origin);
  url.searchParams.set('path', path);
  return apiFetch(url.pathname + url.search);
}

export function projectFileContentUrl({ threadId, path } = {}) {
  if (!threadId || !path) {
    throw new Error('projectFileContentUrl requires threadId and path');
  }
  const url = new URL(`${projectFilesBase(threadId)}/content`, window.location.origin);
  url.searchParams.set('path', path);
  return url.pathname + url.search;
}

function relativeGatewayPath(path) {
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin) {
    throw new ApiError('Invalid attachment URL.', {
      status: 400,
      statusText: 'Bad Request'
    });
  }
  return url.pathname + url.search;
}

export async function fetchAttachmentBlob(path, { signal } = {}) {
  const relativePath = relativeGatewayPath(path);
  const token = readStoredToken();
  const headers = new Headers();
  headers.set('Accept', 'application/octet-stream');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await gatewayFetch(gatewayUrl(relativePath), {
    credentials: gatewayOrigin() ? 'omit' : 'same-origin',
    headers,
    signal
  });
  if (!response.ok) {
    const { text, payload } = await parseErrorBody(response);
    throw new ApiError(describeApiError({ payload, body: text, statusText: response.statusText }), {
      status: response.status,
      statusText: response.statusText,
      body: text,
      headers: response.headers,
      payload
    });
  }
  return response.blob();
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('attachment read failed'));
    reader.readAsDataURL(blob);
  });
}

export async function fetchAttachmentDataUrl(path) {
  return blobToDataUrl(await fetchAttachmentBlob(path));
}

export async function fetchProjectFileBlob({ threadId, path } = {}) {
  if (!threadId || !path) {
    throw new Error('threadId and path are required');
  }
  return fetchAttachmentBlob(projectFileContentUrl({ threadId, path }));
}
