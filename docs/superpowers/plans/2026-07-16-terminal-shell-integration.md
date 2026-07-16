# Terminal Shell Integration (OSC 133) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Accurate terminal Running/Ready via OSC 133 shell integration — typing stays Ready, silent commands show Running — built as an extensible per-shell registry, with the output pulse as fallback.

**Architecture:** On terminal spawn, an extensible registry augments the spawn **args** so the shell emits OSC 133 command-start/end markers (verified clean for bash `--rcfile` and pwsh `-NoExit -Command`). A pure scanner strips the markers from the PTY output and reports busy transitions; the supervisor broadcasts an additive `activity` frame; the terminal screen uses that server signal when integrated, else the existing output pulse.

**Tech Stack:** apps/api (Fastify 5, node-pty behind a Runner seam, the Supervisor), apps/web (React 19, xterm, TanStack Query, vitest), Tailwind v4 Instrument preflight ON.

## Global Constraints

- Spec of record: `docs/superpowers/specs/2026-07-16-terminal-shell-integration-design.md`.
- One commit per task; conventional commits scoped by app.
- **Verified snippets — use verbatim.** bash: `PS0=$'\e]133;C\e\\'` + `PROMPT_COMMAND` printing `\e]133;D\e\\`, injected via a temp `--rcfile`. pwsh: a `prompt` fn emitting `\e]133;D\e\\`+`\e]133;A\e\\` + a `Set-PSReadLineKeyHandler -Chord Enter` writing `\e]133;C\e\\` before `AcceptLine()`, injected via `-NoExit -Command`.
- OSC 133: `C`=`ESC]133;C ESC\` → busy true; `D`=`ESC]133;D ESC\` and `A`=`ESC]133;A ESC\` → busy false. ST = `ESC \` (0x1b 0x5c).
- Markers are **stripped server-side** before persist/broadcast (no marker glyphs in scrollback).
- Injection is **args/env only** — never write setup into the PTY (it would echo).
- Only **precise** integrations (bash, pwsh) drive activity frames; cmd/unknown shells fall back to the client output pulse (unchanged). Registry stays extensible (add zsh/cmd/WSL later).
- No new DB column, no list change (the list stays lifecycle-only; command-name/exit-code + list-busy are the profiles follow-on).
- node-pty on Windows can't spawn bare PATH shims — full exe path required (already how workspaces store commands).
- Existing suites stay green (api 141 · web 142 · db 18); typecheck + build green. API tests need Docker Postgres `tickets-postgres-1` @ 127.0.0.1:5532.

## File Structure

**API**
- `apps/api/src/ai/shell-integration.ts` (new) + test — registry (`bash`, `pwsh`), `integrationFor`.
- `apps/api/src/ai/activity-scanner.ts` (new) + test — strip markers + busy transitions.
- `apps/api/src/ai/types.ts` — `ServerFrame` gains the `activity` frame.
- `apps/api/src/ai/supervisor.ts` — apply integration on terminal start; run scanner in `consumeTerminal`; broadcast `activity`.
- `apps/api/src/ai/session-command.ts` — Windows default shell → `powershell.exe` (so integration is on by default).

**Web**
- `apps/web/src/api/types.ts` — mirror the `activity` frame in `ServerFrame`.
- `apps/web/src/components/ai/use-session-socket.ts` — handle `activity` → `{ busy, integrated }`.
- `apps/web/src/components/ai/ai-session-screen.tsx` — use server busy when integrated, else the output pulse.

---

## Task 1: Shell-integration registry

**Files:**
- Create: `apps/api/src/ai/shell-integration.ts`
- Test: `apps/api/src/ai/shell-integration.test.ts`

**Interfaces:**
- Produces: `interface ShellIntegration { id: string; precise: boolean; matches(command: string): boolean; apply(spec: { id: number; command: string; args?: string[]; env?: Record<string,string> }): { command: string; args: string[]; env: Record<string,string> } }`; `integrationFor(command: string): ShellIntegration | null`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/ai/shell-integration.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { integrationFor } from './shell-integration';

describe('integrationFor', () => {
  it('matches bash by basename (full path, .exe, case)', () => {
    expect(integrationFor('C:/Program Files/Git/bin/bash.exe')?.id).toBe('bash');
    expect(integrationFor('/usr/bin/bash')?.id).toBe('bash');
  });
  it('matches powershell/pwsh', () => {
    expect(integrationFor('powershell.exe')?.id).toBe('pwsh');
    expect(integrationFor('pwsh')?.id).toBe('pwsh');
  });
  it('returns null for cmd and unknown shells (fallback to output pulse)', () => {
    expect(integrationFor('C:/WINDOWS/system32/cmd.exe')).toBeNull();
    expect(integrationFor('zsh')).toBeNull();
  });
  it('bash.apply injects markers via --rcfile without touching the command', () => {
    const bash = integrationFor('/usr/bin/bash')!;
    const out = bash.apply({ id: 7, command: '/usr/bin/bash' });
    expect(out.command).toBe('/usr/bin/bash');
    expect(out.args).toContain('--rcfile');
    expect(out.args).toContain('-i');
    expect(bash.precise).toBe(true);
  });
  it('pwsh.apply appends -NoExit -Command with the marker setup', () => {
    const pwsh = integrationFor('powershell.exe')!;
    const out = pwsh.apply({ id: 8, command: 'powershell.exe', args: ['-NoLogo'] });
    expect(out.args).toEqual(expect.arrayContaining(['-NoLogo', '-NoExit', '-Command']));
    const cmdArg = out.args[out.args.indexOf('-Command') + 1]!;
    expect(cmdArg).toMatch(/133;C/);
    expect(cmdArg).toMatch(/PSReadLineKeyHandler/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @tickets/api test -- shell-integration`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/api/src/ai/shell-integration.ts`:

```ts
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ESC = '\x1b';

