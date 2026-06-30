import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyRisk } from './approval-risk.js';

test('classifyRisk: command tool name wins over read-ish description', () => {
  assert.deepEqual(classifyRisk('bash', 'reads files safely', '{}'), {
    tone: 'warning',
    key: 'tool.riskExec',
    allowAlways: false
  });
});

test('classifyRisk: read tool mentioning edit in description is not danger', () => {
  assert.deepEqual(classifyRisk('read', 'Inspect edit history without changing files', '{}'), {
    tone: 'muted',
    key: 'tool.riskRead',
    allowAlways: true
  });
});

test('classifyRisk: write-like tool name is danger', () => {
  assert.deepEqual(classifyRisk('write_file', 'Writes a file', '{}'), {
    tone: 'danger',
    key: 'tool.riskWrite',
    allowAlways: false
  });
});

test('classifyRisk: legacy approval action kinds get specific danger labels', () => {
  const cases = [
    ['send_email', 'tool.riskSend'],
    ['execute_trade', 'tool.riskTrade'],
    ['git_push', 'tool.riskPublish'],
    ['create_pr', 'tool.riskPublish'],
    ['export_file', 'tool.riskExport'],
    ['publish_post', 'tool.riskPublish'],
    ['reply_to_customer', 'tool.riskSend'],
    ['delete_file', 'tool.riskDelete']
  ];
  for (const [toolName, key] of cases) {
    assert.deepEqual(classifyRisk(toolName, 'Legacy approval action', '{}'), {
      tone: 'danger',
      key,
      allowAlways: false
    });
  }
});

test('classifyRisk: compose is a send (outbound), not a generic create/save write', () => {
  // SEND/PUBLISH are tested before WRITE so a send-shaped verb is not downgraded
  // to a plain "writes files" label even though it also reads as creation.
  assert.deepEqual(classifyRisk('compose_message', 'Compose a reply', '{}'), {
    tone: 'danger',
    key: 'tool.riskSend',
    allowAlways: false
  });
});

test('classifyRisk: create_draft is a write (creates a file/record)', () => {
  assert.deepEqual(classifyRisk('create_draft', 'Create a draft document', '{}'), {
    tone: 'danger',
    key: 'tool.riskWrite',
    allowAlways: false
  });
});

test('classifyRisk: a recognizable read verb keeps the muted reads label', () => {
  assert.deepEqual(classifyRisk('list_invoices', 'List invoices', '{}'), {
    tone: 'muted',
    key: 'tool.riskRead',
    allowAlways: true
  });
});

test('classifyRisk: an unknown vendor tool is flagged for review, not whitewashed green', () => {
  // No recognizable verb: the classifier must NOT default to a safe "reads"
  // badge with always-allow. It surfaces a neutral review warning instead.
  assert.deepEqual(classifyRisk('acme_zorp', 'Vendor-specific action', '{}'), {
    tone: 'warning',
    key: 'tool.riskUnknown',
    allowAlways: false
  });
});
