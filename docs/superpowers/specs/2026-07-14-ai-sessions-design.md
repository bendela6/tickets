# AI chat sessions — initiative design

Status: approved for planning (brainstormed 2026-07-14)

This is the **overview spec** for the AI sessions initiative. It covers the whole
picture at design level and locks the decisions that must hold across all of it.
Each slice below gets its own implementation spec and plan:

- **E1 — Terminal sessions** → `2026-07-14-ai-sessions-terminal-design.md`
- **E2 — Agent sessions** → spec written when E1 lands
- **E3 — Dispatch** → spec written when E2 lands

## Goal

Bring AI coding sessions into the tickets app. Two kinds of session, one list:

- A **terminal session** streams a real PTY to the browser. You get the actual
  `claude` TUI (or `bash`, or `pnpm test`) rendered with xterm.js, keystrokes and
  all. Full fidelity, works with every CLI immediately, runs on your existing CLI
  login.
- An **agent session** runs a provider-adapted agent that emits *structured*
  events — assistant text, tool calls, tool results, cost. The app renders its own
  chat UI, persists every message as a row, and can drive UI off it. This is the
  extensible mode: adding Codex, Gemini, Grok, or a local model means writing one
  adapter, not touching the app.

On top of that: a library of reusable **agents** (personas) that are also ticket
assignees, and the ability for a session to **dispatch** an agent onto a ticket,
spawning a child session that works it and reports back.

## What exists today

- `apps/api` — Fastify 5, valibot, **no Fastify plugins at all**, no streaming of
  any kind. Routes are registered explicitly in `app.ts`; handlers are closures
  over `db` in `routes/*.routes.ts`; pure logic lives in sibling folders with
  colocated vitest.
- `packages/db` — drizzle + postgres-js. Serial integer ids, snake_case columns,
  tz-aware string timestamps, nullable `archived_at`, `jsonb config` escape hatch.
  A new table must be added to `schema/index.ts`, `schema/registry.ts`
  (`allTables`), **and** `schema/schema-groups.ts` (`SCHEMA_GROUPS`) — a test
  enforces that every table belongs to a group.
- `apps/web` — React 19, TanStack Query + **code-based** TanStack Router (routes
  are hand-written objects assembled in `router.ts`; there is no generated route
  tree). No realtime anywhere — `use-board` polls on a 10s interval.
- `apps/mcp` — a stdio MCP server that is a **pure HTTP client of the API**. It
  resolves `TICKETS_ACTOR` (default `'claude'`) to a user id, creating it with
  `kind: 'agent'` if missing.
- **`users.kind` is already `'human' | 'agent'`.** Agents already render with a
  square avatar, already carry an `AGENT` badge on comments, and are already
  valid assignees. Nothing in the ticket system needs to change to let an AI own
  a ticket.
- Zero hits repo-wide for `anthropic`, `openai`, `xterm`, `node-pty`,
  `WebSocket`, `EventSource`, or SSE. Every piece of streaming and process
  supervision below is net-new.

## Locked decisions

1. **Two session kinds, one list.** A session is `terminal` or `agent`. They
   share the sessions list, workspaces, ticket links, and transport, but have
   different payloads and different persistence. Only the `agent` kind is
   provider-extensible; `terminal` is "run any CLI in a workspace."

2. **Agent sessions use the Claude Agent SDK, not `claude -p`.**
   `@anthropic-ai/claude-agent-sdk` is Claude Code as a TypeScript library, and
   it provides as first-class API everything we would otherwise reverse-engineer
   out of a subprocess's stdout: an `AsyncGenerator` of structured messages,
   streaming *input* (`prompt` accepts an `AsyncIterable`), a `canUseTool`
   permission callback the process blocks on, `resume` / `forkSession`,
   `mcpServers`, `maxBudgetUsd`, `cwd`, and `interrupt()`. Critically, its
   `AgentDefinition` type is a one-to-one match for our persona concept.

