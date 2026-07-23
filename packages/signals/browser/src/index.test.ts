import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureError, initSignals, getClient } from './index';
import type { Signal } from '@bendela6/signals-core';
import type { Transport } from '@bendela6/signals-core';

function fakeTransport() {
  const sent: Signal[] = [];
  const transport: Transport = {
    enqueue: (s) => { sent.push(s); }, flush: async () => {}, takeAll: () => sent.splice(0),
    queuedCount: () => sent.length, dispose: () => {},
  };
  return { transport, sent };
}
const DSN = 'sgl://k@127.0.0.1:4640/1';

afterEach(() => { vi.restoreAllMocks(); });

describe('top-level capture functions', () => {
  it('no-op when no client has been inited', () => {
    expect(() => captureError(new Error('x'))).not.toThrow();
  });

  it('routes to the active client after initSignals', () => {
    const { transport, sent } = fakeTransport();
    initSignals({ dsn: DSN, transport });
    captureError(new Error('routed'));
    expect(sent[0]).toMatchObject({ mechanism: 'manual', message: 'routed' });
  });
});

describe('initSignals (browser)', () => {
  it('captures window error events with uncaught-exception mechanism and browser platform', () => {
    const { transport, sent } = fakeTransport();
    initSignals({ dsn: DSN, transport });
    window.dispatchEvent(new ErrorEvent('error', { error: new TypeError('boom'), message: 'boom' }));
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: 'error', mechanism: 'uncaught-exception', name: 'TypeError' });
    expect(sent[0]!.platform.runtime).toBe('browser');
    expect(sent[0]!.platform.url).toContain('localhost');
  });

  it('captures unhandled rejections', () => {
    const { transport, sent } = fakeTransport();
    initSignals({ dsn: DSN, transport });
    const event = new Event('unhandledrejection') as Event & { reason?: unknown };
    event.reason = new Error('nope');
    window.dispatchEvent(event);
    expect(sent[0]).toMatchObject({ mechanism: 'unhandled-rejection', message: 'nope' });
  });

  it('console.warn leaves a breadcrumb that rides the next error', () => {
    const { transport, sent } = fakeTransport();
    initSignals({ dsn: DSN, transport });
    console.warn('low stock');
    getClient()!.captureError(new Error('x'));
    expect(sent[0]!.breadcrumbs!.some((b) => b.type === 'console' && b.message === 'low stock')).toBe(true);
  });

  it("captureConsole: 'both' also emits log signals", () => {
    const { transport, sent } = fakeTransport();
    initSignals({ dsn: DSN, transport, captureConsole: 'both' });
    console.error('gateway timeout');
    expect(sent.some((s) => s.kind === 'log' && s.level === 'error' && s.message === 'gateway timeout')).toBe(true);
  });

  it('captureConsole: true captures warn/error as log signals at the default floor', () => {
    const { transport, sent } = fakeTransport();
    initSignals({ dsn: DSN, transport, captureConsole: true });
    console.warn('low stock');
    expect(sent.some((s) => s.kind === 'log' && s.level === 'warning' && s.message === 'low stock')).toBe(true);
  });

  it('captureConsole: true — uninstalling (via re-init) fully restores console: no stale breadcrumbs or log capture leak onto the disposed client', () => {
    const { transport: transport1, sent: sent1 } = fakeTransport();
    const client1 = initSignals({ dsn: DSN, transport: transport1, captureConsole: true });

    // triggers `current?.uninstall()` for the first install (the only externally
    // reachable uninstall path — there is no separate exported teardown function)
    const { transport: transport2 } = fakeTransport();
    initSignals({ dsn: DSN, transport: transport2 });

    // deliberately NOT mocked with mockImplementation: a mock would replace
    // console.warn outright and short-circuit the very patch chain this test
    // exists to exercise. Matches the unmocked style used elsewhere in this file
    // (e.g. the "leaves a breadcrumb" test above) — real console output is the
    // accepted trade-off for actually exercising the chain.
    console.warn('after uninstall');

    // the disposed client must not have received a log signal for the post-uninstall call
    expect(sent1.some((s) => s.kind === 'log')).toBe(false);

    // nor should a leaked instrument.ts breadcrumb patch have added a breadcrumb
    // to the disposed client's ring buffer
    client1.captureError(new Error('after uninstall probe'));
    const leaked = sent1
      .find((s) => s.kind === 'error')
      ?.breadcrumbs?.some((b) => b.message === 'after uninstall');
    expect(leaked).toBeFalsy();
  });

  it('clicks and history changes leave typed breadcrumbs', () => {
    const { transport, sent } = fakeTransport();
    initSignals({ dsn: DSN, transport });
    const button = document.createElement('button');
    button.id = 'apply-coupon';
    document.body.appendChild(button);
    button.click();
    history.pushState({}, '', '/checkout');
    getClient()!.captureError(new Error('x'));
    const types = sent[0]!.breadcrumbs!.map((b) => `${b.type}:${b.message}`);
    expect(types).toContain('click:button#apply-coupon');
    expect(types).toContain('navigation:/checkout');
  });

  it('re-init tears down old listeners (no double capture)', () => {
    const { transport, sent } = fakeTransport();
    initSignals({ dsn: DSN, transport });
    initSignals({ dsn: DSN, transport });
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('once'), message: 'once' }));
    expect(sent.filter((s) => s.kind === 'error')).toHaveLength(1);
  });

  it('fetch patch leaves an http breadcrumb with status and duration', async () => {
    const { transport, sent } = fakeTransport();
    window.fetch = (async () => ({ status: 200 })) as unknown as typeof fetch;
    initSignals({ dsn: DSN, transport });
    await fetch('/api/x');
    getClient()!.captureError(new Error('x'));
    const http = sent[0]!.breadcrumbs!.find((b) => b.type === 'http');
    expect(http).toMatchObject({ type: 'http', message: 'GET /api/x', data: { status: 200 } });
  });

  it('fetch wrapper survives a weird init object and still performs the fetch', async () => {
    const { transport, sent } = fakeTransport();
    const weirdInit = {
      method: {
        toUpperCase() {
          throw new Error('nope');
        },
      },
    } as unknown as RequestInit;
    window.fetch = (async () => ({ status: 204 })) as unknown as typeof fetch;
    initSignals({ dsn: DSN, transport });
    await expect(fetch('/api/weird', weirdInit)).resolves.toMatchObject({ status: 204 });
    expect(() => getClient()!.captureError(new Error('x'))).not.toThrow();
    expect(sent).toHaveLength(1);
  });

  it('does not breadcrumb its own ingest POSTs (self-ingest loop guard)', async () => {
    const { transport, sent } = fakeTransport();
    window.fetch = (async () => ({ status: 200 })) as unknown as typeof fetch;
    initSignals({ dsn: DSN, transport });
    await fetch('http://127.0.0.1:4640/ingest/k');
    await fetch('/api/x');
    getClient()!.captureError(new Error('x'));
    const http = sent[0]!.breadcrumbs!.filter((b) => b.type === 'http');
    expect(http).toHaveLength(1);
    expect(http[0]).toMatchObject({ message: 'GET /api/x' });
  });

  it('visibilitychange->hidden with no navigator.sendBeacon does not throw', () => {
    const { transport } = fakeTransport();
    const originalSendBeacon = (navigator as Navigator & { sendBeacon?: unknown }).sendBeacon;
    // @ts-expect-error - simulate an environment without the Beacon API
    delete navigator.sendBeacon;
    initSignals({ dsn: DSN, transport });
    expect(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }).not.toThrow();
    if (originalSendBeacon) {
      (navigator as Navigator & { sendBeacon?: unknown }).sendBeacon = originalSendBeacon;
    }
  });
});
