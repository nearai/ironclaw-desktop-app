// Tests for the onboarding wizard's step 2 → step 3 transition in the
// LOCAL sidecar path, and the post-R34d contract for "Skip for now".
//
// CONTRACT CHANGE (R34d): "Skip for now" used to mean "skip THIS step's
// inputs and advance to step 3 anyway." That UX was confusing — the
// persistent "Skip onboarding" footer also existed, with overlapping
// language, and the in-step button mutated the wizard draft in ways
// that confused users (Bug 3: the draft mode could leak to disk on
// later Skip). "Skip for now" now invokes the same wizard-escape
// `skip()` handler as the persistent footer:
//   1. Reads current settings off disk (NOT the wizard draft).
//   2. Flips `onboardingComplete: true` — leaves every other field
//      (mode, URLs, llmBackend, …) exactly as it was on disk.
//   3. Refreshes the live connection store and navigates to `/`.
//
// The "Next" button is unchanged: it still persists the draft + advances
// to step 3 so the connection test there can run against the saved
// config.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';

import OnboardingPage from './+page.svelte';
import { setPagePathname } from '../../../tests/__mocks__/app-state';

beforeEach(async () => {
  vi.resetModules();
  const { invoke } = await import('@tauri-apps/api/core');
  vi.mocked(invoke).mockReset();
  vi.mocked(invoke).mockResolvedValue(undefined);
  // Pin the route so any layout-level path checks see /onboarding.
  setPagePathname('/onboarding');
  // Strip any Tauri-runtime shim that an earlier test in the file (or
  // another suite running first under the same worker) may have stamped
  // on `window`. Each test opts in explicitly to the shim when it needs
  // a non-no-op `loadSettings()` path.
  const win = (globalThis as unknown as { window?: Record<string, unknown> }).window;
  if (win && '__TAURI_INTERNALS__' in win) {
    delete win.__TAURI_INTERNALS__;
  }
  // Reset the localStorage bypass flag so each test starts from a clean
  // state (the R34d escape hatch keys can otherwise leak across cases).
  // Some vitest workers stub `localStorage` to a partial shim — guard
  // the call so a missing `removeItem` doesn't take the whole suite
  // down before any assertion runs.
  if (typeof localStorage !== 'undefined' && typeof localStorage.removeItem === 'function') {
    localStorage.removeItem('ironclaw-onboarding-bypass');
  }
});

afterEach(() => {
  setPagePathname('/');
  const win = (globalThis as unknown as { window?: Record<string, unknown> }).window;
  if (win && '__TAURI_INTERNALS__' in win) {
    delete win.__TAURI_INTERNALS__;
  }
});

