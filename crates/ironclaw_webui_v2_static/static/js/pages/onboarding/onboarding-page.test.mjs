import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import '../../i18n/en.js';
import { getRegisteredPacks } from '../../lib/i18n.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const onboardingPagePath = path.join(testDir, 'onboarding-page.js');
const emptyStatePath = path.resolve(testDir, '..', 'chat', 'components', 'empty-state.js');

// onboarding-single-cluster — the three NEAR AI Cloud sign-in buttons are
// written ONCE. Ironwork de-duplication: the ready path and the
// gateway-unavailable path must share a single AuthActions component rather
// than shipping two literal copies of the same button group (which drift).
// The gateway-unavailable path must NOT render a disabled fake-ready sign-in
// CTA — it leads with the physical next action instead.
test('onboarding auth cluster is defined once, not duplicated per state', async () => {
  const source = await readFile(onboardingPagePath, 'utf8');

  // Exactly one shared auth cluster component.
  const authActionsDefs = source.match(/function AuthActions\b/g) || [];
  assert.equal(authActionsDefs.length, 1, 'expected exactly one AuthActions component');

  // The GitHub primary sign-in trigger appears once — the single cluster owns it.
  const githubStarts = source.match(/startNearai\('github'\)/g) || [];
  assert.equal(
    githubStarts.length,
    1,
    'the GitHub sign-in action must be written once, inside the shared cluster'
  );

  // The gateway-unavailable branch must not carry its own duplicate button bank
  // gated on providerAccessBlocked (the old fake-ready sign-in CTA).
  assert.doesNotMatch(
    source,
    /disabled=\$\{providerAccessBlocked/,
    'gateway-unavailable path must not render a disabled fake-ready sign-in CTA'
  );
});

// onboarding-desk-1 — no fake readiness.
// The green READY badge must reflect a capability the gateway can prove:
// the provider is the active selection, or it holds a real stored key.
// It must NOT light up off `configured`, which is true for NEAR AI Cloud
// before any sign-in (api_key_required: false).
test('onboarding READY badge is gated on real auth, not pre-auth configured', async () => {
  const source = await readFile(onboardingPagePath, 'utf8');

  // The positive badge renders behind the showReady flag, not bare configured.
  assert.match(
    source,
    /\$\{showReady &&\s*html`<\$\{Badge\} tone="positive" label=\$\{t\('onboarding\.ready'\)\}/,
    'expected the READY badge to be gated on showReady'
  );

  // showReady is derived from real authentication signals.
  assert.match(
    source,
    /showReady=\$\{state\.activeProviderId === provider\.id \|\|\s*provider\.has_api_key === true\}/,
    'expected showReady to come from activeProviderId or a stored key'
  );

  // The old contract — badge keyed directly off `configured` — is gone.
  assert.doesNotMatch(
    source,
    /\$\{configured &&\s*html`<\$\{Badge\} tone="positive"/,
    'badge must not render off pre-auth `configured`'
  );

  // Settings owns isProviderConfigured; onboarding may import it but must not
  // redefine it here.
  assert.doesNotMatch(
    source,
    /function isProviderConfigured\b/,
    'onboarding must not redefine isProviderConfigured'
  );
});

// onboarding-tap-target — every NEAR AI Cloud auth control is a real tap target.
// The screen's whole job is the three sign-in actions; the two secondary ones
// (Use Google / Use NEAR Wallet) must match the primary's `md` height, not the
// 32px `size="sm"` they previously shipped at. The rendered floor is enforced in
// tests/static/a11y-static.spec.ts; this guards the source so the secondary auth
// buttons cannot silently regress to `sm`. After Ironwork de-duplication the
// cluster is written once, so there is one Google and one Wallet block.
test('onboarding auth secondary actions use the md tap-target size, not sm', async () => {
  const source = await readFile(onboardingPagePath, 'utf8');

  // Pull every <Button …> element and look only at the auth actions that drive
  // NEAR AI Cloud sign-in (Google + Wallet). They must not be size="sm".
  const buttonBlocks = source.match(/<\$\{Button\}[\s\S]*?\/>|<\$\{Button\}[\s\S]*?<\/\/>/g) || [];
  const authSecondaries = buttonBlocks.filter(
    (block) => block.includes("startNearai('google')") || block.includes('startNearaiWallet')
  );
  assert.ok(authSecondaries.length >= 2, 'expected the Google/Wallet auth buttons to be present');
  for (const block of authSecondaries) {
    assert.doesNotMatch(
      block,
      /size="sm"/,
      'auth secondary actions must not use the sub-44px sm size'
    );
    assert.match(block, /size="md"/, 'auth secondary actions must use the md tap-target size');
  }
});

// onboarding-accent-discipline — gold is the agent's hand (DESIGN.md color law:
// "Never use gold as decoration"). The first-run gate-contract line is a static
// product promise, not an agent artifact/receipt, so it must not use gold. The
// whole onboarding surface must not paint any gold either (no clay island).
test('onboarding gate-contract line and surface do not use gold as decoration', async () => {
  const source = await readFile(onboardingPagePath, 'utf8');

  const gateLine = source.match(/function GateContractLine\([\s\S]*?\n}/);
  assert.ok(gateLine, 'expected a GateContractLine component');
  assert.doesNotMatch(
    gateLine[0],
    /var\(--v2-gold/,
    'GateContractLine must not use gold (reserved for agent work)'
  );
  assert.doesNotMatch(
    source,
    /var\(--v2-gold/,
    'onboarding surface must not use gold anywhere (no clay island)'
  );
});

// onboarding-gate-voice — the marketing "three promises" triad is replaced by
// the product's actual signature: one gate-voice contract line tying first-run
// to the approval gate. The three trust rows must be gone.
test('onboarding renders the single gate-voice contract line, not a trust-row triad', async () => {
  const source = await readFile(onboardingPagePath, 'utf8');

  assert.doesNotMatch(
    source,
    /function TrustRow\b/,
    'the marketing TrustRow triad must be removed'
  );
  assert.match(
    source,
    /It asks before any external action leaves this machine\./,
    'expected the gate-voice contract line'
  );
});

test('onboarding copy frames first-run as setup for sources, work, and approvals', () => {
  const packs = getRegisteredPacks();
  const en = packs.en || {};

  assert.match(
    en['onboarding.subtitle'],
    /private workbench.*ask across workspace sources.*prepare work.*approve external actions/i
  );
  assert.match(en['onboarding.moreInSettings'], /open Connections/i);
  assert.match(en['onboarding.promiseModelsBody'], /Workspace sources are added separately\./);
  for (const value of [
    en['onboarding.subtitle'],
    en['onboarding.moreInSettings'],
    en['onboarding.promiseModelsBody'],
    en['onboarding.promiseApprovalsBody'],
    en['onboarding.promiseFilesBody']
  ]) {
    assert.doesNotMatch(value, /custody record|trust ledger|sources connected/i);
  }
});

// onboarding-desk-4 — the hero is a single, stable prepared-desk question, not a
// generic time-of-day greeting. The three hour-keyed slots exist for the i18n
// key-lock but intentionally resolve to one strong question. A chief-of-staff
// desk asks for the next task; it does not say "Good morning". This guards
// against re-introducing time-of-day greeting theater (an AI-tell trope) and
// against the DT-1 / spec heading drift it caused.
test('greeting keys resolve to the single stable prepared-desk question', () => {
  const packs = getRegisteredPacks();
  const en = packs.en || {};
  const morning = en['chat.heroMorning'];
  const afternoon = en['chat.heroAfternoon'];
  const evening = en['chat.heroEvening'];

  for (const [name, value] of [
    ['chat.heroMorning', morning],
    ['chat.heroAfternoon', afternoon],
    ['chat.heroEvening', evening]
  ]) {
    assert.equal(typeof value, 'string', `${name} should be a string`);
    assert.ok(value.trim().length > 0, `${name} should not be empty`);
  }

  const distinct = new Set([morning, afternoon, evening]);
  assert.equal(distinct.size, 1, 'hero stays one stable question, not time-of-day greetings');
  assert.match(morning, /What should IronClaw handle next\?/);
});

// The hour branch that selects those keys still exists and maps to the three
// hour-keyed hero slots (guards the rendering path even though they resolve equal).
test('empty-state hour branch maps to the three greeting keys', async () => {
  const source = await readFile(emptyStatePath, 'utf8');

  assert.match(source, /hour < 12.*return 'chat\.heroMorning'/s);
  assert.match(source, /hour < 18.*return 'chat\.heroAfternoon'/s);
  assert.match(source, /return 'chat\.heroEvening'/);
});
