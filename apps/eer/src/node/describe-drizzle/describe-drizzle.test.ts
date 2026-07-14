import { sql } from 'drizzle-orm';
import { check, index, integer, pgEnum, pgTable, serial, text, timestamp, unique, uniqueIndex } from 'drizzle-orm/pg-core';
import { expect, it } from 'vitest';

import { describeDrizzle } from './describe-drizzle';

const kind = pgEnum('kind', ['human', 'agent']);

const users = pgTable('users', {
  id: serial('id').primaryKey(),                       // inline PK + type-borne default
  email: text('email').notNull(),
  kind: kind('kind').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => [uniqueIndex('users_email_idx').on(t.email)]);

const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  authorId: integer('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  slug: text('slug'),
}, (t) => [
  unique('posts_slug_key').on(t.slug).nullsNotDistinct(),
  check('posts_slug_len', sql`length(slug) > 0`),
  index('posts_live_idx').on(t.slug).where(sql`slug IS NOT NULL`),
]);

const mod = { kind, users, posts };

it('never reports a serial column as a runtime default', () => {
  const d = describeDrizzle(mod, []);
  expect(d.unsupported.filter((u) => u.kind === 'default-fn')).toEqual([]);
});

it('normalises an inline primaryKey into a table-level pk', () => {
  const d = describeDrizzle(mod, []);
  expect(d.tables.find((t) => t.name === 'users')!.primaryKey!.columns).toEqual(['id']);
});

it('reads defaults as SQL text', () => {
  const d = describeDrizzle(mod, []);
  const col = d.tables.find((t) => t.name === 'users')!.columns.find((c) => c.name === 'created_at')!;
  expect(col.default).toBe('now()');
  expect(col.sqlType).toBe('timestamp with time zone');
});

it('reads fk actions, nullsNotDistinct, checks and a partial index', () => {
  const d = describeDrizzle(mod, []);
  const posts = d.tables.find((t) => t.name === 'posts')!;
  expect(posts.foreignKeys[0]).toMatchObject({ refTable: 'users', refColumns: ['id'], onDelete: 'cascade' });
  expect(posts.uniques[0]!.nullsNotDistinct).toBe(true);
  expect(posts.checks[0]).toMatchObject({ name: 'posts_slug_len', expression: 'length(slug) > 0' });
  expect(posts.indexes[0]).toMatchObject({ name: 'posts_live_idx', where: 'slug IS NOT NULL', method: 'btree' });
});

it('reads enums', () => {
  const d = describeDrizzle(mod, []);
  expect(d.enums).toEqual([{ name: 'kind', values: ['human', 'agent'], schema: null }]);
});

it('reports a $defaultFn column as unsupported and export-blocking', () => {
  const t = pgTable('t', { id: text('id').$defaultFn(() => 'x') });
  const d = describeDrizzle({ t }, []);
  expect(d.unsupported).toEqual([
    expect.objectContaining({ kind: 'default-fn', where: 't.id', blocksExport: true }),
  ]);
});
