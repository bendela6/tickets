# Schema namespacing + terminal/agent split — design

**Status:** approved design, not yet planned
**Branch:** `ai-schema-split` (worktree `.claude/worktrees/ai-schema-split`), based on `sp4a-p2-admin`
**Date:** 2026-07-17

## Problem

Two problems, one migration.

**1. Everything lives in `public`.** The items platform's 22 tables share one namespace with no
declared boundary. `SCHEMA_GROUPS` already names the intended ownership (`ws`/`st`/`rc`/`hi`) and
`registry.ts` enforces that every table joins a group — but the grouping is a rendering hint for the
ERD, invisible to Postgres. pgweb, psql, and search_path see one undifferentiated pile.

**2. `ai_sessions` is a two-kind table.** Its own comment admits the compromise:

> The spine shared by both session kinds. `agent_id`, `ticket_id`, and `parent_session_id` exist from
> E1 but stay null until E2/E3 — that is what makes the later slices additive.

That was a slicing convenience, not a model. The cost is visible in three places:

- **Dead columns per kind.** `provider_session_id` ("Null for terminal sessions"), `agent_id`,
  `worktree_path`, and `cost_usd` are agent-only. `exit_code` is terminal-only.
- **A status enum that lies.** `session_status` carries nine values because both lifecycles were
  merged into one. The terminal-status work had to bolt `live`/`disconnected` onto it precisely
  because "a shell sitting at a prompt is not `running`" — a patch over the wrong model.
- **Coupling with no payoff.** Nothing reads across the kinds. The web UI already renders two
  separate lists; the screen branches on `kind` and shares nothing below the branch.

**Requirement (user):** terminal and agent must be **fully independent** — neither depends on the
other. Depending on a shared common (`core`, `records`) is fine; depending on each other is not.

## Locked decisions

1. **Six schemas, `public` empty.** Every table is namespaced.
2. **Terminal and agent are independent subsystems** — own tables, own id spaces, own status enums,
   **no FK between them in either direction**.
3. **`core.workdirs`** replaces `ai_workspaces`: a directory, optionally linked to a project. It is
   not an AI concept and does not live in an AI schema.
4. **Baseline is `sp4a-p2-admin`** (the items platform), not `main`. Designing against `main`'s
   ticket tables would target tables slated for deletion.
5. **Regenerate the `0000` baseline.** The platform is unshipped; it should be born with schemas
   rather than carry a "built in public, then moved" history.
6. **The EER model is the SSOT.** Schemas are authored in `apps/eer/models/items-platform.json`;
   conformance forces drizzle to match.

## The schema map

| Schema | Tables | Source |
|---|---|---|
| `core` | projects, users, views, **workdirs** | `ws` group + the renamed `ai_workspaces` |
| `structure` | schemes, item_types, item_type_child_types, item_type_fields, fields, option_sets, options, option_transitions, link_types, link_type_target_types | `st` group |
| `records` | items, item_values, comments, comment_reactions, item_links | `rc` group |
| `history` | events, commands, outbox, item_activity | `hi` group |
| `terminal` | sessions, output | split from `ai_sessions` |
| `agent` | sessions, messages, permission_requests, agents | split from `ai_sessions` |

Six schemas, 29 tables, nothing in `public`.

Table names shed their prefixes once namespaced: `ai_session_output` → `terminal.output`,
`ai_messages` → `agent.messages`, `ai_permission_requests` → `agent.permission_requests`. The prefix
*was* the namespace; keeping both stutters.

### The independence rule

`terminal` and `agent` may reference `core` and `records`. Neither may reference the other. This is
mechanically checkable — see Testing — and is the invariant the whole split exists to buy.

```
  terminal ──┐
             ├──> core (workdirs, users, projects)
  agent ─────┘         └──> records (items)
```

## `core.workdirs`

`ai_workspaces` carries more than a path — a runner, container config, and git metadata — all of
which describe *how to execute in a directory*. That survives; only the name, schema, and project
link change.

