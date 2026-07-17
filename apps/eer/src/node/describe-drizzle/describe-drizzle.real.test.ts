import { expect, it } from 'vitest';

import * as schema from '../../../../../packages/db/src/schema/index';

import { describeDrizzle } from './describe-drizzle';

it('describes the real 34-table schema with no unsupported constructs', () => {
  const d = describeDrizzle(schema as Record<string, unknown>, []);
  // 34 = the items platform's 22 + the 6 ai_* tables merged from main + the 2
  // terminal.* tables Task 4 added + the 4 agent.* tables Task 5 added.
  expect(d.tables).toHaveLength(34);
  expect(d.enums).toHaveLength(12); // + terminal.session_status (Task 4) + agent.{session_status,permission_mode,permission_status} (Task 5)
  expect(d.unsupported).toEqual([]); // no relations/$defaultFn/$onUpdate in this repo
  // 27 = 15 + the 6 ai_* serial ids + the 2 terminal.* serial ids + the 4
  // agent.* serial ids. 15, not 17, on the platform side: events.id and
  // item_activity.id are bigserial (they outgrow int4), and the five
  // join/log tables (item_type_child_types, item_type_fields,
  // link_type_target_types, commands, outbox) have no serial key at all.
  expect(d.tables.flatMap((t) => t.columns).filter((c) => c.sqlType === 'serial')).toHaveLength(27);
});