describe('onboarding step 2 (LOCAL) — Skip-for-now exits the wizard cleanly', () => {
  it('clicking Skip-for-now after picking LOCAL on step 1 does NOT persist mode=local (Bug 3 / R34d)', async () => {
    // The CORE Bug 3 regression test the prompt asks for. Wire a Tauri
    // shim so `loadSettings()` and `saveSettings()` actually round-trip,
    // start with a `mode: remote` shape on disk, click Local on step 1
    // (mutates the wizard's in-memory draft to mode=local), then click
    // Skip — and assert the persisted shape STILL has mode=remote.
    const win = (globalThis as unknown as { window?: Record<string, unknown> }).window ?? {};
    win.__TAURI_INTERNALS__ = {};
    (globalThis as unknown as { window: Record<string, unknown> }).window = win;

    const { invoke } = await import('@tauri-apps/api/core');
    let saved: Record<string, unknown> | null = null;
    vi.mocked(invoke).mockImplementation(async (cmd: string, args?: unknown) => {
      if (cmd === 'get_settings') {
        return {
          activeProfileId: 'default',
          onboardingComplete: false,
          profiles: [
            {
              id: 'default',
              name: 'Default',
              mode: 'remote',
              localBaseUrl: 'http://127.0.0.1:3100',
              remoteBaseUrl: 'http://127.0.0.1:18789',
              llmBackend: 'nearai',
              llmProviderId: 'nearai'
            }
          ],
          trayEnabled: true,
          useResponsesApi: true
        };
      }
      if (cmd === 'save_settings') {
        saved = (args as { settings: Record<string, unknown> }).settings;
        return undefined;
      }
      if (cmd === 'get_token') return null;
      if (cmd === 'get_openrouter_key') return null;
      if (cmd === 'sidecar_status') return { running: false, port: null };
      return undefined;
    });

    const { container, getByRole, findByRole, findByText } = render(OnboardingPage);

    // Wait for onMount's `await loadSettings()` to materialize the
    // default profile so `activeProfile` is non-null when
    // `chooseMode('local')` fires.
    await waitFor(() => {
      expect(container.textContent).toMatch(/Welcome to IronClaw/);
    });

    // Step 1: click Local. This mutates the wizard's in-memory draft to
    // mode=local AND advances to step 2 LOCAL.
    const localCard = getByRole('button', { name: /Local/ });
    await fireEvent.click(localCard);
    await findByText(/Set up NEAR\.AI Cloud/);

    // Step 2: click "Skip for now". Under the post-R34d contract this
    // calls the wizard-escape `skip()` handler, which reads settings
    // from disk and saves with onboardingComplete=true — leaving mode
    // exactly as it was on disk (remote), NOT what the user picked
    // mid-flow (local).
    const skip = await findByRole('button', { name: /Skip for now/ });
    await fireEvent.click(skip);

    // Wait for the async save_settings IPC to flush.
    await waitFor(() => {
      expect(saved).not.toBeNull();
    });

    const persisted = saved as unknown as {
      onboardingComplete: boolean;
      profiles: Array<{ mode: string }>;
    };
    // The onboarded sentinel must flip — that's the whole point of Skip.
    expect(persisted.onboardingComplete).toBe(true);
    // Bug 3 regression guard: mode MUST stay `remote`. A pre-fix wizard
    // would have written `local` here, because the OLD skip() snapshotted
    // the in-memory draft (which `chooseMode('local')` had mutated).
    expect(persisted.profiles[0].mode).toBe('remote');
  });

  it('slow loadSettings resolving after Local click does NOT revert draft to REMOTE', async () => {
    // Simulate Tauri runtime + a slow get_settings response that lands
    // with the user's on-disk shape (mode=remote). The user clicks Local
    // on step 1 BEFORE this resolves, so the draft already has mode=local.
    // Bug B (pre-fix): onMount's `settings = await loadSettings()`
    // overwrites the draft and reverts mode to REMOTE; step 2/3 render
    // the REMOTE body even though the user picked Local.
    const win = (globalThis as unknown as { window?: Record<string, unknown> }).window ?? {};
    win.__TAURI_INTERNALS__ = {};
    (globalThis as unknown as { window: Record<string, unknown> }).window = win;

    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'get_settings') {
        // 200ms slow-load — wide enough for the user to click Local on
        // step 1 before this resolves.
        await new Promise((r) => setTimeout(r, 200));
        return {
          activeProfileId: 'default',
          onboardingComplete: true,
          profiles: [
            {
              id: 'default',
              name: 'Default',
              mode: 'remote',
              localBaseUrl: 'http://127.0.0.1:3100',
              remoteBaseUrl: 'http://127.0.0.1:18789',
              llmBackend: 'nearai',
              llmProviderId: 'nearai'
            }
          ],
          trayEnabled: true,
          useResponsesApi: true
        };
      }
      if (cmd === 'save_settings') return undefined;
      if (cmd === 'get_or_create_local_token') return 'token-xyz';
      return null;
    });

    const { getByRole, findByText, container } = render(OnboardingPage);

    // Click Local IMMEDIATELY — before get_settings resolves. Without the
    // hydration guard, this click goes into the (empty) draft and the
    // subsequent loadSettings resolve wipes it.
    await fireEvent.click(getByRole('button', { name: /Local/ }));

    // Wait long enough for the slow load to resolve and any reactive
    // updates to flush. The post-fix behavior: step 2 stays on the
    // LOCAL body because the draft was touched. The pre-fix behavior:
    // step 2 flips to the REMOTE body because the draft is overwritten.
    await new Promise((r) => setTimeout(r, 300));

    await findByText(/Set up NEAR\.AI Cloud/);
    // Belt-and-braces: the REMOTE step 2 header must NOT be on screen.
    expect(container.textContent).not.toMatch(/Where is your IronClaw server/);
  });

  it('clicking Next from step 2 LOCAL persists settings + advances to step 3 LOCAL body', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    // Wire just enough IPC to let saveStep2AndAdvance() finish.
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'save_settings') return undefined;
      if (cmd === 'get_or_create_local_token') return 'local-token-xyz';
      if (cmd === 'get_settings') return {};
      if (cmd === 'get_token') return null;
      return undefined;
    });

    const { getByRole, findByRole, findByText, container } = render(OnboardingPage);
    await waitFor(() => {
      expect(container.textContent).toMatch(/Welcome to IronClaw/);
    });

    await fireEvent.click(getByRole('button', { name: /Local/ }));
    await findByText(/Set up NEAR\.AI Cloud/);

    const next = await findByRole('button', { name: /^Next$/ });
    await fireEvent.click(next);

    await findByText(/spawn the bundled sidecar/, undefined, { timeout: 1500 });
  });
});