```
core.workdirs
  id              serial pk
  project_id      integer NULL -> core.projects.id      -- NEW: nullable
  name            text not null
  path            text not null
  runner          core.runner_kind not null default 'local'
  container_name  text
  git_remote      text
  default_branch  text
  config          jsonb
  archived_at     timestamptz
  created_at      timestamptz not null default now()
```

**`project_id` is nullable by requirement**: a workdir may belong to a project, or stand alone (a
scratch clone, an unrelated repo). A project may have several workdirs (main clone, scratch
checkout) — so the relationship is `project 1 ── 0..N workdir`, and a workdir has `0..1` project.

This gives a useful property for free: a session in a project-linked workdir can comment back on an
item; a standalone-workdir session cannot, because there is no project to resolve. That falls out of
the nullable FK instead of needing a rule.

## The split

### `terminal`

```
terminal.sessions
  id           serial pk
  title        text not null
  workdir_id   integer not null -> core.workdirs.id
  cwd          text
  status       terminal.session_status not null default 'starting'
  exit_code    integer
  started_by   integer -> core.users.id
  created_at   timestamptz not null default now()
  updated_at   timestamptz not null default now()
  ended_at     timestamptz
  archived_at  timestamptz
  index (status, created_at)

terminal.output
  id          serial pk
  session_id  integer not null -> terminal.sessions.id
  seq         integer not null
  data        text not null
  created_at  timestamptz not null default now()
```

Gone from the terminal side: `kind`, `agent_id`, `item_id`, `parent_session_id`,
`provider_session_id`, `worktree_path`, `cost_usd`. None of them were ever non-null for a terminal.

### `agent`

```
agent.sessions
  id                  serial pk
  title               text not null
  workdir_id          integer not null -> core.workdirs.id
  agent_id            integer -> agent.agents.id
  item_id             integer -> records.items.id          -- was ticket_id
  parent_session_id   integer -> agent.sessions.id         -- self; dispatch tree
  status              agent.session_status not null default 'starting'
  provider_session_id text
  cwd                 text
  worktree_path       text
  cost_usd            numeric(10,4)
  started_by          integer -> core.users.id
  created_at          timestamptz not null default now()
  updated_at          timestamptz not null default now()
  ended_at            timestamptz
  archived_at         timestamptz
  index (status, created_at), index (parent_session_id)

agent.messages
  id                 serial pk
  session_id         integer not null -> agent.sessions.id
  seq                integer not null
  role               text not null
  kind               text not null
  content            jsonb
  tool_use_id        text
  parent_tool_use_id text
  created_at         timestamptz not null default now()

agent.permission_requests
  id              serial pk
  session_id      integer not null -> agent.sessions.id
  tool_name       text not null
  input           jsonb
  status          agent.permission_status not null default 'pending'
  decision_reason text
  decided_by      integer -> core.users.id
  created_at      timestamptz not null default now()
  decided_at      timestamptz

agent.agents
  id                  serial pk
  user_id             integer not null -> core.users.id
  key                 text not null
  name                text not null
  provider_key        text not null
  model               text not null
  system_prompt       text
  allowed_tools       jsonb
  disallowed_tools    jsonb
  permission_mode     agent.permission_mode not null default 'bypassPermissions'
  mcp_servers         jsonb
  effort              text
  default_workdir_id  integer -> core.workdirs.id
```

`exit_code` is dropped from the agent side: an agent run has a `result`, not a process exit status.

### Enums, split per kind

The nine-value `session_status` becomes two enums that each carry only reachable states. Same
enum name in different schemas is legal and reads well.

```
terminal.session_status  : starting | live | disconnected | exited | failed
agent.session_status     : starting | running | idle | awaiting_input | interrupted | exited | failed
agent.permission_mode    : (unchanged)
agent.permission_status  : (unchanged)
core.runner_kind         : local | container
core.user_kind           : human | agent
structure.field_type     : (unchanged)
structure.status_kind    : (unchanged)
```

