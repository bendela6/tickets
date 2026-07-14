import { expect, it } from 'vitest';

import * as schema from '../../../../../packages/db/src/schema/index';

import { describeDrizzle } from './describe-drizzle';

it('describes the real 22-table schema with no unsupported constructs', () => {
  const d = describeDrizzle(schema as Record<string, unknown>, []);
  expect(d.tables).toHaveLength(22);
  expect(d.enums).toHaveLength(3);
  expect(d.unsupported).toEqual([]); // no relations/$defaultFn/$onUpdate in this repo
  // 15, not 17: events.id and item_activity.id are bigserial (they outgrow
  // int4), and the five join/log tables (item_type_child_types,
  // item_type_fields, link_type_target_types, commands, outbox) have no serial
  // key at all.
  expect(d.tables.flatMap((t) => t.columns).filter((c) => c.sqlType === 'serial')).toHaveLength(15);
});
