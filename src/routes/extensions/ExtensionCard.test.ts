// Render tests for ExtensionCard.svelte — covers the R108 "Needs setup"
// affordance: an unconfigured installed connector shows a prominent "Set up"
// CTA + a category-derived hint, while a ready one shows the icon gear.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';

import ExtensionCard from './ExtensionCard.svelte';
import type { Extension } from '$lib/api/types';

function ext(overrides: Partial<Extension> = {}): Extension {
  return {
    name: 'slack',
    display_name: 'Slack',
    description: 'Connect Slack workspace via channel relay',
    installed: true,
    ...overrides
  };
}

afterEach(() => {
  // ExtensionCard reads the pins singleton; nothing to reset between renders.
});

describe('ExtensionCard — needs-setup affordance (R108)', () => {
  it('shows a "Set up" CTA + channel hint for an unconfigured channel connector', async () => {
    const onSetup = vi.fn();
    const { container } = render(ExtensionCard, {
      props: {
        extension: ext({ category: 'channel', ready: false }),
        variant: 'installed',
        onSetup
      }
    });
    await tick();
    expect(container.textContent).toContain('Needs setup');
    expect(container.textContent).toContain('Add a token to connect');
    const setupBtn = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Set up')
    );
    expect(setupBtn).toBeTruthy();
  });

  it('uses an OAuth hint for an oauth connector', async () => {
    const { container } = render(ExtensionCard, {
      props: { extension: ext({ category: 'oauth', ready: false }), variant: 'installed' }
    });
    await tick();
    expect(container.textContent).toContain('Sign in to connect (OAuth)');
  });

  it('uses a sign-in hint whenever readiness says auth is missing', async () => {
    const { container } = render(ExtensionCard, {
      props: {
        extension: ext({ category: 'wasm_tool', ready: false, readiness_message: 'needs_auth' }),
        variant: 'installed'
      }
    });
    await tick();
    expect(container.textContent).toContain('Sign in to connect (OAuth)');
  });

  it('shows the icon gear (Configure), not a Set up CTA, when ready', async () => {
    const { container } = render(ExtensionCard, {
      props: { extension: ext({ category: 'channel', ready: true }), variant: 'installed' }
    });
    await tick();
    expect(container.textContent).toContain('Ready');
    expect(container.textContent ?? '').not.toContain('Set up');
    const configureBtn = [...container.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === 'Configure Slack'
    );
    expect(configureBtn).toBeTruthy();
  });

  it('renders an Install button for an uninstalled registry entry', async () => {
    const onInstall = vi.fn();
    const { container } = render(ExtensionCard, {
      props: {
        extension: ext({ installed: false }),
        variant: 'registry',
        onInstall
      }
    });
    await tick();
    const installBtn = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Install')
    );
    expect(installBtn).toBeTruthy();
  });
});
