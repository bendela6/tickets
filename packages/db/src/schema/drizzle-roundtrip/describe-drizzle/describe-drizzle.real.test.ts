import { expect, it } from 'vitest';

import * as schema from '../../index';

import { describeDrizzle } from './describe-drizzle';

it('describes the real 24-table schema with no unsupported constructs', () => {
  const d = describeDrizzle(schema as Record<string, unknown>, []);
  // 24 = the items platform's 22 + records.attachments + core.agent_reports.
  expect(d.tables).toHaveLength(24);
  // 3 = user_kind, status_kind, field_type.
  expect(d.enums).toHaveLength(3);
  expect(d.unsupported).toEqual([]); // no relations/$defaultFn/$onUpdate in this repo
  // 16 = 15 + records.attachments' serial id. 15, not 17, on the platform
  // side: events.id and item_activity.id are bigserial (they outgrow int4),
  // and the five join/log tables (item_type_child_types, item_type_fields,
  // link_type_target_types, commands, outbox) have no serial key at all.
  expect(d.tables.flatMap((t) => t.columns).filter((c) => c.sqlType === 'serial')).toHaveLength(16);
});