export interface IntegrationSpec {
  id: number;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface ShellIntegration {
  id: string;
  precise: boolean;
  matches(command: string): boolean;
  apply(spec: IntegrationSpec): { command: string; args: string[]; env: Record<string, string> };
}

function basename(command: string): string {
  const last = command.replace(/\\/g, '/').split('/').pop() ?? command;
  return last.toLowerCase().replace(/\.exe$/, '');
}

// bash/sh: a temp rcfile sources the user's ~/.bashrc, then sets PS0 (emit C
// before each command) and PROMPT_COMMAND (emit D at each prompt). Verified: no
// setup text echoes; silent commands are bracketed C→D.
const bash: ShellIntegration = {
  id: 'bash',
  precise: true,
  matches: (c) => ['bash', 'sh'].includes(basename(c)),
  apply: (spec) => {
    const rc = join(tmpdir(), `ti-shellint-${spec.id}.sh`);
    writeFileSync(
      rc,
      `[ -f ~/.bashrc ] && . ~/.bashrc\n` +
        `PS0=$'${ESC}]133;C${ESC}\\\\'\n` +
        `PROMPT_COMMAND='printf "${ESC}]133;D${ESC}\\\\";'"\${PROMPT_COMMAND:-}"\n`,
    );
    return { command: spec.command, args: ['--rcfile', rc, '-i'], env: spec.env ?? {} };
  },
};

// pwsh: prompt fn emits D+A; a PSReadLine Enter handler emits C before accepting
// the line. Injected via -NoExit -Command so nothing echoes.
const PWSH_INIT =
  `function prompt { $e=[char]27; "$e]133;D$e\\$e]133;A$e\\PS $($executionContext.SessionState.Path.CurrentLocation)> " }; ` +
  `Set-PSReadLineKeyHandler -Chord Enter -ScriptBlock { [Console]::Write([char]27+']133;C'+[char]27+'\\'); [Microsoft.PowerShell.PSConsoleReadLine]::AcceptLine() }`;

const pwsh: ShellIntegration = {
  id: 'pwsh',
  precise: true,
  matches: (c) => ['powershell', 'pwsh'].includes(basename(c)),
  apply: (spec) => ({
    command: spec.command,
    args: [...(spec.args ?? []), '-NoExit', '-Command', PWSH_INIT],
    env: spec.env ?? {},
  }),
};

// Extensible: add zsh (precise, ZDOTDIR), cmd (coarse, /K prompt), WSL, … here.
const REGISTRY: ShellIntegration[] = [bash, pwsh];

export function integrationFor(command: string): ShellIntegration | null {
  return REGISTRY.find((i) => i.matches(command)) ?? null;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @tickets/api test -- shell-integration`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ai/shell-integration.ts apps/api/src/ai/shell-integration.test.ts
git commit -m "feat(api): extensible shell-integration registry (bash + pwsh OSC 133)"
```

---

## Task 2: Activity scanner

**Files:**
- Create: `apps/api/src/ai/activity-scanner.ts`
- Test: `apps/api/src/ai/activity-scanner.test.ts`

**Interfaces:**
- Produces: `createActivityScanner(): { push(chunk: string): { clean: string; busy?: boolean } }`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/ai/activity-scanner.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createActivityScanner } from './activity-scanner';

const C = '\x1b]133;C\x1b\\';
const D = '\x1b]133;D\x1b\\';

describe('activity-scanner', () => {
  it('passes plain output through and reports no transition', () => {
    const s = createActivityScanner();
    expect(s.push('hello world')).toEqual({ clean: 'hello world' });
  });
  it('reports busy true on C and false on D, stripping the markers', () => {
    const s = createActivityScanner();
    expect(s.push(`before${C}after`)).toEqual({ clean: 'beforeafter', busy: true });
    expect(s.push(`x${D}y`)).toEqual({ clean: 'xy', busy: false });
  });
  it('detects a marker split across two chunks', () => {
    const s = createActivityScanner();
    const a = s.push('out\x1b]133'); // partial marker held back
    expect(a.busy).toBeUndefined();
    expect(a.clean).toBe('out');
    const b = s.push(';C\x1b\\done');
    expect(b).toEqual({ clean: 'done', busy: true });
  });
  it('treats A (prompt) as not busy', () => {
    const s = createActivityScanner();
    expect(s.push('\x1b]133;A\x1b\\$ ')).toEqual({ clean: '$ ', busy: false });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @tickets/api test -- activity-scanner`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/api/src/ai/activity-scanner.ts`:

```ts
// Scans a PTY output stream for OSC 133 shell-integration markers, returning the
// output with the markers removed plus a busy transition when one occurs. A
// small tail is buffered so a marker split across chunk boundaries still matches.
const OSC133 = /\x1b\]133;([A-D])(?:;[^\x1b\x07]*)?(?:\x1b\\|\x07)/g;
// Longest possible partial marker prefix to hold back at a chunk end.
const MAX_PARTIAL = 10;

export function createActivityScanner(): { push(chunk: string): { clean: string; busy?: boolean } } {
  let pending = '';
  return {
    push(chunk) {
      let buf = pending + chunk;
      let busy: boolean | undefined;
      let clean = '';
      let last = 0;
      OSC133.lastIndex = 0;
      for (let m = OSC133.exec(buf); m; m = OSC133.exec(buf)) {
        clean += buf.slice(last, m.index);
        last = OSC133.lastIndex;
        busy = m[1] === 'C'; // C → running; A/D → idle
      }
      let rest = buf.slice(last);
      // Hold back a trailing partial ESC]133… so a split marker isn't emitted.
      const esc = rest.lastIndexOf('\x1b');
      if (esc !== -1 && rest.length - esc <= MAX_PARTIAL && /^\x1b\]?1?3?3?;?[A-D]?$/.test(rest.slice(esc))) {
        pending = rest.slice(esc);
        rest = rest.slice(0, esc);
      } else {
        pending = '';
      }
      clean += rest;
      return busy === undefined ? { clean } : { clean, busy };
    },
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @tickets/api test -- activity-scanner`
Expected: PASS. If the split-chunk test fails on the partial-holdback regex, widen the guard to hold back any trailing `\x1b]` prefix up to `MAX_PARTIAL` chars — the invariant is: never emit a byte that could be the start of a marker until proven otherwise.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ai/activity-scanner.ts apps/api/src/ai/activity-scanner.test.ts
git commit -m "feat(api): OSC 133 activity scanner — strip markers, report busy transitions"
```

---

## Task 3: Supervisor wiring + activity frame + default shell

**Files:**
- Modify: `apps/api/src/ai/types.ts` (ServerFrame `activity`)
- Modify: `apps/api/src/ai/supervisor.ts` (apply integration; scan output; broadcast activity)
- Modify: `apps/api/src/ai/session-command.ts` (win32 default → powershell.exe)
- Test: `apps/api/src/ai/supervisor.test.ts`

**Interfaces:**
- Consumes: `integrationFor` (Task 1), `createActivityScanner` (Task 2).
- Produces: `ServerFrame` union member `{ type: 'activity'; busy: boolean; integrated?: boolean }`.

- [ ] **Step 1: Add the frame type**

In `apps/api/src/ai/types.ts`, add to the `ServerFrame` union:

```ts
  | { type: 'activity'; busy: boolean; integrated?: boolean }
```

- [ ] **Step 2: Write the failing supervisor test**

In `apps/api/src/ai/supervisor.test.ts`, add a test that a terminal started with a recognized shell (a fake runner records the spawn spec; use a `command: 'bash'`-style spec via `integrationFor`) and whose PTY emits a `C` then `D` chunk broadcasts `activity` frames and strips the markers from the output frames:

```ts
it('emits activity frames from OSC 133 markers and strips them from output', async () => {
  const { store } = makeStore();
  const pty = makePty();
  const sup = createSupervisor({ runner: { spawnPty: () => pty.handle }, store, schedule: syncSchedule });
  sup.start({ id: 1, command: 'powershell.exe', cwd: '/w' });
  const { sub, frames } = makeSub();
  await sup.attach(1, sub, 0);
  pty.push('a\x1b]133;Cb');   // command start
  pty.push('\x1b]133;Dc');    // command end
  await tick();
  await sup.flush(1);
  await tick();
  const activity = frames.filter((f) => f.type === 'activity');
  expect(activity.some((f) => f.busy === true)).toBe(true);
  expect(activity.some((f) => f.busy === false)).toBe(true);
  const out = frames.filter((f) => f.type === 'output').map((f) => f.data).join('');
  expect(out).not.toMatch(/133/); // markers stripped
  expect(out).toContain('a');
  expect(out).toContain('c');
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter @tickets/api test -- supervisor`
Expected: FAIL — no activity frames; markers appear in output.

- [ ] **Step 4: Wire the supervisor**

In `apps/api/src/ai/supervisor.ts`, import `integrationFor` and `createActivityScanner`. In `start(spec)`, before spawning, apply the integration:

```ts
    start(spec) {
      const integ = integrationFor(spec.command);
      const spawnSpec = integ ? integ.apply({ id: spec.id, command: spec.command, args: spec.args, env: spec.env }) : null;
      let handle: PtyHandle;
      try {
        handle = runner.spawnPty({
          cwd: spec.cwd,
          command: spawnSpec?.command ?? spec.command,
          args: spawnSpec?.args ?? spec.args ?? [],
          env: spawnSpec?.env ?? spec.env ?? {},
          cols: spec.cols ?? 80,
          rows: spec.rows ?? 24,
        });
      } catch {
        void store.finishSession(spec.id, 'failed', null);
        if (spec.onEnd) void Promise.resolve(spec.onEnd()).catch(() => {});
        return;
      }
      const rs = newSession(spec.id, 'terminal', handle);
      rs.status = 'live';
      rs.onEnd = spec.onEnd;
      rs.scanner = integ?.precise ? createActivityScanner() : null; // add `scanner` to RunningSession
      sessions.set(spec.id, rs);
      void store.setStatus(spec.id, 'live');
      broadcast(rs, { type: 'status', status: 'live' });
      if (integ?.precise) broadcast(rs, { type: 'activity', busy: false, integrated: true });
      consumeTerminal(rs);
    },
```

Add `scanner: ReturnType<typeof createActivityScanner> | null` to the `RunningSession` type and default it `null` in `newSession`.

In `consumeTerminal`, route output through the scanner when present:

```ts
  function consumeTerminal(rs: RunningSession): void {
    const handle = rs.handle as PtyHandle;
    void (async () => {
      try {
        for await (const data of handle.output) {
          let text = data;
          if (rs.scanner) {
            const { clean, busy } = rs.scanner.push(data);
            text = clean;
            if (busy !== undefined) broadcast(rs, { type: 'activity', busy });
          }
          if (text) {
            rs.buffer.push({ seq: ++rs.seq, kind: 'output', data: text });
            scheduleFlush(rs);
          }
        }
        const { exitCode } = await handle.exit;
        await finish(rs, 'exited', exitCode);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        rs.buffer.push({ seq: ++rs.seq, kind: 'output', data: `\r\n[session error] ${message}\r\n` });
        await finish(rs, 'failed', null);
      }
    })();
  }
```

Note: `broadcast` here must handle the `activity` frame — it already forwards arbitrary frames to subscribers; if it special-cases output, ensure `activity` is passed through like `status`.

- [ ] **Step 5: Default Windows shell → powershell**

In `apps/api/src/ai/session-command.ts`, change the win32 default so new terminals get integration by default:

```ts
  if (platform === 'win32') {
    return { command: 'powershell.exe', args: [] };
  }
```

(Was `env.ComSpec ?? 'powershell.exe'` → cmd.exe. Prefer powershell for integration; the profiles subsystem will let users choose.)

- [ ] **Step 6: Run to verify pass**

Run: `pnpm --filter @tickets/api test -- supervisor session-command`
Expected: PASS. Update any existing `session-command` test that asserted the old cmd.exe default.

- [ ] **Step 7: Full api suite + typecheck**

Run: `pnpm --filter @tickets/api test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/ai/types.ts apps/api/src/ai/supervisor.ts apps/api/src/ai/session-command.ts apps/api/src/ai/supervisor.test.ts apps/api/src/ai/session-command.test.ts
git commit -m "feat(api): supervisor applies shell integration + emits activity; default win shell powershell"
```

---

## Task 4: Web — consume the activity frame

**Files:**
- Modify: `apps/web/src/api/types.ts` (ServerFrame `activity`)
- Modify: `apps/web/src/components/ai/use-session-socket.ts`
- Modify: `apps/web/src/components/ai/ai-session-screen.tsx`
- Test: `apps/web/src/components/ai/use-session-socket.test.ts` (if present; else a focused test)

**Interfaces:**
- Consumes: the `activity` frame; `terminalDisplay` (unchanged).
- Produces: `useSessionSocket` exposes `activityBusy: boolean` and `integrated: boolean`.

- [ ] **Step 1: Mirror the frame type**

In `apps/web/src/api/types.ts`, add `{ type: 'activity'; busy: boolean; integrated?: boolean }` to the `ServerFrame` union.

- [ ] **Step 2: Handle the frame in the socket**

In `apps/web/src/components/ai/use-session-socket.ts`, add state `integrated` (default false) and `activityBusy` (default false); in the frame switch add:

```ts
          case 'activity':
            setIntegrated((v) => v || Boolean(frame.integrated));
            setActivityBusy(frame.busy);
            break;
```

Return `integrated` and `activityBusy` from the hook.

- [ ] **Step 3: Use server busy when integrated**

In `apps/web/src/components/ai/ai-session-screen.tsx`, compute busy as: `const busy = socket.integrated ? socket.activityBusy : activity.busy;` (where `activity` is the existing `useTerminalActivity` fallback), and pass `busy` into `terminalDisplay(socket.conn, status, busy)`. Keep pinging `activity.ping()` on output for the fallback path.

- [ ] **Step 4: Test**

Add/extend a socket test: pushing an `activity` frame with `{busy:true, integrated:true}` sets `activityBusy=true`/`integrated=true`; a later `{busy:false}` clears busy. If there's no socket test harness, add a small pure test around the frame-reducer logic, or assert via the screen with a mocked socket.

- [ ] **Step 5: Typecheck + full web suite + build**

Run: `pnpm typecheck && pnpm --filter @tickets/web test && pnpm build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/api/types.ts apps/web/src/components/ai/use-session-socket.ts apps/web/src/components/ai/ai-session-screen.tsx apps/web/src/components/ai/use-session-socket.test.ts
git commit -m "feat(web): use OSC 133 activity for accurate Running/Ready (output pulse fallback)"
```

---

## Task 5: Final verification + manual smoke

**Files:** none.

- [ ] **Step 1: Full checks**

Run: `pnpm typecheck && pnpm --filter @tickets/api test && pnpm --filter @tickets/web test && pnpm --filter @tickets/db test && pnpm build`
Expected: all green.

- [ ] **Step 2: Manual smoke (dev stack, API in a real console)**

With the API run in a real terminal window (ConPTY needs a console on Windows), at http://localhost:4720 start a **PowerShell** terminal and a **bash** terminal (Command = `C:/Program Files/Git/bin/bash.exe`):
- Type without pressing Enter → stays **Ready** (typing no longer flips Running).
- Run a **silent** command (`Start-Sleep 3` / `sleep 3`) → **Running** for the whole duration, then **Ready**.
- Scrollback shows **no** stray marker glyphs.
- A cmd.exe terminal (Command `cmd.exe`) still works and falls back to the output pulse.

- [ ] **Step 3: Commit any fixups**

```bash
git add -A && git commit -m "chore: shell-integration verification fixups" || echo "nothing to commit"
```

---

## Self-Review Notes

- **Spec coverage:** registry+injection → Task 1; marker parse/strip → Task 2; supervisor wiring + frame + default shell → Task 3; client consumption + fallback → Task 4. Command-name/exit-code + list-busy are documented non-goals (profiles follow-on).
- **Type consistency:** `ServerFrame` `activity` member identical in `apps/api/src/ai/types.ts` and `apps/web/src/api/types.ts`; `ShellIntegration.apply` return shape consumed by the supervisor; scanner `{clean,busy?}` consumed by `consumeTerminal`.
- **Risks handled:** injection cleanliness verified by spike (bash `--rcfile`, pwsh `-NoExit -Command`); split-marker buffering has its own test; a spawn failure still degrades to `failed` (Task from the prior feature is untouched); unknown/cmd shells keep the output pulse so nothing regresses.
- **Temp rcfile:** `ti-shellint-<sessionId>.sh` in the OS temp dir; acceptable (not cleaned up here — a follow-up can unlink on session end).
