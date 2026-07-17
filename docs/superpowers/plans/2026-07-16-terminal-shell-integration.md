# Terminal Shell Integration (OSC 133) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Accurate terminal Running/Ready via OSC 133 shell integration — typing stays Ready, silent commands show Running — plus **command text** and **exit code** where the shell provides them. Extensible per-shell registry (PowerShell, Git-bash, WSL Ubuntu), output pulse as fallback.

**Architecture:** On terminal spawn, an extensible registry augments the spawn **args** so the shell emits OSC 133 markers: `C;<command>` at command start, `D;<exit>` at end, `A` at prompt. A pure scanner strips the markers and reports `{busy, command?, exitCode?}` transitions; the supervisor broadcasts an additive `activity` frame; the terminal screen shows **Running: `<command>`** / **Ready** (with success/fail from the exit code) when integrated, else the output pulse.

**Tech Stack:** apps/api (Fastify 5, node-pty behind a Runner seam, the Supervisor), apps/web (React 19, xterm, TanStack Query, vitest), Tailwind v4 Instrument preflight ON.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-16-terminal-shell-integration-design.md` (+ its 2026-07-17 probe addendum).
- One commit per task; conventional commits scoped by app.
- **Probed capabilities (verified against real PTYs) — target these three as precise:**
  - **PowerShell** (`pwsh`/`powershell`): `C;<command>` (from the PSReadLine buffer) + `D;<$LASTEXITCODE>` + `A`. Richest. Inject via `-NoExit -Command`.
  - **Git-bash** (`bash`/`sh`): `C` (PS0) + `D;<$?>` (PROMPT_COMMAND) + real exit codes. Inject via a temp `--rcfile`. Command text skipped (noisy via DEBUG trap).
  - **WSL** (`wsl`): identical to bash inside; inject via a Windows-temp rcfile referenced by its `/mnt/<drive>/…` path — **verified** (`(exit 5)`→`D[5]`, silent `sleep` bracketed).
  - **cmd / unknown**: NOT precise → client output-pulse fallback (unchanged).
- OSC 133 bytes: `C`=`ESC]133;C[;<cmd>] ESC\` → busy true (+command); `D`=`ESC]133;D[;<exit>] ESC\` → busy false (+exitCode); `A`=`ESC]133;A ESC\` → busy false. ST = `ESC \`.
- Markers **stripped server-side** before persist/broadcast (no glyphs in scrollback). Injection is **args/env only** (never write setup into the PTY — it echoes).
- The `activity` frame carries `{ busy, command?, exitCode?, integrated? }`; `command`/`exitCode` are optional (absent where the shell doesn't provide them).
- No new DB column, no list change (list stays lifecycle-only). node-pty on Windows needs full exe paths (no bare PATH shims).
- Existing suites stay green (api 141 · web 142 · db 18); typecheck + build green. API tests need Docker Postgres `tickets-postgres-1` @ 127.0.0.1:5532.

## File Structure

**API**
- `apps/api/src/ai/shell-integration.ts` (+ test) — registry (`pwsh`, `bash`, `wsl`), `integrationFor`.
- `apps/api/src/ai/activity-scanner.ts` (+ test) — strip markers, parse `{busy, command?, exitCode?}`.
- `apps/api/src/ai/types.ts` — `ServerFrame` `activity` member; `RunningSession.scanner`.
- `apps/api/src/ai/supervisor.ts` — apply integration on terminal start; run scanner in `consumeTerminal`; broadcast `activity`.
- `apps/api/src/ai/session-command.ts` — Windows default shell → `powershell.exe`.

**Web**
- `apps/web/src/api/types.ts` — mirror the `activity` frame.
- `apps/web/src/components/ai/use-session-socket.ts` — handle `activity` → `{busy, command, exitCode, integrated}`.
- `apps/web/src/components/ai/terminal-display.ts` — accept `command` → "Running: `<cmd>`".
- `apps/web/src/components/ai/ai-session-screen.tsx` — use server activity when integrated, else the pulse.

---

## Task 1: Shell-integration registry (pwsh + bash + wsl, with command/exit)

**Files:**
- Create/replace: `apps/api/src/ai/shell-integration.ts`
- Test: `apps/api/src/ai/shell-integration.test.ts`

**Interfaces:**
- Produces: `interface ShellIntegration { id: string; precise: boolean; matches(command: string): boolean; apply(spec: IntegrationSpec): { command: string; args: string[]; env: Record<string,string> } }`; `interface IntegrationSpec { id: number; command: string; args?: string[]; env?: Record<string,string> }`; `integrationFor(command: string): ShellIntegration | null`; `toMntPath(winPath: string): string` (exported for the test).

> Note: this replaces the Task-1 registry already committed (`41387f0`, bash+pwsh, busy-only) with the enriched three-shell version (command text + exit code + WSL). Overwrite the file.

- [ ] **Step 1: Write the failing test**

Create/replace `apps/api/src/ai/shell-integration.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { integrationFor, toMntPath } from './shell-integration';

