import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildPacketModel } from '../lib/workbench-packet-model.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const packetPath = path.join(testDir, 'workbench-packet.js');

async function source() {
  return readFile(packetPath, 'utf8');
}

test('workbench packet chrome reads as a general saved-work workspace', async () => {
  const src = await source();

  for (const expected of [
    'Workbench saved work tabs',
    'packetTabLabel(packet, tab.id)',
    'Work summary',
    'Before continuing',
    'Open the saved output and any prepared reply before export, sharing, or Chat handoff',
    'Saved output',
    'No saved output content is available yet.',
    'Context will populate from saved work metadata and future output references.',
    'No activity receipts are saved for this item yet.'
  ]) {
    assert.match(src, new RegExp(escapeRegExp(expected)), `${expected} should remain visible`);
  }

  for (const stale of [
    'Workbench review workspace tabs',
    "{ id: 'document', label: 'Artifact' }",
    "{ id: 'email', label: 'Draft' }",
    "{ id: 'evidence', label: 'Sources' }",
    'Review summary',
    'Review checklist',
    'Artifact reviewed',
    'Draft reviewed',
    'No saved artifact content is available yet.',
    'No response draft or notes are saved with this work item yet.',
    'Workbench packet tabs',
    'Before anything acts',
    'Review status - required before external action',
    'Document v${packet.version}',
    'Email or response draft',
    'Redline or artifact reviewed',
    'Packet email draft',
    'Approval notes',
    'Artifact available for review',
    'Draft appears here when a response is prepared.',
    'No text artifact is available yet.',
    'Current artifact'
  ]) {
    assert.doesNotMatch(src, new RegExp(escapeRegExp(stale)), `${stale} should not return`);
  }
});

test('workbench packet keeps real Work and Chat links without pretending to send', async () => {
  const src = await source();

  assert.match(src, /to=\$\{packet\.href\}/);
  assert.match(src, /Open in Work/);
  assert.match(src, /to=\$\{packet\.threadHref\}/);
  assert.match(src, /Open linked Chat/);
  assert.match(src, /Workbench does not send or approve external actions/);
  assert.match(src, /No external action runs from this modal\./);

  for (const stale of [
    'Review action package',
    'Approve external action',
    'Open Chat approval',
    'Ready to continue. Workbench does not fake the send'
  ]) {
    assert.doesNotMatch(src, new RegExp(escapeRegExp(stale)), `${stale} should not return`);
  }
});

test('buildPacketModel ignores hollow saved artifact placeholders', () => {
  const packet = buildPacketModel([
    {
      id: 'work-placeholder',
      title: 'Placeholder work',
      artifacts: [{ id: 'artifact-placeholder', title: 'No body yet' }]
    }
  ]);

  assert.equal(packet.item, null);
  assert.equal(packet.hasArtifact, false);
  assert.equal(packet.artifactPreview.kind, 'empty');
  assert.equal(packet.href, '/work');
  assert.equal(packet.stateLabel, 'No saved artifact yet');
});

test('buildPacketModel keeps text artifacts readable and file artifacts metadata-only', () => {
  const textPacket = buildPacketModel([
    {
      id: 'work-text',
      title: 'Roadmap extraction',
      artifacts: [{ id: 'artifact-text', title: 'Roadmap.md', content: '# Real saved body' }]
    }
  ]);
  assert.equal(textPacket.hasArtifact, true);
  assert.equal(textPacket.artifactText, '# Real saved body');
  assert.equal(textPacket.artifactPreview.kind, 'text');
  assert.equal(textPacket.href, '/work?item=work-text&artifact=artifact-text');

  const filePacket = buildPacketModel([
    {
      id: 'work-file',
      title: 'Board deck',
      artifacts: [
        {
          id: 'artifact-file',
          title: 'Board deck',
          filename: 'board-deck.pptx',
          content: 'UEsDBA==',
          content_format: 'base64',
          data_base64: 'UEsDBA=='
        }
      ]
    }
  ]);
  assert.equal(filePacket.hasArtifact, true);
  assert.equal(filePacket.artifactText, '');
  assert.equal(filePacket.artifactPreview.kind, 'file');
  assert.equal(filePacket.artifactPreview.filename, 'board-deck.pptx');
});

test('buildPacketModel keeps Chat handoff and receipt metadata out of the component layer', () => {
  const packet = buildPacketModel([
    {
      id: 'work-sent-brief',
      title: 'Investor update',
      links: [{ kind: 'thread', ref: 'thread-abc', label: 'Source Chat' }],
      receipts: [{ id: 'receipt-1', title: 'Saved after review', status: 'Completed' }],
      artifacts: [
        {
          id: 'artifact-brief',
          title: 'Investor update draft',
          content: 'Draft body',
          packet: {
            approval: {
              title: 'Review send package',
              destination: 'Board channel',
              actionLabel: 'Send update'
            }
          }
        }
      ]
    }
  ]);

  assert.equal(packet.stateLabel, 'Saved item with Chat handoff');
  assert.equal(packet.stateTone, 'hold');
  assert.equal(packet.threadHref, '/chat/thread-abc');
  assert.equal(packet.approval.destination, 'Board channel');
  assert.equal(packet.receipts.length, 1);
});

test('buildPacketModel infers general workspace labels from the saved work type', () => {
  const researchPacket = buildPacketModel([
    {
      id: 'work-research',
      title: 'TEE vendor research',
      artifacts: [
        {
          id: 'artifact-research',
          title: 'Vendor shortlist',
          content: 'Compare privacy-preserving TEE vendors and source links.'
        }
      ]
    }
  ]);

  assert.equal(researchPacket.labels.output, 'Research');
  assert.equal(researchPacket.labels.draft, 'Draft');
  assert.equal(researchPacket.labels.context, 'Context');

  const replyPacket = buildPacketModel([
    {
      id: 'work-reply',
      title: 'Customer renewal response',
      openApprovals: [
        {
          title: 'Send customer reply',
          destination: 'customer@example.com',
          actionLabel: 'Send response'
        }
      ],
      artifacts: [
        {
          id: 'artifact-reply',
          title: 'Renewal output',
          content: 'Prepared renewal terms.'
        }
      ],
      packet: {
        email: {
          to: 'customer@example.com',
          subject: 'Renewal reply',
          body: 'Prepared response body'
        }
      }
    }
  ]);

  assert.equal(replyPacket.labels.output, 'Output');
  assert.equal(replyPacket.labels.draft, 'Reply');
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
