# Layer 2 — Routing & the request pipeline

_How a request becomes a durable change (write) or a read (query). Routing is thin; the work is in the
**command** and **query** registries, which mirror the **event** registry._

---

## Routing — thin dispatch

Routes don't contain logic; they map an HTTP endpoint to a **command** or **query** name and hand off.
REST URLs stay (familiar, cacheable), but each handler is one line:

```ts
// http/routes.ts
app.post('/api/items',            (req) => runCommand('item.create',  req.body, ctx(req)));
app.patch('/api/items/:id',       (req) => runCommand('item.patch',   { id: req.params.id, ...req.body }, ctx(req)));
app.post('/api/types/:id/fields', (req) => runCommand('type.attachField', { typeId: req.params.id, ...req.body }, ctx(req)));

app.get('/api/items/:id',         (req) => runQuery('item.get',      { id: req.params.id }, ctx(req)));
app.get('/api/boards/:projectId', (req) => runQuery('board.list',    req.params, ctx(req)));
```

_(Optional envelope form: `POST /api/commands/:name` + `POST /api/queries/:name` for a single generic
endpoint. Either way, routes are declarative.)_

---

## Command registry

One self-contained file per write action — input schema (valibot) + a pure-ish handler:

```ts
type CommandDef<I, O> = {
  name: string;
  input: v.GenericSchema<I>;                               // validates the request body
  handle: (tx: DbExecutor, input: I, ctx: Ctx) => Promise<O>;
};
const defineCommand = <I, O>(d: CommandDef<I, O>) => d;

export const itemPatch = defineCommand({
  name: 'item.patch',
  input: ItemPatchSchema,                                  // from @tickets/core
  handle: async (tx, input, ctx) => {
    const vocab = await loadVocab(tx, input.id);           // reusable-fields resolution
    const events = validateItemPatch(vocab, input, ctx);   // pure: field ∈ type, transitions, required
    return emitAll(tx, events, ctx);                       // append + project + outbox
  },
});
```

## Write pipeline

`commands/dispatch.ts` runs every command the same way — one transaction:

```
runCommand(name, body, ctx):
  input = v.parse(def.input, body)                 # 400 on bad shape
  BEGIN
    INSERT commands(id = ctx.commandId)            # idempotency → conflict = replay, return cached
    lock aggregate; load state/vocab
    output = def.handle(tx, input, ctx)            # → events
      for each event:
        v.parse(eventDef.schema, payload)          # event-registry validation
        INSERT events (seq, correlationId)         # append
        eventDef.project?(tx, stored)              # fold projections (item_values, …)
        eventDef.activity?(...) → INSERT item_activity
        INSERT outbox(eventId)                     # one bus
    bump updated_at
  COMMIT
  return output (+ etag)
```

The command handler only *decides which events*; appending, projecting, and outboxing are generic
(the event registry does the per-kind work). See [`../3-runtime.md`](../3-runtime.md).

---

## Query registry

Reads never touch events — they read **projections**:

```ts
export const boardList = defineQuery({
  name: 'board.list',
  input: BoardListSchema,
  handle: (db, { projectId, view }) => readBoard(db, projectId, view),  // from item_values + board read model
});
```

## Read pipeline

```
runQuery(name, body, ctx):
  input = v.parse(def.input, body)
  authorize(ctx, input)
  return def.handle(db, input, ctx)                # plain reads from projections
```

No locks, no transaction — projections are the current state (Tier B) or the authoritative tables
(Tier 0/A). Either way the query is a straight read; the feed is `item_activity` (one indexed query).

---

## Cross-cutting

| Concern | Where | How |
| --- | --- | --- |
| AuthN/Z | `http/auth.ts` + per-def `authorize` | actor on `ctx`; commands/queries can declare required scope |
| Validation | valibot schemas on every def | shape at the edge; domain rules in the handler |
| Idempotency | write dispatch | `commands` ledger; retries return cached result |
| Errors | `http/errors.ts` | `HttpError` → status; replay → 200/201; conflict → 409; bad shape → 400 |
| Context | `context.ts` | `{ actorId, commandId, correlationId, tx }` threaded through |
| Automations | `consumers/` | re-enter the **same** command dispatch (agent actor, `causedBy`/`depth`) |

---

## Why registries for commands/queries too (not just events)

- **Uniform** — validation, idempotency, error mapping, and tracing are written once in `dispatch.ts`.
- **Thin routes** — no logic to drift; the route table is a map of URL → name.
- **Shared contracts** — the input schemas live in `@tickets/core`, so `web` and `mcp` call the same commands with the same types.
- **One-file features** — a new endpoint is a new def; the dispatcher already knows how to run it.
