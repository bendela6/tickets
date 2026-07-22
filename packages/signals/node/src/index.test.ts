import { describe, expect, it, vi } from 'vitest';
import {
  buildUncaughtListener,
  captureError,
  expressErrorHandler,
  fastifyErrorHook,
  handleRejection,
  handleUncaught,
  initSignals,
} from './index';
import type { Signal, Transport } from '@bendela6/signals-core';

function fakeTransport() {
  const sent: Signal[] = [];
  const transport: Transport = {
    enqueue: (s) => { sent.push(s); }, flush: async () => {}, takeAll: () => sent.splice(0),
    queuedCount: () => sent.length, dispose: () => {},
  };
  return { transport, sent };
}
const DSN = 'sgl://k@127.0.0.1:4640/1';

describe('top-level capture functions', () => {
  it('no-op when no client has been inited', () => {
    expect(() => captureError(new Error('x'))).not.toThrow();
  });

  it('routes to the active client after initSignals', () => {
    const { transport, sent } = fakeTransport();
    initSignals({ dsn: DSN, transport, registerProcessHandlers: false });
    captureError(new Error('routed'));
    expect(sent[0]).toMatchObject({ mechanism: 'manual', message: 'routed' });
  });
});

describe('node SDK', () => {
  it('carries node platform info and does not register process handlers when disabled', () => {
    const before = process.listenerCount('uncaughtException');
    const { transport, sent } = fakeTransport();
    const client = initSignals({ dsn: DSN, transport, registerProcessHandlers: false });
    expect(process.listenerCount('uncaughtException')).toBe(before);
    client.captureError(new Error('x'));
    expect(sent[0]!.platform).toMatchObject({ runtime: 'node', nodeVersion: process.version, pid: process.pid });
  });

  it('handleUncaught captures with mechanism and calls exit hook; handleRejection never exits', async () => {
    const { transport, sent } = fakeTransport();
    const client = initSignals({ dsn: DSN, transport, registerProcessHandlers: false });
    let exited: number | null = null;
    await handleUncaught(client, new TypeError('crash'), (code) => { exited = code; });
    expect(sent[0]).toMatchObject({ mechanism: 'uncaught-exception', name: 'TypeError' });
    expect(exited).toBe(1);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    handleRejection(client, 'string reason');
    expect(sent[1]).toMatchObject({ mechanism: 'unhandled-rejection', message: 'string reason' });
    expect(errorSpy).toHaveBeenCalledWith('[signals] unhandled rejection:', 'string reason');
    errorSpy.mockRestore();
  });

  it('buildUncaughtListener logs to stderr and never exits when exitOnUncaught is false', async () => {
    const { transport, sent } = fakeTransport();
    const client = initSignals({ dsn: DSN, transport, registerProcessHandlers: false });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const listener = buildUncaughtListener(client, { exitOnUncaught: false });
    const error = new TypeError('non-fatal crash');
    listener(error);
    // handleUncaught's capture + flush happen synchronously before the flush race,
    // but the listener itself is fire-and-forget (`void handleUncaught(...)`).
    await new Promise((r) => setTimeout(r, 0));
    expect(sent[0]).toMatchObject({ mechanism: 'uncaught-exception', name: 'TypeError' });
    expect(errorSpy).toHaveBeenCalledWith('[signals] uncaught exception:', error);
    expect(errorSpy).toHaveBeenCalledWith('[signals] uncaught exception (exitOnUncaught: false):', error);
    errorSpy.mockRestore();
  });

  it('buildUncaughtListener logs to stderr on the exit path too (exitOnUncaught: true)', async () => {
    const { transport, sent } = fakeTransport();
    const client = initSignals({ dsn: DSN, transport, registerProcessHandlers: false });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const listener = buildUncaughtListener(client, { exitOnUncaught: true });
    const error = new TypeError('fatal crash');
    listener(error);
    await new Promise((r) => setTimeout(r, 0));
    expect(sent[0]).toMatchObject({ mechanism: 'uncaught-exception', name: 'TypeError' });
    expect(errorSpy).toHaveBeenCalledWith('[signals] uncaught exception:', error);
    expect(errorSpy).not.toHaveBeenCalledWith('[signals] uncaught exception (exitOnUncaught: false):', error);
    expect(exitSpy).toHaveBeenCalledWith(1);
    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('express and fastify helpers capture with http context and middleware mechanism', () => {
    const { transport, sent } = fakeTransport();
    const client = initSignals({ dsn: DSN, transport, registerProcessHandlers: false });
    let nexted: unknown = null;
    expressErrorHandler(client)(new Error('exp'), { method: 'POST', url: '/pay', originalUrl: '/api/pay' }, {}, (e: unknown) => { nexted = e; });
    expect(sent[0]).toMatchObject({ mechanism: 'middleware', message: 'exp' });
    expect(sent[0]!.contexts?.http).toMatchObject({ method: 'POST', url: '/api/pay' });
    expect(nexted).toBeInstanceOf(Error);
    fastifyErrorHook(client)(new Error('fas'), { method: 'GET', url: '/x' });
    expect(sent[1]!.contexts?.http).toMatchObject({ method: 'GET', url: '/x' });
  });

  it('handleUncaught still exits when the transport flush() rejects', async () => {
    const sent: Signal[] = [];
    const transport: Transport = {
      enqueue: (s) => { sent.push(s); },
      flush: async () => { throw new Error('down'); },
      takeAll: () => sent.splice(0),
      queuedCount: () => sent.length,
      dispose: () => {},
    };
    const client = initSignals({ dsn: DSN, transport, registerProcessHandlers: false });
    let exited: number | null = null;
    await expect(
      handleUncaught(client, new TypeError('crash'), (code) => { exited = code; }),
    ).resolves.toBeUndefined();
    expect(exited).toBe(1);
  });
});
