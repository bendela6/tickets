# E1 — Terminal sessions — design

Status: approved for planning (brainstormed 2026-07-14)

**Slice 1 of 3** of the AI sessions initiative. Read
`2026-07-14-ai-sessions-design.md` first — it holds the locked decisions, the
four architectural seams, and the E2/E3 roadmap this slice is built to support.
This spec covers E1 in implementation detail.

## Goal

Open `/ai`, click **New terminal session**, pick a workspace, and get a live shell
in the browser. Run `claude`, `pnpm test`, `git log` — anything. Close the tab,
come back tomorrow, and the session is still running with its scrollback intact.

No AI in this slice. Not one line of provider code.

## Why this is first

E1 is not the product. It is here because it forces us to build and debug the
infrastructure E2 cannot ship without — process supervision, a bidirectional
transport, reconnect-and-replay, and the nginx/Vite WebSocket config — while a
dumb `bash` process is the only variable in the system. Each of those fails
silently and in confusing ways; none of them is easier to diagnose with an agent
SDK also in the loop.

The seams it must respect (Runner, Provider, one WebSocket) are defined in the
overview spec. E1 implements the Runner seam and the transport; it leaves the
Provider seam as an unused interface.

## Scope

**In:**
- `ai_workspaces`, `ai_sessions`, `ai_session_output` tables.
- A Session Supervisor in `apps/api` that owns PTY processes and outlives sockets.
- `@fastify/websocket` and the `/api/ai/sessions/:id/socket` endpoint, carrying
  the full `ClientFrame` / `ServerFrame` unions from the overview spec (only the
  terminal-relevant variants are exercised in E1).
- REST: workspaces CRUD, sessions list/create/get/stop.
- Vite proxy and nginx config for WebSocket upgrade.
- `/ai` (sessions list) and `/ai/:sessionId` (xterm.js terminal) screens.

**Out (deferred to E2/E3):**
- Every provider, the Agent SDK, `ai_agents`, `ai_messages`,
  `ai_permission_requests`.
- `ContainerRunner`. `ai_workspaces.runner` accepts `'container'` in the type but
  the supervisor rejects it with a 400 until E2.
- Ticket links and session trees. The `agent_id`, `ticket_id`, and
  `parent_session_id` columns are created and stay null.

## Components

Each unit below can be understood and tested without reading the others'
internals.

### 1. `packages/db` — the `ai` schema group

Three tables, one file each in `packages/db/src/schema/`, re-exported from
`schema/index.ts`, and — this is the step that fails a test if skipped —
registered in **both** `schema/registry.ts` (`allTables`) and
`schema/schema-groups.ts` (a new `ai` group). Then `pnpm db:generate` and
`pnpm db:migrate`.

Conventions, matching every existing table: `serial('id').primaryKey()`,
snake_case column names with camelCase TS keys, `timestamp({ withTimezone: true,
mode: 'string' }).notNull().defaultNow()`, nullable `archived_at` rather than
hard deletes, explicit table-prefixed constraint and index names.

```ts
// ai_workspaces
id, name, path, runner, containerName, gitRemote, defaultBranch,
config, archivedAt, createdAt
// unique('ai_workspaces_name')

// ai_sessions
id, kind, title, workspaceId, agentId, ticketId, parentSessionId,
status, providerSessionId, cwd, worktreePath, exitCode, costUsd,
startedBy, createdAt, updatedAt, endedAt
// index('ai_sessions_status_created')

// ai_session_output
id, sessionId, seq, data, createdAt
// unique('ai_session_output_session_seq') on (session_id, seq)
// index('ai_session_output_session_seq_idx')
```

`kind`, `status`, and `runner` become pg enums in
`packages/db/src/schema/enums.ts` alongside the existing `user_kind` and
`status_kind`.

### 2. `apps/api/src/ai/supervisor.ts` — the Session Supervisor

The one stateful thing in an otherwise stateless API. A module-level singleton
holding `Map<SessionId, RunningSession>`.

**What it does:**
- `start(session, workspace)` — spawn a PTY via the Runner, register it, set
  status `running`.
- `attach(sessionId, subscriber, lastSeq)` — replay persisted output rows with
  `seq > lastSeq`, send `replay_done`, then add the subscriber to the live fan-out.
- `detach(sessionId, subscriber)` — remove it. **Does not kill the process.**
- `write` / `resize` / `stop`.

**What it must get right:**
- **Output is persisted before it is broadcast.** The `seq` counter is the single
  source of truth shared by the DB rows and the wire frames; a client that has
  seen `seq=N` can always be brought current from the DB alone. Getting this
  backwards — broadcast then persist — makes reconnect lossy in a way that is
  very hard to see in testing.
- **Writes are batched.** A PTY emits many small chunks; one INSERT per chunk
  would hammer Postgres during a `pnpm build`. Coalesce on a short interval or a
  size threshold.
- **Output is capped.** Prune the oldest rows for a session past a configured
  limit, so an infinite log loop can't fill the disk.
