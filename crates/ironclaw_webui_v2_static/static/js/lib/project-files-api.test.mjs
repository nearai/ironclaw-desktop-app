import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fetchAttachmentBlob,
  listProjectFiles,
  projectFileContentUrl,
  statProjectFile
} from './project-files-api.js';

function setupBrowserEnv({ token = 'token-1', fetchImpl } = {}) {
  globalThis.window = {
    location: { origin: 'https://app.test' }
  };
  globalThis.sessionStorage = {
    getItem: () => token,
    setItem: () => {},
    removeItem: () => {}
  };
  globalThis.fetch =
    fetchImpl ||
    (async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }));
}

test('project file APIs encode thread ids and path query values', async () => {
  const calls = [];
  setupBrowserEnv({
    fetchImpl: async (path, options) => {
      calls.push({ path, options });
      return new Response(JSON.stringify({ files: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
  });

  await listProjectFiles({ threadId: 'thread/1', path: 'dir/a b.txt' });
  await statProjectFile({ threadId: 'thread/1', path: 'dir/a b.txt' });

  assert.equal(
    calls[0].path,
    '/api/webchat/v2/threads/thread%2F1/files?path=dir%2Fa+b.txt'
  );
  assert.equal(
    calls[1].path,
    '/api/webchat/v2/threads/thread%2F1/files/stat?path=dir%2Fa+b.txt'
  );
  assert.equal(calls[0].options.headers.get('Authorization'), 'Bearer token-1');
});

test('projectFileContentUrl requires inputs and encodes content paths', () => {
  assert.throws(() => projectFileContentUrl({ threadId: 'thread-1' }), /requires threadId and path/);
  assert.equal(
    projectFileContentUrl({ threadId: 'thread/1', path: 'dir/a b.txt' }),
    '/api/webchat/v2/threads/thread%2F1/files/content?path=dir%2Fa+b.txt'
  );
});

test('fetchAttachmentBlob rejects cross-origin URLs, forwards signals, and surfaces API errors', async () => {
  const controller = new AbortController();
  const calls = [];
  setupBrowserEnv({
    fetchImpl: async (path, options) => {
      calls.push({ path, options });
      return new Response(JSON.stringify({ kind: 'file_missing', message: 'No file' }), {
        status: 404,
        statusText: 'Not Found',
        headers: { 'content-type': 'application/json' }
      });
    }
  });

  await assert.rejects(
    fetchAttachmentBlob('https://evil.test/file'),
    /Invalid attachment URL/
  );

  await assert.rejects(fetchAttachmentBlob('/api/file.bin', { signal: controller.signal }), (err) => {
    assert.equal(err.name, 'ApiError');
    assert.equal(err.status, 404);
    assert.equal(err.payload.kind, 'file_missing');
    return true;
  });
  assert.equal(calls[0].path, '/api/file.bin');
  assert.equal(calls[0].options.signal, controller.signal);
  assert.equal(calls[0].options.headers.get('Accept'), 'application/octet-stream');
});
