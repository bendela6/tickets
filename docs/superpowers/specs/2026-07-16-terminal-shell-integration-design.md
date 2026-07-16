# Terminal shell integration — accurate Running/Ready (+ extensible)

**Date:** 2026-07-16
**Branch:** `worktree-ai-sessions`
**Status:** design (approved for implementation)

Follow-on to the terminal status model. The shipped Running/Ready signal is an **output
pulse** (busy = recent output), which has two blind spots the user hit:

- **Typing** echoes characters → false "Running" (you're idle at the prompt).
- A **silent long-running command** produces no output → false "Ready" (it's running).

Fix: **OSC 133 shell integration** — the shell emits markers at command start/end so we know
the real state. Built as an **extensible registry** so shells (bash/zsh/pwsh/cmd/WSL/…) plug
in, per the user's "all + extendable".

## Verified feasibility (throwaway spikes, real PTY on Windows)

- **bash** (`--norc -i`): `PS0=$'\e]133;C\e\\'` emits **C** before each command; `PROMPT_COMMAND`
  printing `\e]133;D\e\\` emits **D** at each prompt. A silent `sleep 2` was bracketed
  **C→D, 2034ms**.
- **pwsh** (`-NoLogo -NoProfile`): a `prompt` function emitting `\e]133;D\e\\ \e]133;A\e\\`,
  plus a `Set-PSReadLineKeyHandler -Chord Enter` that writes **C** before `AcceptLine()`. A
  silent `Start-Sleep 2` was bracketed **C→D, 2079ms**.
- **cmd.exe**: `PROMPT $e]133;A$P$G` (Win10+ `$e`) emits a prompt marker only — no clean
  command-start hook, so cmd is *coarse* (prompt-boundary + input-Enter heuristic).
- **Unknown shell**: no integration → fall back to the existing output pulse.

Because **C fires on Enter** (submission), typing (pre-Enter) never flags Running, and a
silent command does. Both blind spots resolved.

## OSC 133 codes we use

| code | meaning | drives |
|---|---|---|
| `ESC ] 133 ; C ST` | command started (pre-exec) | busy = **true** |
| `ESC ] 133 ; D [; exit] ST` | command finished | busy = **false** |
| `ESC ] 133 ; A ST` | prompt (fallback idle marker for coarse shells) | busy = **false** |

`ST` = `ESC \`. These are non-printing OSC sequences; xterm ignores unknown OSC, but we
**strip** them server-side so scrollback stays pristine.

## Architecture

### 1. Extensible registry — `apps/api/src/ai/shell-integration.ts`

```ts
export interface ShellIntegration {
  id: string;                                  // 'bash' | 'pwsh' | 'cmd' | …
  matches(command: string): boolean;           // by executable basename, case-insensitive
  apply(spec: PtySpec): PtySpec;               // augment args/env so the shell emits markers
  precise: boolean;                            // true = emits C/D; false = prompt-only (coarse)
}
export function integrationFor(command: string): ShellIntegration | null;
```

Injection is **via spawn args/env only** (no post-spawn writes → nothing echoes into the
terminal):

- **bash/zsh/sh**: write a temp init file that `source`s the user's rc then sets `PS0` +
  `PROMPT_COMMAND`; spawn with `--rcfile <file>` (bash) / `ZDOTDIR` (zsh). `precise: true`.
- **pwsh/powershell**: spawn with `-NoExit -Command "<init>"` defining the prompt function +
  the Enter key handler. `precise: true`.
- **cmd**: spawn with `/K "prompt $e]133;A$P$G"`. `precise: false`.
- Registry is an array; adding a shell = one entry. `integrationFor` returns the first match
  or `null`.

**Task 1 verifies each injection is clean** (no visible marker text, silent command → C/D)
before the rest is wired — the spikes proved the markers; the plan proves the *args-based*
injection specifically.

### 2. Activity scanner (pure) — `apps/api/src/ai/activity-scanner.ts`

```ts
export function createActivityScanner(): {
  // Feed each raw PTY chunk; get back the chunk with OSC-133 stripped, and a
  // busy transition when one occurred (undefined = no change).
  push(chunk: string): { clean: string; busy?: boolean };
};
```

Buffers a small tail so a marker split across chunk boundaries is still matched. `C` →
`busy:true`; `D`/`A` → `busy:false`. Strips the matched sequences from `clean`.

### 3. Supervisor — `apps/api/src/ai/supervisor.ts`

- On terminal `start()`: `const integ = integrationFor(spec.command)`; if present, `spec =
  integ.apply(spec)` and remember `integrated = true`.
- In `consumeTerminal`: run each output chunk through the scanner; **persist/broadcast the
  cleaned output** (not the raw markers); on a `busy` transition, broadcast a new
  `activity` frame.
- On start, if `integrated`, broadcast one `{ type:'activity', busy:false, integrated:true }`
  so the client knows accurate signal is available and disables its output-pulse fallback.
- No integration → no scanner, no activity frames → client keeps the output pulse.

### 4. Frame — additive

`ServerFrame` gains `{ type: 'activity'; busy: boolean; integrated?: boolean }`. Existing
clients ignore unknown frames; no other frame changes.

### 5. Web

- `use-session-socket.ts`: handle the `activity` frame → expose `{ busy, integrated }`.
- `ai-session-screen.tsx` (terminal): when `integrated`, feed `terminalDisplay(...)` the
  server `busy`; otherwise fall back to `useTerminalActivity` (output pulse). `terminalDisplay`
  is unchanged (it already takes a `busy` boolean).

## Testing

- **activity-scanner** (pure): C→busy true; D/A→busy false; marker split across two chunks
  still detected; markers stripped from `clean`; plain output passes through untouched.
- **shell-integration** (pure): `matches()` per shell by basename; `apply()` yields the
  expected args/env (e.g. bash args include `--rcfile`, pwsh args include `-NoExit`/`-Command`
  with the marker setup, cmd args include the `prompt` `/K`); `integrationFor` precedence +
  null for unknown.
- **api**: a terminal started with a fake runner recording the spawn spec is augmented for a
  known shell; the supervisor emits an `activity` frame when the scanner reports a transition
  (drive a fake PTY that outputs a `C` then `D`), and the broadcast/persisted output has the
  markers stripped.
- **web**: `activity` frame → socket `{busy,integrated}`; terminal screen uses server busy
  when integrated (else the pulse).
- **Manual smoke**: PowerShell + bash terminals — type (stays **Ready**), run a silent
  `Start-Sleep 3` / `sleep 3` (shows **Running** the whole time), no stray marker glyphs in
  scrollback.
- Full suites green; typecheck + build green.

## Scope / non-goals

- **In:** accurate Running/Ready on the OPEN terminal for bash/pwsh (precise) + cmd (coarse)
  + output-pulse fallback; extensible registry; server-side marker stripping.
- **Out (later, with profiles):** showing the running **command name / exit code** in the
  pill; persisting busy so the session **list** shows Running (this spec keeps the list
  lifecycle-only — no new column); WSL/zsh entries can be added to the registry when needed
  (the seam is here). No change to the agent path or dispatch.
