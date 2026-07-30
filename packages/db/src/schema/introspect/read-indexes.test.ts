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

  it('resolves a mixed named+expression index via pg_get_indexdef, not string-slicing', async () => {
    // records.items is a column-free "skeleton" table (id/fks/timestamps
    // only, see items.ts) with no text column suitable for lower() — so this
    // uses core.projects instead, which has real text columns (key, name,
    // item_prefix).
    //
    // This is the one place in this plan a test runs DDL: it creates one
    // temporary index mixing a named column with an expression, reads it
    // back, then drops it unconditionally (both a pre-emptive drop in case a
    // prior run crashed before cleanup, and an unconditional drop in
    // `finally`) so a failing assertion can't leave it behind for other
    // suites sharing tickets_test.
    const { tables, indexes } = await withDatabase('tickets_test', async (sql) => {
      await sql`DROP INDEX IF EXISTS core.tmp_expr_idx`;
      await sql`CREATE INDEX tmp_expr_idx ON core.projects (scheme_id, lower(name))`;
      try {
        const tables = await readTables(sql);
        return { tables, indexes: await readIndexes(sql, tables) };
      } finally {
        await sql`DROP INDEX IF EXISTS core.tmp_expr_idx`;
      }
    });
    const projects = tables.find((t) => t.name === 'projects' && t.schema === 'core')!;
    expect(projects).toBeDefined();
    const ix = indexes.get(projects.oid)!.find((i) => i.name === 'tmp_expr_idx');
    expect(ix).toBeDefined();
    // Canonical Postgres rendering, confirmed by running this once against
    // the live catalog: the named column keeps its bare name; the expression
    // renders verbatim as `lower(name)` (pg_get_indexdef omits the table
    // qualifier for an index's own table). A string-slicing implementation
    // instead returns the WHOLE column list in the expression slot:
    // ['scheme_id', 'scheme_id, lower(name)'].
    expect(ix!.columns).toEqual(['scheme_id', 'lower(name)']);
  });
});
