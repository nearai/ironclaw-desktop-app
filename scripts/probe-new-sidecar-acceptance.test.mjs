import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  OUTBOUND_DELIVERY_CHECK_NAME,
  SLACK_ADMIN_MANAGED_CHECK_NAME,
  evaluateOutboundDeliveryRoutes,
  evaluateSlackAdminManagedRoutes
} from './probe-new-sidecar-acceptance.mjs';

test('new sidecar acceptance gates Slack admin-managed routes when advertised', async () => {
  const source = await readFile(
    new URL('./probe-new-sidecar-acceptance.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /'channels\/connectable'/);
  assert.match(source, /admin_managed_channels/);
  assert.match(source, /channels\/slack\/allowed/);
  assert.match(source, /channels\/slack\/subjects/);
  assert.match(
    source,
    /Slack admin-managed capability is backed by allowed-channel and subject routes/
  );
});

test('new sidecar acceptance recognizes the top-level Slack admin-managed strategy used by the UI', () => {
  const verdict = evaluateSlackAdminManagedRoutes({
    connectable: {
      body: {
        channels: [{ channel: 'slack', strategy: 'admin_managed_channels' }]
      }
    },
    allowed: { res: { ok: true, status: 200 }, body: { channels: [] } },
    subjects: { res: { ok: true, status: 200 }, body: { subjects: [] } }
  });

  assert.equal(verdict.pass, true);
  assert.deepEqual(verdict.detail, {
    advertised: true,
    allowed_status: 200,
    subjects_status: 200
  });
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

test('new sidecar acceptance fails when top-level admin-managed Slack is missing subjects route', () => {
  const verdict = evaluateSlackAdminManagedRoutes({
    connectable: {
      body: {
        channels: [{ channel: 'slack', strategy: 'admin_managed_channels' }]
      }
    },
    allowed: { res: { ok: true, status: 200 }, body: { channels: [] } },
    subjects: { res: { ok: false, status: 404 }, body: null }
  });

  assert.equal(verdict.name, SLACK_ADMIN_MANAGED_CHECK_NAME);
  assert.equal(verdict.pass, false);
  assert.deepEqual(verdict.detail, {
    advertised: true,
    allowed_status: 200,
    subjects_status: 404
  });
});

test('new sidecar acceptance requires outbound delivery route shapes', () => {
  const verdict = evaluateOutboundDeliveryRoutes({
    preferences: {
      res: { ok: true, status: 200 },
      body: {
        final_reply_target: null,
        final_reply_target_status: 'none_configured'
      }
    },
    targets: { res: { ok: true, status: 200 }, body: { targets: [] } }
  });

  assert.equal(verdict.name, OUTBOUND_DELIVERY_CHECK_NAME);
  assert.equal(verdict.pass, true);
  assert.deepEqual(verdict.detail, {
    preferences_status: 200,
    targets_status: 200,
    has_final_reply_target: true,
    has_final_reply_target_status: true,
    final_reply_target_defaulted: false,
    targets_count: 0
  });
});

test('new sidecar acceptance accepts omitted target when status is none configured', () => {
  const verdict = evaluateOutboundDeliveryRoutes({
    preferences: {
      res: { ok: true, status: 200 },
      body: {
        final_reply_target_status: 'none_configured'
      }
    },
    targets: { res: { ok: true, status: 200 }, body: { targets: [] } }
  });

  assert.equal(verdict.name, OUTBOUND_DELIVERY_CHECK_NAME);
  assert.equal(verdict.pass, true);
  assert.deepEqual(verdict.detail, {
    preferences_status: 200,
    targets_status: 200,
    has_final_reply_target: false,
    has_final_reply_target_status: true,
    final_reply_target_defaulted: true,
    targets_count: 0
  });
});

test('new sidecar acceptance fails malformed outbound delivery routes', () => {
  const missingPreferenceFields = evaluateOutboundDeliveryRoutes({
    preferences: { res: { ok: true, status: 200 }, body: { ok: true } },
    targets: { res: { ok: true, status: 200 }, body: { targets: [] } }
  });
  const missingTargetsArray = evaluateOutboundDeliveryRoutes({
    preferences: {
      res: { ok: true, status: 200 },
      body: {
        final_reply_target: null,
        final_reply_target_status: 'none_configured'
      }
    },
    targets: { res: { ok: true, status: 200 }, body: { ok: true } }
  });

  assert.equal(missingPreferenceFields.pass, false);
  assert.equal(missingPreferenceFields.detail.has_final_reply_target, false);
  assert.equal(missingPreferenceFields.detail.has_final_reply_target_status, false);
  assert.equal(missingTargetsArray.pass, false);
  assert.equal(missingTargetsArray.detail.targets_count, null);
});
