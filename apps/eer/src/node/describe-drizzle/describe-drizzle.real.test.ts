import { expect, it } from 'vitest';

import * as schema from '../../../../../packages/db/src/schema/index';

import { describeDrizzle } from './describe-drizzle';

it('describes the real 28-table schema with no unsupported constructs', () => {
  const d = describeDrizzle(schema as Record<string, unknown>, []);
  // 28 = the items platform's 22 + the 6 ai_* tables merged from main.
  expect(d.tables).toHaveLength(28);
  expect(d.enums).toHaveLength(8);
  expect(d.unsupported).toEqual([]); // no relations/$defaultFn/$onUpdate in this repo
  // 21 = 15 + the 6 ai_* serial ids. 15, not 17, on the platform side: events.id
  // and item_activity.id are bigserial (they outgrow int4), and the five
  // join/log tables (item_type_child_types, item_type_fields,
  // link_type_target_types, commands, outbox) have no serial key at all.
  expect(d.tables.flatMap((t) => t.columns).filter((c) => c.sqlType === 'serial')).toHaveLength(21);
});
