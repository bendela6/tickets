import { describe, expect, it } from 'vitest';
import { UnknownDatabaseError } from '../list-databases';
import { introspectDatabase } from './introspect-database';

type Graph = Awaited<ReturnType<typeof introspectDatabase>>;

// Look up by schema AND name — never by array position or "first match".
// `sessions` alone is ambiguous (both terminal.sessions and agent.sessions
// exist), and position-based lookups break silently whenever an unrelated
// table is added or reordered upstream.
function findTable(graph: Graph, schema: string | null, name: string) {
  const t = graph.tables.find((t) => t.schema === schema && t.name === name);
  if (!t) throw new Error(`table ${schema ?? 'public'}.${name} not found`);
  return t;
}

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

  // The fk-mapping and grouping bugs a wiring mistake would introduce live
  // entirely inside introspectDatabase's assembly step — readConstraints and
  // groupTables are already unit-tested elsewhere (read-constraints.test.ts
  // asserts refSchema concretely; group-tables.test.ts asserts group keys
  // concretely). What's untested is the WIRING between them: mapping a
  // RawFk onto ColumnMeta.fk, and actually calling groupTables rather than
  // some stub. These four tests target that seam directly, with concrete
  // expected values so a wiring regression can't hide behind a `typeof`
  // check or a trivially-satisfiable "resolves to something" assertion.

  it('wires a cross-schema fk end-to-end: terminal.sessions.workdir_id -> core.workdirs.id', async () => {
    const graph = await introspectDatabase('tickets_test');
    const sessions = findTable(graph, 'terminal', 'sessions');
    const workdirId = sessions.columns.find((c) => c.name === 'workdir_id')!;
    expect(workdirId.fk).toEqual({ schema: 'core', table: 'workdirs', column: 'id' });
  });

  it('wires a self-referencing fk end-to-end: records.items.parent_id -> records.items.id', async () => {
    const graph = await introspectDatabase('tickets_test');
    const items = findTable(graph, 'records', 'items');
    const parentId = items.columns.find((c) => c.name === 'parent_id')!;
    expect(parentId.fk).toEqual({ schema: 'records', table: 'items', column: 'id' });
  });

  it('assigns records.items its curated group, not a stub', async () => {
    const graph = await introspectDatabase('tickets_test');
    const items = findTable(graph, 'records', 'items');
    expect(items.group).toBe('rc');
    const records = graph.groups.find((g) => g.key === 'rc');
    expect(records).toBeDefined();
    expect(records!.label).toBe('Records');
    expect(records!.tables).toContain('records.items');
  });

  it('does not collapse every table into one group', async () => {
    const graph = await introspectDatabase('tickets_test');
    const distinctGroups = new Set(graph.tables.map((t) => t.group));
    expect(distinctGroups.size).toBeGreaterThan(1);

    // Two concrete tables that must land in different groups.
    const items = findTable(graph, 'records', 'items');
    const sessions = findTable(graph, 'terminal', 'sessions');
    expect(items.group).toBe('rc');
    expect(sessions.group).toBe('terminal');
    expect(items.group).not.toBe(sessions.group);
  });
});
