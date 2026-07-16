# Terminal session status model + archive

**Date:** 2026-07-16
**Branch:** `worktree-ai-sessions`
**Status:** design (approved for implementation)

A focused fix on top of AI Sessions v2. Terminal sessions inherit the agent turn
lifecycle (`starting`/`running`/`idle`) which is wrong for a PTY: a shell sitting at a
prompt is not "running", and after an API restart orphaned rows show `running`/`starting`
forever because the in-memory supervisor is empty but the DB is never reconciled.

## Problems

1. **Perpetual "running".** Terminal `start()` sets status `running` and it never changes
   until the PTY exits. A shell at a prompt is mislabeled.
2. **Stale ghosts.** On API restart the supervisor's session map is empty, but DB rows keep
   their live status — they read as `running`/`starting` indefinitely.
3. **No archive.** Dead sessions pile up as `exited`; there is no way to hide them.

## Decisions (locked)

- **Activity detail:** *Live + activity pulse*, upgraded to **foreground-process
  detection** (see below) after the follow-up ask "indicator if some process is running
  inside the terminal". The server reads the PTY's foreground process (node-pty's
  `IPty.process`) so we can honestly say **Ready** (at the shell prompt) vs **Running:
  `<name>`** (a program is in the foreground) — in the list *and* the open terminal — with
  an output-based pulse layered on for "actively producing output right now".
- **Archive rules:** *Archive ends it first.* Archiving a live session ends the PTY, then
  hides it; archived sessions leave the list behind a "Show archived" toggle; unarchive
  restores.

### Foreground-process detection

node-pty exposes `IPty.process` — the title of the tty's active foreground process. At a
shell prompt it reads as the shell (`bash`/`zsh`/`pwsh`/`cmd`); while a command runs it
reads as that program (`npm`, `vim`, `node`, `claude`, …). We poll it per live terminal
(~1s) and derive:

- **idle / "Ready"** — foreground process is the shell (or matches the session's launch
  command's shell) and no output in the last ~1s.
- **running / "Running: `<name>`"** — foreground process differs from the shell; surface the
  name. An **output pulse** (output within ~1s) renders a subtle active dot on top, so a
  long-lived TUI like `claude` reads as `claude` steady when waiting and `claude ●` while it
  streams.

**Caveats (honest limits):**
- `IPty.process` is reliable on Linux (the deploy target / container). On Windows dev
  (ConPTY) it is best-effort and may not always track children; the output pulse is the
  fallback there.
- For an interactive tool like Claude Code running *as a raw terminal*, we can show it's the
  foreground program and pulse on output, but we cannot read its internal idle-vs-thinking
  state — that precision is exactly what an **agent** session gives you. Noted, not solved.

## Status model

Add two enum values to `session_status`: **`live`**, **`disconnected`**. Agents keep
`running`/`idle`/`awaiting_input`/`interrupted` (correct for turns). `starting`, `exited`,
`failed`, plus the two new values, are shared.

**Terminal lifecycle (server, persisted):**

| status | meaning | pill (terminal) |
|---|---|---|
| `starting` | row created, PTY not yet spawned | "Connecting" |
| `live` | PTY alive and tracked by the supervisor | "Live" |
| `exited` | PTY exited cleanly (exit code kept) | "Exited N" |
| `disconnected` | supervisor lost the PTY (API restart / orphan) | "Disconnected" |
| `failed` | spawn/crash before or during life | "Couldn't start" |

**Terminal screen display (client)** combines the persisted status with live socket signal:

- socket `conn === 'connecting'` → "Connecting"; `'reconnecting'` → "Reconnecting".
- status `live` + foreground process ≠ shell → **"Running: `<name>`"** (+ pulse dot when
  output is flowing); at the prompt → **"Ready"**.
- otherwise the persisted-status label above.

**The list rows have no socket**, but the server persists the current foreground program
(see below), so a row can still show **Running: `<name>`** vs **Ready** (refreshed on the 4s
list poll — slight lag is acceptable) alongside the lifecycle label.

Agent pill mapping is unchanged.

## Startup reconciliation

On API boot, before serving, flip every orphaned session to `disconnected`:

```
UPDATE ai_sessions
   SET status = 'disconnected', ended_at = now(), updated_at = now()
 WHERE ended_at IS NULL
   AND status IN ('starting','running','live','idle','awaiting_input','interrupted');
```

Exposed as `store.reconcileOrphaned()` and called once where the app wires the supervisor
(app.ts). Any session the supervisor genuinely still owns doesn't exist yet at boot (the map
is built as sessions start), so this is safe: nothing live is running at process start.

## Foreground-process plumbing

