import { sql } from 'drizzle-orm';
import { check, integer, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { schemes } from './schemes';
import { coreSchema } from './schemas';

export const projects = coreSchema.table(
  'projects',
  {
    id: serial('id').primaryKey(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    itemPrefix: text('item_prefix').notNull(),
    schemeId: integer('scheme_id')
      .notNull()
      .references(() => schemes.id),
    // The project's repository, the same for everyone: a git URL (https, ssh,
    // git@host:path). Where each developer has it checked out is theirs, kept
    // on their machine, never here. The API checks the URL's shape.
    repositoryUrl: text('repository_url'),
    // The branch work lands on. Null is the remote's own default (its HEAD).
    defaultBranch: text('default_branch'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('projects_key_unique').on(t.key),
    check('projects_branch_needs_repository', sql`default_branch IS NULL OR repository_url IS NOT NULL`),
  ],
);
