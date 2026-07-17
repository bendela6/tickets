// packages/db/src/schema/independence.test.ts
import { getTableConfig } from 'drizzle-orm/pg-core';
import { expect, it } from 'vitest';
import { schemaOf } from './describe-schema';
import { allTables } from './registry';

// The invariant this whole split exists to buy. It gets a test, not a
// comment — three reviewers checking it by hand is not a gate; this is.
// Both `terminal` and `agent` may depend on `core`/public/session-core, but
// never on each other, in either direction.
it('no foreign key crosses terminal <-> agent in either direction', () => {
  const crossings: string[] = [];
  for (const table of allTables) {
    const from = schemaOf(table);
    if (from !== 'terminal' && from !== 'agent') continue;
    const other = from === 'terminal' ? 'agent' : 'terminal';
    const cfg = getTableConfig(table);
    for (const fk of cfg.foreignKeys) {
      const foreignTable = fk.reference().foreignTable;
      const target = schemaOf(foreignTable);
      if (target === other) {
        const targetName = getTableConfig(foreignTable).name;
        crossings.push(`${from}.${cfg.name} -> ${target}.${targetName}`);
      }
    }
  }
  expect(crossings).toEqual([]);
});
