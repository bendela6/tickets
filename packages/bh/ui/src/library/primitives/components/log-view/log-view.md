---
title: LogView
summary: Reads any app's log, line by line, its ANSI colours drawn, what failed,
  warned or passed highlighted, its stack traces folding, in sections the app
  names, following the end while lines arrive.
related: [JsonViewer, Disclosure, useDisclosure]
---

[//]: # 'written from log-view.doc.yaml by pnpm docs:sync; edit that file, not this one'

# LogView

Reads any app's log, line by line, in monospace. It knows nothing of the
app: the colours its program printed are drawn in the page's tones,
highlight rules, the defaults and the app's own, mark what to look at,
and the app says which lines start a section, and at which level.

Pass `lines` as one string, split at each newline, or as an array of
lines, each a string or a `LogLine` with a `time` and an `id`. The view
grows with the page rather than scrolling in a box of its own, and keeps
the page at its end while lines arrive.

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
is dropped, never shown, and a line a terminal printed over (a progress
bar's carriage return) keeps what was printed last.

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
the line shown above.

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

## Sections

`sections` says which lines start a section, and at which level: rules,
each a `match` and a `level` (0 unless given), the first rule to match a
line deciding; or a function given each line's plain text and index,
returning its `LogSection` or nothing. A section runs until the next one
at its level or above it; one at a deeper level nests inside it, a guide
deeper, and a level with no section above it starts at the top.

A section's first line has its fold, its state and how long it took,
from its first line's time to the next line's: **running** while
`streaming` is on and it holds the last line, its time ticking;
**failed** once it holds an error line (a rule's `level: 'error'`, as
the defaults' `error:` and `failed`), and the sections around it with
it; **done** otherwise. A section with no lines under its first has no
fold.

A section starts open while it holds the last line or a failure, and
folded otherwise, so while a log streams the step running is open and
folds once it is through. A rule's or the function's `start` (`open` or
`folded`) fixes it instead; either way, once the reader opens or folds
one it stays as they left it, inside a folded section too. Multi-line
entries fold inside a section as they do outside one.

**A build log, streaming**

```tsx
import { useEffect, useState } from 'react';
import { Button, LogView, type LogLine, type LogSectionRule } from '@bh/ui';

// A deploy's steps start with `==>`; inside its build, BuildKit's steps
// start with `#13 [stage n/m]`. A constant, so the lines are read once.
const SECTIONS: readonly LogSectionRule[] = [
  { match: /^==> /, level: 0 },
  { match: /^#\d+ \[/, level: 1 },
];

// What the deploy prints, and how long after the line before.
const SCRIPT: [number, string][] = [
  [0, '==> deploy 14: bendela6/gateway d5e2f41, asked by the page'],
  [600, '==> fetched the commit'],
  [700, '==> build'],
  [300, '#1 [internal] load local bake definitions'],
  [100, '#1 reading from stdin 1.82kB done'],
  [100, '#1 DONE 0.0s'],
  [300, '#2 [gateway internal] load build definition from Dockerfile'],
  [100, '#2 transferring dockerfile: 1.45kB done'],
  [100, '#2 DONE 0.1s'],
  [400, '#3 [gateway build 8/9] RUN pnpm install --frozen-lockfile'],
  [400, '#3 0.395 Scope: 8 of 9 workspace projects'],
  [700, '#3 4.710 [WARN] Tarball download average speed 22 KiB/s is below 50 KiB/s'],
  [900, '#3 9.821 Done in 9.6s using pnpm v12.4.2'],
  [200, '#3 DONE 10.0s'],
  [400, '#4 [gateway build 9/9] RUN pnpm --filter @gateway/web build'],
  [500, '#4 0.395 $ tsc --noEmit && vite build'],
  [900, '#4 9.664 vite v8.3.0 building client environment for production...'],
  [600, '#4 10.08 ✓ 2938 modules transformed.'],
  [500, '#4 10.33 ✓ built in 662ms'],
  [200, '#4 DONE 10.6s'],
  [600, '==> starting gateway next to the running one, waiting up to 60 s for running and healthy'],
  [1200, 'Container gateway-gateway-1 Healthy'],
  [600, '==> done: live'],
];

/** The deploy so far: a line every few hundred milliseconds, until it is through. */
function useDeploy(run: number): { lines: LogLine[]; streaming: boolean } {
  const [lines, setLines] = useState<LogLine[]>([]);
  useEffect(() => {
    setLines([]);
    let at = Date.now();
    let next = 0;
    let timer: ReturnType<typeof setTimeout>;
    const print = () => {
      const step = SCRIPT[next];
      if (step === undefined) {
        return;
      }
      at += step[0];
      const line: LogLine = { time: at, text: step[1], id: `${run}-${next}` };
      setLines((before) => [...before, line]);
      next += 1;
      const after = SCRIPT[next];
      if (after !== undefined) {
        timer = setTimeout(print, after[0]);
      }
    };
    timer = setTimeout(print, 300);
    return () => clearTimeout(timer);
  }, [run]);
  return { lines, streaming: lines.length < SCRIPT.length };
}

export function BuildLogStreaming() {
  const [run, setRun] = useState(0);
  const { lines, streaming } = useDeploy(run);
  return (
    <div className="flex w-full flex-col items-start gap-12">
      <Button size="sm" disabled={streaming} onClick={() => setRun((was) => was + 1)}>
        Deploy again
      </Button>
      <LogView
        lines={lines}
        sections={SECTIONS}
        streaming={streaming}
        label="Deploy 14"
        className="w-full"
      />
    </div>
  );
}
```

Here the steps come from a function, as the app knows its own steps'
words. The step that failed opens by itself, its error and the stack
trace under it marked.

**A failed step**

```tsx
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
```

## Following the end

The log has no scroll box: it grows with the page, and the page, or the
box the page scrolls in (an app shell's main), follows its end while
lines arrive, as long as the reader is at the end. Once they scroll up
it stops, and a pill at the bottom of what they see counts the lines
that arrived since and jumps back to the end, following again. A
reader who scrolls back down follows again too. Only arriving lines
move the page: opening a fold or a time ticking never does.

Give a tail's lines an `id` (the last 200 a container printed, say): the
id keeps a fold in its place and counts the new lines while the tail's
start moves on.

**Service logs**

```tsx
import { useEffect, useState } from 'react';
import { LogView, type LogLine, type LogRule } from '@bh/ui';

// The service's own marks: its level in green, the JSON it adds dimmed.
const RULES: readonly LogRule[] = [
  { match: /(?<=^\[)info(?=\])/, tone: 'success' },
  { match: /\{.*\}$/, tone: 'quiet' },
];

const JOBS = [
  '[info][Jobs]: Starting scheduled job: Plex Watchlist Sync',
  '[info][Jobs]: Starting scheduled job: Plex Recently Added Scan',
  '[info][Plex Scan]: Scan starting {"sessionId":"f76dea29-2949-4b3f-9234-36e56b4f63b7"}',
  '[info][Plex Scan]: Beginning to process recently added for library: Movies {"lastScan":1791495300020}',
  '[info][Plex Scan]: Beginning to process recently added for library: Series {"lastScan":1791495300023}',
  '[info][Plex Scan]: Recently Added Scan Complete',
];

// The last lines a container printed: a tail, its start moving on once it
// is full, so each line has an id that keeps its place.
const TAIL = 200;

function lineAt(index: number, time: number): LogLine {
  return { id: index, time, text: JOBS[index % JOBS.length] ?? '' };
}

/** The container's log, a line a second, kept to its last 200. */
function useContainerLog(): LogLine[] {
  const [lines, setLines] = useState<LogLine[]>(() => {
    const now = Date.now();
    return Array.from({ length: 12 }, (_, index) => lineAt(index, now - (12 - index) * 4000));
  });
  useEffect(() => {
    const timer = setInterval(() => {
      setLines((before) => {
        const next = lineAt((before.at(-1)?.id as number) + 1, Date.now());
        return [...before, next].slice(-TAIL);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  return lines;
}

export function ServiceLogs() {
  const lines = useContainerLog();
  return (
    <LogView lines={lines} rules={RULES} streaming label="medialib-seerr-1" className="w-full" />
  );
}
```

## Keyboard and accessibility

| Key                | Does                                                                             |
| ------------------ | -------------------------------------------------------------------------------- |
| `Enter` or `Space` | Folds or opens the section or entry whose chevron has the focus.                 |
| `Tab`              | Moves to the next chevron, and to the pill that jumps to the end while it shows. |

The log is a `role="log"` named by `label`, `Log` by default, with
`aria-live="off"`: a screen reader is not read each line as it arrives.
While a log streams, a polite `role="status"` inside it says a section
starting, finishing (`Finished: build, in 31 s`) or failing instead,
once each; a section and the one around it failing together are said
as the inner one. Its lines are text, so a reader selects and copies
them as the program printed them, spacing and all; the times stay out
of a selection.

A section's or an entry's chevron is a `<button>` with `aria-expanded`,
named by its line and described by how the section went (`Done, 31 s`)
or how many lines the entry holds, and `aria-controls` pointing at the
lines it folds while they are drawn. The lines are drawn only while
open; a section's are a `group` named by its first line. The chevron
turns, and stops turning, as a running section's mark does, for a reader
who asks for less motion.

## Props

| Prop               | Type                                              | Default                  | Description                                                                                                                                                                                                                                                 |
| ------------------ | ------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lines` (required) | `string \| readonly (string \| LogLine)[]`        |                          | The log: its text, split at each newline, or its lines, each a string or a `LogLine` with a time and an id.                                                                                                                                                 |
| `sections`         | `readonly LogSectionRule[] \| LogSectionOf`       |                          | Which lines start a section, and at which level: rules, the first to match a line saying how its section starts, or a function given each line. Unset, the log has no sections. Keep it stable (a constant, or memoised): a new one reads every line again. |
| `streaming`        | `boolean`                                         | `false`                  | Whether lines are still arriving. While they are, the section holding the last line is running, its time ticking; it finishes, or fails, when the next one starts or this turns off.                                                                        |
| `rules`            | `readonly LogRule[]`                              |                          | Highlights of the app's own, on top of the defaults: where two match the same text, the later one draws it. Keep the array stable (a constant, or memoised): a new one reads every line again.                                                              |
| `defaultRules`     | `boolean`                                         | `true`                   | Whether the defaults apply: times dimmed, failures red, warnings amber, successes green. Turn them off for a log whose app marks its own.                                                                                                                   |
| `wrap`             | `boolean`                                         | `false`                  | Wraps a long line onto the next rows. Unset, it is cut short with an ellipsis.                                                                                                                                                                              |
| `entries`          | `LogEntriesStart`: `'open'`, `'folded'`, `'flat'` | `'open'`                 | How multi-line entries (a line and the lines indented under it, as a stack trace) start: `open`, or `folded` under their first line; each folds and opens at the chevron beside it. `flat` draws them as plain lines, with no fold.                         |
| `label`            | `string`                                          | `'Log'`                  | Names the log to assistive tech.                                                                                                                                                                                                                            |
| `empty`            | `ReactNode`                                       | `'Nothing printed yet.'` | Shown while there are no lines.                                                                                                                                                                                                                             |
| `className`        | `string`                                          |                          | Added to the outer element's classes.                                                                                                                                                                                                                       |

## Types

```ts
interface LogLine
```

One line of a log, as the app has it.

| Member            | Type                       | Default | Description                                                                                                                                                                                       |
| ----------------- | -------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text` (required) | `string`                   |         | What was printed, escape codes and all: ANSI colours are drawn, the other codes dropped.                                                                                                          |
| `time`            | `Date \| number \| string` |         | When it was printed: a `Date`, epoch milliseconds or an ISO string. Shown as the clock reads it (`14:02:07`) beside the line, only when it changes from the line above.                           |
| `id`              | `string \| number`         |         | What keeps the line's place, such as a fold, while the start of the log moves on (a tail of the last 500 lines). Unset, the line's index does, which holds while lines are only added at the end. |

```ts
interface LogRule
```

A highlight: the text it matches, and how that text is drawn.

| Member             | Type                                                                                                                                                                                                                      | Default | Description                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `match` (required) | `string \| RegExp`                                                                                                                                                                                                        |         | What it marks. A string matches itself, case and all, wherever it appears; a regular expression marks each of its matches. |
| `tone` (required)  | `LogTone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'`, `'quiet'` |         | How the matched text is drawn.                                                                                             |
| `level`            | `LogLevel`: `'error'`, `'warning'`                                                                                                                                                                                        |         | Makes every line it matches an error or a warning line: the whole line washed in its tone.                                 |

```ts
interface LogSectionRule extends LogSection
```

Starts a section at each line it matches.

| Member             | Type                                       | Default | Description                                                                                                                                                                                                                                                   |
| ------------------ | ------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `level`            | `number`                                   |         | How deep it sits: 0, the top, unless given. A section runs until the next one at its level or above it; one at a deeper level starts inside it.                                                                                                               |
| `start`            | `'open' \| 'folded'`: `'open'`, `'folded'` |         | Whether it starts open or folded. Unset, it is open while it holds the log's last line or a failure, and folded otherwise: a streaming log's running step is open, and folds once it is through. Once the reader opens or folds it, it stays as they left it. |
| `match` (required) | `string \| RegExp`                         |         | The lines that start one, read as plain text. A string matches a line that holds it, case and all; a regular expression, a line it matches (`^` ties it to the line's start).                                                                                 |

```ts
interface LogSection
```

How a section starts: how deep it sits, and whether it starts open.

| Member  | Type                                       | Default | Description                                                                                                                                                                                                                                                   |
| ------- | ------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `level` | `number`                                   |         | How deep it sits: 0, the top, unless given. A section runs until the next one at its level or above it; one at a deeper level starts inside it.                                                                                                               |
| `start` | `'open' \| 'folded'`: `'open'`, `'folded'` |         | Whether it starts open or folded. Unset, it is open while it holds the log's last line or a failure, and folded otherwise: a streaming log's running step is open, and folds once it is through. Once the reader opens or folds it, it stays as they left it. |

```ts
type LogSectionOf = (text: string, index: number) => LogSection | undefined;
```

Says whether a line starts a section, and how: its level and how it
starts, or nothing for a line that belongs to the section it is in. Given
the line's plain text, its escape codes taken out, and its index.

```ts
const DEFAULT_LOG_RULES: readonly LogRule[];
```

What every log is highlighted with unless the app turns it off: times and
stack frames' `at` dimmed, failures red, warnings amber, successes green.
A line with a failure is an error line and one with a warning a warning
line, washed in that tone.

The words are matched as written, so `Error.captureStackTrace` and a
lower-case `done` (as in `3.12kB done`) stay plain: a capitalised `Error`
or `Warning` counts only before a colon, as a thrown error prints it. A
bare `FATAL` stays plain too, being a field's value as often as a verdict
(`severity: 'FATAL'`); in brackets, `[FATAL]`, it is a failure.

```ts
stripAnsi(raw: string): string
```

A line's text with every escape sequence and control character taken out.

| Parameter        | Type     | Default | Description                                       |
| ---------------- | -------- | ------- | ------------------------------------------------- |
| `raw` (required) | `string` |         | The line as it was printed, escape codes and all. |

Returns `string`.
