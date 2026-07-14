# Layer 1 — File structure

_Where everything lives. The rule: **a feature is a few colocated definition files**, and the plumbing
(routing, dispatch, validation, error mapping) is generic and written once._

---

## Monorepo

```
apps/
  api/         Fastify + Postgres — the whole backend (command/query/event/projection/consumer)
  web/         React 19 · TanStack Router/Query · the client
  mcp/         MCP server — thin adapter over the same commands/queries
packages/
  db/          Drizzle schema + client  (@tickets/db)
  core/        shared domain types + valibot schemas used by api, web, mcp  (@tickets/core)
```

`packages/core` is new: the event/command/query **schemas and types** live here so `web` and `mcp`
import the exact same contracts as `api` (one source of truth for shapes).

---

## `apps/api/src`

```
app.ts                      # Fastify bootstrap: plugins, error mapper, mount dispatch
context.ts                  # RequestContext (actor, commandId, tx runner)

http/
  routes.ts                 # thin: maps HTTP endpoints → command/query names
  auth.ts  errors.ts        # middleware: authN/Z, HttpError → status mapping

commands/                   # WRITE side — one file per command
  registry.ts               # defineCommand + register (the command registry)
  dispatch.ts               # generic: idempotency → validate → run → commit
  kinds/
    item-create.ts  item-patch.ts  item-reparent.ts  item-archive.ts
    comment-add.ts  reaction-add.ts  link-add.ts
    field-define.ts  field-attach.ts  field-detach.ts  type-create.ts …

queries/                    # READ side — one file per query
  registry.ts  dispatch.ts
  kinds/
    item-get.ts  board-list.ts  item-activity.ts  schema-graph.ts  field-library.ts …

events/                     # the event model (SSOT: ../1-events.md)
  registry.ts               # defineEvent + register
  dispatch.ts               # parse / project / activity / emit
  kinds/
    item-created.ts  field-changed.ts  comment-added.ts  link-added.ts
    type-field-attached.ts  field-created.ts  option-added.ts …

projections/                # read-model builders (inline write + rebuild job)
  item-values.ts  item-activity.ts  board.ts  rebuild.ts

consumers/                  # after-commit
  outbox-worker.ts  automations.ts  webhooks.ts

domain/                     # PURE logic — no Fastify, no tx
  aggregate/item.ts         # fold + invariants for the item aggregate
  vocab.ts                  # load scheme → types → reusable fields
  effective-field.ts        # definition ⊕ placement merge
  transitions.ts guards.ts  # workflow rules
  value.ts                  # value-type ↔ column mapping (buildValueRows/renderValue)

infra/
  event-store.ts  outbox.ts  snapshots.ts  db.ts  ids.ts  crypto.ts
```

### The three registries mirror each other

`commands/`, `queries/`, and `events/` each have `registry.ts` (the `define*` + `register` chain) and
`dispatch.ts` (generic execution reading the registry). Learn one, know all three.

---

## `apps/web/src`

```
routes/                     # TanStack Router route tree
api/
  client.ts                 # dispatch helpers → /api/commands, /api/queries (or REST)
  commands.ts  queries.ts   # typed hooks generated over @tickets/core schemas
features/
  board/  item/  schema-admin/  field-library/  activity/
components/                 # design-system primitives (Instrument)
```

`api/commands.ts` and `api/queries.ts` are typed against `@tickets/core`, so a new command's input type
is available on the client the moment its schema is defined.

---

## Where a new feature touches

| Add… | Files |
| --- | --- |
| a write action | `commands/kinds/x.ts` (+ its event def in `events/kinds/` if it emits a new kind) |
| a read | `queries/kinds/x.ts` |
| an event kind | `events/kinds/x.ts` — schema + optional `project`/`activity` |
| a projection | `projections/x.ts` + reference it from the event def's `project` |
| a consumer | `consumers/x.ts` registered on the outbox worker |

No central switch, route table edit, or validator map to touch — the registries are read generically.