This is the terminal-status muddle fixed at the root. `live`/`disconnected` are terminal facts;
`running`/`idle`/`awaiting_input` are agent-turn facts. Neither kind can now hold a state that is
meaningless for it — the database rejects it.

## API and routes

Two id sequences mean `terminal.sessions.id = 1` and `agent.sessions.id = 1` both exist. Every
route keyed on a bare session id becomes ambiguous and must be qualified by kind.

| Now | After |
|---|---|
| `/ai/$sessionId` | `/terminals/$id` · `/agents/$id` |
| `GET/POST /api/ai/sessions` | `/api/terminal/sessions` · `/api/agent/sessions` |
| `/api/ai/sessions/:id/socket` | `/api/terminal/sessions/:id/socket` · `/api/agent/sessions/:id/socket` |
| `/api/ai/workspaces` | `/api/workdirs` (moves out of the AI namespace) |
| `POST /api/ai/dispatch` | `POST /api/agent/dispatch` |

The v2 UI already split the lists into `/terminals` and `/agents`; this finishes a half-done move.
`ai-session-screen.tsx` currently branches on `kind` and shares nothing below the branch — it
becomes `terminal-session-screen.tsx` and `agent-session-screen.tsx`, and the branch disappears.

**Dispatch is agent-only.** `parent_session_id` lives on `agent.sessions` referencing itself. A
terminal never parents anything, so `buildSessionTree` becomes agent-only and terminals render flat.
`AI_SESSION_ID` (MCP) stays agent-scoped.

## The supervisor boundary

The supervisor's persist-before-broadcast, seq-as-SSOT, and reconnect-replay-dedupe logic is the
subtlest code in the subsystem and is well tested. Duplicating it per kind would be the worst
outcome of this split.

```
apps/api/src/session-core/    channel, seq, replay, broadcast, attach/detach   (owned by neither)
apps/api/src/terminal/        PTY driver + store over terminal.*
apps/api/src/agent/           AgentRun driver + store over agent.*
```

Both drivers depend on `session-core`; neither depends on the other. This honours the independence
rule — depending on a shared common is not depending on each other — without paying for two copies
of the hardest code in the system.

## Migration

**Regenerate the baseline.** `0000` and `0001` are replaced by a single hand-written baseline that
creates the six schemas and all 29 tables in place. The platform is unshipped, so there is no
history worth preserving and no "built in public, then moved" story to explain later.

**Trap — `drizzle-kit generate` is not schema-move aware.** It sees `public.items` gone and
`records.items` added and emits `DROP TABLE` + `CREATE TABLE`. Against a populated database that
silently destroys data. This baseline is authored by hand and reviewed as SQL; generated output is
never trusted for a schema move.

**Dev databases are rebuilt, not migrated.** `tickets_platform` (635 items / 2,948 values / 2,158
events) and `tickets_test` are dropped and recreated. The data is reproducible: `tickets_legacy`
still holds the original 635 tickets and the importer lives in `packages/db/src/import/`. Rebuild is
drop → migrate → import.

**Coordination.** `sp4a-p2-admin` is actively worked by another agent against `tickets_platform`.
Regenerating the baseline forces them to rebuild that database. This must be sequenced with them,
not sprung on them.

**Prod is untouched.** `tickets` runs main's ticket schema; the items platform has never been
deployed. No production migration is part of this work.

## The EER model (SSOT)

