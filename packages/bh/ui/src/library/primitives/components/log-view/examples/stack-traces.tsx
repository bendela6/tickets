import { LogView, type LogLine } from '@bh/ui';

const at = Date.UTC(2026, 9, 8, 0, 42, 9);

// A migration that failed: its error, the stack trace under it, and the
// fields the error printed, each a line as the container printed it.
const LINES: LogLine[] = [
  { time: at, text: 'Container app-migrate-run-6b52f4b3108c Created' },
  { time: at + 1000, text: 'error: password authentication failed for user "app_owner"' },
  { time: at + 1000, text: '    at /repo/node_modules/pg-pool/index.js:45:11' },
  {
    time: at + 1000,
    text: '    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)',
  },
  {
    time: at + 1000,
    text: '    at async migrateDatabase (/repo/packages/db/src/migrate.ts:23:20)',
  },
  {
    time: at + 1000,
    text: '    at async <anonymous> (/repo/packages/db/src/cli/migrate.ts:6:1) {',
  },
  { time: at + 1000, text: "  severity: 'FATAL'," },
  { time: at + 1000, text: "  code: '28P01'," },
  { time: at + 1000, text: "  routine: 'auth_failed'" },
  { time: at + 1000, text: '}' },
  { time: at + 1000, text: 'Node.js v24.21.0' },
  { time: at + 2000, text: 'docker compose run failed (exit 1)' },
];

export function StackTraces() {
  return <LogView lines={LINES} label="Migration log" className="w-full" />;
}
