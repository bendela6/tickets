# Layer 2 — Schema

_The tables. Grounded in the current Drizzle schema; owns all DDL. Event/payload shapes →
[`1-events.md`](1-events.md); phase order → [`4-migration-plan.md`](4-migration-plan.md)._

---

## `fields` — slim enum

Only the enum changes; the table keeps its shape. Formats and cardinality ride in `config`.

```ts
export const fieldTypeEnum = pgEnum('field_type', [
  'string',    // text / rich_text / url / email — format in config
  'number',
  'boolean',
  'date',
  'datetime',
  'option',    // select / multi_select — cardinality in config
  'user',      // single / multi        — cardinality in config
  'json',
  // removed: 'status' → a workflow field is an `option` with config.transitions
]);
```

```jsonc
{ "type": "string", "config": { "format": "url" } }
{ "type": "option", "config": { "multiple": false, "transitions": [ /* … */ ] } }
{ "type": "user",   "config": { "multiple": true } }
```

---

## `events` — the log

Generalizes `ticket_events`. **No unique on `command_id`** — idempotency is the `commands` ledger,
because one command emits many events.

```ts
export const events = pgTable(
  'events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),          // global cursor
    aggregateType: text('aggregate_type').notNull(),               // 'ticket' | 'config'
    aggregateId: integer('aggregate_id').notNull(),
    seq: integer('seq').notNull(),                                 // per-stream order + concurrency
    kind: text('kind').notNull(),
    version: integer('version').notNull().default(1),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`), // after only
    actorId: integer('actor_id').notNull().references(() => users.id),
    at: timestamp('at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    commandId: uuid('command_id').notNull(),                       // trace; NON-unique here
    correlationId: uuid('correlation_id').notNull(),               // default = commandId
    causedBy: bigint('caused_by', { mode: 'number' }).references((): AnyPgColumn => events.id),
    depth: integer('depth').notNull().default(0),
    projectId: integer('project_id'),                              // ticket streams only; NULL for config
  },
  (t) => [
    unique('events_stream_seq').on(t.aggregateType, t.aggregateId, t.seq), // order + optimistic lock
    index('events_correlation').on(t.correlationId),
    index('events_command').on(t.aggregateType, t.aggregateId, t.commandId), // trace, NOT unique
    index('events_caused_by').on(t.causedBy),
    index('events_project_at').on(t.projectId, t.at),
    index('events_ticket_at').on(t.aggregateType, t.aggregateId, t.at),      // feed fallback
  ],
);
```

---

## `commands` — idempotency ledger

One row per accepted command. A retried `commandId` collides here and the whole command is a no-op.

```ts
export const commands = pgTable('commands', {
  id: uuid('id').primaryKey(),                                     // client-supplied commandId
  aggregateType: text('aggregate_type').notNull(),
  aggregateId: integer('aggregate_id').notNull(),
  actorId: integer('actor_id').notNull().references(() => users.id),
  at: timestamp('at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  result: jsonb('result'),                                         // optional cached response for safe retries
});
```

---

## `outbox` — reliable delivery

One row per event, written in the **same transaction**. A single worker drains it in `id` order, so
consumers can't miss mid-transaction events (which `bigserial` gaps would otherwise cause).

```ts
export const outbox = pgTable('outbox', {
  eventId: bigint('event_id', { mode: 'number' }).primaryKey().references(() => events.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  pickedAt: timestamp('picked_at', { withTimezone: true, mode: 'string' }),
  doneAt: timestamp('done_at', { withTimezone: true, mode: 'string' }),
});
```

---

## `ticket_activity` — feed projection

Denormalized so source events stay `after`-only. Written **inline** in the command txn (v1).

```ts
export const ticketActivity = pgTable(
  'ticket_activity',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    ticketId: integer('ticket_id').notNull().references(() => tickets.id),
    eventId: bigint('event_id', { mode: 'number' }).notNull().unique().references(() => events.id),
    projectId: integer('project_id').notNull(),
    kind: text('kind').notNull(),
    actorId: integer('actor_id').notNull(),
    at: timestamp('at', { withTimezone: true, mode: 'string' }).notNull(),
    correlationId: uuid('correlation_id').notNull(),
    summary: jsonb('summary').notNull(),                          // { fieldId?, before?, after?, … }
  },
  (t) => [
    index('ticket_activity_ticket_at').on(t.ticketId, t.at),
    index('ticket_activity_correlation').on(t.correlationId),
  ],
);
```

---

## `ticket_values` — hardened projection

Adds `value_user_id`, drops `status_id`, and enforces exactly-one-value + correct cardinality in the DB
(closes the NULL-distinct duplicate-row hole). The CHECK + partial uniques are **independent hardening**
and ship early ([P0](4-migration-plan.md)).

```ts
export const ticketValues = pgTable(
  'ticket_values',
  {
    id: serial('id').primaryKey(),
    ticketId: integer('ticket_id').notNull().references(() => tickets.id),
    fieldId: integer('field_id').notNull().references(() => fields.id),
    valueText: text('value_text'),
    valueNumber: numeric('value_number'),
    valueDate: timestamp('value_date', { withTimezone: true, mode: 'string' }),
    valueBool: boolean('value_bool'),
    valueJson: jsonb('value_json'),
    optionId: integer('option_id').references(() => fieldOptions.id),
    valueUserId: integer('value_user_id').references(() => users.id),   // NEW (P3)
    // no statusId — a workflow status is an option field (option_id)
  },
  (t) => [
    check('tv_one_value', sql`num_nonnulls(
      value_text, value_number, value_date, value_bool, value_json, option_id, value_user_id) = 1`),
    uniqueIndex('tv_scalar').on(t.ticketId, t.fieldId)
      .where(sql`option_id IS NULL AND value_user_id IS NULL`),          // one scalar row
    uniqueIndex('tv_option').on(t.ticketId, t.fieldId, t.optionId)
      .where(sql`option_id IS NOT NULL`),                                // multi-option, no NULLs
    uniqueIndex('tv_user').on(t.ticketId, t.fieldId, t.valueUserId)
      .where(sql`value_user_id IS NOT NULL`),                            // multi-user, no NULLs
    index('tv_field_text').on(t.fieldId, t.valueText),
    index('tv_field_number').on(t.fieldId, t.valueNumber),
    index('tv_field_date').on(t.fieldId, t.valueDate),
    index('tv_field_option').on(t.fieldId, t.optionId),
    index('tv_field_user').on(t.fieldId, t.valueUserId),
  ],
);
```

---

## `ticket_snapshots` — Tier B rebuild economy

Fold checkpoints so a hot ticket doesn't replay from `seq = 1`.

```ts
export const ticketSnapshots = pgTable(
  'ticket_snapshots',
  {
    ticketId: integer('ticket_id').notNull().references(() => tickets.id),
    throughSeq: integer('through_seq').notNull(),
    state: jsonb('state').notNull(),
  },
  (t) => [primaryKey({ columns: [t.ticketId, t.throughSeq] })],
);
```

---

## Config audit stream (open)

Config/vocab changes are **audit-only** — the tables stay authoritative, but every change emits an event
(no projector).

- `aggregate_type = 'config'`, `aggregate_id` = the fieldId / optionId / schemeId; `project_id` NULL.
- Kinds (draft, 🟡): `config.field.created` · `config.option.renamed` · `config.transition.changed` · `config.scheme.*`.

Gives "who changed the vocabulary, when" — and the context to interpret old ticket events — without
event-sourcing config.

---

## Compat view

```sql
CREATE VIEW ticket_events AS
SELECT id, aggregate_id AS ticket_id, actor_id, kind, payload, at AS created_at
FROM events WHERE aggregate_type = 'ticket';
```

Keeps [`use-ticket-events.ts`](../../apps/web/src/api/use-ticket-events.ts) and the `list_ticket_events`
MCP tool working; the API maps payloads for display where needed.

---

## Performance / partition / retention

- `bigserial` on `events` / `outbox` / `ticket_activity` — never `serial`.
- Append-only `events` → no HOT updates, vacuum-friendly.
- Avoid GIN on `payload` for the default feed; use `ticket_activity` / the ticket index.
- Partition later by `RANGE (at)` or `project_id`; archive cold partitions; keep snapshots at Tier B.

---

## Types

`fieldTypeEnum`, `events`, `commands`, `outbox`, `ticketActivity`, `ticketValues`, `ticketSnapshots`
are above. `tickets`, `users`, `fieldOptions`, `AnyPgColumn`, pg-core helpers come from the existing
schema.
