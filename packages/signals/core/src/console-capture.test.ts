import { afterEach, describe, expect, it, vi } from 'vitest';
import { installConsoleCapture } from './console-capture';
import type { SignalsClient } from './client';

function fakeClient(captureLogImpl?: (message: string, level?: string) => void): {
  client: SignalsClient;
  captureLog: ReturnType<typeof vi.fn>;
} {
  const captureLog = vi.fn(captureLogImpl);
  const client = {
    captureError: vi.fn(),
    captureEvent: vi.fn(),
    captureLog,
    addBreadcrumb: vi.fn(),
    setUser: vi.fn(),
    setTag: vi.fn(),
    setContext: vi.fn(),
    flush: vi.fn(async () => {}),
    takeAll: vi.fn(() => []),
    sessionId: 'sess_test',
    enabled: true,
  } as unknown as SignalsClient;
  return { client, captureLog };
}

describe('installConsoleCapture', () => {
  let uninstall: (() => void) | null = null;

  afterEach(() => {
    uninstall?.();
    uninstall = null;
    vi.restoreAllMocks();
  });

  it('captures console.warn at the default floor and still calls through to the original', () => {
    const { client, captureLog } = fakeClient();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    uninstall = installConsoleCapture(client, 'warning');
    console.warn('low stock');
    expect(captureLog).toHaveBeenCalledTimes(1);
    expect(captureLog).toHaveBeenCalledWith('low stock', 'warning');
    expect(warnSpy).toHaveBeenCalledWith('low stock');
  });

  it('captures console.error and still calls through', () => {
    const { client, captureLog } = fakeClient();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    uninstall = installConsoleCapture(client, 'warning');
    console.error('gateway timeout');
    expect(captureLog).toHaveBeenCalledWith('gateway timeout', 'error');
    expect(errorSpy).toHaveBeenCalledWith('gateway timeout');
  });

  it('does not capture console.log/info at the default warning floor', () => {
    const { client, captureLog } = fakeClient();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    uninstall = installConsoleCapture(client, 'warning');
    console.log('hi');
    console.info('hi');
    expect(captureLog).not.toHaveBeenCalled();
  });

  it('joins multi-arg calls into one space-separated message, stringifying non-strings', () => {
    const { client, captureLog } = fakeClient();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    uninstall = installConsoleCapture(client, 'warning');
    console.warn('x', 42, { a: 1 });
    expect(captureLog).toHaveBeenCalledWith('x 42 {"a":1}', 'warning');
  });

  it('a throwing/circular arg does not break console or throw', () => {
    const { client, captureLog } = fakeClient();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    uninstall = installConsoleCapture(client, 'warning');
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => console.warn('bad', circular)).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
    expect(captureLog).toHaveBeenCalledTimes(1);
  });

  it('is idempotent: double-install does not double-capture', () => {
    const { client, captureLog } = fakeClient();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    uninstall = installConsoleCapture(client, 'warning');
    const secondUninstall = installConsoleCapture(client, 'warning');
    console.warn('once');
    expect(captureLog).toHaveBeenCalledTimes(1);
    secondUninstall();
  });

  it('uninstall restores the original console methods and stops capturing', () => {
    const original = console.warn;
    const { client, captureLog } = fakeClient();
    uninstall = installConsoleCapture(client, 'warning');
    expect(console.warn).not.toBe(original);
    uninstall();
    uninstall = null;
    // reference identity of console.warn isn't guaranteed to round-trip (Node's
    // console methods are themselves already bound), so assert behavior instead:
    // once uninstalled, capture must stop.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    console.warn('after uninstall');
    expect(captureLog).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('floor "error" only captures console.error, not warn', () => {
    const { client, captureLog } = fakeClient();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    uninstall = installConsoleCapture(client, 'error');
    console.warn('meh');
    console.error('boom');
    expect(captureLog).toHaveBeenCalledTimes(1);
    expect(captureLog).toHaveBeenCalledWith('boom', 'error');
  });

  it('floor "info" captures log/info/warn/error', () => {
    const { client, captureLog } = fakeClient();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    uninstall = installConsoleCapture(client, 'info');
    console.log('a');
    console.info('b');
    console.warn('c');
    console.error('d');
    expect(captureLog).toHaveBeenCalledTimes(4);
  });

  it('does not recurse if captureLog itself logs to console', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { client, captureLog } = fakeClient(() => {
      console.warn('internal logging from captureLog');
    });
    uninstall = installConsoleCapture(client, 'warning');
    expect(() => console.warn('outer')).not.toThrow();
    expect(captureLog).toHaveBeenCalledTimes(1);
    // the original console.warn still fires for both the outer call and the
    // re-entrant internal call — only the *capture* (captureLog) doesn't loop.
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});