3. **Personas are `users` rows.** Every agent in the library owns a
   `users` row with `kind='agent'`. This is what makes an agent assignable,
   attributable, and reportable with no changes to the ticket system.

4. **Providers are a code registry, not DB rows.** Adding a provider means
   writing an adapter, which is a deploy, not a config change. A `capabilities`
   flag set per provider lets the UI degrade honestly (a local model with no
   permission callback hides the approve/deny card rather than faking it).

5. **The execution target is a seam from day one, but only `local` is built
   first.** A workspace declares `runner: 'local' | 'container'`.

6. **Autonomy: run autonomously now, approvals later — but the transport is
   bidirectional from day one.** Every persona carries a `permission_mode`, and
   the DB and WebSocket support approvals from the start; E2 ships in
   `bypassPermissions` with a tool allowlist, because per-tool prompts are the
   single biggest UX tax on an agent and disposable git worktrees are the better
   guardrail. E3 adds the approval card without a rewrite.

7. **Sessions outlive browser connections.** The supervisor owns processes;
   sockets attach and detach. Closing the tab does not kill an agent.

8. **AI providers do NOT reuse the automation connector/connection vocabulary**
   from `2026-07-07-automation-event-bus-and-rules-design.md`. That split exists
   to sync ticket data with external trackers behind a durable outbox. This is
   long-lived local process supervision. They share nothing but the word
   "provider."

## Billing consequence of the two modes

The Agent SDK docs state that Anthropic does not permit third-party developers to
offer claude.ai login for products built on it — agent mode authenticates with an
`ANTHROPIC_API_KEY` and is billed per token. Terminal mode runs the real `claude`
CLI as you, on your existing CLI login.

So the two modes bill differently, which is an independent reason to keep both.
Current per-million-token pricing, for sizing `max_budget_usd`:

| Model | Model ID | Input | Output |
|---|---|---|---|
| Claude Opus 4.8 | `claude-opus-4-8` | $5.00 | $25.00 |
| Claude Sonnet 5 | `claude-sonnet-5` | $3.00 | $15.00 |
| Claude Haiku 4.5 | `claude-haiku-4-5` | $1.00 | $5.00 |

## Architecture — four seams

### 1. The Session Supervisor

A singleton in `apps/api` holding `Map<SessionId, RunningSession>`. It owns every
child process and is **not coupled to any browser connection**.

- Sockets attach to and detach from a session that outlives them.
- On reconnect, the client sends its last-seen sequence number; the supervisor
  replays from the database, then attaches the socket to the live stream.
- On API restart, sessions still marked `running` are marked `interrupted`.
  Agent sessions can be resumed via their `provider_session_id`; terminal
  sessions are dead and the UI offers a restart.

### 2. The Runner — *where* a process runs

```ts
interface Runner {
  spawnPty(spec: PtySpec): PtyHandle
  spawnAgent(spec: RunSpec): AgentRun
}
```

`LocalRunner` spawns on the host. `ContainerRunner` execs into a container. E1
implements `LocalRunner` only; the interface exists so E2 and E3 don't have to
retrofit it.

### 3. The Provider — *what kind of agent* runs

```ts
interface AgentProvider {
  key: string                        // 'claude' | 'codex' | 'gemini' | 'ollama'
  models(): ModelInfo[]
  capabilities: ProviderCapabilities
  start(spec: RunSpec): AgentRun
}

interface ProviderCapabilities {
  permissions: boolean               // can pause mid-run for approval?
  resume: boolean                    // can continue a prior session?
  mcp: boolean
  subagents: boolean
}
```

Every provider normalizes into one event union. **The persistence layer and the
UI only ever see `AgentEvent` — they never learn which provider produced it.**

```ts
type AgentEvent =
  | { type: 'session_started'; providerSessionId: string }
  | { type: 'assistant_text'; text: string; parentToolUseId?: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown; parentToolUseId?: string }
  | { type: 'tool_result'; toolUseId: string; content: unknown; isError: boolean }
  | { type: 'permission_request'; id: string; toolName: string; input: unknown }
  | { type: 'result'; costUsd: number; durationMs: number; isError: boolean }
  | { type: 'error'; message: string }
```