- **Process exit** sets `status`, `exit_code`, `ended_at`, and broadcasts a final
  `status` frame.
- **Startup recovery.** On boot, any session left `running` in the DB is marked
  `interrupted` — that process died with the old API. The UI offers a restart.

The supervisor's only dependency is the `Runner` interface, so it is testable
against a fake runner with no real process at all.

### 3. `apps/api/src/ai/local-runner.ts`

Implements `Runner.spawnPty` with `node-pty`. Resolves the shell per platform,
sets `cwd` from the workspace, and passes a scrubbed env.

**This is the only file in E1 that touches the OS.** `ContainerRunner` will sit
beside it in E2 and the supervisor will not change.

`node-pty` is a native module: it needs a build toolchain, it must be rebuilt for
the Docker image's Node version, and its Windows and Linux behaviors differ. This
is the highest-risk dependency in the slice and the plan should install and prove
it end-to-end (spawn, echo, exit) before anything else is built on it.

### 4. `apps/api/src/routes/ai.routes.ts`

`registerAiRoutes(app, context)`, wired with one line in `app.ts` alongside the
other nine. Handlers are closures over `db`; bodies parsed with valibot via
`parseBody`; failures are `throw new HttpError(404, '...')`. Writes that touch
more than one table are wrapped in `db.transaction`.

```
GET    /api/ai/workspaces
POST   /api/ai/workspaces
PATCH  /api/ai/workspaces/:id
GET    /api/ai/sessions            ?status=&kind=
POST   /api/ai/sessions            { kind: 'terminal', workspaceId, title?, command? }
GET    /api/ai/sessions/:id
DELETE /api/ai/sessions/:id        stop the process, archive the row
```

**`POST /api/ai/sessions` validates the workspace path exists and is a directory
before spawning.** A typo'd path should be a 400, not a dead session.

### 5. `@fastify/websocket` — `/api/ai/sessions/:id/socket`

The API's first Fastify plugin. One route. The frames are the `ClientFrame` /
`ServerFrame` unions from the overview spec; E1 exercises `attach`, `input`,
`resize`, `interrupt` inbound and `output`, `status`, `replay_done` outbound.

The handshake is: client connects → sends `{type:'attach', lastSeq}` → server
replays missed output from the DB → sends `replay_done` → live frames follow.

An unknown session id closes the socket with a code the client can distinguish
from a network drop.

### 6. Proxy configuration — the silent-failure step

Two changes, neither of which produces a useful error when missing:

- `apps/web/vite.config.ts` — the existing `/api` proxy needs `ws: true`.
  Without it the upgrade request is proxied as a plain GET and the socket just
  never opens.
- `docker/` nginx — the `/api` location needs `proxy_http_version 1.1`, the
  `Upgrade` and `Connection` headers, and `proxy_buffering off`. Without these,
  it works in dev on :4620 and mysteriously does not work in the deployed
  container on :4610.

Both must be verified against a real deployed container, not just `pnpm dev`.

### 7. `apps/web` — two routes

Hand-written route objects in `apps/web/src/routes/`, added to
`rootRoute.addChildren([...])` in `router.ts`. This app does **not** use
file-based routing and has no generated route tree.

- **`ai-route.tsx` → `/ai`** — the sessions list. Columns: status, kind, title,
  workspace, age. A "New terminal session" dialog picking a workspace and an
  optional command. Fetched with a `use-ai-sessions.ts` hook following the
  one-hook-per-endpoint pattern in `apps/web/src/api/`.
- **`ai-session-route.tsx` → `/ai/:sessionId`** — xterm.js bound to a
  `use-session-socket.ts` hook that owns the WebSocket lifecycle: connect,
  `attach` with the last seq, reconnect with backoff on drop, and resize on
  container resize (via `@xterm/addon-fit`).

**The xterm.css trap.** `xterm.css` is third-party unlayered CSS, and unlayered
CSS has beaten this project's design system before (see the trap tables in the
project skills). Wrap it in a cascade layer, and theme the terminal from
Instrument tokens by passing an explicit `theme` to the xterm constructor rather
than shipping its default palette. **Verify the current preflight setting before
debugging any terminal styling** — `CLAUDE.md` says preflight is off, but the
completed-redesign notes say it was turned on when `globals.css` was deleted, and
those two disagree.

## Data flow

```
Browser                 API                          OS
   |                     |                            |
   |-- POST /sessions -->|                            |
   |                     |-- validate workspace       |
   |                     |-- INSERT ai_sessions       |
   |                     |-- supervisor.start() ----->|-- node-pty spawn
   |<-- 201 {id} --------|                            |
   |                     |                            |
   |-- WS connect ------>|                            |
   |-- attach(lastSeq=0)>|                            |
   |                     |-- SELECT output WHERE seq>0|
   |<-- output x N ------|                            |
   |<-- replay_done -----|                            |
   |                     |<-------- pty data ---------|
   |                     |-- INSERT output (batched)  |
   |<-- output (live) ---|                            |
   |                     |                            |
   |-- input "ls\r" ---->|-- pty.write() ------------>|
   |                     |                            |
   [ tab closed ]        |   process keeps running    |
   |                     |<-------- pty data ---------|
   |                     |-- INSERT output            |
   |                     |                            |
   [ tab reopened ]      |                            |
   |-- attach(lastSeq=N)>|-- SELECT output WHERE seq>N|
   |<-- output (missed) -|                            |
```

