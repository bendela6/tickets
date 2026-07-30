// A hand-written drizzle schema exercising the FULL vocabulary the exporter
// and reader (export-drizzle.ts / describe-drizzle.ts / import-drizzle.ts)
// claim to support — deliberately including constructs the real 18-table
// schema (packages/db/src/schema/index.ts) never happens to use: varchar/char
// LENGTHS, a numeric with PRECISION+SCALE, foreign keys with onDelete AND
// onUpdate both set, a non-default index METHOD (gin), a partial index
// .where(), per-column .asc()/.desc()/.nullsFirst()/.nullsLast()/.op(), an
// identity column with non-default sequence options, and a Postgres SCHEMA
// NAMESPACE (pgSchema) — a table and an enum living outside public, plus a
// cross-schema foreign key in each direction.
//
// Why this file exists: the real-schema gate (roundtrip.gate.test.ts's first
// test) proves nothing about any of the above — the real schema simply
// doesn't contain them, so a reviewer proved the gate blind by disabling each
// emitter in export-drizzle.ts one at a time and watching the gate stay
// green. This fixture is the second gate's input; see task-7-report.md
// ("kitchen-sink fixture") for the full defect list it exposed.
//
// Authored in ordinary hand-written style (like tiny-schema.ts), NOT the
// exporter's own house style (camelCase idents, its own import grouping,
// etc.) — the point of the gate is to prove the round-trip is SEMANTIC (same
// Postgres objects), not textual.
import { sql } from 'drizzle-orm';
import {
  char,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgSchema,
  pgTable,
  primaryKey,
  serial,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

// pgEnum used by a column (widgets.status below).
export const statusEnum = pgEnum('status', ['open', 'closed', 'archived']);

// widgets: an INLINE single-column PK (id); varchar(n) and char(n); a numeric
// with precision+scale; a pgEnum column; a plain array column and a
// sized+nested array column; timestamp AND time, each WITH and WITHOUT time
// zone; a generatedAlwaysAs STORED column; a SELF-REFERENCING fk with BOTH
// onDelete and onUpdate set; a CHECK; a non-default-method (gin) index; a
// partial index exercising per-column asc/desc + nullsFirst/nullsLast + an
// .op() opClass together; and a uniqueIndex.
export const widgets = pgTable(
  'widgets',
  {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 20 }).notNull(),
    flag: char('flag', { length: 1 }),
    price: numeric('price', { precision: 10, scale: 2 }),
    status: statusEnum('status').notNull().default('open'),
    tags: text('tags').array(),
    matrix: integer('matrix').array(3).array(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
    createdAtNaive: timestamp('created_at_naive', { mode: 'string' }),
    startTime: time('start_time', { withTimezone: true }),
    startTimeNaive: time('start_time_naive'),
    fullName: text('full_name').generatedAlwaysAs(sql`code || flag`),
    parentId: integer('parent_id'),
  },
  (t) => [
    foreignKey({
      name: 'widgets_parent_fk',
      columns: [t.parentId],
      foreignColumns: [t.id],
    })
      .onDelete('set null')
      .onUpdate('cascade'),
    check('widgets_price_check', sql`price >= 0`),
    index('widgets_tags_gin_idx').using('gin', t.tags),
    index('widgets_code_status_idx')
      .on(t.code.asc().nullsLast().op('varchar_ops'), t.status.desc().nullsFirst())
      .where(sql`status <> 'archived'`),
    uniqueIndex('widgets_code_unique_idx').on(t.code),
  ],
);

// accounts / memberships: a table-level unique with nullsNotDistinct(); a
// COMPOSITE table-level primary key (memberships' (id, seq), which drizzle has
// no inline form for); a COMPOSITE fk with BOTH onDelete and onUpdate set.
export const accounts = pgTable(
  'accounts',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull(),
    region: text('region').notNull(),
  },
  (t) => [unique('accounts_slug_region_key').on(t.slug, t.region).nullsNotDistinct()],
);

export const memberships = pgTable(
  'memberships',
  {
    id: serial('id'),
    seq: integer('seq').notNull(),
    accountSlug: text('account_slug').notNull(),
    accountRegion: text('account_region').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.id, t.seq] }),
    foreignKey({
      name: 'memberships_account_fk',
      columns: [t.accountSlug, t.accountRegion],
      foreignColumns: [accounts.slug, accounts.region],
    })
      .onDelete('cascade')
      .onUpdate('restrict'),
  ],
);

// sequences_demo: an identity column with NON-DEFAULT sequence options (the
// real schema's 16 identity-ish serial columns never set any of these).
export const sequencesDemo = pgTable('sequences_demo', {
  id: integer('id')
    .primaryKey()
    .generatedAlwaysAsIdentity({
      name: 'sequences_demo_id_seq',
      increment: 2,
      minValue: 1,
      maxValue: 100000,
      startWith: 5,
      cache: 10,
      cycle: true,
    }),
  label: text('label'),
});

// ---- namespaces: a Postgres SCHEMA other than public (pgSchema) ----
//
// Entity.schema / EnumDecl.schema / fk refSchema / the schema-qualified
// entity id (`schema.name`, see tableId() in import-drizzle.ts) and the
// exporter's own pgSchema-const emission are all real, load-bearing
// machinery — but neither gate fixture had ever put a `pgSchema` in front of
// the round-trip, so a regression there could pass both gates silently. This
// section exercises: a table living IN a non-public schema (analytics.events),
// an enum declared IN that schema (analyticsEventTypeEnum — checked against
// drizzle-orm/pg-core's PgSchema.enum(), which exists in 0.45.2), a
// cross-schema fk FROM the namespaced table back to public (events -> public
// widgets), and the reverse direction (a public table -> the namespaced
// table: event_notes -> analytics.events).
export const analyticsSchema = pgSchema('analytics');

export const analyticsEventTypeEnum = analyticsSchema.enum('event_type', ['click', 'view', 'purchase']);

// analytics.events: lives in the non-public "analytics" schema; its own
// column is typed to an enum ALSO declared in that schema; its fk points
// back OUT to public.widgets (id) — the cross-schema direction that must
// survive as refSchema: 'public' (not null, and not 'analytics').
export const events = analyticsSchema.table(
  'events',
  {
    id: serial('id').primaryKey(),
    widgetId: integer('widget_id').notNull(),
    type: analyticsEventTypeEnum('type').notNull(),
  },
  (t) => [
    foreignKey({
      name: 'events_widget_fk',
      columns: [t.widgetId],
      foreignColumns: [widgets.id],
    }).onDelete('cascade'),
  ],
);

// event_notes: an ordinary PUBLIC table whose fk points INTO the "analytics"
// schema (analytics.events.id) — the reverse cross-schema direction.
export const eventNotes = pgTable(
  'event_notes',
  {
    id: serial('id').primaryKey(),
    eventId: integer('event_id').notNull(),
    note: text('note'),
  },
  (t) => [
    foreignKey({
      name: 'event_notes_event_fk',
      columns: [t.eventId],
      foreignColumns: [events.id],
    }).onDelete('cascade'),
  ],
);
