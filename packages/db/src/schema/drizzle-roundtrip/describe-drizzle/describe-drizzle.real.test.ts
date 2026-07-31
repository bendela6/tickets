import { expect, it } from 'vitest';

import * as schema from '../../index';

import { describeDrizzle } from './describe-drizzle';

it('describes the real 30-table schema with no unsupported constructs', () => {
  const d = describeDrizzle(schema as Record<string, unknown>, []);
  // 30 = the items platform's 22 (still public until Plan 2) + core.workdirs
  // + the 2 terminal.* tables + the 4 agent.* tables + records.attachments.
  // The 5 legacy public ai_* tables were deleted in Task 11 once nothing read
  // them.
  expect(d.tables).toHaveLength(30);
  // 8 = user_kind, status_kind, field_type (public) + core.runner_kind
  // + terminal.session_status + agent.{session_status,permission_mode,
  // permission_status}. The 4 legacy public enums went with the ai_* tables.
  expect(d.enums).toHaveLength(8);
  expect(d.unsupported).toEqual([]); // no relations/$defaultFn/$onUpdate in this repo
  // 23 = 15 + core.workdirs' serial id + the 2 terminal.* serial ids + the 4
  // agent.* serial ids + records.attachments' serial id. 15, not 17, on the
  // platform side: events.id and item_activity.id are bigserial (they outgrow
  // int4), and the five join/log tables (item_type_child_types,
  // item_type_fields, link_type_target_types, commands, outbox) have no serial
  // key at all.
  expect(d.tables.flatMap((t) => t.columns).filter((c) => c.sqlType === 'serial')).toHaveLength(23);
});
