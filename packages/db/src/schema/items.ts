import {
  index, integer, serial, timestamp, unique, type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { itemTypes } from './item-types';
import { projects } from './projects';
import { recordsSchema } from './schemas';
import { users } from './users';

// Pure skeleton — everything user-visible lives in item_values.
export const items = recordsSchema.table(
  'items',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id),
    typeId: integer('type_id')
      .notNull()
      .references(() => itemTypes.id),
    parentId: integer('parent_id').references((): AnyPgColumn => items.id),
    number: integer('number').notNull(),
    createdBy: integer('created_by')
      .notNull()
      .references(() => users.id),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    // doubles as the optimistic-lock token — always compare as text
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('items_project_number').on(t.projectId, t.number),
    index('items_project_type').on(t.projectId, t.typeId),
    index('items_parent').on(t.parentId),
  ],
);
