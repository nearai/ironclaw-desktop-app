import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  SLACK_ADMIN_MANAGED_CHECK_NAME,
  evaluateSlackAdminManagedRoutes
} from './probe-new-sidecar-acceptance.mjs';

test('new sidecar acceptance gates Slack admin-managed routes when advertised', async () => {
  const source = await readFile(new URL('./probe-new-sidecar-acceptance.mjs', import.meta.url), 'utf8');

  assert.match(source, /'channels\/connectable'/);
  assert.match(source, /admin_managed_channels/);
  assert.match(source, /channels\/slack\/allowed/);
  assert.match(source, /channels\/slack\/subjects/);
  assert.match(
    source,
    /Slack admin-managed capability is backed by allowed-channel and subject routes/
  );
});

test('new sidecar acceptance fails when admin-managed Slack routes are missing', () => {
  const verdict = evaluateSlackAdminManagedRoutes({
    connectable: {
      body: {
        channels: [{ channel: 'slack', action: { strategy: 'admin_managed_channels' } }]
      }
    },
    allowed: { res: { ok: false, status: 404 }, body: null },
    subjects: { res: { ok: true, status: 200 }, body: { subjects: [] } }
  });

  assert.equal(verdict.name, SLACK_ADMIN_MANAGED_CHECK_NAME);
  assert.equal(verdict.pass, false);
  assert.deepEqual(verdict.detail, {
    advertised: true,
    allowed_status: 404,
    subjects_status: 200
  });
});

test('new sidecar acceptance ignores Slack routes when admin-managed Slack is not advertised', () => {
  const verdict = evaluateSlackAdminManagedRoutes({
    connectable: { body: { channels: [] } },
    allowed: { res: { ok: false, status: 404 }, body: null },
    subjects: { res: { ok: false, status: 404 }, body: null }
  });

  assert.equal(verdict.pass, true);
  assert.equal(verdict.detail.advertised, false);
});
