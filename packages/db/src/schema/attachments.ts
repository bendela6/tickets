import { customType, integer, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { recordsSchema } from './schemas';

// Drizzle has no built-in bytea; store/retrieve Buffers.
const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

// Editor image uploads. No item FK on purpose: a doc (description, comment,
// rich field) references an attachment by URL, and docs move between items.
export const attachments = recordsSchema.table('attachments', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  data: bytea('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});
