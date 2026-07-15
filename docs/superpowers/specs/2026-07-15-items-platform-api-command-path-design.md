# Items Platform API — Command Path & Event Registry (sub-project 2) — Design

**Status:** approved design, ready for a plan.
**Sub-project 2 of 4** in the items-platform rebuild. Predecessor:
[`2026-07-14-items-platform-schema-and-import-design.md`](2026-07-14-items-platform-schema-and-import-design.md)
(the 22-table schema + import, complete). Successors: SP3 (outbox worker,
`item_activity`, automations) and SP4 (web + MCP + cutover).

## 1. Goal & scope

Port `apps/api` off the deleted `ticket*` schema onto the 22-table items
platform so the app compiles and runs, and route every mutation through a single
audited **command → typed event** path.

**Scope: the full API port.** All 24 existing endpoints work on the new schema —
item mutations, the vocabulary/settings admin writes (fields, types, options,
link-types, scheme fork, views), and the reads (board, export, events). The
type-owned→scheme-library reversal from the schema rebuild lands in the admin
routes here.

Out of scope: the outbox **worker**, the `item_activity` projection, and
automations (all SP3); web, MCP tool renames, and the production cutover (all
SP4). Tier B (the event log as source of truth) stays gated — this is Tier A:
**the tables are the source of truth; events are written alongside.**

## 2. Locked decisions

