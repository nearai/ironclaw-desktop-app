import assert from 'node:assert/strict';
import test from 'node:test';

import {
  readVoiceSamples,
  recordVoiceSample,
  effectiveVoiceDirective
} from './workbench-voice-store.js';

// In-memory localStorage so the store's persistence + dedupe/cap logic is exercised
// (the functions read `localStorage` lazily at call time).
class MemStore {
  constructor() {
    this.m = new Map();
  }
  getItem(k) {
    return this.m.has(k) ? this.m.get(k) : null;
  }
  setItem(k, v) {
    this.m.set(k, String(v));
  }
  removeItem(k) {
    this.m.delete(k);
  }
}

const A =
  'fine to match the terms but make the liability cap mutual — hold signature until i see the final clause';
const B =
  'devhub grant terms do not cover external BD with crm access — need an NDA with a non-solicit first';

test('recordVoiceSample stores real replies, drops trivial text, dedupes, newest leads', () => {
  globalThis.localStorage = new MemStore();
  assert.deepEqual(readVoiceSamples(), []);
  // Trivial commits ("ok thanks") teach nothing about voice — ignored.
  recordVoiceSample('ok thanks');
  assert.deepEqual(readVoiceSamples(), []);
  recordVoiceSample(A);
  assert.deepEqual(readVoiceSamples(), [A]);
  recordVoiceSample(B);
  assert.equal(readVoiceSamples()[0], B); // newest leads
  // Re-committing A (case-insensitive dupe) moves it to front, no duplicate row.
  recordVoiceSample(A.toUpperCase());
  const samples = readVoiceSamples();
  assert.equal(samples.length, 2);
  assert.equal(samples[0].toLowerCase(), A.toLowerCase());
});

test('recordVoiceSample caps the window to the most recent samples', () => {
  globalThis.localStorage = new MemStore();
  for (let i = 0; i < 12; i++) {
    recordVoiceSample(
      `this is a sufficiently long sample number ${i} that the user actually wrote`
    );
  }
  const samples = readVoiceSamples();
  assert.equal(samples.length, 8); // MAX_SAMPLES
  assert.ok(samples[0].includes('number 11')); // newest kept
  assert.ok(!samples.some((s) => s.includes('number 0 ')) || samples.length === 8);
});

test('effectiveVoiceDirective leads with learned samples, falls back, undefined when empty', () => {
  globalThis.localStorage = new MemStore();
  // No learned samples and no fallback → keep the generic default (undefined).
  assert.equal(effectiveVoiceDirective([]), undefined);
  const fb = ['this is the configured fallback example of how i write, decisive and lowercase'];
  const d1 = effectiveVoiceDirective(fb);
  assert.ok(d1 && d1.includes('configured fallback example'));
  // A learned sample takes precedence over the configured fallback.
  recordVoiceSample(
    'learned sample the user actually wrote recently, specific and direct, no hedging'
  );
  const d2 = effectiveVoiceDirective(fb);
  assert.ok(d2.indexOf('learned sample') < d2.indexOf('configured fallback example'));
});