The Claude adapter maps `SDKMessage` → `AgentEvent` and routes `canUseTool`
through `permission_request`. A future Codex adapter wraps that CLI's JSON output;
an Ollama adapter would use the plain Anthropic-style client SDK with our own tool
loop and declare `permissions: false, resume: false`.

### 4. One WebSocket, two payload shapes

`/api/ai/sessions/:id/socket`. Both kinds need a channel *into* the process:
terminal needs keystrokes, and a tool approval needs your click to unblock a
`canUseTool` promise. SSE was never sufficient for either, so one transport
serves both.

```ts
type ClientFrame =
  | { type: 'attach'; lastSeq: number }
  | { type: 'input'; data: string }                       // terminal keystrokes
  | { type: 'resize'; cols: number; rows: number }        // terminal
  | { type: 'prompt'; text: string }                      // agent
  | { type: 'permission'; requestId: string; result: 'allow' | 'deny'; reason?: string }
  | { type: 'interrupt' }

type ServerFrame =
  | { type: 'output'; seq: number; data: string }         // terminal
  | { type: 'message'; seq: number; event: AgentEvent }   // agent
  | { type: 'status'; status: SessionStatus; exitCode?: number }
  | { type: 'replay_done' }
```

This is the API's **first Fastify plugin** (`@fastify/websocket`) and brings two
config changes that fail silently if missed: `ws: true` on the Vite proxy, and
`Upgrade`/`Connection` headers plus `proxy_buffering off` in the nginx config
under `docker/`.

## Data model

One new schema group, `ai`. All tables follow existing conventions and must be
registered in `schema/index.ts`, `registry.ts`, and `schema-groups.ts`.

### E1

**`ai_workspaces`** — a directory a session runs in, and how to run things there.

`id, name, path, runner, container_name, git_remote, default_branch, config, archived_at, created_at`

**`ai_sessions`** — the spine, shared by both kinds.

`id, kind, title, workspace_id, agent_id, ticket_id, parent_session_id, status, provider_session_id, cwd, worktree_path, exit_code, cost_usd, started_by, created_at, updated_at, ended_at`

`agent_id`, `ticket_id`, and `parent_session_id` exist from E1 but stay null until
E2/E3. That is what makes the later slices additive rather than migrations of live
data.

**`ai_session_output`** — `id, session_id, seq, data, created_at`, indexed
`(session_id, seq)`. Append-only raw PTY chunks; this is what a reconnecting
browser replays to rebuild scrollback. Capped, so a chatty `pnpm test` can't grow
unbounded.

### E2

**`ai_agents`** — the persona library.

`id, user_id, key, name, provider_key, model, system_prompt, allowed_tools, disallowed_tools, permission_mode, mcp_servers, effort, default_workspace_id, config, archived_at, created_at`

**`ai_messages`** — one row per `AgentEvent`.

`id, session_id, seq, role, kind, content, tool_use_id, parent_tool_use_id, created_at`

`kind` is free text, following the deliberate precedent of `ticket_events.kind`
("the vocabulary grows in app code"). `parent_tool_use_id` attributes subagent
output to the right nested pane.

**`ai_permission_requests`** — a pending row is a `canUseTool` promise in the
supervisor, waiting on a human.

`id, session_id, tool_name, input, status, decision_reason, decided_by, created_at, decided_at`

## API

One new `apps/api/src/routes/ai.routes.ts`, one `registerAiRoutes(app, context)`
line in `app.ts`. Pure logic in `apps/api/src/ai/*.ts` with colocated vitest, plus
an `app.inject()` integration test in the style of `app.test.ts`.

```
GET  | POST   /api/ai/workspaces          PATCH /api/ai/workspaces/:id
GET  | POST   /api/ai/agents              PATCH /api/ai/agents/:id      (E2)
GET  | POST   /api/ai/sessions            GET   /api/ai/sessions/:id
GET           /api/ai/sessions/:id/messages
DELETE        /api/ai/sessions/:id        (stop + archive)
WS            /api/ai/sessions/:id/socket
```