| # | Decision | Why |
| --- | --- | --- |
| 1 | **Full API port** — every one of the 24 endpoints works on the new schema. | The app must compile and run; half-ported leaves dead routes. |
| 2 | **Symmetric registries** — `defineCommand` + `defineEvent`, both central catalogues. Routes parse and call `runCommand`; they never open a transaction, touch the ledger, or write `events` directly. | One audited path; the command surface is enumerable (SP4's MCP introspects it). |
| 3 | **Envelope in the JSON body; `commandId` required.** Every mutation body carries `commandId` (uuid) and `actorId`. Item patches also carry `expectedUpdatedAt`. | Matches today's body-only style. A required client-supplied `commandId` is what makes retries idempotent. |
| 4 | **Every mutation emits typed events — items *and* config.** Item mutations use `aggregate_type='item'`; config mutations use `field`/`option`/`transition`/`link_type`/`scheme`/`project`/`user`/`view`. | Full audit trail from day one; uniform command path with no "config is special" carve-out. |
| 5 | **Dedicated `tickets_test` database.** The suite creates, migrates, and tears it down. `tickets_platform` stays the pristine deliverable; `tickets_dev` stays the legacy dev app. | Import/seed tests are destructive; running them against the deliverable wipes it. Supersedes the predecessor spec's "tests against `tickets_dev`". |
| 6 | **Write outbox rows in-transaction now; the worker is SP3.** `emit()` inserts one `outbox` row per event, in the same txn. | The transactional-outbox log is complete from day one; SP3 adds only the draining worker — no backfill gap. |
| 7 | **Set `events.project_id` on item events.** The handler has the project id; it populates the column. | Prerequisite for SP3's head-of-line-blocking `CHECK (aggregate_type <> 'item' OR project_id IS NOT NULL)`. |
| 8 | **A command is not a route.** Routes, MCP tools, and automations are all just callers of the command registry. A command may have zero routes (automation-only) and a route may dispatch to a command chosen from the body. | SP3 automations and SP4 MCP call commands in-process; HTTP is one caller among several. |

## 3. Architecture — the command/event core

Two registries and one pipeline. Everything mutating goes through it; every read
stays out of it.

```
route handler → parseEnvelope + parseBody → runCommand(db, cmd, envelope, input)
        │
        ▼   (one transaction)
   1. ledger check   SELECT commands WHERE id = commandId
                       → hit? return stored `result` verbatim (handler never runs)
   2. insert ledger  INSERT commands (id, aggregateType, aggregateId, actorId)
   3. run handler    handler(tx, input, ctx): reads/writes tables, calls ctx.emit(evt, payload)
   4. emit           validate payload vs the event's valibot schema; seq = max(seq)+1
                       per (aggregateType, aggregateId); INSERT events row + INSERT outbox row
   5. commit         UPDATE commands.result; COMMIT
```

**`defineEvent`** (`event/registry.ts`) — `{ kind, aggregateType, version, payload }`
where `payload` is a valibot schema. A central registry keyed by `kind`. `emit()`
looks the kind up, validates the payload, and **refuses an unregistered kind**.
This is the typed-lossless guarantee: a payload that fails its schema cannot be
written. `emit()` also writes the matching `outbox` row (decision 6).

**`defineCommand`** (`command/registry.ts`) —
`{ kind, input, aggregate, handler }` where `input` is a valibot schema,
`aggregate(input) → { type, id? }`, and `handler(tx, input, ctx)` holds the
domain logic and calls `ctx.emit(...)`. Also a central registry.

**`runCommand`** (`command/run-command.ts`) — opens the transaction, runs the
5-step pipeline, owns idempotency and the ledger. Routes never re-implement any
of it.

**Envelope** — in the JSON body on every mutation: `commandId` (required uuid),
`actorId` (required). Item patches add `expectedUpdatedAt`. `correlationId`
defaults to `commandId` for a top-level command; SP3 automations chain new
command ids under the same `correlationId`.

### 3.1 Two concurrency mechanisms, kept distinct

- **Item optimistic lock** — `items.updated_at` compared to `expectedUpdatedAt`
  in a compare-and-set update; a stale token → **HTTP 409**. Protects a single
  item's *state*. Lives in a shared `lockItem(tx, id, expectedUpdatedAt)` helper,
  not copy-pasted per route.
- **Stream integrity** — `unique(aggregate_type, aggregate_id, seq)`. `seq` is
  `max(seq)+1` per stream computed inside the txn; the unique index is the
  backstop if two txns race. A collision → serialization retry → surfaced as
  **409**. Protects the *ordering of the event log*.

### 3.2 Idempotency

The `commands` primary key is the client-supplied `commandId`. A replay is caught
by step 1's `SELECT` or collides on step 2's `INSERT`, and returns the stored
`result` without re-running the handler. Satisfies the exit criterion literally.

## 4. Command catalogue

Grouped by aggregate. Item commands write one event stream per item; config
commands write one stream per config entity.

### 4.1 item aggregate (`aggregate_type='item'`)

| Command | Route | Events emitted |
| --- | --- | --- |
| `item.create` | `POST /projects/:key/items` | `item.created` (carries the initial values snapshot) |
| `item.update` | `PATCH /items/:id` | `item.field_changed` (one per changed field), `item.reparented`, `item.archived` / `item.restored` |
| `item.comment` | `POST /items/:id/comments` | `comment.added` |
| `item.link` | `POST /links` | `item.linked` |
| `item.unlink` | `DELETE /links/:id` | `item.unlinked` |

`item.created` carries the full initial values snapshot; later edits are
`item.field_changed`. `item.field_changed` payload carries `fieldKey` **only** —
never `fieldId` (the stale-id trap the importer hit; see the predecessor spec
§6.3). Link/unlink emit on the **source item's** stream.

### 4.2 config aggregates

| Aggregate | Command | Route | Events |
| --- | --- | --- | --- |
| `field` | `field.create` | `POST /types/:typeId/fields` | `field.created`, `field.placed` |
| `field` | `field.update` | `PATCH /fields/:id` | `field.updated` |
| `option` | `option.create` | `POST /fields/:id/options` | `option.created` |
| `option` | `option.update` | `PATCH /options/:id` | `option.updated` |
| `transition` | `transition.create` | `POST /fields/:id/transitions` | `transition.created` |
| `transition` | `transition.delete` | `DELETE /transitions/:id` | `transition.deleted` |
| `link_type` | `linkType.create` | `POST /types/:typeId/link-types` | `link_type.created` |
| `scheme` | `scheme.fork` | `POST /schemes/:id/fork` | `scheme.forked` |
| `project` | `project.create` | `POST /projects` | `project.created` |
| `user` | `user.create` | `POST /users` | `user.created` |
| `view` | `view.create` | `POST /projects/:key/views` | `view.created` |
| `view` | `view.update` | `PATCH /views/:id` | `view.updated` |

`field.create` both creates the scheme-library field and places it on the type
(`field.created` + `field.placed`) — the type-owned→library reversal made
concrete.

## 5. Route map — all 24 legacy endpoints

| Old | New | Change |
| --- | --- | --- |
| `POST /projects/:key/tickets` | `POST /projects/:key/items` | renamed |
| `PATCH /tickets/:id` | `PATCH /items/:id` | renamed |
| `POST /tickets/:id/comments` | `POST /items/:id/comments` | renamed |
| `GET /tickets/:id/events` | `GET /items/:id/events` | renamed · read |
| `POST /projects/:key/statuses` | `POST /fields/:id/options` | replaced — a status is an option with a `kind` |
| `PATCH /statuses/:id` | `PATCH /options/:id` | replaced |
| `POST /projects/:key/status-transitions` | `POST /fields/:id/transitions` | replaced |
| `DELETE /status-transitions/:id` | `DELETE /transitions/:id` | replaced |
| `POST /projects` | `POST /projects` | same path, new impl |
| `POST /users` | `POST /users` | same |
| `POST /links` | `POST /links` | same |
| `DELETE /links/:id` | `DELETE /links/:id` | same |
| `POST /fields/:id/options` | `POST /fields/:id/options` | same |
| `PATCH /fields/:id` | `PATCH /fields/:id` | same |
| `PATCH /options/:id` | `PATCH /options/:id` | same |
| `POST /types/:typeId/fields` | `POST /types/:typeId/fields` | same (creates library field + placement) |
| `POST /types/:typeId/link-types` | `POST /types/:typeId/link-types` | same |
| `POST /schemes/:id/fork` | `POST /schemes/:id/fork` | same |
| `POST /projects/:key/views` | `POST /projects/:key/views` | same |
| `PATCH /views/:id` | `PATCH /views/:id` | same |
| `GET /projects` | `GET /projects` | read |
| `GET /projects/:key/board` | `GET /projects/:key/board` | read — new response shape |
| `GET /projects/:key/export` | `GET /projects/:key/export` | read |
| `GET /schema` | `GET /schema` | read |
| `GET /users` | `GET /users` | read |

The four status routes are the only endpoints with no successor path — statuses
are now options with a lifecycle `kind`. `POST /links` and
`POST /types/:typeId/fields` keep their old paths because their resources aren't
items.

## 6. Read path (no command, rebuilt on the new schema)

- **`renderValue`** loses its `statusId` branch entirely (`item_values` has no
  status column). `option_id` → `options.value`; the new `value_user_id` →
  `{ id, name }`; scalars unchanged. `value_date` backs both `date` and
  `datetime` fields — the field's `type` decides formatting.
- **`assembleItems`** — the old `field.type === 'multi_select'` special-case
  becomes structural. `item_values` already permits N rows per `(item, field)`
  for option/user fields (the `iv_option`/`iv_user` partial unique indexes), so
  assembly groups rows by field and returns an array when the field's
  `config.multiple` is set, a scalar otherwise. No `multi_select` field type.
- **`GET /items/:id/events`** reads the `events` table filtered to
  `aggregate_type='item'`, ordered by `seq`. Imported events (`version: 0`)
  render as history here identically to live ones.

**Board response shape changes** (SP4 web adapts): instead of `statuses[]` +
`transitions[]`, it returns the field library + `item_type_fields` placements,
the option sets/options **with their `kind`**, and `option_transitions` as the
workflow graph. Board columns and lifecycle rollups derive from `options.kind`.

## 7. Testing

Against the dedicated **`tickets_test`** DB (decision 5), migrated fresh per run.

Every `defineCommand` gets three tests — uniform because they all share
`runCommand`:

1. **happy path** — tables written *and* the exact typed events emitted with the
   right payloads.
2. **idempotency** — replay the same `commandId`; assert one ledger row, one set
   of events, and the stored `result` returned.
3. **concurrency** (item commands) — stale `expectedUpdatedAt` → 409; two
   commands racing the same stream → one wins, one retries.

Two cross-cutting guards:

- the event registry throws on an unregistered kind and on a payload that fails
  its schema;
- a static guard test asserting no route writes `events`/`commands`/`outbox`
  outside `runCommand`.

## 8. File structure

New under `apps/api/src/`:

| File | Responsibility |
| --- | --- |
| `command/registry.ts` | `defineCommand`, the command registry |
| `command/run-command.ts` | the transaction + 5-step pipeline + ledger/idempotency |
| `command/envelope.ts` | `parseEnvelope`, the `CommandEnvelope` type |
| `command/item/*.ts` | one file per item command handler |
| `command/config/*.ts` | one file per config command handler |
| `event/registry.ts` | `defineEvent`, `emit()` (writes `events` + `outbox`) |
| `event/seq.ts` | next-`seq`-per-stream |
| `event/kinds.ts` | every `defineEvent` declaration |
| `routes/items.routes.ts` | thin item routes (replaces `tickets.routes.ts`) |
| `read/assemble-items.ts`, `read/render-value.ts`, `read/board.ts` | rebuilt read path (replace `tickets/assemble-tickets.ts`, `tickets/render-value.ts`) |

Deleted: `events/write-event.ts`, `tickets/resolve-status.ts`,
`tickets/check-transition.ts`'s status coupling (rewritten against
`option_transitions`), and every hand-rolled `db.transaction` in a route.

