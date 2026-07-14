// A small, hand-written drizzle schema used as the round-trip gate fixture
// (see export-drizzle.test.ts, Step 5 of task-6-brief.md). Authored in an
// ordinary hand-written style rather than the exporter's own house style, so
// the gate proves the round-trip is SEMANTIC (same Postgres objects), not
// textual.
//
// Covers: one enum, an INLINE single-column serial PK (accounts.id), a
// COMPOSITE table-level PK (memberships' (id, seq)), a composite FK with
// ON DELETE CASCADE, a partial unique index, a CHECK constraint, and both a
// bare `.default(true)` and a bare `.default(false)` boolean default.
//
// NOTE on the two PK shapes: `accounts.id` is authored INLINE
// (`serial('id').primaryKey()`) — the common hand-written style, and what
// `@tickets/db` uses on all 16 serial PKs. `memberships`' PK is COMPOSITE
// (`id`, `seq`), which drizzle has no inline form for at all, so it's
// authored table-level (`primaryKey({ columns: [...] })`). The exporter
// (export-drizzle.ts) must reproduce whichever shape the model actually
// describes: a single-column, unnamed pk -> inline; anything else (composite,
// or named) -> table-level. Getting this wrong isn't cosmetic — inline and
// table-level are different real Postgres constraint names (`t_pkey` vs.
// `t_id_pk`), and drizzle-kit's own `generateDrizzleJson` represents them
// differently too. See task-6-report.md, Finding 1, for the full story
// (including why an earlier draft of this fixture avoided inline PKs
// entirely, and why that was the wrong fix).
//
// NOTE on `isActive`/`archived`'s bare boolean defaults: these are ordinary
// `.default(true)` / `.default(false)` — no `sql`…`` wrapping needed. An
// earlier draft of this fixture wrapped `isActive`'s default in `sql`true``
// to dodge a drizzle-kit snapshot quirk (a bare boolean default is stored as
// a native JSON boolean, but ANY `sql`…`` default is stored as a JSON
// *string*, even when its rendered text is literally "true"/"false" — so
// diffing `true !== "true"` looked like a real migration). That workaround
// papered over a real exporter gap instead of fixing it. Finding 2 fixed the
// exporter instead: a **boolean** column whose default text is exactly
// "true"/"false" is now re-emitted as a bare literal, matching `@tickets/db`'s
// real `fields.required`/`fields.system` columns. See task-6-report.md.
import { sql } from 'drizzle-orm';
import { boolean, check, foreignKey, integer, pgEnum, pgTable, primaryKey, serial, text, uniqueIndex } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['admin', 'member']);

export const accounts = pgTable(
  'accounts',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull(),
    region: text('region').notNull(),
    role: roleEnum('role').notNull().default('member'),
  },
  (t) => [uniqueIndex('accounts_slug_region_key').on(t.slug, t.region)],
);

export const memberships = pgTable(
  'memberships',
  {
    id: serial('id'),
    accountSlug: text('account_slug').notNull(),
    accountRegion: text('account_region').notNull(),
    userRole: roleEnum('user_role'),
    isActive: boolean('is_active').notNull().default(true),
    archived: boolean('archived').notNull().default(false),
    seq: integer('seq').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.id, t.seq] }),
    foreignKey({
      name: 'memberships_account_fk',
      columns: [t.accountSlug, t.accountRegion],
      foreignColumns: [accounts.slug, accounts.region],
    }).onDelete('cascade'),
    uniqueIndex('memberships_active_account_idx')
      .on(t.accountSlug, t.accountRegion)
      .where(sql`is_active`),
    check('memberships_role_check', sql`user_role is not null or is_active = false`),
  ],
);
