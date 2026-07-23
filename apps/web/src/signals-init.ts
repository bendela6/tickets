import { captureEvent, ensureAppDsn, initSignals, type SignalLevel } from '@bendela6/signals-react';

// Module-level: survives across calls within a page load so `web.mount`
// fires exactly once even if initWebSignals() is ever invoked more than
// once (defensive — main.tsx only calls it once today).
let mountEventEmitted = false;

// Self-registers Tickets Web with the local Signals collector (via the
// same-origin /signals-api proxy) and initializes the browser SDK. Never
// throws, never blocks rendering — main.tsx calls this fire-and-forget
// (`void initWebSignals()`). A down collector degrades to "no signals" with
// a single console.warn; the app renders normally either way.
export async function initWebSignals(): Promise<void> {
  if (import.meta.env.VITE_SIGNALS_DISABLED === '1') return;

  const dsn = import.meta.env.VITE_SIGNALS_DSN ?? (await ensureAppDsn({ name: 'Tickets Web' }));

  if (!dsn) {
    console.warn('[signals] no DSN available — Tickets Web is not reporting errors to Signals');
    return;
  }

  const logLevel = (import.meta.env.VITE_SIGNALS_LOG_LEVEL as SignalLevel | undefined) ?? 'warning';

  initSignals({ dsn, environment: import.meta.env.MODE, captureConsole: true, logLevel });

  if (!mountEventEmitted) {
    mountEventEmitted = true;
    captureEvent('web.mount');
  }
}