## 9. Exit criteria

- `pnpm --filter @tickets/api typecheck` and `pnpm --filter @tickets/db typecheck`
  clean — **the API compiling is the headline of this sub-project.** Root
  `pnpm typecheck` still fails: `apps/web` and `apps/mcp` reference the old
  schema until SP4, and that is expected, not a regression.
- API test suite green against `tickets_test`.
- Every mutation writes exactly one `commands` ledger row and ≥1 typed `events`
  row (schema-validated), plus its `outbox` rows, in one transaction.
- A retried `commandId` is a no-op returning the first result.
- `GET /projects/:key/board` serves a project end-to-end on the new schema.

## 10. Deferrals

| Item | Where |
| --- | --- |
| `outbox` **worker** (`FOR UPDATE SKIP LOCKED`) | SP3 |
| `item_activity` projection + activity feed | SP3 |
| automations / first rule consumer | SP3 |
| `events.project_id` `CHECK` constraint | SP3 (SP2 populates the column) |
| `commands` result-index / retention | SP3+ if needed |
| web board/tiles/rollups, settings UI | SP4 |
| MCP tool renames (`create_ticket` → `create_item`) | SP4 |
| re-import from a fresh dump + flip `tickets` | SP4 |

## Types

Types named on this page, defined here for self-containment (see CLAUDE.md).

