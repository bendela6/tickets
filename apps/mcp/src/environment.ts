// The only place in the app that reads process.env.
export const environment = {
  apiUrl: process.env.TICKETS_API_URL ?? 'http://127.0.0.1:4600',
  actorName: process.env.TICKETS_ACTOR ?? 'claude',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  // Signals self-monitoring knobs — see src/signals.ts.
  signalsDisabled: process.env.SIGNALS_DISABLED === '1',
  signalsDsn: process.env.SIGNALS_DSN,
  signalsCollectorUrl: process.env.SIGNALS_COLLECTOR_URL ?? 'http://127.0.0.1:4640',
  // Floor for console-log capture (installConsoleCapture) — 'error' | 'warning' | 'info'.
  signalsLogLevel: (process.env.SIGNALS_LOG_LEVEL ?? 'warning') as 'error' | 'warning' | 'info',
};
