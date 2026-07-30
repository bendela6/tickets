import { describe, expect, it } from 'vitest';
import { UnknownDatabaseError } from '../list-databases';
import { introspectDatabase } from './introspect-database';

describe('introspectDatabase', () => {
  it('returns a SchemaGraph for a real database', async () => {
    const graph = await introspectDatabase('tickets_test');
    expect(Array.isArray(graph.tables)).toBe(true);
    expect(Array.isArray(graph.groups)).toBe(true);
    expect(Array.isArray(graph.enums)).toBe(true);
    expect(graph.tables.length).toBeGreaterThan(0);
  });

  it('rejects an unknown database', async () => {
    await expect(introspectDatabase('no_such_db')).rejects.toBeInstanceOf(UnknownDatabaseError);
  });

  it('carries pk and fk onto columns', async () => {
    const graph = await introspectDatabase('tickets_test');
    const items = graph.tables.find((t) => t.name === 'items')!;
    expect(items.columns.find((c) => c.name === 'id')!.pk).toBe(true);

    const withFk = graph.tables.find((t) => t.columns.some((c) => c.fk !== null));
    expect(withFk).toBeDefined();
    const fkColumn = withFk!.columns.find((c) => c.fk !== null)!;
    expect(typeof fkColumn.fk!.table).toBe('string');
    expect(typeof fkColumn.fk!.column).toBe('string');
  });

  it('every group table resolves to a real table', async () => {
    const graph = await introspectDatabase('tickets_test');
    const ids = new Set(
      graph.tables.map((t) => (t.schema ? `${t.schema}.${t.name}` : t.name)),
    );
    for (const g of graph.groups) {
      for (const id of g.tables) expect(ids.has(id)).toBe(true);
    }
  });

  it('every table belongs to a group that exists', async () => {
    const graph = await introspectDatabase('tickets_test');
    const keys = new Set(graph.groups.map((g) => g.key));
    for (const t of graph.tables) expect(keys.has(t.group)).toBe(true);
  });

  it('agrees with the drizzle-derived graph on table names', async () => {
    // tickets_test is migrated from the same schema the code declares, so the
    // two paths must see the same tables. A mismatch here is real drift.
    const { describeSchema } = await import('../describe-schema');
    const live = await introspectDatabase('tickets_test');
    const declared = describeSchema();
    const liveIds = new Set(live.tables.map((t) => (t.schema ? `${t.schema}.${t.name}` : t.name)));
    for (const t of declared.tables) {
      const id = t.schema ? `${t.schema}.${t.name}` : t.name;
      expect(liveIds.has(id)).toBe(true);
    }
  });
});
