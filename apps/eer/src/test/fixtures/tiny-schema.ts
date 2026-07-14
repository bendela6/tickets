// A small, hand-written drizzle schema used as the round-trip gate fixture
// (see export-drizzle.test.ts, Step 5 of task-6-brief.md). Authored in an
// ordinary hand-written style (a plain string default) rather than the
// exporter's own house style, so the gate proves the round-trip is SEMANTIC
// (same Postgres objects), not textual.
//
// Covers: one enum, a serial PK (both tables), a composite FK with
// ON DELETE CASCADE, a partial unique index, and a CHECK constraint.
//
// NOTE on `isActive`'s default: written as `sql`true`` rather than the more
// obvious bare `.default(true)`. Both compile to the identical `DEFAULT
// true` DDL, but drizzle-kit's OWN snapshot generator (generateDrizzleJson,
// used by Gate B) represents them differently in its JSON: a bare JS literal
// default is stored as a native JSON boolean (`"default": true`), while ANY
// `sql`…`` default — even one whose text is literally "true" — is stored as
// a STRING (`"default": "true"`). generateMigration's differ then treats
// `true !== "true"` as a real change and emits `ALTER COLUMN ... SET DEFAULT
// true` — a false positive purely in drizzle-kit's source-level diffing, not
// a real difference in what reaches Postgres. Since the exporter's spec (see
// export-drizzle.ts) always re-emits every default through `sql`…`` — never
// guessing whether the stored text was a JS literal or a SQL expression —
// authoring the ORIGINAL side the same way keeps this fixture apples-to-
// apples. See task-6-report.md for the general finding: any hand-written
// bare-literal boolean/numeric default (e.g. `@tickets/db`'s
// `.default(false)` columns) will trip this same drizzle-kit quirk against
// re-generated output, independent of anything this exporter does.
import { sql } from 'drizzle-orm';
import { boolean, check, foreignKey, integer, pgEnum, pgTable, primaryKey, serial, text, uniqueIndex } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['admin', 'member']);

export const accounts = pgTable(
  'accounts',
  {
    id: serial('id'),
    slug: text('slug').notNull(),
    region: text('region').notNull(),
    role: roleEnum('role').notNull().default('member'),
  },
  (t) => [primaryKey({ columns: [t.id] }), uniqueIndex('accounts_slug_region_key').on(t.slug, t.region)],
);

export const memberships = pgTable(
  'memberships',
  {
    id: serial('id'),
    accountSlug: text('account_slug').notNull(),
    accountRegion: text('account_region').notNull(),
    userRole: roleEnum('user_role'),
    isActive: boolean('is_active').notNull().default(sql`true`),
    seq: integer('seq').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.id] }),
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
