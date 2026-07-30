import { describe, expect, it } from 'vitest';
import { withDatabase } from './connect';
import { readConstraints } from './read-constraints';
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

  it('reports exactly the standalone indexes for records.items', async () => {
    // Concrete, not just "pkey absent": records.items declares four index-
    // shaped objects — items_pkey, the items_project_number UNIQUE
    // CONSTRAINT, and the two plain indexes items_project_type and
    // items_parent (see schema/items.ts). Only the last two are this
    // reader's to report; the first two are constraints readConstraints
    // already returns, in `primaryKey` and `uniques` respectively.
    // Asserting the full set (not just non-membership) catches a query that
    // over- or under-selects for any reason.
    const { tables, indexes } = await withDatabase('tickets_test', async (sql) => {
      const tables = await readTables(sql);
      return { tables, indexes: await readIndexes(sql, tables) };
    });
    const items = tables.find((t) => t.name === 'items' && t.schema === 'records')!;
    expect(items).toBeDefined();
    const names = indexes.get(items.oid)!.map((ix) => ix.name).sort();
    expect(names).toEqual(['items_parent', 'items_project_type']);
  });

  it('excludes a unique constraint\'s backing index, which readConstraints owns', async () => {
    // The same double-counting argument as the pk: `unique('items_project_number')`
    // is reported by readConstraints in `uniques`, so its backing index must
    // not also appear here. Asserting against readConstraints' own output
    // (rather than a hardcoded name) states the invariant — no object is
    // reported by both readers.
    const { tables, indexes, constraints } = await withDatabase('tickets_test', async (sql) => {
      const tables = await readTables(sql);
      return {
        tables,
        indexes: await readIndexes(sql, tables),
        constraints: await readConstraints(sql, tables),
      };
    });
    const items = tables.find((t) => t.name === 'items' && t.schema === 'records')!;
    const uniqueNames = constraints.get(items.oid)!.uniques.map((u) => u.name);
    expect(uniqueNames).toContain('items_project_number');
    const indexNames = indexes.get(items.oid)!.map((ix) => ix.name);
    for (const name of uniqueNames) expect(indexNames).not.toContain(name);
  });

  it('still reports a standalone CREATE UNIQUE INDEX, which backs no constraint', async () => {
    // The exclusion keys on pg_constraint, not on indisunique — a unique
    // index created directly has no constraint row and is a real index the
    // diagram should show. Dropped unconditionally (and pre-emptively, in
    // case a prior run crashed) so it can't leak into other suites sharing
    // tickets_test.
    const { tables, indexes } = await withDatabase('tickets_test', async (sql) => {
      await sql`DROP INDEX IF EXISTS core.tmp_uniq_idx`;
      await sql`CREATE UNIQUE INDEX tmp_uniq_idx ON core.projects (key)`;
      try {
        const tables = await readTables(sql);
        return { tables, indexes: await readIndexes(sql, tables) };
      } finally {
        await sql`DROP INDEX IF EXISTS core.tmp_uniq_idx`;
      }
    });
    const projects = tables.find((t) => t.name === 'projects' && t.schema === 'core')!;
    const ix = indexes.get(projects.oid)!.find((i) => i.name === 'tmp_uniq_idx');
    expect(ix).toBeDefined();
    expect(ix!.unique).toBe(true);
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
