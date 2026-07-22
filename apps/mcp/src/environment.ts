// The only place in the app that reads process.env.
export const environment = {
  apiUrl: process.env.TICKETS_API_URL ?? 'http://127.0.0.1:4600',
  actorName: process.env.TICKETS_ACTOR ?? 'claude',
  // When this MCP server runs inside an agent session, the supervisor sets
  // AI_SESSION_ID in its environment — a dispatch then records that session as
  // the parent so the sessions list nests correctly (TIX-207).
  parentSessionId: process.env.AI_SESSION_ID ? Number(process.env.AI_SESSION_ID) : null,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  // Signals self-monitoring knobs — see src/signals.ts.
  signalsDisabled: process.env.SIGNALS_DISABLED === '1',
  signalsDsn: process.env.SIGNALS_DSN,
  signalsCollectorUrl: process.env.SIGNALS_COLLECTOR_URL ?? 'http://127.0.0.1:4640',
};
