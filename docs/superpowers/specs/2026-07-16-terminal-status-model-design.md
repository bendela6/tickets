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

- **Activity detail:** *Live + output pulse.* The list shows lifecycle only. The OPEN
  terminal screen adds a **Running** (busy) vs **Ready** (idle) signal inferred from recent
  PTY output — a client-side pulse off the output stream, no server change.
- **Archive rules:** *Archive ends it first.* Archiving a live session ends the PTY, then
  hides it; archived sessions leave the list behind a "Show archived" toggle; unarchive
  restores.

### Why not the foreground process name (verified)

The follow-up ask ("indicator if some process is running inside the terminal") was
investigated with throwaway spikes against a real PTY on Windows:

- **`IPty.process`** — returns the `name` we pass to `spawn` (`"xterm-color"`) and never
  tracks the foreground child on Windows/ConPTY. Rejected: not doable on the dev platform.
- **OSC 133 shell integration** (the shell emits a prompt marker) — **verified working on
  Windows**: a 3s command left a clean ~4s gap between prompt markers, so idle-vs-running
  and the command name/exit code are recoverable cross-platform. But it requires injecting a
  shell-specific prompt marker (pwsh/bash/zsh differ), which is exactly the per-shell config
  the **profiles subsystem (C)** will own.

**Decision:** ship the *output pulse* now (works everywhere, zero shell config); defer
accurate **"Running: `<name>`"** via OSC 133 shell integration to the profiles work. The
spike proved it's doable, so C can adopt it without re-litigating feasibility.

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
- status `live` + PTY produced output within ~1s → **"Running"** (with a pulse dot); at rest
  → **"Ready"**.
- otherwise the persisted-status label above.

**The list rows have no socket**, so they show the persisted lifecycle label only (Live /
Disconnected / Exited / Couldn't start / Connecting). No pulse in the list — that's the
honest limit until shell integration lands and can persist the running command.

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

## Archive

Mirror the existing workspace/agent pattern (both already use `archived_at` + an `isNull`
list filter + a PATCH `archived` boolean).

- **DB:** add nullable `archived_at` timestamp to `ai_sessions`.
- **Store:** `setArchived(sessionId, archived: boolean)` (sets/clears `archived_at`);
  `reconcileOrphaned()` (the startup UPDATE above).
- **Routes:**
  - `GET /api/ai/sessions` — exclude `archived_at IS NOT NULL` unless `?archived=true`.
  - `POST /api/ai/sessions/:id/archive` — if `supervisor.has(id)`, `supervisor.stop(id)`
    (its exit handler finalizes the row); if not live and not ended, finalize to
    `disconnected`; then set `archived_at`. Returns the row.
  - `POST /api/ai/sessions/:id/unarchive` — clear `archived_at`.

## Supervisor change

Terminal `start()` persists **`live`** instead of `running` and broadcasts
`{ type: 'status', status: 'live' }` (reuse `store.setStatus(id, 'live')`, dropping the
terminal `markRunning` call). Agent `startAgent()` is unchanged. No new frame, no poll.

## Web

- **Types:** `SessionStatus` gains `'live' | 'disconnected'`; `AiSession` gains
  `archivedAt: string | null`.
- **`SessionStatusPill`** gains an optional `kind?: SessionKind` prop and a terminal
  mapping (table above); default (no kind / agent) keeps today's mapping. New tones: `live`
  → running/green tone; `disconnected` → warn/amber; terminal `failed` → danger "Couldn't
  start".
- **Output pulse (terminal screen only):** a pure `useTerminalActivity()` hook — fed each
  output chunk (the screen already receives them via the socket's `onData`), returns `busy`
  true for ~1s after the last chunk (timer-based, cleared on unmount). A pure
  `terminalDisplay(conn, status, busy)` returns the pill label + tone + pulse for the whole
  matrix, so the mapping is unit-tested without a socket.
- **List + panels:** `useAiSessions({ archived })` param; Terminals/Agents panels get a
  "Show archived" toggle (off by default) and pass it through. Each `SessionList` row gets
  an **Archive**/**Unarchive** affordance (hover action). The session header ⋯ menu gains
  **Archive** beside End session.
- `useArchiveSession` / `useUnarchiveSession` mutations invalidate `['ai','sessions']`.

## Testing

- **db:** migration applies on the scratch DB (existing harness); `archived_at` present;
  enum has the new `live`/`disconnected` values.
- **api:** terminal start persists `live` (not `running`); `reconcileOrphaned` flips orphans
  to `disconnected` and stamps `ended_at`, leaves already-`exited` rows untouched; list
  excludes archived unless `?archived=true`; archive of a live session calls
  `supervisor.stop` then sets `archived_at`; unarchive clears it.
- **web:** `SessionStatusPill` label/tone per (kind,status) incl. the terminal table (agent
  mapping unchanged = regression guard); `terminalDisplay(conn,status,busy)` returns the
  right label/tone/pulse across Ready / Running / Connecting / Reconnecting / Disconnected /
  Exited / Couldn't-start; `useTerminalActivity` goes busy on a chunk and clears after the
  window (fake timers).
- Full suites stay green; typecheck + build green.
- **Manual smoke (dev stack):** open a terminal, run `sleep 3` → pill pulses **Running**
  then settles **Ready**; restart the API under a live terminal → it flips to
  **Disconnected** (not stuck "running"); Archive hides it, Show-archived reveals it,
  Unarchive restores.

## Non-goals

- **Foreground command name / accurate idle-vs-running** ("Running: `npm`") — deferred to
  the profiles subsystem via OSC 133 shell integration (feasibility already verified).
- Shell-integration prompt injection of any kind in this task.
- No change to the agent status model, the socket frame union, or dispatch.
