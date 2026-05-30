// Tests for the agent-UI action registry. Pure module (host is injected), so
// no Svelte/Tauri/navigation imports are needed — a fake host records calls.

import { describe, expect, it } from 'vitest';
import { actionSchemas, dispatchAction, NAV_SURFACES, type AgentUiHost } from './actions';

function fakeHost(): { host: AgentUiHost; calls: string[] } {
  const calls: string[] = [];
  return { host: { navigate: (p) => calls.push(p) }, calls };
}

describe('agent-ui action registry', () => {
  it('exposes a navigate tool schema enumerating only the safe surfaces', () => {
    const nav = actionSchemas().find((s) => s.name === 'navigate');
    expect(nav).toBeTruthy();
    const params = nav!.parameters as { properties: { surface: { enum: string[] } } };
    const surfaces = params.properties.surface.enum;
    expect(surfaces).toContain('knowledge');
    expect(surfaces).toContain('chat');
    expect(surfaces).not.toContain('dev'); // internal surfaces excluded
    expect(surfaces).not.toContain('onboarding');
    expect(surfaces).toHaveLength(Object.keys(NAV_SURFACES).length);
  });

  it('navigates to a known surface through the injected host', async () => {
    const { host, calls } = fakeHost();
    const res = await dispatchAction('navigate', { surface: 'knowledge' }, host);
    expect(res.ok).toBe(true);
    expect(calls).toEqual(['/knowledge']);
  });

  it('maps the chat surface to the root path', async () => {
    const { host, calls } = fakeHost();
    await dispatchAction('navigate', { surface: 'chat' }, host);
    expect(calls).toEqual(['/']);
  });

  it('rejects an unknown surface without navigating', async () => {
    const { host, calls } = fakeHost();
    const res = await dispatchAction('navigate', { surface: 'bogus' }, host);
    expect(res.ok).toBe(false);
    expect(calls).toEqual([]);
  });

  it('returns an error result (not a throw) for an unknown action name', async () => {
    const { host } = fakeHost();
    const res = await dispatchAction('frobnicate', {}, host);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Unknown action/);
  });
});
