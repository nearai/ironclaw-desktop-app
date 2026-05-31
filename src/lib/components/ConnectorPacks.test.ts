import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import type { Extension } from '$lib/api/types';
import { CONNECTOR_PACKS } from '$lib/data/connector-packs';

const { connectionStub } = vi.hoisted(() => ({
  connectionStub: {
    client: null as null | {
      listExtensions: () => Promise<Extension[]>;
      installExtension: (name: string) => Promise<{ ok: boolean }>;
    }
  }
}));

vi.mock('$lib/stores/connection.svelte', () => ({
  connection: connectionStub
}));

import ConnectorPacks from './ConnectorPacks.svelte';

function installFakeClient(): void {
  connectionStub.client = {
    listExtensions: vi.fn(async () => []),
    installExtension: vi.fn(async (_name: string) => ({ ok: true }))
  };
}

describe('ConnectorPacks component', () => {
  beforeEach(() => {
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
});
