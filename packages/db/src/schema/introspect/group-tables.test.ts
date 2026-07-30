import { describe, expect, it } from 'vitest';
import { groupTables } from './group-tables';

type Input = Parameters<typeof groupTables>[0][number];

const table = (name: string, schema: string | null = null): Input => ({
  name,
  schema,
  columns: [],
  primaryKey: [],
  uniques: [],
  checks: [],
  indexes: [],
});

describe('groupTables', () => {
  it('gives a curated table its configured group', () => {
    const { tables, groups } = groupTables([table('items')]);
    expect(tables[0]!.group).toBe('rc');
    expect(groups.find((g) => g.key === 'rc')?.label).toBe('Records');
  });

  it('keeps the curated grouping that ignores a table real schema', () => {
    // core.users renders in WORKSPACE, not WORKDIRS — see schema-groups.ts.
    const { tables } = groupTables([table('users', 'core')]);
    expect(tables[0]!.group).toBe('ws');
  });

  it('falls back to a per-namespace group for an unknown table', () => {
    const { tables, groups } = groupTables([table('audit_log', 'billing')]);
    expect(tables[0]!.group).toBe('ns:billing');
    const fallback = groups.find((g) => g.key === 'ns:billing')!;
    expect(fallback.label).toBe('BILLING');
    expect(fallback.tables).toEqual(['billing.audit_log']);
  });

  it('groups an unknown public table under ns:public', () => {
    const { tables } = groupTables([table('legacy_rows')]);
    expect(tables[0]!.group).toBe('ns:public');
  });

  it('emits only Instrument option hue names as colours', () => {
    const valid = new Set([
      'gray', 'red', 'orange', 'yellow', 'green',
      'teal', 'cyan', 'blue', 'indigo', 'purple', 'pink',
    ]);
    const { groups } = groupTables([
      table('items'),
      table('a', 'one'),
      table('b', 'two'),
      table('c', 'three'),
    ]);
    for (const g of groups) expect(valid.has(g.color)).toBe(true);
  });

  it('drops curated groups that matched nothing', () => {
    const { groups } = groupTables([table('audit_log', 'billing')]);
    expect(groups.every((g) => g.tables.length > 0)).toBe(true);
    expect(groups.some((g) => g.key === 'rc')).toBe(false);
  });

  it('lists group tables by qualified name', () => {
    const { groups } = groupTables([table('sessions', 'terminal')]);
    const group = groups.find((g) => g.tables.length > 0)!;
    expect(group.tables).toContain('terminal.sessions');
  });
});
