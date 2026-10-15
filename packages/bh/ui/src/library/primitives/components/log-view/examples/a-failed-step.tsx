import { LogView, type LogLine, type LogSectionOf } from '@bh/ui';

// The deployer's own words start a step; BuildKit's `#1 [stage]` lines start
// one inside the build. A function, as the app knows its steps' words. A
// module constant, so the lines are read once.
const STEP =
  /^(deploy \d+:|fetched the commit|build$|setting it up|running \S+ before|failed before|done:)/;

const sectionOf: LogSectionOf = (text) => {
  if (STEP.test(text)) {
    return { level: 0 };
  }
  return /^#\d+ \[/.test(text) ? { level: 1 } : undefined;
};

const at = Date.UTC(2026, 9, 8, 0, 41, 33);

// A deploy whose migration could not log in, each line with how long after
// the start it was printed: the step that failed opens by itself, and the
// rest stay folded.
const PRINTED: [number, string][] = [
  [0, 'deploy 1: bendela6/wallet-passes 54129ade72de, asked by the page'],
  [1000, 'fetched the commit'],
  [1000, 'build'],
  [1100, '#1 [internal] load build definition from Dockerfile'],
  [1200, '#1 DONE 0.1s'],
  [1300, '#2 [wallet-passes build 4/6] RUN pnpm install --frozen-lockfile'],
  [9800, '#2 9.821 Done in 9.6s using pnpm v12.4.2'],
  [9900, '#2 DONE 9.9s'],
  [35000, "setting it up in postgres's postgres"],
  [36000, 'running migrate before anything starts'],
  [
    36000,
    'time="2026-10-08T00:42:09Z" level=warning msg="Found orphan containers ([wallet-passes-mailpit]) for this project."',
  ],
  [36000, 'Container wallet-passes-migrate-run-6b52f4b3108c Created'],
  [37000, 'error: password authentication failed for user "wp_owner"'],
  [37000, '    at /repo/node_modules/pg-pool/index.js:45:11'],
  [37000, '    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)'],
  [37000, '    at async migrateDatabase (/repo/packages/db/src/migrate.ts:23:20) {'],
  [37000, "  severity: 'FATAL',"],
  [37000, "  code: '28P01',"],
  [37000, "  routine: 'auth_failed'"],
  [37000, '}'],
  [37000, 'Node.js v24.21.0'],
  [
    38000,
    'failed before anything was started; the live version is untouched: docker compose run failed (exit 1)',
  ],
  [38000, 'done: failed'],
];

const LINES: LogLine[] = PRINTED.map(([after, text]) => ({ time: at + after, text }));

export function AFailedStep() {
  return <LogView lines={LINES} sections={sectionOf} label="Deploy 1" className="w-full" />;
}