`apps/eer/models/items-platform.json` is the source of truth: `model.ts` loads it and
`model-conformance.test.ts` diffs it against drizzle in both directions ("a stray table in drizzle
fails as loudly as a missing one").

The model already supports what this needs — `Entity.schema: string | null` and
`EnumDecl.schema: string | null`, where `null` means public. That capability exists on `main` and
arrives here via the merge (step 1 of the plan).

Work required:
- Assign `schema` to all 29 entities and all enums in the model.
- Add the terminal/agent entities and their enums to the model.
- **Teach `describe-schema.ts` to report a table's schema, and the conformance test to compare it.**
  Neither does today — conformance would currently pass while every table sat in the wrong schema.
- Assign `schema` to the enums in `registry.ts`'s `allEnums` alongside `allTables`.
- **`SCHEMA_GROUPS` loses its `tables` array.** The schemas now mirror the groups exactly
  (`core`=ws, `structure`=st, `records`=rc, `history`=hi, plus `terminal`/`agent`), so a table's
  group *is* its schema. Keeping both would be two lists to drift apart. `SCHEMA_GROUPS` keeps
  `key`/`label`/`color` for ERD rendering and derives its tables from each table's pgSchema. The
  group-invariant test in `registry.ts` is then redundant — a table cannot fail to have a schema —
  and is replaced by the independence test below.

## Prerequisite: the merge

`ai-schema-split` is based on `sp4a-p2-admin` @ `8353206` and must merge `main` (75 commits: AI
sessions + the EER schema feature) before any of this can be built. A trial merge was run and
aborted; it produces **12 conflicts** in three clusters:

1. **Schema layout** — `schema-groups.ts`, `registry.ts`, `schema/index.ts`. Items platform's
   `rc`/`hi` versus main's `ai` group. *These are this design's decisions; they resolve to the map
   above.*
2. **App shell** — `app-shell.tsx`, `router.ts`, `api/types.ts`. The AI activity rail and
   `/terminals`/`/agents` routes versus the settings-admin shell. Both sides restructured the same
   files; needs real reading.
3. **EER conformance gates** — the three gate files. `24` (main) versus `22` (platform). Resolve to
   whatever the final model says; free once the map lands.

Plus `apps/api/package.json` and `pnpm-lock.yaml` (node-pty, agent SDK) — mechanical.

**`apps/eer/models/items-platform.json` merges cleanly** — verified in the trial. Their `status_kind`
addition and main's `schema:` format churn are disjoint. No manual resolution needed.

## Testing

- **Independence, mechanically enforced.** A test asserts no FK crosses `terminal` ↔ `agent` in
  either direction, by reading the drizzle schema. This is the invariant the split exists for; it
  gets a test, not a comment.
- **Conformance** — model ↔ drizzle agreement, now including `schema` per table and enum.
- **Per-kind status** — a terminal session cannot be `running`; an agent session cannot be `live`.
  Enforced by the enums; asserted once so a future widening is deliberate.
- **Existing suites stay green.** Post-merge: api, web, eer, db. The eer gates move from 18/24 to
  the final table count.
- **Baseline applies clean** to an empty database, and the importer repopulates from
  `tickets_legacy` to the same 635/2,948/2,158 counts.

## Out of scope

- Deploying the items platform (unshipped; separate decision).
- Porting main's ticket data to the items schema (the importer already covers it).
- The AI sessions manual PTY smoke, still outstanding from the shell-integration work.
- Auto-archiving a terminal session on Restart (separate small change).

## Types

Types named above, defined here so this page stands alone.

```ts
// apps/eer/src/engine/model/types/types.ts — the SSOT's shape (exists today)
interface Entity {
  id: string;
  label: string;
  group: string;
  description: string | null;
  schema: string | null; // null = public
  columns: Column[];
  constraints: Constraint[];
  indexes: TableIndex[];
  x: number; y: number; _w: number; _h: number;
}

interface EnumDecl {
  name: string;
  values: string[];
  schema: string | null; // null = public
}

// packages/db/src/schema/schema-groups.ts — the ERD grouping (exists today)
type SchemaGroup = {
  key: string;
  label: string;
  color: string;   // an instrument option hue name
  tables: string[]; // sql table names, render order
};

// The status enums this design splits in two.
type TerminalStatus = 'starting' | 'live' | 'disconnected' | 'exited' | 'failed';
type AgentStatus =
  | 'starting' | 'running' | 'idle' | 'awaiting_input' | 'interrupted' | 'exited' | 'failed';

type RunnerKind = 'local' | 'container';
type PermissionStatus = 'pending' | 'allowed' | 'denied';
type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk';
type UserKind = 'human' | 'agent';
```