## Error handling

| Failure | Behavior |
|---|---|
| Workspace path missing / not a directory | 400 at create. No session row. |
| `runner: 'container'` | 400 until E2. |
| PTY spawn fails | Session row goes `failed`; the error is persisted as an output chunk so the user can read it in the terminal. |
| Process exits (clean or crash) | `status`, `exit_code`, `ended_at` set; final `status` frame broadcast; terminal shows the exit code. Scrollback stays readable. |
| Socket drops | Process untouched. Client reconnects with backoff and re-`attach`es with its last seq. |
| API restarts | `running` sessions → `interrupted` on boot. UI offers restart. (Terminal sessions cannot be resumed — the PTY is gone. Agent sessions will be resumable in E2 via `provider_session_id`.) |
| Attach to unknown/archived session | Socket closed with a distinguishable code; UI shows "session ended", not a reconnect spinner. |
| Output cap exceeded | Oldest rows pruned. Replay starts from the oldest surviving seq; the terminal shows a truncation notice rather than silently lying about scrollback. |

## Testing

Following the two tiers already in `apps/api`:

**Unit, colocated:**
- `supervisor.test.ts` against a **fake Runner** — no real process. Covers:
  output persisted before broadcast; seq monotonicity; replay from an arbitrary
  seq; detach does not kill; exit sets status and code; output cap prunes and
  reports truncation.
- `local-runner.test.ts` — spawn a trivial command (`echo`), assert output and
  exit code. The one place a real process is used.

**Integration**, in the style of `app.test.ts` (scratch Postgres per run, real
migrations, real app):
- workspace validation rejects a bad path,
- create → the session row exists and is `running`,
- **the reconnect path end-to-end**: connect, write input, read output, drop the
  socket, write more input, reconnect with `lastSeq`, and assert the missed
  output is replayed exactly once and in order. This is the test the whole slice
  exists to make pass.

**Manual, against the deployed container on :4610** — not just `pnpm dev` on
:4620 — because that is the only thing that proves the nginx upgrade config.

## Types

E1 introduces no types of its own beyond the drizzle row types generated from the
three tables. It uses the following, which are shared with E2/E3 and also appear
in `2026-07-14-ai-sessions-design.md`. Only the terminal-relevant frame variants
are exercised in this slice; the rest are carried so the transport does not have
to change in E2.

```ts
type SessionId = number
type SessionKind = 'terminal' | 'agent'
type RunnerKind = 'local' | 'container'

type SessionStatus =
  | 'starting'
  | 'running'
  | 'idle'           // agent finished a turn, awaiting a prompt (E2)
  | 'awaiting_input' // blocked on a permission decision (E3)
  | 'interrupted'    // API restarted underneath it; may be resumable
  | 'exited'
  | 'failed'

// Where a process runs. E1 implements LocalRunner only.
interface Runner {
  spawnPty(spec: PtySpec): PtyHandle
  spawnAgent(spec: RunSpec): AgentRun   // unused in E1
}

interface PtySpec {
  cwd: string
  command: string
  args: string[]
  env: Record<string, string>
  cols: number
  rows: number
}

interface PtyHandle {
  output: AsyncIterable<string>
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(): void
}

// The supervisor's in-memory entry for one live session.
interface RunningSession {
  sessionId: SessionId
  kind: SessionKind
  status: SessionStatus
  handle: PtyHandle | AgentRun
  seq: number                   // monotonic; matches the persisted seq
  subscribers: Set<Subscriber>  // attached sockets
}

interface Subscriber {
  send(frame: ServerFrame): void
  close(): void
}

type ClientFrame =
  | { type: 'attach'; lastSeq: number }
  | { type: 'input'; data: string }                // terminal keystrokes
  | { type: 'resize'; cols: number; rows: number } // terminal
  | { type: 'prompt'; text: string }               // agent (E2)
  | { type: 'permission'; requestId: string; result: 'allow' | 'deny'; reason?: string } // E3
  | { type: 'interrupt' }

type ServerFrame =
  | { type: 'output'; seq: number; data: string }       // terminal
  | { type: 'message'; seq: number; event: AgentEvent } // agent (E2)
  | { type: 'status'; status: SessionStatus; exitCode?: number }
  | { type: 'replay_done' }
```

`RunSpec`, `AgentRun`, and `AgentEvent` appear in the signatures above but are
never constructed in E1 — they are defined in the **Types** and **Architecture**
sections of `2026-07-14-ai-sessions-design.md` and are implemented in E2.
