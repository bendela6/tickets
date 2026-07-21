import { describe, expect, it } from 'vitest';
import { createTransport } from './transport';
import type { Signal } from './types';

const sig = (n: number): Signal => ({
  kind: 'event', sessionId: 's', name: `e${n}`, mechanism: 'manual', level: 'info',
  timestamp: new Date(0).toISOString(), platform: { runtime: 'node' }, sdk: { name: 't', version: '0' },
});

function harness(overrides: Partial<Parameters<typeof createTransport>[0]> = {}) {
  const calls: { url: string; body: unknown }[] = [];
  let status = 202;
  const timers: { cb: () => void; ms: number }[] = [];
  const transport = createTransport({
    url: 'http://x/ingest/k',
    fetchFn: async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { status }; },
    scheduleFlush: (cb, ms) => { timers.push({ cb, ms }); return timers.length; },
    cancelFlush: () => {},
    now: () => 0,
    ...overrides,
  });
  return { transport, calls, timers, setStatus: (s: number) => { status = s; } };
}

describe('createTransport', () => {
  it('arms a single 5s timer and flushes the batch when it fires', async () => {
    const { transport, calls, timers } = harness();
    transport.enqueue(sig(1));
    transport.enqueue(sig(2));
    expect(timers).toHaveLength(1);
    expect(timers[0]!.ms).toBe(5000);
    timers[0]!.cb();
    await Promise.resolve(); await Promise.resolve();
    expect(calls).toHaveLength(1);
    expect((calls[0]!.body as { signals: unknown[] }).signals).toHaveLength(2);
  });

  it('flushes immediately at flushAt and chunks by maxPerRequest', async () => {
    const { transport, calls } = harness({ flushAt: 3, maxPerRequest: 2 });
    for (let i = 0; i < 3; i++) transport.enqueue(sig(i));
    await transport.flush();
    expect(calls.length).toBeGreaterThanOrEqual(2); // 2 + 1
    expect(transport.queuedCount()).toBe(0);
  });

  it('caps the queue by dropping oldest', () => {
    const { transport } = harness({ maxQueue: 2, flushAt: 100 });
    transport.enqueue(sig(1)); transport.enqueue(sig(2)); transport.enqueue(sig(3));
    expect(transport.queuedCount()).toBe(2);
    expect(transport.takeAll().map((s) => s.name)).toEqual(['e2', 'e3']);
  });

  it('backs off after 429 and re-queues the batch', async () => {
    let t = 0;
    const { transport, calls, setStatus } = harness({ now: () => t, flushAt: 1 });
    setStatus(429);
    transport.enqueue(sig(1));
    await transport.flush();
    expect(transport.queuedCount()).toBe(1);
    const before = calls.length;
    await transport.flush();               // still inside backoff → no send
    expect(calls.length).toBe(before);
    t = 31_000; setStatus(202);
    await transport.flush();
    expect(transport.queuedCount()).toBe(0);
  });

  it('never rejects even when fetch throws', async () => {
    const { transport } = harness({ fetchFn: async () => { throw new Error('net down'); }, flushAt: 1 });
    transport.enqueue(sig(1));
    await expect(transport.flush()).resolves.toBeUndefined();
    expect(transport.queuedCount()).toBe(1); // kept for retry
  });
});
