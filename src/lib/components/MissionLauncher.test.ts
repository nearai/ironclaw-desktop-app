import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import type { Extension } from '$lib/api/types';

import { FIRST_RUN_MISSIONS } from '$lib/data/missions';
import type { ConnectorPackId, ConnectorPackStatus } from '$lib/data/connector-packs';

const gotoMock = vi.hoisted(() => vi.fn());
const composerPushMock = vi.hoisted(() => vi.fn());
const { connectionStub } = vi.hoisted(() => ({
  connectionStub: {
    client: null as null | {
      listExtensions: () => Promise<Extension[]>;
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

import MissionLauncher from './MissionLauncher.svelte';

function installFakeClient(extensions: Extension[]): void {
  connectionStub.client = {
    listExtensions: vi.fn(async () => extensions)
  };
}

const CONNECTED_PACK_STATUSES: Record<ConnectorPackId, ConnectorPackStatus> = {
  google: 'connected',
  notion: 'not-installed',
  slack: 'not-installed'
};

const DISCONNECTED_PACK_STATUSES: Record<ConnectorPackId, ConnectorPackStatus> = {
  google: 'not-installed',
  notion: 'not-installed',
  slack: 'not-installed'
};

beforeEach(() => {
  installFakeClient([]);
});

afterEach(() => {
  vi.clearAllMocks();
  connectionStub.client = null;
});

describe('MissionLauncher component', () => {
  it('renders every first-run mission title', () => {
    render(MissionLauncher);

    for (const mission of FIRST_RUN_MISSIONS) {
      expect(screen.getByText(mission.title)).toBeTruthy();
    }
  });

  it('disables a mission when required connectors are not ready', async () => {
    render(MissionLauncher);
    const mission = FIRST_RUN_MISSIONS.find((candidate) => candidate.id === 'morning-brief');
    expect(mission).toBeTruthy();
    if (!mission) return;

    const card = screen.getByTestId(`mission-card-${mission.id}`);

    await waitFor(() => {
      expect(within(card).getByText('Needs Google Workspace')).toBeTruthy();
    });

    expect(
      within(card)
        .getByRole<HTMLAnchorElement>('link', { name: 'Connect Google Workspace' })
        .getAttribute('href')
    ).toBe('/extensions?focus=gmail&setup=1');
    expect(
      within(card).getByRole<HTMLButtonElement>('button', { name: mission.title }).disabled
    ).toBe(true);
  });

  it('shows recommended missions when pack statuses make a mission ready', () => {
    render(MissionLauncher, { props: { packStatuses: CONNECTED_PACK_STATUSES } });

    const recommended = screen.getByTestId('recommended-missions');
    expect(
      within(recommended).getAllByText('Recommended · Google Workspace connected').length
    ).toBe(2);
    expect(
      within(recommended).getAllByRole('button', { name: /Launch recommended mission:/ }).length
    ).toBe(2);
  });

  it('shows an honest recommendation prompt when no pack is ready', () => {
    render(MissionLauncher, { props: { packStatuses: DISCONNECTED_PACK_STATUSES } });

    expect(screen.getByText('Connect a workspace pack to get a recommendation.')).toBeTruthy();
  });

  it('pushes mission context and navigates to chat when required connectors are ready', async () => {
    const firstMission = FIRST_RUN_MISSIONS[0];
    installFakeClient([
      { name: 'gmail', installed: true, ready: true, readiness_message: 'ready' },
      { name: 'google_calendar', installed: true, ready: true, readiness_message: 'ready' },
      { name: 'google_docs', installed: true, ready: true, readiness_message: 'ready' },
      { name: 'google_drive', installed: true, ready: true, readiness_message: 'ready' },
      { name: 'google_sheets', installed: true, ready: true, readiness_message: 'ready' },
      { name: 'google_slides', installed: true, ready: true, readiness_message: 'ready' }
    ]);
    render(MissionLauncher);

    await waitFor(() => {
      expect(
        screen.getByRole<HTMLButtonElement>('button', { name: firstMission.title }).disabled
      ).toBe(false);
    });

    await fireEvent.click(screen.getByRole('button', { name: firstMission.title }));

    expect(composerPushMock).toHaveBeenCalledTimes(1);
    expect(composerPushMock).toHaveBeenCalledWith(
      expect.stringContaining(`Mission: ${firstMission.title}`),
      null,
      {
        title: firstMission.title,
        source: `mission:${firstMission.id}`,
        mode: firstMission.mode,
        autorun: true
      }
    );
    expect(gotoMock).toHaveBeenCalledTimes(1);
    expect(gotoMock).toHaveBeenCalledWith('/');
  });
});
