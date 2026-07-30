import { describe, expect, it } from 'vitest';
import { withDatabase } from './connect';
import { readIndexes } from './read-indexes';
import { readTables } from './read-tables';

describe('readIndexes', () => {
  it('returns an entry for every table', async () => {
    const { tables, indexes } = await withDatabase('tickets_test', async (sql) => {
      const tables = await readTables(sql);
      return { tables, indexes: await readIndexes(sql, tables) };
    });
    for (const t of tables) expect(indexes.has(t.oid)).toBe(true);
  });

  it('names index columns rather than attnums, and carries the method', async () => {
    const { tables, indexes } = await withDatabase('tickets_test', async (sql) => {
      const tables = await readTables(sql);
      return { tables, indexes: await readIndexes(sql, tables) };
    });
    const withIndex = tables.find((t) => (indexes.get(t.oid)?.length ?? 0) > 0);
    expect(withIndex).toBeDefined();
    const ix = indexes.get(withIndex!.oid)![0]!;
    expect(ix.name.length).toBeGreaterThan(0);
    expect(ix.method).toBe('btree');
    for (const c of ix.columns) expect(c).not.toMatch(/^\d+$/);
  });

  it('excludes the primary key index', async () => {
    const { tables, indexes } = await withDatabase('tickets_test', async (sql) => {
      const tables = await readTables(sql);
      return { tables, indexes: await readIndexes(sql, tables) };
    });
    const items = tables.find((t) => t.name === 'items')!;
    expect(indexes.get(items.oid)!.some((ix) => ix.name === 'items_pkey')).toBe(false);
  });

  it('reports exactly the known non-primary indexes for records.items', async () => {
    // Concrete, not just "pkey absent": records.items has exactly three
    // non-pk indexes. Asserting the full set (not just non-membership of
    // items_pkey) catches a query that over- or under-selects for reasons
    // other than the primary-key exclusion.
    const { tables, indexes } = await withDatabase('tickets_test', async (sql) => {
      const tables = await readTables(sql);
      return { tables, indexes: await readIndexes(sql, tables) };
    });
    const items = tables.find((t) => t.name === 'items' && t.schema === 'records')!;
    expect(items).toBeDefined();
    const names = indexes.get(items.oid)!.map((ix) => ix.name).sort();
    expect(names).toEqual(['items_parent', 'items_project_number', 'items_project_type']);
  });
});
