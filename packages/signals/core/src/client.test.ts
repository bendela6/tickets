import { describe, expect, it } from 'vitest';
import { createClient, generateSessionId } from './client';
import type { Signal } from './types';
import type { Transport } from './transport';

function fakeTransport() {
  const sent: Signal[] = [];
  const transport: Transport = {
    enqueue: (s) => { sent.push(s); },
    flush: async () => {},
    takeAll: () => sent.splice(0),
    queuedCount: () => sent.length,
    dispose: () => {},
  };
  return { transport, sent };
}

const base = {
  dsn: 'sgl://k@127.0.0.1:4640/1',
  platform: { runtime: 'node' as const },
  sdk: { name: 'test-sdk', version: '0.0.0' },
  now: () => new Date('2026-07-21T12:00:00Z'),
};

describe('createClient', () => {
  it('captures an Error with parsed stack, defaults, session id, and context state', () => {
    const { transport, sent } = fakeTransport();
    const client = createClient({ ...base, transport, release: '1.0.0', environment: 'test' });
    client.setUser({ id: 'u1' });
    client.setTag('checkout', 'v2');
    client.setContext('cart', { items: 3 });
    client.addBreadcrumb({ type: 'console', timestamp: base.now().toISOString(), message: 'hi' });
    const err = new TypeError('boom');
    client.captureError(err);
    expect(sent).toHaveLength(1);
    const s = sent[0]!;
    expect(s).toMatchObject({
      kind: 'error', name: 'TypeError', message: 'boom', mechanism: 'manual', level: 'error',
      release: '1.0.0', environment: 'test', user: { id: 'u1' }, tags: { checkout: 'v2' },
      timestamp: '2026-07-21T12:00:00.000Z', sessionId: client.sessionId,
    });
    expect(s.contexts).toMatchObject({ cart: { items: 3 } });
    expect(s.breadcrumbs).toHaveLength(1);
    expect(s.stack!.length).toBeGreaterThan(0);
  });

  it('wraps non-Error values and honors overrides', () => {
    const { transport, sent } = fakeTransport();
    const client = createClient({ ...base, transport });
    client.captureError('plain string', { level: 'warning', mechanism: 'middleware', fingerprint: 'fp' });
    expect(sent[0]).toMatchObject({ name: 'Error', message: 'plain string', level: 'warning', mechanism: 'middleware', fingerprint: 'fp' });
  });

  it('captureEvent defaults to info/manual with data under contexts.event; captureLog maps console', () => {
    const { transport, sent } = fakeTransport();
    const client = createClient({ ...base, transport });
    client.captureEvent('checkout.started', { items: 3 });
    client.captureLog('cart mismatch', 'warning');
    expect(sent[0]).toMatchObject({ kind: 'event', name: 'checkout.started', level: 'info', mechanism: 'manual' });
    expect(sent[0]!.contexts).toMatchObject({ event: { items: 3 } });
    expect(sent[1]).toMatchObject({ kind: 'log', name: 'console', message: 'cart mismatch', level: 'warning', mechanism: 'console' });
  });

  it('ring-buffers breadcrumbs to maxBreadcrumbs', () => {
    const { transport, sent } = fakeTransport();
    const client = createClient({ ...base, transport, maxBreadcrumbs: 2 });
    for (const n of ['a', 'b', 'c']) client.addBreadcrumb({ type: 'custom', timestamp: 't', message: n });
    client.captureError(new Error('x'));
    expect(sent[0]!.breadcrumbs!.map((b) => b.message)).toEqual(['b', 'c']);
  });

  it('beforeSend can drop and mutate', () => {
    const { transport, sent } = fakeTransport();
    const client = createClient({
      ...base, transport,
      beforeSend: (s) => (s.kind === 'log' ? null : { ...s, tags: { ...s.tags, scrubbed: 'yes' } }),
    });
    client.captureLog('secret');
    client.captureError(new Error('keep'));
    expect(sent).toHaveLength(1);
    expect(sent[0]!.tags).toMatchObject({ scrubbed: 'yes' });
  });

  it('a bad DSN disables the client instead of throwing, and nothing ever throws', () => {
    const client = createClient({ ...base, dsn: 'garbage' });
    expect(client.enabled).toBe(false);
    expect(() => {
      client.captureError(new Error('x'));
      client.captureEvent('e');
      client.setUser(null);
    }).not.toThrow();
  });

  it('even a throwing beforeSend cannot escape', () => {
    const { transport, sent } = fakeTransport();
    const client = createClient({ ...base, transport, beforeSend: () => { throw new Error('hook bug'); } });
    expect(() => client.captureError(new Error('x'))).not.toThrow();
    expect(sent).toHaveLength(0);
  });
});

it('generateSessionId shape', () => {
  expect(generateSessionId()).toMatch(/^sess_[a-z0-9]{10}$/);
});
