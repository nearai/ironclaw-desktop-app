// Wire-shape tests for `IronClawClient`. Focus on the parse paths
// that have bug-fix history — `turns[]` → `messages[]` expansion,
// `turn_count` → `message_count` mapping, `uptime_secs` aliasing,
// and the settings array → map fold. Real HTTP is mocked via
// `global.fetch`; tests do not run the gateway.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { IronClawClient } from './ironclaw';

// Build a Response-shaped object that `fetch` can return.
function fetchOk(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

function makeClient(): IronClawClient {
  return new IronClawClient({ baseUrl: 'http://example.test', token: 'tok' });
}

describe('IronClawClient.getHistory', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      fetchOk({
        thread_id: 't1',
        turns: [
          {
            turn_number: 1,
            user_message_id: 'u1',
            user_input: 'hello',
            response: 'hi there',
            response_id: 'a1',
            started_at: '2026-05-27T00:00:00Z',
            completed_at: '2026-05-27T00:00:01Z'
          },
          {
            turn_number: 2,
            user_message_id: 'u2',
            user_input: 'follow up',
            response: 'sure',
            response_id: 'a2',
            started_at: '2026-05-27T00:00:02Z',
            completed_at: '2026-05-27T00:00:03Z'
          }
        ]
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('expands turns[] into a flat user→assistant message sequence', async () => {
    const c = makeClient();
    const msgs = await c.getHistory('t1');
    expect(msgs).toHaveLength(4);
    expect(msgs[0]).toMatchObject({ id: 'u1', role: 'user', content: 'hello' });
    expect(msgs[1]).toMatchObject({
      id: 'a1',
      role: 'assistant',
      content: 'hi there'
    });
    expect(msgs[2]).toMatchObject({ id: 'u2', role: 'user', content: 'follow up' });
    expect(msgs[3]).toMatchObject({ id: 'a2', role: 'assistant', content: 'sure' });
  });

  it('skips the assistant half when the turn has no response yet', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      fetchOk({
        turns: [
          {
            turn_number: 1,
            user_message_id: 'u1',
            user_input: 'mid-flight',
            // no `response` field — turn is still streaming
            started_at: '2026-05-27T00:00:00Z'
          }
        ]
      })
    );
    const c = makeClient();
    const msgs = await c.getHistory('t1');
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatchObject({ role: 'user', content: 'mid-flight' });
  });

  it('falls through to the flat messages[] shape when the server emits it', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      fetchOk({
        messages: [
          { id: 'm1', role: 'user', content: 'a', created_at: 't1' },
          { id: 'm2', role: 'assistant', content: 'b', timestamp: 't2' }
        ]
      })
    );
    const c = makeClient();
    const msgs = await c.getHistory('t1');
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toMatchObject({ id: 'm1', role: 'user', created_at: 't1' });
    // `timestamp` fallback → `created_at`
    expect(msgs[1]).toMatchObject({ id: 'm2', role: 'assistant', created_at: 't2' });
  });
});

describe('IronClawClient.listThreads', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps turn_count → message_count', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      fetchOk({
        threads: [
          {
            id: 't1',
            title: 'first',
            created_at: '2026-05-27T00:00:00Z',
            last_message_at: '2026-05-27T00:01:00Z',
            turn_count: 3
          }
        ]
      })
    );
    const c = makeClient();
    const threads = await c.listThreads();
    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({
      id: 't1',
      title: 'first',
      message_count: 3,
      updated_at: '2026-05-27T00:01:00Z'
    });
  });

  it('falls back to message_count when the server emits the new name', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      fetchOk({
        threads: [
          {
            id: 't2',
            created_at: '2026-05-27T00:00:00Z',
            message_count: 7
          }
        ]
      })
    );
    const c = makeClient();
    const threads = await c.listThreads();
    expect(threads[0].message_count).toBe(7);
    // No title → empty string default.
    expect(threads[0].title).toBe('');
    // No last_message_at → falls back to created_at.
    expect(threads[0].updated_at).toBe('2026-05-27T00:00:00Z');
  });
});

describe('IronClawClient.generateImage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws a clear gateway-version error while the endpoint is not wired', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const c = makeClient();
    await expect(c.generateImage('a red apple')).rejects.toThrow(
      'Image generation not implemented on this gateway version'
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('IronClawClient.gatewayStatus', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps uptime_secs onto uptime_seconds', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      fetchOk({
        version: '0.28.2',
        uptime_secs: 1234,
        ws_connections: 1,
        sse_connections: 2,
        enabled_channels: ['http']
      })
    );
    const c = makeClient();
    const s = await c.gatewayStatus();
    expect(s.uptime_seconds).toBe(1234);
    expect(s.total_connections).toBe(3);
    expect(s.enabled_channels).toEqual(['http']);
  });

  it('still reads uptime_seconds when the server emits the long-form name', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(fetchOk({ uptime_seconds: 99 }));
    const c = makeClient();
    const s = await c.gatewayStatus();
    expect(s.uptime_seconds).toBe(99);
  });
});

describe('IronClawClient.getSettings', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('folds settings array → key/value map', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      fetchOk({
        settings: [
          { key: 'system_prompt', value: 'be helpful', updated_at: 't1' },
          { key: 'max_tokens', value: 2048, updated_at: 't2' }
        ]
      })
    );
    const c = makeClient();
    const s = await c.getSettings();
    expect(s.system_prompt).toBe('be helpful');
    expect(s.max_tokens).toBe(2048);
  });

  it('accepts a server emitting the map shape directly', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      fetchOk({ settings: { foo: 'bar', n: 1 } })
    );
    const c = makeClient();
    const s = await c.getSettings();
    expect(s).toMatchObject({ foo: 'bar', n: 1 });
  });

  it('returns the empty object when the server omits the settings field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(fetchOk({}));
    const c = makeClient();
    const s = await c.getSettings();
    expect(s).toEqual({});
  });

  it('redacts secret-shaped string values', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      fetchOk({
        settings: [
          {
            key: 'mcp_servers',
            value: 'Authorization: Bearer sk-foofoofoofoofoo',
            updated_at: 't1'
          }
        ]
      })
    );
    const c = makeClient();
    const s = await c.getSettings();
    expect(JSON.stringify(s)).not.toContain('foofoofoofoofoo');
    expect(JSON.stringify(s)).toContain('Bearer ');
  });
});
