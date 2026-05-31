import { describe, expect, it } from 'vitest';

import { FIRST_RUN_MISSIONS, missionById } from './missions';

const WRITE_CAPABLE_MISSION_IDS = new Set([
  'inbox-triage',
  'meeting-prep',
  'follow-up-catcher',
  'draft-replies',
  'update-notion-crm'
]);

describe('first-run missions', () => {
  it('has unique ids', () => {
    const ids = FIRST_RUN_MISSIONS.map((mission) => mission.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('defines each mission with a non-empty title and prompt', () => {
    expect(FIRST_RUN_MISSIONS.length).toBeGreaterThanOrEqual(6);

    for (const mission of FIRST_RUN_MISSIONS) {
      expect(mission.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(mission.title.trim().length).toBeGreaterThan(0);
      expect(mission.prompt.trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps send/write-capable missions in approval mode', () => {
    for (const mission of FIRST_RUN_MISSIONS) {
      expect(mission.mode).toBe('approval');

      if (WRITE_CAPABLE_MISSION_IDS.has(mission.id)) {
        expect(mission.mode).toBe('approval');
        expect(mission.prompt.toLowerCase()).toContain('approval');
      }
    }
  });

  it('looks up missions by id', () => {
    expect(missionById('morning-brief')?.title).toBe('Morning Brief');
    expect(missionById('not-a-mission')).toBeUndefined();
  });
});
