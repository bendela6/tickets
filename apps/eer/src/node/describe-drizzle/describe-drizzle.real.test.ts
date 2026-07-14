import { expect, it } from 'vitest';

import * as schema from '../../../../../packages/db/src/schema/index';

import { describeDrizzle } from './describe-drizzle';

it('describes the real 18-table schema with no unsupported constructs', () => {
  const d = describeDrizzle(schema as Record<string, unknown>, []);
  expect(d.tables).toHaveLength(18);
  expect(d.enums).toHaveLength(3);
  expect(d.unsupported).toEqual([]); // no relations/$defaultFn/$onUpdate in this repo
  expect(d.tables.flatMap((t) => t.columns).filter((c) => c.sqlType === 'serial')).toHaveLength(16);
});
