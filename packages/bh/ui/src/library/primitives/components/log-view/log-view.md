---
title: LogView
summary: Reads any app's log, line by line, its ANSI colours drawn, what failed,
  warned or passed highlighted, and its stack traces folding.
related: [JsonViewer, Disclosure]
---

[//]: # 'written from log-view.doc.yaml by pnpm docs:sync; edit that file, not this one'

# LogView

Reads any app's log, line by line, in monospace. It knows nothing of the
app: the colours its program printed are drawn in the page's tones, and
highlight rules, the defaults and the app's own, mark what to look at.

Pass `lines` as one string, split at each newline, or as an array of
lines, each a string or a `LogLine` with a `time` and an `id`. The view
grows with the page rather than scrolling in a box of its own.

## Import

```tsx
import { LogView } from '@bh/ui';
```

## Examples

By default times are dimmed, failures red (`error`, `failed`, `FAIL`,
`[ERROR]`), warnings amber (`warn`, `[WARN]`) and successes green (`OK`,
`DONE`, `healthy`). A tone colours the word that earned it; a line with
a failure or a warning is also washed in its tone.

**Highlights**

```tsx
import { LogView } from '@bh/ui';

// What a build prints, as one string: the view splits it at each newline.
const BUILD = `2026-10-08T00:46:03Z Scope: 8 of 9 workspace projects
? Verifying lockfile against supply-chain policies (806 entries)...
✓ Lockfile passes supply-chain policies (806 entries in 4.7s)
[WARN] Tarball download average speed 22 KiB/s (size 37 KiB) is below 50 KiB/s
Progress: resolved 750, reused 0, downloaded 477, added 480
Done in 9.6s using pnpm v12.4.2
Container gateway-docker-proxy-1 Healthy
error: password authentication failed for user "app_owner"
failed before anything was started: docker compose run failed (exit 1)`;

export function Highlights() {
  return <LogView lines={BUILD} label="Build log" className="w-full" />;
}
```

ANSI colours are drawn in Instrument's hues, so they follow dark mode:
a colour at its rung 11, its bright twin at 9, a background at 3, and a
256-colour or 24-bit colour at the nearest hue. Bold, dim, italic and
underline are kept. Every other escape code, a cursor move or an erase,
is dropped, never shown.

**ANSI colours**

```tsx
import { LogView } from '@bh/ui';

const ESC = '\u001b';

// Lines as a test runner prints them to a terminal, escape codes and all.
const RUN = [
  `${ESC}[1m${ESC}[46m RUN ${ESC}[49m${ESC}[22m ${ESC}[36mv5.0.1${ESC}[39m ${ESC}[90m/repo/packages/ui${ESC}[39m`,
  `${ESC}[32m✓${ESC}[39m src/parse.test.ts ${ESC}[2m(17 tests)${ESC}[22m ${ESC}[33m13ms${ESC}[39m`,
  `${ESC}[31m×${ESC}[39m src/fold.test.ts ${ESC}[2m(4 tests | 1 failed)${ESC}[22m`,
  `${ESC}[35mmagenta${ESC}[39m ${ESC}[34mblue${ESC}[39m ${ESC}[4munderlined${ESC}[24m ${ESC}[38;5;208m256-colour orange${ESC}[39m ${ESC}[38;2;30;160;60m24-bit green${ESC}[39m`,
  `${ESC}[2K${ESC}[1A${ESC}[2K${ESC}[G Test Files  ${ESC}[1m${ESC}[31m1 failed${ESC}[39m${ESC}[22m | ${ESC}[1m${ESC}[32m2 passed${ESC}[39m${ESC}[22m (3)`,
];

export function AnsiColors() {
  return <LogView lines={RUN} label="Test run" className="w-full" />;
}
```

`rules` adds highlights of the app's own on top of the defaults, each a
`match` (a string or a regular expression), a `tone` (or `quiet`) and,
for a line that should stand out, a `level`. Where two rules match the
same text, the later one draws it. `defaultRules={false}` leaves only
the app's. A line's `time` shows beside it, only where it changes from
the line above.

**Rules and times**

```tsx
import { LogView, type LogLine, type LogRule } from '@bh/ui';

// The app's own highlights, on top of the defaults. A module constant, so the
// lines are read once.
const RULES: readonly LogRule[] = [
  { match: /\breqId=\S+/, tone: 'quiet' },
  { match: /\b[45]\d\d\b(?= in)/, tone: 'warning' },
  { match: /\b2\d\d\b(?= in)/, tone: 'success' },
];

const at = Date.UTC(2026, 9, 8, 21, 46, 25);

// Lines with times: the time shows beside a line only where it changes.
const LINES: LogLine[] = [
  { time: at, text: 'INFO incoming request GET / reqId=req-20x' },
  { time: at + 120, text: 'INFO request completed 404 in 0.2 ms reqId=req-20x' },
  { time: at + 6000, text: 'INFO incoming request GET /api/health reqId=req-20y' },
  { time: at + 6004, text: 'INFO request completed 200 in 4.9 ms reqId=req-20y' },
];

export function RulesAndTimes() {
  return <LogView lines={LINES} rules={RULES} label="Service log" className="w-full" />;
}
```

A multi-line entry, a line and the lines indented under it as a stack
trace is, folds under its first line at the chevron beside it, which says
how many lines it holds; a single line under another is left as it is,
since folding it would save nothing. A stack frame (`at …`, `... 3 more`,
`Caused by:`) belongs to the trace however it is indented, and a printed
object's closing brace stays with the entry that opened it. Entries start
open; `entries="folded"` starts them folded, and `entries="flat"` draws
them as plain lines.

**Stack traces**

```tsx
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
```

## Keyboard and accessibility

| Key                | Does                                                  |
| ------------------ | ----------------------------------------------------- |
| `Enter` or `Space` | Folds or opens the entry whose chevron has the focus. |

The log is a `role="log"` named by `label`, `Log` by default. Its lines
are text, so a reader selects and copies them as the program printed
them, spacing and all; the times stay out of a selection.

An entry's chevron is a `<button>` with `aria-expanded`, named by its
line and described by its count, and `aria-controls` pointing at the lines
it folds while they are drawn. The lines are drawn only while open. The
chevron turns, and stops turning for a reader who asks for less motion.

## Props

| Prop               | Type                                              | Default                  | Description                                                                                                                                                                                                                         |
| ------------------ | ------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lines` (required) | `string \| readonly (string \| LogLine)[]`        |                          | The log: its text, split at each newline, or its lines, each a string or a `LogLine` with a time and an id.                                                                                                                         |
| `rules`            | `readonly LogRule[]`                              |                          | Highlights of the app's own, on top of the defaults: where two match the same text, the later one draws it. Keep the array stable (a constant, or memoised): a new one reads every line again.                                      |
| `defaultRules`     | `boolean`                                         | `true`                   | Whether the defaults apply: times dimmed, failures red, warnings amber, successes green. Turn them off for a log whose app marks its own.                                                                                           |
| `wrap`             | `boolean`                                         | `false`                  | Wraps a long line onto the next rows. Unset, it is cut short with an ellipsis.                                                                                                                                                      |
| `entries`          | `LogEntriesStart`: `'open'`, `'folded'`, `'flat'` | `'open'`                 | How multi-line entries (a line and the lines indented under it, as a stack trace) start: `open`, or `folded` under their first line; each folds and opens at the chevron beside it. `flat` draws them as plain lines, with no fold. |
| `label`            | `string`                                          | `'Log'`                  | Names the log to assistive tech.                                                                                                                                                                                                    |
| `empty`            | `ReactNode`                                       | `'Nothing printed yet.'` | Shown while there are no lines.                                                                                                                                                                                                     |
| `className`        | `string`                                          |                          | Added to the outer element's classes.                                                                                                                                                                                               |
