import { describe, expect, it } from 'vitest';
import { withDatabase } from './connect';
import { readTables } from './read-tables';

describe('readTables', () => {
  it('reads user tables with their columns', async () => {
    const tables = await withDatabase('tickets_test', (sql) => readTables(sql));
    expect(tables.length).toBeGreaterThan(0);

    const items = tables.find((t) => t.name === 'items');
    expect(items).toBeDefined();
    expect(items!.columns.some((c) => c.name === 'id')).toBe(true);
  });

  it('carries the real namespace, and never the string "public"', async () => {
    // Every table in tickets_test lives in a named schema — there are no
    // public tables at all — so this asserts a real value, not a vacuous one.
    const tables = await withDatabase('tickets_test', (sql) => readTables(sql));
    expect(tables.find((t) => t.name === 'items')!.schema).toBe('records');
    // There are TWO `sessions` tables (agent.sessions and terminal.sessions);
    // `.find()` would silently pick whichever one comes first, so assert both
    // exist with their exact, distinct schemas rather than on a single match.
    const sessionsTables = tables.filter((t) => t.name === 'sessions');
    expect(sessionsTables.map((t) => t.schema).sort()).toEqual(['agent', 'terminal']);
    for (const t of tables) expect(t.schema).not.toBe('public');
  });

  it('excludes system catalogs and migration bookkeeping', async () => {
    const tables = await withDatabase('tickets_test', (sql) => readTables(sql));
    expect(tables.some((t) => t.schema === 'pg_catalog')).toBe(false);
    expect(tables.some((t) => t.schema === 'information_schema')).toBe(false);
    // drizzle.__drizzle_migrations is drizzle-kit's bookkeeping, not schema.
    expect(tables.some((t) => t.name === '__drizzle_migrations')).toBe(false);
    expect(tables.some((t) => t.schema === 'drizzle')).toBe(false);
  });

  it('orders columns by attnum', async () => {
    const tables = await withDatabase('tickets_test', (sql) => readTables(sql));
    for (const t of tables) {
      const nums = t.columns.map((c) => c.attnum);
      expect([...nums].sort((a, b) => a - b)).toEqual(nums);
    }
  });

  it('carries notNull off the catalog', async () => {
    const tables = await withDatabase('tickets_test', (sql) => readTables(sql));
    const items = tables.find((t) => t.name === 'items')!;
    expect(items.columns.find((c) => c.name === 'id')!.notNull).toBe(true);
  });
});
