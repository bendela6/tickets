import { createClient, parseDsn, type ClientOptions, type SignalsClient, type Transport } from '@bendela6/signals-core';
import { installInstrumentation, type CaptureConsoleMode } from './instrument';

let current: { client: SignalsClient; uninstall: () => void } | null = null;

export type BrowserInitOptions = Omit<ClientOptions, 'platform' | 'sdk' | 'transport'> & {
  captureConsole?: CaptureConsoleMode;
  transport?: Transport;
};

export function initSignals(options: BrowserInitOptions): SignalsClient {
  try {
    current?.uninstall();
    current = null;

    const client = createClient({
      ...options,
      platform: { runtime: 'browser', browser: navigator.userAgent, url: location.href },
      sdk: { name: '@bendela6/signals-browser', version: '0.1.0' },
    });

    let ingestUrl: string | null = null;
    try {
      ingestUrl = parseDsn(options.dsn).ingestUrl;
    } catch {
      // disabled client; no beacon target
    }

    const uninstall = installInstrumentation(client, {
      captureConsole: options.captureConsole ?? 'breadcrumbs',
      ingestUrl,
    });

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

export { ensureAppDsn } from './ensure';
export type { EnsureAppDsnOptions } from './ensure';

export * from '@bendela6/signals-core';
