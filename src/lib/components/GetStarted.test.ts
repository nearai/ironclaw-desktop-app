import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import type { Extension } from '$lib/api/types';
import { CONNECTOR_PACKS } from '$lib/data/connector-packs';
import { FIRST_RUN_MISSIONS } from '$lib/data/missions';

const gotoMock = vi.hoisted(() => vi.fn());
const composerPushMock = vi.hoisted(() => vi.fn());
const { connectionStub } = vi.hoisted(() => ({
  connectionStub: {
    client: null as null | {
      listExtensions: () => Promise<Extension[]>;
      installExtension: (name: string) => Promise<{ ok: boolean }>;
    }
  }
}));

vi.mock('$app/navigation', () => ({
  goto: gotoMock
}));

vi.mock('$lib/stores/templates.svelte', () => ({
  composerInsert: {
    push: composerPushMock
  }
}));

vi.mock('$lib/stores/connection.svelte', () => ({
  connection: connectionStub
}));

import GetStarted from './GetStarted.svelte';

function installFakeClient(): void {
  connectionStub.client = {
    listExtensions: vi.fn(async () => []),
    installExtension: vi.fn(async (_name: string) => ({ ok: true }))
  };
}

describe('GetStarted component', () => {
  beforeEach(() => {
    // The test runtime's global `localStorage` is the node experimental one
    // (no functional getItem/setItem); the component swallows that via
    // try/catch, but the assertions need a real store, so install a
    // Map-backed shim per test (mirrors ResizeHandle.test.ts).
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => void store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      }
    });
    vi.clearAllMocks();
    installFakeClient();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the setup flow with connector packs and missions', async () => {
    render(GetStarted);

    expect(screen.getByRole('heading', { name: 'Set up your chief of staff' })).toBeTruthy();
    expect(screen.getByText('1 · Connect your workspace')).toBeTruthy();
    expect(screen.getByText('2 · Run your first mission')).toBeTruthy();

    await waitFor(() => {
      expect(connectionStub.client?.listExtensions).toHaveBeenCalled();
    });

    expect(screen.getByText(CONNECTOR_PACKS[0].display_name)).toBeTruthy();
    expect(screen.getByText(FIRST_RUN_MISSIONS[0].title)).toBeTruthy();
    expect(screen.getByTestId('mission-grid')).toBeTruthy();
  });

  it('persists dismissal and hides the panel', async () => {
    render(GetStarted);

    await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(localStorage.getItem('ironclaw-getstarted-dismissed')).toBe('1');
    expect(screen.queryByRole('heading', { name: 'Set up your chief of staff' })).toBeNull();
  });
});
