import { ensureAppDsn, initSignals } from '@bendela6/signals-react';

// Self-registers Tickets EER with the local Signals collector (via the
// same-origin /signals-api proxy) and initializes the browser SDK. Never
// throws, never blocks rendering — main.tsx calls this fire-and-forget
// (`void initEerSignals()`). A down collector degrades to "no signals" with
// a single console.warn; the app renders normally either way.
export async function initEerSignals(): Promise<void> {
  if (import.meta.env.VITE_SIGNALS_DISABLED === '1') return;

  const dsn = import.meta.env.VITE_SIGNALS_DSN ?? (await ensureAppDsn({ name: 'Tickets EER' }));

  if (!dsn) {
    console.warn('[signals] no DSN available — Tickets EER is not reporting errors to Signals');
    return;
  }

  initSignals({ dsn, environment: import.meta.env.MODE });
}
