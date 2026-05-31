import { describe, expect, it, vi, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';

import { FIRST_RUN_MISSIONS } from '$lib/data/missions';

const gotoMock = vi.hoisted(() => vi.fn());
const composerPushMock = vi.hoisted(() => vi.fn());

vi.mock('$app/navigation', () => ({
  goto: gotoMock
}));

vi.mock('$lib/stores/templates.svelte', () => ({
  composerInsert: {
    push: composerPushMock
  }
}));

import MissionLauncher from './MissionLauncher.svelte';

afterEach(() => {
  vi.clearAllMocks();
});

describe('MissionLauncher component', () => {
  it('renders every first-run mission title', () => {
    render(MissionLauncher);

    for (const mission of FIRST_RUN_MISSIONS) {
      expect(screen.getByText(mission.title)).toBeTruthy();
    }
  });

  it('pushes the mission prompt and navigates to chat when a mission is launched', async () => {
    render(MissionLauncher);
    const firstMission = FIRST_RUN_MISSIONS[0];

    await fireEvent.click(screen.getByRole('button', { name: firstMission.title }));

    expect(composerPushMock).toHaveBeenCalledTimes(1);
    expect(composerPushMock).toHaveBeenCalledWith(firstMission.prompt);
    expect(gotoMock).toHaveBeenCalledTimes(1);
    expect(gotoMock).toHaveBeenCalledWith('/');
  });
});
