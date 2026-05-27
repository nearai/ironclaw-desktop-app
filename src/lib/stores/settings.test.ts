// Tests for the settings schema migration. `migrateLoaded` is pure
// (no IPC) so we can call it directly with synthetic disk shapes.
//
// Three cases matter:
//   1. Empty file → fresh defaults, one Default profile.
//   2. Legacy flat shape → wrapped into a single profile with id
//      `DEFAULT_PROFILE_ID`.
//   3. Profile-aware shape with a bogus activeProfileId → re-anchored
//      to the first profile.

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PROFILE_ID,
  migrateLoaded
} from './settings.svelte';

describe('migrateLoaded', () => {
  it('produces one Default profile from an empty input', () => {
    const s = migrateLoaded({});
    expect(s.profiles).toHaveLength(1);
    expect(s.profiles[0].id).toBe(DEFAULT_PROFILE_ID);
    expect(s.profiles[0].name).toBe('Default');
    expect(s.activeProfileId).toBe(DEFAULT_PROFILE_ID);
    expect(s.onboardingComplete).toBe(false);
    // trayEnabled is opt-OUT — true by default.
    expect(s.trayEnabled).toBe(true);
    // useResponsesApi is opt-OUT — true by default.
    expect(s.useResponsesApi).toBe(true);
    // adminMode + engineV2Enabled are opt-IN — false by default.
    expect(s.adminMode).toBe(false);
    expect(s.engineV2Enabled).toBe(false);
  });

  it('wraps legacy flat shape into a single profile with the default id', () => {
    const s = migrateLoaded({
      mode: 'remote',
      remoteBaseUrl: 'http://example.test:3100',
      localBaseUrl: 'http://127.0.0.1:3100',
      llmBackend: 'openrouter',
      onboardingComplete: true
    });
    expect(s.profiles).toHaveLength(1);
    expect(s.profiles[0].id).toBe(DEFAULT_PROFILE_ID);
    expect(s.profiles[0].mode).toBe('remote');
    expect(s.profiles[0].remoteBaseUrl).toBe('http://example.test:3100');
    expect(s.profiles[0].llmBackend).toBe('openrouter');
    // llmProviderId should default to the legacy backend on the
    // migrated profile so existing installs round-trip cleanly.
    expect(s.profiles[0].llmProviderId).toBe('openrouter');
    expect(s.activeProfileId).toBe(DEFAULT_PROFILE_ID);
    expect(s.onboardingComplete).toBe(true);
  });

  it('re-anchors activeProfileId when it points at an orphaned id', () => {
    const s = migrateLoaded({
      activeProfileId: 'orphan',
      profiles: [
        {
          id: 'p1',
          name: 'first',
          mode: 'remote',
          remoteBaseUrl: 'http://127.0.0.1:3100',
          localBaseUrl: 'http://127.0.0.1:3100',
          llmBackend: 'nearai'
        },
        {
          id: 'p2',
          name: 'second',
          mode: 'local',
          remoteBaseUrl: 'http://127.0.0.1:3100',
          localBaseUrl: 'http://127.0.0.1:3100',
          llmBackend: 'nearai'
        }
      ]
    });
    expect(s.profiles).toHaveLength(2);
    // First-profile pivot.
    expect(s.activeProfileId).toBe('p1');
  });

  it('trusts a valid activeProfileId when it matches a profile', () => {
    const s = migrateLoaded({
      activeProfileId: 'p2',
      profiles: [
        {
          id: 'p1',
          name: 'first',
          mode: 'remote',
          remoteBaseUrl: 'http://127.0.0.1:3100',
          localBaseUrl: 'http://127.0.0.1:3100',
          llmBackend: 'nearai'
        },
        {
          id: 'p2',
          name: 'second',
          mode: 'local',
          remoteBaseUrl: 'http://127.0.0.1:3100',
          localBaseUrl: 'http://127.0.0.1:3100',
          llmBackend: 'nearai'
        }
      ]
    });
    expect(s.activeProfileId).toBe('p2');
  });

  it('normalizes invalid mode / llmBackend values on stored profiles', () => {
    const s = migrateLoaded({
      activeProfileId: 'p1',
      profiles: [
        {
          id: 'p1',
          name: 'first',
          // @ts-expect-error — exercising the defensive normalizer
          mode: 'garbage',
          remoteBaseUrl: 'http://127.0.0.1:3100',
          localBaseUrl: 'http://127.0.0.1:3100',
          // @ts-expect-error — exercising the defensive normalizer
          llmBackend: 'mystery'
        }
      ]
    });
    expect(s.profiles[0].mode).toBe('remote');
    expect(s.profiles[0].llmBackend).toBe('nearai');
  });
});
