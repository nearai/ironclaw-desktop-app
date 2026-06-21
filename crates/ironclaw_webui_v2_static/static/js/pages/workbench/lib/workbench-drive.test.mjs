import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeDriveFiles, driveKind, DRIVE_FILE_LIMIT } from './workbench-drive.js';

test('DRIVE_FILE_LIMIT is the documented default', () => {
  assert.equal(DRIVE_FILE_LIMIT, 6);
});

test('driveKind maps known Google mimeTypes and falls back to File', () => {
  assert.equal(driveKind('application/vnd.google-apps.document'), 'Doc');
  assert.equal(driveKind('application/vnd.google-apps.spreadsheet'), 'Sheet');
  assert.equal(driveKind('application/vnd.google-apps.presentation'), 'Slides');
  assert.equal(driveKind('application/vnd.google-apps.folder'), 'Folder');
  assert.equal(driveKind('application/vnd.google-apps.form'), 'Form');
  assert.equal(driveKind('application/pdf'), 'PDF');
  assert.equal(driveKind('image/png'), 'File');
  assert.equal(driveKind(''), 'File');
  assert.equal(driveKind(undefined), 'File');
});

test('normalizeDriveFiles maps a real GOOGLEDRIVE_LIST_FILES file', () => {
  const rows = normalizeDriveFiles({
    successful: true,
    data: {
      files: [
        {
          id: '1dtp',
          name: 'JASON Levels',
          mimeType: 'application/vnd.google-apps.spreadsheet',
          modifiedTime: '2026-06-20T20:11:59.338Z',
          webViewLink: 'https://docs.google.com/spreadsheets/d/1dtp/edit',
          iconLink: 'https://drive-thirdparty.googleusercontent.com/icon'
        }
      ]
    }
  });
  assert.equal(rows.length, 1);
  const [row] = rows;
  assert.equal(row.id, '1dtp');
  assert.equal(row.name, 'JASON Levels');
  assert.equal(row.kind, 'Sheet');
  assert.ok(row.when, 'a human time is derived from the ISO modifiedTime');
  assert.ok(row.link.startsWith('http'), 'webViewLink is used when it is an http(s) url');
});

test('normalizeDriveFiles maps a folder to kind Folder', () => {
  const rows = normalizeDriveFiles({
    successful: true,
    data: {
      files: [
        {
          id: 'fold1',
          name: 'Projects',
          mimeType: 'application/vnd.google-apps.folder',
          modifiedTime: '2026-06-19T10:00:00.000Z',
          webViewLink: 'https://drive.google.com/drive/folders/fold1'
        }
      ]
    }
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'Folder');
});

test('normalizeDriveFiles synthesizes an open-by-id link when webViewLink is absent', () => {
  const rows = normalizeDriveFiles({
    successful: true,
    data: {
      files: [
        {
          id: 'noLink42',
          name: 'No Link Doc',
          mimeType: 'application/vnd.google-apps.document',
          modifiedTime: '2026-06-18T08:30:00.000Z'
        }
      ]
    }
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].link, 'https://drive.google.com/open?id=noLink42');
});

test('normalizeDriveFiles falls back name to (untitled) and drops fully empty rows', () => {
  const rows = normalizeDriveFiles({
    successful: true,
    data: {
      files: [
        { id: 'hasIdNoName', mimeType: 'application/pdf', modifiedTime: '2026-06-17T00:00:00.000Z' },
        { mimeType: 'application/vnd.google-apps.document' } // no id and no name -> dropped
      ]
    }
  });
  assert.equal(rows.length, 1, 'the entry with neither id nor name is dropped');
  assert.equal(rows[0].name, '(untitled)');
  assert.equal(rows[0].link, 'https://drive.google.com/open?id=hasIdNoName');
});

test('normalizeDriveFiles honors the limit option', () => {
  const files = Array.from({ length: 10 }, (_, i) => ({
    id: `f${i}`,
    name: `File ${i}`,
    mimeType: 'application/pdf',
    modifiedTime: '2026-06-16T00:00:00.000Z'
  }));
  assert.equal(normalizeDriveFiles({ successful: true, data: { files } }, { limit: 3 }).length, 3);
  assert.equal(normalizeDriveFiles({ successful: true, data: { files } }).length, 6);
});

test('normalizeDriveFiles returns [] for unsuccessful or malformed payloads', () => {
  assert.deepEqual(normalizeDriveFiles(null), []);
  assert.deepEqual(normalizeDriveFiles({ successful: false }), []);
  assert.deepEqual(normalizeDriveFiles({ data: {} }), []);
  assert.deepEqual(normalizeDriveFiles({ data: { files: 'nope' } }), []);
});
