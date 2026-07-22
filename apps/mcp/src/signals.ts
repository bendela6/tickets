import { ensureAppDsn, initSignals, type SignalsClient } from '@bendela6/signals-node';
import { environment } from './environment';

// Self-registers the MCP server with the local Signals collector and
// initializes the node SDK. Never throws, never blocks — a down collector
// degrades to "no signals" with a single console.warn.
//
// registerProcessHandlers is off: server.ts owns its own
// uncaughtException/unhandledRejection listeners (the stdio transport must
// never be torn down by an uncaught error — see the comment there), and
// forwards to Signals through them instead of letting the SDK install its
// own exit-capable handlers.
export async function initMcpSignals(): Promise<SignalsClient | null> {
  if (environment.signalsDisabled) return null;

  const dsn =
    environment.signalsDsn ??
    (await ensureAppDsn({ collectorUrl: environment.signalsCollectorUrl, name: 'Tickets MCP' }));

  if (!dsn) {
    console.error('[signals] no DSN available — Tickets MCP is not reporting errors to Signals');
    return null;
  }

  return initSignals({
    dsn,
    environment: environment.nodeEnv,
    registerProcessHandlers: false,
  });
}
