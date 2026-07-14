# Layer 1 — Events

_The log: the envelope, the kinds, the value types, the payloads, and the **registry** that makes
adding a kind a one-file change. SSOT for all event/payload shapes. Tables → [`2-schema.md`](2-schema.md)._

---

## Principles

1. **Facts, past tense** — `field.changed`, not `changeField`.
2. **Lossless** — payloads carry stable ids and raw values, never display labels alone.
3. **Value-only** — a source event carries the new `value`; the `before → after` diff is a *projection* concern.
4. **Closed core, open hatch** — a small value-type set + `json` for compounds until they earn a type.
5. **Versioned** — every event has `version`; upcast on read, never rewrite rows.
6. **One fact per event** — a multi-field save is N events + a shared `correlationId`, never a fat event.

---

## Envelope (`EventMeta`)

Fixed for every event; only `payload` varies by `kind` + `version`. The DB also assigns `id`
(`bigserial`) — the global commit cursor consumers poll.

```ts
type EventMeta = {
  aggregateType: 'ticket' | 'config';  // names the stream with aggregateId
  aggregateId: number;
  seq: number;                          // per-stream 1..n — order + optimistic concurrency
  version: number;                      // payload schema version (default 1)
  kind: EventKind;                      // registry-validated (see below)
  actorId: number;                      // → users
  at: string;                           // ISO-8601, server-assigned; display/sort only, not concurrency
  commandId: string;                    // uuid; client-supplied; ties to the commands ledger (trace)
  correlationId: string;                // uuid; groups one command's N events; default = commandId
  causedBy: number | null;              // parent event id (automations); null for human/API
  depth: number;                        // 0 = human/API; +1 per automation hop
  projectId: number | null;             // denorm for partition/retention/ACL; null for config streams
};
```

---

## Event kinds

Closed set — covers every ticket mutation; **derived** from the registry (`keyof typeof registry.defs`),
shown here for reference:

```
ticket.created · ticket.reparented · ticket.archived · ticket.unarchived
field.changed
comment.added · comment.edited · comment.deleted
reaction.added · reaction.removed
link.added · link.removed
```

Config kinds (`aggregate_type = 'config'`, audit-only, later): `field.created`, `option.renamed`, …

---

## Field types vs value types

Two catalogs at two layers. A type exists at the **value** layer only when the *data* differs — pure
format/validation/cardinality overlays live in the field's `config`.

**Field types** (`fields.type`, 8):

```
string · number · boolean · date · datetime · option · user · json
```

_(url/email/rich_text = `string` + `config.format`; single vs multi = `config.multiple`; workflow
transitions = `config.transitions` on an `option` field.)_

**Value types** (in `field.changed`, 7) — the field enum collapses to these:

| value `type` | `value` | → `ticket_values` | from field type(s) |
| --- | --- | --- | --- |
| `string` | `string \| null` | `value_text` | string |
| `number` | `string \| null` (precision) | `value_number` | number |
| `boolean` | `boolean \| null` | `value_bool` | boolean |
| `date` | `string \| null` (ISO 8601) | `value_date` | date · datetime |
| `option` | `number[]` | `option_id` (N rows) | option _(single = length ≤ 1)_ |
| `user` | `number[]` | `value_user_id` (N rows) | user |
| `json` | `unknown` | `value_json` | json _(compound)_ |

`date` + `datetime` share one value type; `option`/`user` cover single **and** multi.

**No separate status.** A workflow status is just an `option` field — its state machine lives in the
field's `config.transitions`, and each option carries its lifecycle kind (`todo`/`active`/`done`) in
`option.config`. There is no `statuses` table, `status_id`, or `status` value type.

---

## `field.changed` (valibot schema)

`type` is hoisted; `after` is a bare value shaped by it. One valibot **variant** is the SSOT — the
payload type is inferred from it, and the same schema validates at runtime.

```ts
import * as v from 'valibot';

export const FieldChangedSchema = v.variant('type', [
  v.object({ fieldId: v.number(), type: v.literal('string'),  value: v.nullable(v.string()) }),
  v.object({ fieldId: v.number(), type: v.literal('number'),  value: v.nullable(v.string()) }),  // numeric-as-string
  v.object({ fieldId: v.number(), type: v.literal('boolean'), value: v.nullable(v.boolean()) }),
  v.object({ fieldId: v.number(), type: v.literal('date'),    value: v.nullable(v.string()) }),   // ISO 8601
  v.object({ fieldId: v.number(), type: v.literal('option'),  value: v.array(v.number()) }),      // sorted unique; [] = cleared
  v.object({ fieldId: v.number(), type: v.literal('user'),    value: v.array(v.number()) }),
  v.object({ fieldId: v.number(), type: v.literal('json'),    value: v.unknown() }),
]);

export type FieldChanged = v.InferOutput<typeof FieldChangedSchema>;
```

```jsonc
{ "fieldId": 2, "type": "string", "value": "new title" }
{ "fieldId": 3, "type": "option", "value": [88] }         // priority OR status — both are option fields
{ "fieldId": 5, "type": "user",   "value": [] }           // assignee cleared
```

