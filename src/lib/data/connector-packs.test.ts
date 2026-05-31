import { describe, expect, it } from 'vitest';
import { CONNECTOR_PACKS, connectorPackById } from './connector-packs';

describe('connector packs', () => {
  it('pack ids are unique', () => {
    const ids = CONNECTOR_PACKS.map((pack) => pack.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every pack has installable extensions and concrete starter tasks', () => {
    for (const pack of CONNECTOR_PACKS) {
      expect(pack.extensions.length).toBeGreaterThanOrEqual(1);
      expect(pack.example_tasks.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('connectorPackById returns matching packs', () => {
    expect(connectorPackById('google')?.display_name).toBe('Google Workspace');
    expect(connectorPackById('notion')?.extensions).toEqual(['notion']);
    expect(connectorPackById('slack')?.extensions).toEqual(['channels/slack', 'tools/slack_tool']);
  });

  it('connectorPackById returns undefined for unknown ids', () => {
    expect(connectorPackById('unknown')).toBeUndefined();
  });
});
