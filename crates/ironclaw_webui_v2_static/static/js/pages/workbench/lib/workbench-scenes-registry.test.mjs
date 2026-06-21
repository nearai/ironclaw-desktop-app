import assert from 'node:assert/strict';
import test from 'node:test';

import {
  actionRows,
  commandActionLabel,
  inferWorkbenchScene,
  outputHint
} from './workbench-scenes-registry.js';
import * as registry from './workbench-scenes-registry.js';

test('workbench scene registry keeps trigger terms internal', () => {
  assert.deepEqual(Object.keys(registry).sort(), [
    'actionRows',
    'commandActionLabel',
    'inferWorkbenchScene',
    'outputHint'
  ]);
});

test('workbench packet inference keeps generic visible scene copy', () => {
  const scene = inferWorkbenchScene('Redline the MSA agreement terms.');

  assert.deepEqual(scene, {
    id: 'packet',
    label: 'Review workspace',
    title: 'Review workspace started',
    detail: 'IronClaw is preparing reviewable work. External sends remain gated.'
  });

  assert.doesNotMatch(
    `${scene.label} ${scene.title} ${scene.detail}`,
    /\b(counter|redline|agreement|msa|contract|amendment|terms?)\b/i
  );
});

test('workbench scene rows and output hints preserve visible packet copy', () => {
  assert.deepEqual(actionRows('packet'), [
    ['Prepare review workspace', 'Turn the request into a reviewable work item.', 'Private'],
    ['Draft artifacts', 'Keep documents, replies, and notes available for review.', 'Draft'],
    ['Hold external action', 'Any send, post, or filing waits for approval.', 'Approval']
  ]);
  assert.equal(outputHint('packet'), 'prepared documents, response drafts, and approval details');
});

test('workbench scene registry preserves fallback copy', () => {
  assert.deepEqual(actionRows('missing-scene'), [
    ['Start work', 'The request is queued in the existing Chat runtime.', 'Private'],
    ['Keep boundaries', 'External effects remain held until an approval gate exists.', 'Approval'],
    ['Save output', 'Drafts and artifacts can be saved back to Work.', 'Draft']
  ]);
  assert.equal(outputHint('missing-scene'), 'drafts, documents, research notes, and decisions');
  assert.equal(inferWorkbenchScene('please help with something unusual').title, 'Work session started');
});

test('workbench command action label follows inferred work type', () => {
  assert.equal(commandActionLabel(''), 'Ask');
  assert.equal(commandActionLabel('Research privacy-preserving TEE vendors.'), 'Research');
  assert.equal(commandActionLabel('Prepare investor update for the board.'), 'Prepare');
  assert.equal(commandActionLabel('Review the agreement counter before approval.'), 'Review');
  assert.equal(commandActionLabel('Watch competitor launches weekly.'), 'Watch');
  assert.equal(commandActionLabel('Grow a channel for our audience.'), 'Plan');
  assert.equal(commandActionLabel('Help me think through this weird thing.'), 'Ask');
});
