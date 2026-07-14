# Events — storage

Greenfield table names use **item**. No ticket_* tables.

## `events`

```ts
export const events = pgTable(
  'events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: integer('aggregate_id').notNull(),
    seq: integer('seq').notNull(),
    kind: text('kind').notNull(),
    version: integer('version').notNull().default(1),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    actorId: integer('actor_id').notNull().references(() => users.id),
    at: timestamp('at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    commandId: uuid('command_id').notNull(),
    correlationId: uuid('correlation_id').notNull(),
    causedBy: bigint('caused_by', { mode: 'number' }).references((): AnyPgColumn => events.id),
    depth: integer('depth').notNull().default(0),
    projectId: integer('project_id'),
  },
  (t) => [
    unique('events_stream_seq').on(t.aggregateType, t.aggregateId, t.seq),
    index('events_correlation').on(t.correlationId),
    index('events_command').on(t.aggregateType, t.aggregateId, t.commandId), // NOT unique
    index('events_caused_by').on(t.causedBy),
    index('events_project_at').on(t.projectId, t.at),
  ],
);
```

## `commands`

```ts
export const commands = pgTable('commands', {
  id: uuid('id').primaryKey(),
  aggregateType: text('aggregate_type').notNull(),
  aggregateId: integer('aggregate_id').notNull(),
  actorId: integer('actor_id').notNull().references(() => users.id),
  at: timestamp('at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  result: jsonb('result'),
});
```

## `outbox`

```ts
export const outbox = pgTable('outbox', {
  eventId: bigint('event_id', { mode: 'number' }).primaryKey().references(() => events.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  pickedAt: timestamp('picked_at', { withTimezone: true, mode: 'string' }),
  doneAt: timestamp('done_at', { withTimezone: true, mode: 'string' }),
});
```

## `item_activity`

```ts
export const itemActivity = pgTable(
  'item_activity',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    itemId: integer('item_id').notNull().references(() => items.id),
    eventId: bigint('event_id', { mode: 'number' }).notNull().unique().references(() => events.id),
    projectId: integer('project_id').notNull(),
    kind: text('kind').notNull(),
    actorId: integer('actor_id').notNull(),
    at: timestamp('at', { withTimezone: true, mode: 'string' }).notNull(),
    correlationId: uuid('correlation_id').notNull(),
    summary: jsonb('summary').notNull(), // { fieldId?, before?, after?, … }
  },
  (t) => [
    index('item_activity_item_at').on(t.itemId, t.at),
    index('item_activity_correlation').on(t.correlationId),
  ],
);
```

## `item_values` (hardened projection / SoT until Tier B)

```ts
// columns: item_id, field_id, value_text/number/date/bool/json, option_id, value_user_id
// NO status_id
// CHECK num_nonnulls(...) = 1
// partial uniques: scalar | option | user
// board filter indexes on field_id + value columns
```

## `item_snapshots` (Tier B)

`(item_id, through_seq)` PK + `state` jsonb.

## Related structure tables

See [../platform/5-database.md](../platform/5-database.md) and [../fields/](../fields/README.md).  
No `statuses` / `status_transitions`.