## Screens

Two hand-written routes added to `router.ts`.

- **`/ai`** — the sessions list. Status, kind, title, workspace, agent, linked
  ticket, age, cost. Becomes a tree in E3 (a dispatched child nests under its
  parent).
- **`/ai/:sessionId`** — for `kind='terminal'`, an xterm.js canvas; for
  `kind='agent'`, the structured chat with collapsible tool calls, diffs, and
  (E3) approval cards.

**Known trap:** `xterm.css` is third-party unlayered CSS, and unlayered CSS has
beaten this project's design system before. It gets wrapped in a cascade layer,
and the terminal is themed from Instrument tokens rather than shipping xterm's
default palette.

## E3 — Dispatch (design sketch)

The MCP server already talks to the API over HTTP and already resolves an agent
actor. So dispatch needs **no new plumbing inside the agent process**: the tickets
MCP server gains a `dispatch_agent(agentKey, projectKey, ticketNumber, prompt)`
tool that POSTs `/api/ai/sessions` with `parent_session_id` taken from its
environment. That call:

1. creates a child session with `parent_session_id` and `ticket_id` set,
2. assigns the ticket to that agent's `users` row,
3. runs it in its own git worktree so parallel dispatches can't collide,
4. streams into a child pane, and on completion comments on the ticket.

The sessions list becomes a tree. That is the actual vision: the ticket board as
an agent work queue.

## Types

Types referenced above and not defined inline:

```ts
type SessionId = number
type SessionKind = 'terminal' | 'agent'

type SessionStatus =
  | 'starting'
  | 'running'
  | 'idle'          // agent finished a turn, awaiting a prompt
  | 'awaiting_input'// blocked on a permission decision
  | 'interrupted'   // API restarted underneath it; may be resumable
  | 'exited'
  | 'failed'

type RunnerKind = 'local' | 'container'

// How a persona decides whether a tool call needs a human.
// Mirrors the Agent SDK's PermissionMode.
type PermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'bypassPermissions'
  | 'plan'
  | 'dontAsk'
  | 'auto'

interface ModelInfo {
  id: string          // e.g. 'claude-opus-4-8'
  label: string
  contextWindow: number
}

// What the supervisor needs to start a process.
interface PtySpec {
  cwd: string
  command: string
  args: string[]
  env: Record<string, string>
  cols: number
  rows: number
}

interface RunSpec {
  cwd: string
  model: string
  systemPrompt?: string
  allowedTools?: string[]
  disallowedTools?: string[]
  permissionMode: PermissionMode
  mcpServers?: Record<string, unknown>
  maxBudgetUsd?: number
  resumeSessionId?: string
}

// A live handle the supervisor holds.
interface PtyHandle {
  output: AsyncIterable<string>
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(): void
}

interface AgentRun {
  events: AsyncIterable<AgentEvent>
  send(text: string): Promise<void>
  respondToPermission(id: string, result: 'allow' | 'deny', reason?: string): Promise<void>
  interrupt(): Promise<void>
  close(): void
}

// Supervisor's in-memory entry for one live session.
interface RunningSession {
  sessionId: SessionId
  kind: SessionKind
  status: SessionStatus
  handle: PtyHandle | AgentRun
  seq: number                       // monotonic, matches the persisted seq
  subscribers: Set<Subscriber>      // attached sockets
}

interface Subscriber {
  send(frame: ServerFrame): void
  close(): void
}
```

## Build order

**E1 → E2 → E3, strictly.** E1 is chosen to go first not because it's the product
— it isn't — but because it forces the hard infrastructure (process supervision,
bidirectional transport, reconnect-and-replay, nginx and Vite WebSocket config)
to be built and debugged while a dumb `bash` process is the only variable. Every
one of those is a prerequisite for E2, and all of them are far harder to diagnose
with an agent SDK in the loop at the same time.