describe('toMntPath', () => {
  it('converts a Windows temp path to a WSL /mnt path', () => {
    expect(toMntPath('C:\\Users\\me\\AppData\\Local\\Temp\\x.sh')).toBe('/mnt/c/Users/me/AppData/Local/Temp/x.sh');
    expect(toMntPath('D:/tmp/y.sh')).toBe('/mnt/d/tmp/y.sh');
  });
});

describe('integrationFor', () => {
  it('matches by basename (path, .exe, case)', () => {
    expect(integrationFor('C:/Program Files/Git/bin/bash.exe')?.id).toBe('bash');
    expect(integrationFor('/usr/bin/bash')?.id).toBe('bash');
    expect(integrationFor('powershell.exe')?.id).toBe('pwsh');
    expect(integrationFor('C:/Program Files/PowerShell/7/pwsh.exe')?.id).toBe('pwsh');
    expect(integrationFor('C:/Windows/System32/wsl.exe')?.id).toBe('wsl');
  });
  it('returns null for cmd and unknown (output-pulse fallback)', () => {
    expect(integrationFor('cmd.exe')).toBeNull();
    expect(integrationFor('zsh')).toBeNull();
  });
  it('all three integrations are precise', () => {
    for (const c of ['bash', 'pwsh', 'wsl.exe']) expect(integrationFor(c)!.precise).toBe(true);
  });
  it('pwsh.apply emits C with the command buffer and D with $LASTEXITCODE', () => {
    const out = integrationFor('pwsh')!.apply({ id: 1, command: 'pwsh' });
    const cmdArg = out.args[out.args.indexOf('-Command') + 1]!;
    expect(out.args).toContain('-NoExit');
    expect(cmdArg).toMatch(/133;C/);
    expect(cmdArg).toMatch(/GetBufferState/);          // captures the command text
    expect(cmdArg).toMatch(/LASTEXITCODE/);            // exit code on D
  });
  it('bash.apply injects a --rcfile and emits D with $?', () => {
    const out = integrationFor('/usr/bin/bash')!.apply({ id: 2, command: '/usr/bin/bash' });
    expect(out.args).toEqual(['--rcfile', expect.stringContaining('ti-shellint-2'), '-i']);
  });
  it('wsl.apply runs bash with the rcfile via its /mnt path, keeping any distro args', () => {
    const out = integrationFor('wsl.exe')!.apply({ id: 3, command: 'wsl.exe', args: ['-d', 'Ubuntu'] });
    expect(out.command).toBe('wsl.exe');
    expect(out.args.slice(0, 2)).toEqual(['-d', 'Ubuntu']);
    expect(out.args).toEqual(expect.arrayContaining(['--', 'bash', '--rcfile', '-i']));
    const rc = out.args[out.args.indexOf('--rcfile') + 1]!;
    expect(rc.startsWith('/mnt/')).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @tickets/api test -- shell-integration`
Expected: FAIL (`toMntPath`/wsl not present).

- [ ] **Step 3: Implement**

Replace `apps/api/src/ai/shell-integration.ts`:

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

// Windows path -> WSL mount path: C:\a\b -> /mnt/c/a/b
export function toMntPath(winPath: string): string {
  const m = /^([A-Za-z]):[\\/](.*)$/.exec(winPath);
  if (!m) return winPath.replace(/\\/g, '/');
  return `/mnt/${m[1]!.toLowerCase()}/${m[2]!.replace(/\\/g, '/')}`;
}

// Shared bash rcfile: source ~/.bashrc, then PS0 emits C, PROMPT_COMMAND emits
// D with the exit code ($? captured first). Verified: no echo, real exit codes.
function writeBashRc(id: number): string {
  const rc = join(tmpdir(), `ti-shellint-${id}.sh`);
  writeFileSync(
    rc,
    `[ -f ~/.bashrc ] && . ~/.bashrc\n` +
      `PS0=$'${ESC}]133;C${ESC}\\\\'\n` +
      `PROMPT_COMMAND='__ec=$?; printf "${ESC}]133;D;%s${ESC}\\\\" "$__ec";'"\${PROMPT_COMMAND:-}"\n`,
  );
  return rc;
}

const bash: ShellIntegration = {
  id: 'bash',
  precise: true,
  matches: (c) => ['bash', 'sh'].includes(basename(c)),
  apply: (spec) => ({ command: spec.command, args: ['--rcfile', writeBashRc(spec.id), '-i'], env: spec.env ?? {} }),
};

// WSL: same bash rcfile, referenced by its /mnt path; keep any distro args
// (e.g. -d Ubuntu) the caller passed, then `-- bash --rcfile <mnt> -i`.
const wsl: ShellIntegration = {
  id: 'wsl',
  precise: true,
  matches: (c) => basename(c) === 'wsl',
  apply: (spec) => ({
    command: spec.command,
    args: [...(spec.args ?? []), '--', 'bash', '--rcfile', toMntPath(writeBashRc(spec.id)), '-i'],
    env: spec.env ?? {},
  }),
};

// pwsh: prompt emits D;<$LASTEXITCODE> + A; the Enter handler emits C with the
// typed command (from the PSReadLine buffer). Injected via -NoExit -Command.
const PWSH_INIT =
  `function prompt { $e=[char]27; $ec=if($LASTEXITCODE -ne $null){$LASTEXITCODE}elseif($?){0}else{1}; ` +
  `"$e]133;D;$ec$e\\$e]133;A$e\\PS $($executionContext.SessionState.Path.CurrentLocation)> " }; ` +
  `Set-PSReadLineKeyHandler -Chord Enter -ScriptBlock { ` +
  `$c=$null;[Microsoft.PowerShell.PSConsoleReadLine]::GetBufferState([ref]$c,[ref]$null); ` +
  `[Console]::Write([char]27+']133;C;'+$c+[char]27+'\\'); ` +
  `[Microsoft.PowerShell.PSConsoleReadLine]::AcceptLine() }`;

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

// Extensible: add zsh (ZDOTDIR), cmd (coarse /K prompt), more distros, … here.
const REGISTRY: ShellIntegration[] = [pwsh, bash, wsl];

export function integrationFor(command: string): ShellIntegration | null {
  return REGISTRY.find((i) => i.matches(command)) ?? null;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @tickets/api test -- shell-integration`
Expected: PASS. Then `pnpm typecheck`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ai/shell-integration.ts apps/api/src/ai/shell-integration.test.ts
git commit -m "feat(api): shell-integration for pwsh/bash/wsl with command text + exit code"
```

---

## Task 2: Activity scanner (busy + command + exitCode)

**Files:**
- Create: `apps/api/src/ai/activity-scanner.ts`
- Test: `apps/api/src/ai/activity-scanner.test.ts`

**Interfaces:**
- Produces: `createActivityScanner(): { push(chunk: string): { clean: string; event?: { busy: boolean; command?: string; exitCode?: number } } }`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/ai/activity-scanner.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createActivityScanner } from './activity-scanner';

const C = (cmd = '') => `\x1b]133;C${cmd ? `;${cmd}` : ''}\x1b\\`;
const D = (code = '') => `\x1b]133;D${code !== '' ? `;${code}` : ''}\x1b\\`;

describe('activity-scanner', () => {
  it('passes plain output through untouched', () => {
    expect(createActivityScanner().push('hello')).toEqual({ clean: 'hello' });
  });
  it('C → busy true (+command), D → busy false (+exitCode), markers stripped', () => {
    const s = createActivityScanner();
    expect(s.push(`x${C('npm test')}y`)).toEqual({ clean: 'xy', event: { busy: true, command: 'npm test' } });
    expect(s.push(`a${D('1')}b`)).toEqual({ clean: 'ab', event: { busy: false, exitCode: 1 } });
  });
  it('bare C/D carry no command/exit', () => {
    const s = createActivityScanner();
    expect(s.push(C())).toEqual({ clean: '', event: { busy: true } });
    expect(s.push(D())).toEqual({ clean: '', event: { busy: false } });
  });
  it('A (prompt) → busy false', () => {
    expect(createActivityScanner().push('\x1b]133;A\x1b\\$ ')).toEqual({ clean: '$ ', event: { busy: false } });
  });
  it('detects a marker split across chunks', () => {
    const s = createActivityScanner();
    expect(s.push('out\x1b]133;C;np').clean).toBe('out'); // held back
    expect(s.push('m\x1b\\done')).toEqual({ clean: 'done', event: { busy: true, command: 'npm' } });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @tickets/api test -- activity-scanner` → FAIL (module not found).

- [ ] **Step 3: Implement**

Create `apps/api/src/ai/activity-scanner.ts`:

```ts
export interface ActivityEvent {
  busy: boolean;
  command?: string;
  exitCode?: number;
}

// Full OSC 133 marker: ESC ] 133 ; <A-D> [ ; <params> ] (ESC\ | BEL).
const OSC133 = /\x1b\]133;([A-D])(?:;([^\x1b\x07]*))?(?:\x1b\\|\x07)/g;

export function createActivityScanner(): {
  push(chunk: string): { clean: string; event?: ActivityEvent };
} {
  let pending = '';
  return {
    push(chunk) {
      const buf = pending + chunk;
      let clean = '';
      let last = 0;
      let event: ActivityEvent | undefined;
      OSC133.lastIndex = 0;
      for (let m = OSC133.exec(buf); m; m = OSC133.exec(buf)) {
        clean += buf.slice(last, m.index);
        last = OSC133.lastIndex;
        const kind = m[1]!;
        const param = m[2];
        if (kind === 'C') event = { busy: true, ...(param ? { command: param } : {}) };
        else event = { busy: false, ...(kind === 'D' && param ? { exitCode: Number(param) } : {}) };
      }
      let rest = buf.slice(last);
      // Hold back a trailing partial "ESC]133…" so a split marker isn't emitted.
      const esc = rest.lastIndexOf('\x1b');
      if (esc !== -1 && '\x1b]133;'.startsWith(rest.slice(esc, esc + Math.min(6, rest.length - esc))) === false) {
        // not a marker prefix — keep as-is
      }
      if (esc !== -1 && rest.slice(esc).length < 64 && /^\x1b(\](1(3(3(;[A-D]?[^\x1b]*)?)?)?)?)?$/.test(rest.slice(esc))) {
        pending = rest.slice(esc);
        rest = rest.slice(0, esc);
      } else {
        pending = '';
      }
      clean += rest;
      return event ? { clean, event } : { clean };
    },
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @tickets/api test -- activity-scanner`
Expected: PASS. If the split-marker holdback regex misbehaves, simplify the invariant to: hold back everything from the last `\x1b` to end whenever that tail is a strict prefix of a `\x1b]133;<X>…` marker and shorter than 64 chars; never emit bytes that could still be part of a marker.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ai/activity-scanner.ts apps/api/src/ai/activity-scanner.test.ts
git commit -m "feat(api): OSC 133 activity scanner — busy + command + exit code, marker-stripping"
```

---

## Task 3: Supervisor wiring + activity frame + default shell

**Files:**
- Modify: `apps/api/src/ai/types.ts` (ServerFrame `activity`; `RunningSession.scanner`)
- Modify: `apps/api/src/ai/supervisor.ts`
- Modify: `apps/api/src/ai/session-command.ts` (win32 default → powershell.exe)
- Test: `apps/api/src/ai/supervisor.test.ts`, `apps/api/src/ai/session-command.test.ts`

**Interfaces:**
- Consumes: `integrationFor` (Task 1), `createActivityScanner`/`ActivityEvent` (Task 2).
- Produces: `ServerFrame` member `{ type: 'activity'; busy: boolean; command?: string; exitCode?: number; integrated?: boolean }`.

- [ ] **Step 1: Add the frame + scanner field**

In `apps/api/src/ai/types.ts`: add to `ServerFrame`:

```ts
  | { type: 'activity'; busy: boolean; command?: string; exitCode?: number; integrated?: boolean }
```

Add `scanner?: ReturnType<typeof import('./activity-scanner').createActivityScanner> | null` to `RunningSession` (or type it via an import of `createActivityScanner`).

- [ ] **Step 2: Write the failing supervisor test**

In `apps/api/src/ai/supervisor.test.ts`, add:

```ts
it('emits activity (busy+command+exit) from OSC 133 and strips markers', async () => {
  const { store } = makeStore();
  const pty = makePty();
  const sup = createSupervisor({ runner: { spawnPty: () => pty.handle }, store, schedule: syncSchedule });
  sup.start({ id: 1, command: 'powershell.exe', cwd: '/w' });
  const { sub, frames } = makeSub();
  await sup.attach(1, sub, 0);
  pty.push('o\x1b]133;C;npm test\x1b\\');
  pty.push('\x1b]133;D;2\x1b\\p');
  await tick();
  await sup.flush(1);
  await tick();
  const acts = frames.filter((f) => f.type === 'activity');
  expect(acts).toEqual(expect.arrayContaining([
    expect.objectContaining({ busy: true, command: 'npm test' }),
    expect.objectContaining({ busy: false, exitCode: 2 }),
  ]));
  const out = frames.filter((f) => f.type === 'output').map((f) => f.data).join('');
  expect(out).not.toMatch(/133/);
  expect(out).toContain('o');
  expect(out).toContain('p');
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter @tickets/api test -- supervisor` → FAIL.

- [ ] **Step 4: Wire the supervisor**

In `apps/api/src/ai/supervisor.ts` import `integrationFor` and `createActivityScanner`. In `start(spec)`, apply the integration and attach a scanner (keep the existing spawn-failure try/catch from the prior feature):

```ts
    start(spec) {
      const integ = integrationFor(spec.command);
      const sp = integ ? integ.apply({ id: spec.id, command: spec.command, args: spec.args, env: spec.env }) : null;
      let handle: PtyHandle;
      try {
        handle = runner.spawnPty({
          cwd: spec.cwd,
          command: sp?.command ?? spec.command,
          args: sp?.args ?? spec.args ?? [],
          env: sp?.env ?? spec.env ?? {},
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
      rs.scanner = integ?.precise ? createActivityScanner() : null;
      sessions.set(spec.id, rs);
      void store.setStatus(spec.id, 'live');
      broadcast(rs, { type: 'status', status: 'live' });
      if (integ?.precise) broadcast(rs, { type: 'activity', busy: false, integrated: true });
      consumeTerminal(rs);
    },
```

Add `scanner` to `newSession` (default `null`). In `consumeTerminal`, route output through the scanner:

```ts
        for await (const data of handle.output) {
          let text = data;
          if (rs.scanner) {
            const { clean, event } = rs.scanner.push(data);
            text = clean;
            if (event) broadcast(rs, { type: 'activity', ...event });
          }
          if (text) {
            rs.buffer.push({ seq: ++rs.seq, kind: 'output', data: text });
            scheduleFlush(rs);
          }
        }
```

Ensure `broadcast` forwards an `activity` frame to subscribers like `status` (it should already forward arbitrary non-output frames; verify).

- [ ] **Step 5: Default Windows shell → powershell**

In `apps/api/src/ai/session-command.ts`, win32 branch → `return { command: 'powershell.exe', args: [] };` (was cmd.exe). Update the matching `session-command.test.ts` expectation.

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm --filter @tickets/api test -- supervisor session-command && pnpm --filter @tickets/api test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/ai/types.ts apps/api/src/ai/supervisor.ts apps/api/src/ai/session-command.ts apps/api/src/ai/supervisor.test.ts apps/api/src/ai/session-command.test.ts
git commit -m "feat(api): supervisor emits activity (busy/command/exit); default win shell powershell"
```

---

## Task 4: Web — consume activity, show Running: <command>

**Files:**
- Modify: `apps/web/src/api/types.ts` (ServerFrame `activity`)
- Modify: `apps/web/src/components/ai/use-session-socket.ts`
- Modify: `apps/web/src/components/ai/terminal-display.ts`
- Modify: `apps/web/src/components/ai/ai-session-screen.tsx`
- Test: `apps/web/src/components/ai/terminal-display.test.ts` (extend)

**Interfaces:**
- Consumes: the `activity` frame.
- Produces: `useSessionSocket` exposes `activity: { busy: boolean; command?: string; exitCode?: number } | null` and `integrated: boolean`; `terminalDisplay(conn, status, busy, command?)` returns the label incl. `Running: <command>`.

- [ ] **Step 1: Mirror the frame**

In `apps/web/src/api/types.ts`, add `{ type: 'activity'; busy: boolean; command?: string; exitCode?: number; integrated?: boolean }` to `ServerFrame`.

- [ ] **Step 2: Extend terminal-display (failing test first)**

Add to `apps/web/src/components/ai/terminal-display.test.ts`:

```ts
it('shows the running command when provided', () => {
  expect(terminalDisplay('live', 'live', true, 'npm test')).toMatchObject({ label: 'Running: npm test' });
});
it('falls back to plain Running with no command', () => {
  expect(terminalDisplay('live', 'live', true)).toMatchObject({ label: 'Running' });
});
```

Update `terminalDisplay` in `apps/web/src/components/ai/terminal-display.ts` to accept an optional `command` and, in the `live + busy` branch, return `label: command ? \`Running: ${command}\` : 'Running'` (truncate very long commands to ~40 chars). Signature: `terminalDisplay(conn, status, busy, command?)`.

- [ ] **Step 3: Handle the frame in the socket**

In `apps/web/src/components/ai/use-session-socket.ts`, add `integrated` + `activity` state; in the frame switch:

```ts
          case 'activity':
            setIntegrated((v) => v || Boolean(frame.integrated));
            setActivity({ busy: frame.busy, command: frame.command, exitCode: frame.exitCode });
            break;
```

Return `integrated` and `activity` from the hook.

- [ ] **Step 4: Use server activity when integrated**

In `apps/web/src/components/ai/ai-session-screen.tsx`: `const busy = socket.integrated ? (socket.activity?.busy ?? false) : fallback.busy;` and `const cmd = socket.integrated ? socket.activity?.command : undefined;`, then `terminalDisplay(socket.conn, status, busy, cmd)`. Keep `useTerminalActivity` (`fallback`) pinging on output for the non-integrated path.

- [ ] **Step 5: Typecheck + full web suite + build**

Run: `pnpm typecheck && pnpm --filter @tickets/web test && pnpm build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/api/types.ts apps/web/src/components/ai/use-session-socket.ts apps/web/src/components/ai/terminal-display.ts apps/web/src/components/ai/terminal-display.test.ts apps/web/src/components/ai/ai-session-screen.tsx
git commit -m "feat(web): accurate Running/Ready with command name via OSC 133 activity"
```

---

## Task 5: Final verification + manual smoke

- [ ] **Step 1: Full checks**

Run: `pnpm typecheck && pnpm --filter @tickets/api test && pnpm --filter @tickets/web test && pnpm --filter @tickets/db test && pnpm build`
Expected: all green.

- [ ] **Step 2: Manual smoke (API in a real console)**

At http://localhost:4720, start **PowerShell**, **git-bash** (`C:/Program Files/Git/bin/bash.exe`), and **WSL** (`wsl.exe` args `-d Ubuntu`) terminals:
- Type without Enter → **Ready**; run a silent `Start-Sleep 3` / `sleep 3` → **Running** throughout.
- PowerShell shows **Running: `<command>`**; bash/wsl show **Running** and reflect exit codes.
- No stray marker glyphs in scrollback. cmd.exe still works via the pulse fallback.

- [ ] **Step 3: Commit any fixups**

```bash
git add -A && git commit -m "chore: shell-integration verification fixups" || echo "nothing to commit"
```

---

## Self-Review Notes

- **Probe-driven:** three precise shells (pwsh/bash/wsl) per the verified capabilities; command text (pwsh) + exit code (all three) carried in the frame; cmd/unknown → pulse.
- **Type consistency:** `activity` frame identical in api/web `types.ts`; scanner `{clean, event?}` consumed by `consumeTerminal`; `ActivityEvent` fields flow into the frame and out to `terminalDisplay(command)`.
- **Supersedes** the committed busy-only Task 1 (`41387f0`) — Task 1 here overwrites `shell-integration.ts` with the enriched version.
- **Risks:** injection cleanliness + WSL `/mnt` rcfile + command/exit extraction all verified by spikes; split-marker buffering has its own test; spawn-failure→`failed` (prior feature) preserved in the new `start()`.
- **Temp rcfiles** `ti-shellint-<id>.sh` are not unlinked here (follow-up).
