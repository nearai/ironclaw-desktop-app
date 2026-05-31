import { describe, expect, it } from 'vitest';
import { CONNECTOR_PACKS, connectorPackById, connectorPackStatus } from './connector-packs';

describe('connector packs', () => {
  it('pack ids are unique', () => {
    const ids = CONNECTOR_PACKS.map((pack) => pack.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every pack has installable extensions and concrete starter tasks', () => {
    for (const pack of CONNECTOR_PACKS) {
      expect(pack.extensions.length).toBeGreaterThanOrEqual(1);
      expect(pack.extensions).toContain(pack.primary_extension_id);
      expect(pack.example_tasks.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('derives readiness from installed extension state', () => {
    const google = connectorPackById('google');
    expect(google).toBeTruthy();
    if (!google) return;

    expect(connectorPackStatus(google, new Map())).toBe('not-installed');
    expect(
      connectorPackStatus(
        google,
        new Map(google.extensions.map((name) => [name, { name, readiness_message: 'ready' }]))
      )
    ).toBe('connected');
    expect(
      connectorPackStatus(
        google,
        new Map([
          [google.extensions[0], { name: google.extensions[0], readiness_message: 'needs_auth' }]
        ])
      )
    ).toBe('needs-auth');
  });

  it('connectorPackById returns matching packs', () => {
    expect(connectorPackById('google')?.display_name).toBe('Google Workspace');
    expect(connectorPackById('notion')?.extensions).toEqual(['notion']);
    expect(connectorPackById('slack')?.extensions).toEqual(['slack', 'slack_tool']);
  });

  it('connectorPackById returns undefined for unknown ids', () => {
    expect(connectorPackById('unknown')).toBeUndefined();
  });

  it('accepts legacy prefixed readiness names from older desktop fixtures', () => {
    const google = connectorPackById('google');
    expect(google).toBeTruthy();
    if (!google) return;

    expect(
      connectorPackStatus(
        google,
        new Map([
          ['tools/gmail', { name: 'tools/gmail', ready: true, readiness_message: 'ready' }],
          [
            'tools/google_calendar',
            { name: 'tools/google_calendar', ready: true, readiness_message: 'ready' }
          ],
          [
            'tools/google_docs',
            { name: 'tools/google_docs', ready: true, readiness_message: 'ready' }
          ],
          [
            'tools/google_drive',
            { name: 'tools/google_drive', ready: true, readiness_message: 'ready' }
          ],
          [
            'tools/google_sheets',
            { name: 'tools/google_sheets', ready: true, readiness_message: 'ready' }
          ],
          [
            'tools/google_slides',
            { name: 'tools/google_slides', ready: true, readiness_message: 'ready' }
          ]
        ])
      )
    ).toBe('connected');
  });

  it('does not accept wrong-kind prefixed aliases as connector readiness', () => {
    const google = connectorPackById('google');
    const slack = connectorPackById('slack');
    expect(google).toBeTruthy();
    expect(slack).toBeTruthy();
    if (!google || !slack) return;

    expect(
      connectorPackStatus(
        google,
        new Map([
          ['channels/gmail', { name: 'channels/gmail', ready: true, readiness_message: 'ready' }]
        ])
      )
    ).toBe('not-installed');
    expect(
      connectorPackStatus(
        slack,
        new Map([
          [
            'mcp-servers/slack',
            { name: 'mcp-servers/slack', ready: true, readiness_message: 'ready' }
          ],
          ['tools/slack', { name: 'tools/slack', ready: true, readiness_message: 'ready' }]
        ])
      )
    ).toBe('not-installed');
  });
});
