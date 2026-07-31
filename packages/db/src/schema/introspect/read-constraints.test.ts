import { describe, expect, it } from 'vitest';
import { withDatabase } from './connect';
import { readConstraints } from './read-constraints';
import { readTables } from './read-tables';

describe('readConstraints', () => {
  it('reads the primary key by column name', async () => {
    const { tables, constraints } = await withDatabase('tickets_test', async (sql) => {
      const tables = await readTables(sql);
      return { tables, constraints: await readConstraints(sql, tables) };
    });
    const items = tables.find((t) => t.name === 'items')!;
    expect(constraints.get(items.oid)!.primaryKey).toEqual(['id']);
  });

  it('resolves foreign keys to their referenced table and column', async () => {
    const { tables, constraints } = await withDatabase('tickets_test', async (sql) => {
      const tables = await readTables(sql);
      return { tables, constraints: await readConstraints(sql, tables) };
    });
    const withFk = tables.find((t) => (constraints.get(t.oid)?.fks.length ?? 0) > 0);
    expect(withFk).toBeDefined();
    const fk = constraints.get(withFk!.oid)!.fks[0]!;
    expect(typeof fk.column).toBe('string');
    expect(typeof fk.refTable).toBe('string');
    expect(typeof fk.refColumn).toBe('string');
    // Resolved names, never raw attnums.
    expect(fk.column).not.toMatch(/^\d+$/);
  });

  it("resolves a cross-schema foreign key to the REFERENCED table's schema", async () => {
    // terminal.sessions.workdir_id -> core.workdirs.id. refSchema must be
    // 'core' (the referenced table's schema) — if it were flipped to take
    // the referencing table's schema instead, this would read 'terminal'.
    const { tables, constraints } = await withDatabase('tickets_test', async (sql) => {
      const tables = await readTables(sql);
      return { tables, constraints: await readConstraints(sql, tables) };
    });
    const sessions = tables.find((t) => t.name === 'sessions' && t.schema === 'terminal')!;
    expect(sessions).toBeDefined();
    const fk = constraints.get(sessions.oid)!.fks.find((f) => f.column === 'workdir_id');
    expect(fk).toEqual({
      column: 'workdir_id',
      refSchema: 'core',
      refTable: 'workdirs',
      refColumn: 'id',
    });
  });

  it('resolves a self-referencing foreign key without mixing up local/foreign columns', async () => {
    // records.items.parent_id -> records.items.id (conrelid === confrelid).
    // A bug that swapped conkey/confkey resolution would surface here as
    // column and refColumn both resolving to the same name.
    const { tables, constraints } = await withDatabase('tickets_test', async (sql) => {
      const tables = await readTables(sql);
      return { tables, constraints: await readConstraints(sql, tables) };
    });
    const items = tables.find((t) => t.name === 'items' && t.schema === 'records')!;
    expect(items).toBeDefined();
    const fk = constraints.get(items.oid)!.fks.find((f) => f.column === 'parent_id');
    expect(fk).toEqual({
      column: 'parent_id',
      refSchema: 'records',
      refTable: 'items',
      refColumn: 'id',
    });
  });

  it('returns an entry for every table, even one with no constraints', async () => {
    const { tables, constraints } = await withDatabase('tickets_test', async (sql) => {
      const tables = await readTables(sql);
      return { tables, constraints: await readConstraints(sql, tables) };
    });
    for (const t of tables) {
      expect(constraints.has(t.oid)).toBe(true);
    }
  });

  it('renders check expressions as text', async () => {
    const { tables, constraints } = await withDatabase('tickets_test', async (sql) => {
      const tables = await readTables(sql);
      return { tables, constraints: await readConstraints(sql, tables) };
    });
    for (const t of tables) {
      for (const c of constraints.get(t.oid)!.checks) {
        expect(typeof c.expression).toBe('string');
        expect(c.expression.length).toBeGreaterThan(0);
      }
    }
  });
});