Only the new `value` (no `before`): the feed's diff is computed by the projection, which knows the
prior value as it folds ([layer 3](3-runtime.md)).

---

## Structural payloads

```ts
// ticket.created — skeleton; initial values follow as correlated field.changed events
{ projectId: number; typeId: number; number: number; parentId: number | null }

// ticket.reparented — from+to both kept (the one after-only exception):
//   'from' lets a consumer fix the OLD parent's rollup without a lookup (like links carrying both endpoints)
{ from: number | null; to: number | null }

// ticket.archived | ticket.unarchived
{}

// comment.added | comment.edited  (comment.deleted → { commentId })
{ commentId: number; body: string }

// reaction.added | reaction.removed  — natural key (commentId, emoji, actorId)
{ commentId: number; emoji: string }

// link.added — written on BOTH ticket streams, same correlationId; stable linkTypeId
{ linkId: number; linkTypeId: number; linkTypeKey?: string; sourceTicketId: number; targetTicketId: number }

// link.removed — both streams
{ linkId: number }
```

Each has its own valibot schema on its registry def (below).

---

## Multi-field commands

One API command → N events, all in one transaction:

- shared `correlationId`, consecutive `seq`;
- the feed groups by `correlationId` for the headline and expands per event for the diff.

Rejected: a single `fields.changed` array event — it splits every consumer into singular/plural paths.

---

## Registry

One self-contained entry per kind. The def owns its `kind` and its valibot `schema`; everything else
derives. Adding a kind is one new file + one `register` line.

### `defineEvent`

```ts
type StoredEvent<K extends string, S extends v.GenericSchema> =
  EventMeta & { id: number; kind: K; payload: v.InferOutput<S> };

type EventDef<K extends string, S extends v.GenericSchema> = {
  kind: K;
  schema: S;                                                          // valibot — validates + types the payload
  project?: (tx: DbExecutor, e: StoredEvent<K, S>) => Promise<void>;  // optional: fold into state
  activity?: (e: StoredEvent<K, S>, prior: TicketState) => ActivityRow;
  upcast?: Record<number, (old: unknown) => unknown>;                // version N → N+1
};

const defineEvent = <K extends string, S extends v.GenericSchema>(d: EventDef<K, S>) => d;

// events/kinds/field-changed.ts — payload schema + project + activity, all together
export const fieldChangedEvent = defineEvent({
  kind: 'field.changed',
  schema: FieldChangedSchema,
  project,
  activity,
});
```

### `register` + derived types

The `.register()` chain accumulates types, so the maps stay exact (keep it **one expression** — that's
the condition for the closed-set guarantees):

```ts
export const registry = new Registry()
  .register(ticketCreatedEvent)
  .register(fieldChangedEvent)
  .register(linkAddedEvent);
  // …one line per kind

export type EventKind   = keyof typeof registry.defs;
export type PayloadFor<K extends EventKind> = v.InferOutput<(typeof registry.defs)[K]['schema']>;
export type AnyDomainEvent = { [K in EventKind]: EventMeta & { kind: K; payload: PayloadFor<K> } }[EventKind];
```

### One file per action

```
events/
  registry.ts   ← Registry + defineEvent + the .register chain
  dispatch.ts   ← parse / project / activity / emit (generic; read the registry)
  kinds/
    field-changed.ts   comment-added.ts   link-added.ts   …
```

- **Add** → new `kinds/x.ts` + one `.register(xEvent)` line.
- **Update** → edit that one file.
- **Remove** → delete the file + its line (compiler flags stale `emit`s).

### Remove caveat (append-only)

The log is immutable, so a kind is never *gone* — old rows remain. "Remove" = stop emitting it, but
keep the def's `schema` + `upcast` (or a tombstone) so replay/history reads still work.

---

## Versioning / upcast

`payload` shapes evolve; rows are never rewritten. Each kind's `upcast` map lives on its def; readers
migrate on load:

```ts
const load = (e) => {
  let p = e.payload;
  const up = registry.defs[e.kind].upcast;
  for (let vN = e.version; up?.[vN]; vN++) p = up[vN](p);
  return p;                       // now the current shape → v.parse(def.schema, p)
};
```

---

## Emit + validate

`kind` and `payload` can't mismatch; validation is `v.parse(def.schema, …)` on write:

```ts
export function emit<K extends EventKind>(kind: K, payload: PayloadFor<K>, meta: EmitMeta): void;

// dispatch reads the registry — no switch to maintain
export const parse = <K extends EventKind>(kind: K, raw: unknown) =>
  v.parse(registry.defs[kind].schema, raw) as PayloadFor<K>;
```

Domain checks beyond shape (field ∈ type, option ∈ field, legal transition) run in the write path
([layer 3](3-runtime.md)).

---

## Types

`EventMeta`, `EventDef`, `StoredEvent`, `registry`, `EventKind`, `PayloadFor`, `AnyDomainEvent`,
`FieldChanged` are defined above. `DbExecutor` is exported from `@tickets/db`; `TicketState`,
`ActivityRow`, `EmitMeta` from the runtime layer.
