import {
  createClient,
  installConsoleCapture,
  parseDsn,
  type Breadcrumb,
  type CaptureOptions,
  type ClientOptions,
  type SignalLevel,
  type SignalsClient,
  type Transport,
} from '@bendela6/signals-core';
import { installInstrumentation, type CaptureConsoleMode } from './instrument';

let current: { client: SignalsClient; uninstall: () => void } | null = null;

export type BrowserInitOptions = Omit<ClientOptions, 'platform' | 'sdk' | 'transport' | 'captureConsole' | 'logLevel'> & {
  // `CaptureConsoleMode` ('breadcrumbs' | 'both' | 'off') is this package's
  // pre-existing breadcrumb-oriented console capture; `true` opts into the
  // core SDK's floor-gated `log`-signal capture (see logLevel) on top of it.
  captureConsole?: CaptureConsoleMode | boolean;
  logLevel?: SignalLevel;
  transport?: Transport;
};

export function initSignals(options: BrowserInitOptions): SignalsClient {
  try {
    current?.uninstall();
    current = null;

    const { captureConsole, logLevel, ...rest } = options;

    const client = createClient({
      ...rest,
      platform: { runtime: 'browser', browser: navigator.userAgent, url: location.href },
      sdk: { name: '@bendela6/signals-browser', version: '0.1.0' },
    });

    let ingestUrl: string | null = null;
    try {
      ingestUrl = parseDsn(options.dsn).ingestUrl;
    } catch {
      // disabled client; no beacon target
    }

    const legacyMode: CaptureConsoleMode = typeof captureConsole === 'string' ? captureConsole : 'breadcrumbs';
    const uninstallInstrumentation = installInstrumentation(client, {
      captureConsole: legacyMode,
      ingestUrl,
    });

    const uninstallConsoleCapture = captureConsole === true
      ? installConsoleCapture(client, logLevel ?? 'warning')
      : null;

    const uninstall = () => {
      uninstallInstrumentation();
      uninstallConsoleCapture?.();
    };

    current = { client, uninstall };
    return client;
  } catch {
    // absolute last resort: return an inert client-shaped object
    const noop = () => {};
    return {
      captureError: noop,
      captureEvent: noop,
      captureLog: noop,
      addBreadcrumb: noop,
      setUser: noop,
      setTag: noop,
      setContext: noop,
      flush: async () => {},
      takeAll: () => [],
      sessionId: 'sess_disabled0',
      enabled: false,
    } as SignalsClient;
  }
}

export function getClient(): SignalsClient | null {
  return current?.client ?? null;
}

export function captureError(error: unknown, options?: CaptureOptions): void {
  getClient()?.captureError(error, options);
}
export function captureEvent(name: string, data?: Record<string, unknown>, options?: CaptureOptions): void {
  getClient()?.captureEvent(name, data, options);
}
export function captureLog(message: string, level?: SignalLevel): void {
  getClient()?.captureLog(message, level);
}
export function addBreadcrumb(breadcrumb: Breadcrumb): void {
  getClient()?.addBreadcrumb(breadcrumb);
}
export function setUser(user: { id?: string; email?: string; name?: string } | null): void {
  getClient()?.setUser(user);
}
export function setTag(key: string, value: string): void {
  getClient()?.setTag(key, value);
}
export function setContext(key: string, context: Record<string, unknown> | null): void {
  getClient()?.setContext(key, context);
}

export { ensureAppDsn } from './ensure';
export type { EnsureAppDsnOptions } from './ensure';

export * from '@bendela6/signals-core';
