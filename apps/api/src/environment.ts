import { homedir } from 'node:os';

// The only place in the app that reads process.env. Postgres settings are
// consumed inside @tickets/db; this file only owns the API's own knobs.
export const environment = {
  apiPort: Number(process.env.API_PORT ?? 4600),
  // 127.0.0.1 for local dev; containers set API_HOST=0.0.0.0 to be reachable
  apiHost: process.env.API_HOST ?? '127.0.0.1',
  // outbox worker poll interval (ms) between drain sweeps
  outboxPollMs: Number(process.env.OUTBOX_POLL_MS ?? 500),
  // Directory-browser allow-list: comma-separated absolute paths the
  // /api/workdirs/dirs endpoint may list under. Comma (not `:`) so Windows
  // drive letters survive. Defaults to the running user's home dir.
  workdirRoots: (process.env.WORKDIR_ROOTS ?? homedir())
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
