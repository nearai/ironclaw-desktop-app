import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import type { Extension } from '$lib/api/types';
import { CONNECTOR_PACKS } from '$lib/data/connector-packs';

const gotoMock = vi.hoisted(() => vi.fn());
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

vi.mock('$lib/stores/connection.svelte', () => ({
  connection: connectionStub
}));

import ConnectorPacks from './ConnectorPacks.svelte';

function installFakeClient(extensions: Extension[] = []): void {
  connectionStub.client = {
    listExtensions: vi.fn(async () => extensions),
    installExtension: vi.fn(async (_name: string) => ({ ok: true }))
  };
}

describe('ConnectorPacks component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installFakeClient();
  });

  it('renders every workspace pack with starter tasks', async () => {
    render(ConnectorPacks);

    await waitFor(() => {
      expect(connectionStub.client?.listExtensions).toHaveBeenCalled();
    });

    for (const pack of CONNECTOR_PACKS) {
      expect(screen.getByText(pack.display_name)).toBeTruthy();
      expect(screen.getByText(pack.example_tasks[0])).toBeTruthy();
    }
  });

  it('shows an inline connection message when no gateway client exists', async () => {
    connectionStub.client = null;
    render(ConnectorPacks);

    const [connectButton] = screen.getAllByRole('button', { name: 'Connect' });
    await fireEvent.click(connectButton);

    expect(screen.getByText('Not connected — connect IronClaw first')).toBeTruthy();
  });

  it('shows readiness states from extension readiness', async () => {
    installFakeClient([
      { name: 'tools/gmail', installed: true, ready: true, readiness_message: 'ready' },
      { name: 'tools/google_calendar', installed: true, ready: true, readiness_message: 'ready' },
      { name: 'tools/google_docs', installed: true, ready: true, readiness_message: 'ready' },
      { name: 'tools/google_drive', installed: true, ready: true, readiness_message: 'ready' },
      { name: 'tools/google_sheets', installed: true, ready: true, readiness_message: 'ready' },
      { name: 'tools/google_slides', installed: true, ready: true, readiness_message: 'ready' },
      { name: 'notion', installed: true, readiness_message: 'needs_auth' },
      { name: 'channels/slack', installed: true, ready: true, readiness_message: 'ready' }
    ]);

    render(ConnectorPacks);

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeTruthy();
      expect(screen.getByText('Needs sign-in')).toBeTruthy();
      expect(screen.getByText('Partial')).toBeTruthy();
    });
  });

  it('opens a pack in Extensions with the primary extension focused', async () => {
    render(ConnectorPacks);

    const openButtons = await screen.findAllByRole('button', { name: 'Open in Extensions' });
    await fireEvent.click(openButtons[0]);

    expect(gotoMock).toHaveBeenCalledWith(
      `/extensions?focus=${encodeURIComponent(CONNECTOR_PACKS[0].primary_extension_id)}`
    );
  });
});
