import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { StatCard } from './primitives.js';

// Every Badge tone StatCard's consumers actually pass (automations/jobs/routines
// summary strips + admin dashboard/usage tabs) plus the rest of the tone map.
const TONES = [
  'muted',
  'gold',
  'warning',
  'info',
  'signal',
  'success',
  'danger',
  'positive',
  'accent',
  'copper'
];

function visibleText(markup) {
  return [...markup.matchAll(/>([^<>]+)</g)].map((match) => match[1].trim()).filter(Boolean);
}

test('StatCard uses explicit badge copy instead of leaking tone tokens', () => {
  for (const tone of TONES) {
    const badgeLabel = `Label for ${tone}`;
    const markup = renderToStaticMarkup(
      StatCard({ label: 'Active', value: 2, tone, badgeLabel, detail: 'Updated just now' })
    );
    const text = visibleText(markup);

    assert.ok(text.includes(badgeLabel), 'translated badge copy must render');
    assert.ok(
      !text.some((node) => node.toLowerCase() === tone.toLowerCase()),
      `tone "${tone}" leaked as rendered text: ${JSON.stringify(text)}`
    );
    assert.doesNotMatch(markup, new RegExp(`>${tone}<`, 'i'));
    assert.doesNotMatch(markup, new RegExp(`>${tone.toUpperCase()}<`));
  }
});

test('StatCard still renders its real content (label, value, detail)', () => {
  const markup = renderToStaticMarkup(
    StatCard({
      label: 'Paused',
      value: 7,
      tone: 'warning',
      badgeLabel: 'Needs attention',
      detail: 'Awaiting validation'
    })
  );
  const text = visibleText(markup);

  assert.ok(text.includes('Paused'), 'label must render');
  assert.ok(text.includes('7'), 'value must render');
  assert.ok(text.includes('Awaiting validation'), 'detail must render');
  assert.ok(text.includes('Needs attention'), 'badge label must render');
});

test('StatCard expresses tone through Badge semantic v2 colors', () => {
  const toToken = {
    success: '--v2-positive-text',
    signal: '--v2-accent-text',
    warning: '--v2-warning-text',
    danger: '--v2-danger-text',
    info: '--v2-info-text',
    gold: '--v2-gold-text',
    muted: '--v2-text-muted'
  };

  for (const [tone, token] of Object.entries(toToken)) {
    const markup = renderToStaticMarkup(
      StatCard({ label: 'Total', value: 1, tone, badgeLabel: `Badge ${tone}` })
    );
    assert.match(markup, new RegExp(`text-\\[var\\(${token}\\)\\]`), `${tone} badge uses ${token}`);
    assert.doesNotMatch(markup, /bg-(?:red|yellow|amber|orange|emerald|green|lime)-\d/);
  }
});

test('StatCard badge stays on one line for translated labels', () => {
  const markup = renderToStaticMarkup(
    StatCard({ label: 'In progress', value: 3, tone: 'signal', badgeLabel: '信号' })
  );
  assert.match(markup, /shrink-0/);
  assert.match(markup, /whitespace-nowrap/);
  assert.doesNotMatch(markup, /animate-pulse|animate-bounce/);
});

test('StatCard can downshift value typography for text values', () => {
  const markup = renderToStaticMarkup(
    StatCard({
      label: 'Next run',
      value: 'Tomorrow at 09:00',
      tone: 'info',
      badgeLabel: 'Info',
      valueClassName: 'text-sm'
    })
  );
  assert.match(markup, /text-sm/);
});
