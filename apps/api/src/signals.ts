import { ensureAppDsn, initSignals, type SignalsClient } from '@bendela6/signals-node';
import { environment } from './environment';

// Self-registers the API with the local Signals collector and initializes
// the node SDK. Never throws, never blocks boot beyond ensureAppDsn's own
// timeout (default 2s) — a down collector degrades to "no signals" with a
// single console.warn, and the app runs normally either way.
export async function initApiSignals(): Promise<SignalsClient | null> {
  if (environment.signalsDisabled) return null;

  const dsn =
    environment.signalsDsn ??
    (await ensureAppDsn({ collectorUrl: environment.signalsCollectorUrl, name: 'Tickets API' }));

  if (!dsn) {
    console.warn('[signals] no DSN available — Tickets API is not reporting errors to Signals');
    return null;
  }

  return initSignals({
    dsn,
    environment: environment.nodeEnv,
    exitOnUncaught: environment.nodeEnv === 'production',
    registerProcessHandlers: true,
    captureConsole: true,
    logLevel: environment.signalsLogLevel,
  });
}