- **`PtyHandle`** (`apps/api/src/ai/types.ts`) gains `process(): string` — the local runner
  returns node-pty's `proc.process`; fakes in tests return a stub they can drive.
- **Supervisor:** per live terminal, a ~1s poll reads `handle.process()` and tracks
  `{ foreground: string | null, busy: boolean }` on the `RunningSession` (foreground = the
  program name when it differs from the session's shell, else null; busy = output within the
  window). On a **change**, it (a) broadcasts a new `activity` frame and (b) persists the
  foreground via `store.setForeground(id, name | null)` — writes happen only on transitions,
  not every poll. The poll is cleared in `finish()`.
- **New `ServerFrame`:** `{ type: 'activity'; foreground: string | null; busy: boolean }`.
  Purely additive to the frame union; existing clients ignore unknown frames.
- The shell base name comes from the session's launch command (or the workspace default
  shell); comparison is on the process basename, case-insensitively.

## Archive

Mirror the existing workspace/agent pattern.

- **DB:** add nullable `archived_at` timestamp AND nullable `foreground_process` text to
  `ai_sessions`.
- **Store:** `setArchived(sessionId, archived: boolean)` (sets/clears `archived_at`);
  `setForeground(sessionId, name: string | null)` (sets `foreground_process`);
  `reconcileOrphaned()` (the startup UPDATE above, and clears `foreground_process`).
- **Routes:**
  - `GET /api/ai/sessions` — exclude `archived_at IS NOT NULL` unless `?archived=true`.
  - `POST /api/ai/sessions/:id/archive` — if `supervisor.has(id)`, `supervisor.stop(id)`
    (its exit handler finalizes the row); if not live and not ended, finalize to
    `disconnected`; then set `archived_at`. Returns the row.
  - `POST /api/ai/sessions/:id/unarchive` — clear `archived_at`.

## Supervisor change

Terminal `start()` persists **`live`** instead of `running` and broadcasts
`{ type: 'status', status: 'live' }`. Add `store` support: reuse `setStatus(id, 'live')`
(drop the terminal-specific `markRunning` call). Agent `startAgent()` is unchanged.

## Web

- **Types:** `SessionStatus` gains `'live' | 'disconnected'`; `AiSession` gains
  `archivedAt: string | null`.
- **`SessionStatusPill`** gains an optional `kind?: SessionKind` prop and a terminal
  mapping (table above); default (no kind / agent) keeps today's mapping. New tones: `live`
  → running/green tone; `disconnected` → warn/amber; terminal `failed` → danger "Couldn't
  start".
  - `AiSession` also gains `foregroundProcess: string | null`.
- **Activity frame:** `use-session-socket` handles the new `activity` frame and exposes
  `{ foreground, busy }`. The terminal screen composes the display status from
  `(conn, status, foreground, busy)` → a pure `terminalDisplay(...)` helper returning the
  pill label + tone + pulse, so the mapping is unit-tested without a socket.
- **List + panels:** `useAiSessions({ archived })` param; Terminals/Agents panels get a
  "Show archived" toggle (off by default) and pass it through. `SessionList` terminal rows
  show **Running: `<name>`** vs **Ready** from `session.foregroundProcess`, plus an
  **Archive**/**Unarchive** affordance (hover action). The session header ⋯ menu gains
  **Archive** beside End session.
- `useArchiveSession` / `useUnarchiveSession` mutations invalidate `['ai','sessions']`.

## Testing

- **db:** migration applies on the scratch DB (existing harness); `archived_at` present;
  enum has the new values.
- **api:** terminal start persists `live`; `reconcileOrphaned` flips orphans to
  `disconnected` and stamps `ended_at`; list excludes archived unless `?archived=true`;
  archive of a live session calls `supervisor.stop` then sets `archived_at`; unarchive
  clears it.
- **api:** foreground poll emits an `activity` frame + `setForeground` on a
  shell→program→shell transition (fake PtyHandle whose `process()` the test drives); no
  write while it stays put.
- **web:** `SessionStatusPill` label/tone per (kind,status) incl. the terminal table;
  `terminalDisplay(conn,status,foreground,busy)` returns the right label/tone/pulse across
  Ready / Running:name / Connecting / Reconnecting / Disconnected / Exited.
- Full suites stay green; typecheck + build green.

## Non-goals

- Shell-integration (OSC 133) prompt/command markers — foreground detection uses
  `IPty.process`, the output pulse uses output timing.
- Reading an interactive tool's internal idle/thinking state from a raw terminal (that's the
  agent session's job).
- No change to the agent status model or dispatch. The socket frame union gains one additive
  `activity` frame; no existing frame changes.
