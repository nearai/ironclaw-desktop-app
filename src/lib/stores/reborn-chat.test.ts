// Orchestration tests for the IronClaw Reborn v2 chat controller. The pure
// reducers/mappers are covered in `api/reborn.test.ts` and the transport in
// `api/reborn-transport.test.ts`; here we exercise the glue: thread
// auto-creation on first send, the optimistic user bubble, the send-failure
// path, the SSE→terminal-success→timeline-refetch wiring, gate resolution,
// and cancel. A mock client is injected via the controller's constructor
// getter so no connection store or real I/O is needed.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IronClawClient } from '$lib/api/ironclaw';
import { RebornChatController } from './reborn-chat.svelte';

async function* gen<T>(items: T[]): AsyncGenerator<T> {
  for (const it of items) yield it;
}

function mockClient(over: Record<string, unknown> = {}): IronClawClient {
  return {
    createThreadV2: vi.fn(async () => ({ thread: { thread_id: 't-new' } })),
    sendMessageV2: vi.fn(async () => ({ run_id: 'r1', thread_id: 't1', status: 'queued' })),
    fetchTimelineV2: vi.fn(async () => ({ records: [] })),
    resolveGateV2: vi.fn(async () => undefined),
    cancelRunV2: vi.fn(async () => undefined),
    streamWebChatV2Events: vi.fn(() => gen([])),
    ...over
  } as unknown as IronClawClient;
}

describe('RebornChatController.send', () => {
  it('auto-creates a thread on first send, then posts the message', async () => {
    const client = mockClient();
    const c = new RebornChatController(() => client);
    await c.send('hi there');
    expect(client.createThreadV2).toHaveBeenCalledTimes(1);
    expect(c.threadId).toBe('t-new');
    expect(client.sendMessageV2).toHaveBeenCalledWith('t-new', 'hi there');
    const userMsg = c.state.messages.find((m) => m.role === 'user');
    expect(userMsg?.content).toBe('hi there');
    expect(c.state.activeRun?.runId).toBe('r1');
    expect(c.state.isProcessing).toBe(true);
  });

  it('skips thread creation when already bound', async () => {
    const client = mockClient();
    const c = new RebornChatController(() => client);
    c.threadId = 't1';
    await c.send('hello');
    expect(client.createThreadV2).not.toHaveBeenCalled();
    expect(client.sendMessageV2).toHaveBeenCalledWith('t1', 'hello');
  });

  it('marks the optimistic bubble errored and stops processing on failure', async () => {
    const client = mockClient({
      sendMessageV2: vi.fn(async () => {
        throw new Error('boom');
      })
    });
    const c = new RebornChatController(() => client);
    c.threadId = 't1';
    await expect(c.send('hi')).rejects.toThrow('boom');
    const m = c.state.messages.find((x) => x.role === 'user');
    expect(m?.status).toBe('error');
    expect(m?.error).toBe('boom');
    expect(c.state.isProcessing).toBe(false);
  });
});

describe('RebornChatController.openStream', () => {
  it('refetches the timeline on terminal run success and surfaces the reply', async () => {
    const client = mockClient({
      streamWebChatV2Events: vi.fn(() =>
        gen([
          {
            type: 'projection_update',
            frame: { state: { items: [{ run_status: { run_id: 'r1', status: 'completed' } }] } }
          }
        ])
      ),
      fetchTimelineV2: vi.fn(async () => ({
        records: [
          { kind: 'user', message_id: 'u1', content: 'hi' },
          { kind: 'assistant', message_id: 'a1', content: 'hello back' }
        ]
      }))
    });
    const c = new RebornChatController(() => client);
    await c.openStream('t1');
    expect(client.fetchTimelineV2).toHaveBeenCalledWith('t1', { limit: 50 });
    expect(c.state.messages.some((m) => m.content === 'hello back')).toBe(true);
    expect(c.state.isProcessing).toBe(false);
  });

  it('does not refetch while a run is merely running', async () => {
    const client = mockClient({
      streamWebChatV2Events: vi.fn(() =>
        gen([
          {
            type: 'projection_update',
            frame: { state: { items: [{ run_status: { run_id: 'r1', status: 'running' } }] } }
          }
        ])
      )
    });
    const c = new RebornChatController(() => client);
    await c.openStream('t1');
    expect(client.fetchTimelineV2).not.toHaveBeenCalled();
    expect(c.state.isProcessing).toBe(true);
  });
});

describe('RebornChatController.resolveGate / cancel', () => {
  let c: RebornChatController;
  let client: IronClawClient;

  beforeEach(() => {
    client = mockClient();
    c = new RebornChatController(() => client);
    c.threadId = 't1';
  });

  it('resolves the pending gate using its runId + gateRef, then clears it', async () => {
    c.state = {
      ...c.state,
      pendingGate: { kind: 'gate', runId: 'r1', gateRef: 'g1', headline: 'Approve?', body: '' }
    };
    await c.resolveGate('approved', { always: true });
    expect(client.resolveGateV2).toHaveBeenCalledWith('t1', 'r1', 'g1', 'approved', {
      always: true
    });
    expect(c.state.pendingGate).toBeNull();
    expect(c.state.isProcessing).toBe(true);
  });

  it('no-ops resolveGate when there is no pending gate', async () => {
    await c.resolveGate('approved');
    expect(client.resolveGateV2).not.toHaveBeenCalled();
  });

  it('cancels the active run and stops processing', async () => {
    c.state = { ...c.state, activeRun: { runId: 'r1', threadId: 't1', status: 'running' } };
    await c.cancel('user aborted');
    expect(client.cancelRunV2).toHaveBeenCalledWith('t1', 'r1', 'user aborted');
    expect(c.state.isProcessing).toBe(false);
  });
});

describe('RebornChatController.loadTimeline', () => {
  it('projects timeline records into render-ready messages', async () => {
    const client = mockClient({
      fetchTimelineV2: vi.fn(async () => ({
        records: [{ kind: 'user', message_id: 'u1', content: 'hey' }]
      }))
    });
    const c = new RebornChatController(() => client);
    await c.loadTimeline('t1');
    expect(c.state.messages[0]).toMatchObject({ role: 'user', content: 'hey' });
  });
});

describe('RebornChatController thread binding', () => {
  it('binds threadId from an explicit send id so cancel/resolveGate target it', async () => {
    const client = mockClient();
    const c = new RebornChatController(() => client);
    await c.send('hi', 'explicit-thread');
    expect(c.threadId).toBe('explicit-thread');
    expect(client.createThreadV2).not.toHaveBeenCalled();
    c.state = {
      ...c.state,
      activeRun: { runId: 'r1', threadId: 'explicit-thread', status: 'running' }
    };
    await c.cancel();
    expect(client.cancelRunV2).toHaveBeenCalledWith('explicit-thread', 'r1', undefined);
  });

  it('reset() clears the bound thread so a later send starts fresh', async () => {
    const client = mockClient();
    const c = new RebornChatController(() => client);
    c.threadId = 'old';
    c.reset();
    expect(c.threadId).toBeNull();
    await c.send('hi'); // no bound thread → must create a new one
    expect(client.createThreadV2).toHaveBeenCalledTimes(1);
    expect(c.threadId).toBe('t-new');
  });

  it('loadTimeline binds the thread it loaded', async () => {
    const client = mockClient();
    const c = new RebornChatController(() => client);
    await c.loadTimeline('t-loaded');
    expect(c.threadId).toBe('t-loaded');
  });
});
