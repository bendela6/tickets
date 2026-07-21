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

  it('re-arms a retry timer after a failed flush with no further enqueues', async () => {
    const { transport, timers, setStatus } = harness({ flushAt: 1 });
    setStatus(500);
    transport.enqueue(sig(1));
    await transport.flush();
    const timersAfterFailure = timers.length;
    expect(timersAfterFailure).toBeGreaterThan(0); // a new retry timer was scheduled

    setStatus(202);
    const newest = timers[timers.length - 1]!;
    newest.cb();
    await Promise.resolve(); await Promise.resolve();
    expect(transport.queuedCount()).toBe(0);
  });

  it('takeAll during an in-flight flush returns the in-flight batch exactly once', async () => {
    let resolveFetch!: (v: { status: number }) => void;
    const deferred = new Promise<{ status: number }>((resolve) => { resolveFetch = resolve; });
    const { transport } = harness({ flushAt: 1, fetchFn: async () => deferred });
    transport.enqueue(sig(1));
    const flushPromise = transport.flush(); // starts, hangs on the deferred fetch

    const stolenSignals = transport.takeAll();
    expect(stolenSignals.map((s) => s.name)).toEqual(['e1']);

    resolveFetch({ status: 500 }); // would normally requeue the batch
    await flushPromise;
    expect(transport.queuedCount()).toBe(0); // not double-requeued
  });

  it('sets keepalive for small bodies', async () => {
    const inits: { keepalive?: boolean }[] = [];
    const { transport } = harness({
      flushAt: 1,
      fetchFn: async (_url, init) => { inits.push(init); return { status: 202 }; },
    });
    transport.enqueue(sig(1));
    await transport.flush();
    expect(inits).toHaveLength(1);
    expect(inits[0]!.keepalive).toBe(true);
  });

  it('drops the batch on a non-429 4xx (poison pill) — no requeue, no retry timer', async () => {
    const { transport, timers, setStatus } = harness({ flushAt: 1 });
    setStatus(400);
    transport.enqueue(sig(1));
    await transport.flush();
    expect(transport.queuedCount()).toBe(0);
    expect(timers).toHaveLength(0);
  });

  it('still requeues and retries on a 5xx, unlike a 4xx', async () => {
    const { transport, timers, setStatus } = harness({ flushAt: 1 });
    setStatus(500);
    transport.enqueue(sig(1));
    await transport.flush();
    expect(transport.queuedCount()).toBe(1);
    expect(timers.length).toBeGreaterThan(0);
  });

  it('a second takeAll during the same in-flight window returns only the queue, not the batch again', async () => {
    let resolveFetch!: (v: { status: number }) => void;
    const deferred = new Promise<{ status: number }>((resolve) => { resolveFetch = resolve; });
    const { transport } = harness({ flushAt: 1, fetchFn: async () => deferred });
    transport.enqueue(sig(1));
    const flushPromise = transport.flush();

    const first = transport.takeAll();
    expect(first.map((s) => s.name)).toEqual(['e1']);

    transport.enqueue(sig(2));
    const second = transport.takeAll();
    expect(second.map((s) => s.name)).toEqual(['e2']);

    resolveFetch({ status: 500 });
    await flushPromise;
  });

  it('dispose during an in-flight failure leaves no retry timer armed after it settles', async () => {
    let resolveFetch!: (v: { status: number }) => void;
    const deferred = new Promise<{ status: number }>((resolve) => { resolveFetch = resolve; });
    const { transport, timers } = harness({ flushAt: 1, fetchFn: async () => deferred });
    transport.enqueue(sig(1));
    const flushPromise = transport.flush();

    transport.dispose();
    resolveFetch({ status: 500 });
    await flushPromise;

    expect(timers).toHaveLength(0);
  });
});