```ts
// The envelope carried in every mutation's JSON body.
interface CommandEnvelope {
  commandId: string;        // uuid, required — idempotency key
  actorId: number;          // required — who is acting
  correlationId?: string;   // defaults to commandId for a top-level command
  expectedUpdatedAt?: string; // item patches only — optimistic-lock token
}

// A registered event kind. `payload` is a valibot schema; TPayload is its output.
interface EventDef<TPayload> {
  kind: string;             // e.g. 'item.field_changed'
  aggregateType: string;    // 'item' | 'field' | 'option' | 'transition' | 'link_type'
                            // | 'scheme' | 'project' | 'user' | 'view'
  version: number;          // 1 for all SP2 events (0 is reserved for imported)
  payload: BaseSchema<TPayload>; // valibot schema; emit() validates against it
}

// A registered command. `input` is a valibot schema; TInput is its output.
interface CommandDef<TInput, TResult> {
  kind: string;
  input: BaseSchema<TInput>;
  aggregate: (input: TInput) => { type: string; id?: number };
  handler: (tx: DbExecutor, input: TInput, ctx: CommandContext) => Promise<TResult>;
}

// Passed to every handler; the only way to write events.
interface CommandContext {
  envelope: CommandEnvelope;
  emit<T>(event: EventDef<T>, payload: T): Promise<void>; // validates, writes events + outbox
}

// The pipeline entry point every route calls.
declare function runCommand<TInput, TResult>(
  db: Db,
  cmd: CommandDef<TInput, TResult>,
  envelope: CommandEnvelope,
  input: TInput,
): Promise<TResult>;

// `BaseSchema<T>` is valibot's schema type (`import * as v from 'valibot'`).
// `Db` / `DbExecutor` are the drizzle handles exported by `@tickets/db`.
```
