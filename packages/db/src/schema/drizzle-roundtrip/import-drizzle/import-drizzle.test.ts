import { describe, expect, it } from 'vitest';

import type { SchemaDescription } from '../describe-drizzle';
import { importDrizzle } from './import-drizzle';

const DESC: SchemaDescription = {
  tables: [
    {
      schema: null,
      name: 'users',
      columns: [
        { name: 'id', sqlType: 'serial', notNull: true, default: null, identity: null, generated: null },
        { name: 'email', sqlType: 'text', notNull: true, default: null, identity: null, generated: null },
      ],
      primaryKey: { name: null, columns: ['id'] },
      uniques: [],
      checks: [],
      foreignKeys: [],
      indexes: [],
    },
    {
      schema: null,
      name: 'posts',
      columns: [
        { name: 'id', sqlType: 'serial', notNull: true, default: null, identity: null, generated: null },
        { name: 'author_id', sqlType: 'integer', notNull: true, default: null, identity: null, generated: null },
      ],
      primaryKey: { name: null, columns: ['id'] },
      uniques: [],
      checks: [],
      foreignKeys: [
        {
          name: 'posts_author_id_users_id_fk',
          columns: ['author_id'],
          refSchema: null,
          refTable: 'users',
          refColumns: ['id'],
          onDelete: 'cascade',
          onUpdate: null,
        },
      ],
      indexes: [],
    },
  ],
  enums: [],
  groups: [
    { key: 'workspace', label: 'Workspace', color: '#7aa2ff', tables: ['users'] },
    { key: 'structure', label: 'Structure', color: '#22c55e', tables: ['posts'] },
  ],
  unsupported: [],
};

const DESC_WITH_EXTRA_COLUMN: SchemaDescription = {
  ...DESC,
  tables: [
    {
      ...DESC.tables[0]!,
      columns: [
        ...DESC.tables[0]!.columns,
        { name: 'nickname', sqlType: 'text', notNull: false, default: null, identity: null, generated: null },
      ],
    },
    DESC.tables[1]!,
  ],
};

const DESC_MINUS_POSTS: SchemaDescription = {
  ...DESC,
  tables: [DESC.tables[0]!],
  groups: [DESC.groups[0]!],
};

// ---- Finding 1: constraints / indexes / identity / generated must count as changes ----

const DESC_WITH_INDEX: SchemaDescription = {
  ...DESC,
  tables: [
    DESC.tables[0]!,
    {
      ...DESC.tables[1]!,
      indexes: [
        {
          name: 'posts_author_id_idx',
          columns: [{ expression: 'author_id', isExpression: false, order: null, nulls: null, opClass: null }],
          unique: false,
          method: null,
          only: false,
          where: null,
        },
      ],
    },
  ],
};

const DESC_WITH_UNIQUE_INDEX: SchemaDescription = {
  ...DESC_WITH_INDEX,
  tables: [
    DESC_WITH_INDEX.tables[0]!,
    { ...DESC_WITH_INDEX.tables[1]!, indexes: [{ ...DESC_WITH_INDEX.tables[1]!.indexes[0]!, unique: true }] },
  ],
};

const DESC_WITH_UNIQUE_CONSTRAINT: SchemaDescription = {
  ...DESC,
  tables: [
    DESC.tables[0]!,
    { ...DESC.tables[1]!, uniques: [{ name: 'posts_author_id_unique', columns: ['author_id'], nullsNotDistinct: false }] },
  ],
};

const IDENTITY = {
  always: true,
  name: 'users_id_seq',
  increment: '1',
  minValue: '1',
  maxValue: '2147483647',
  startWith: '1',
  cache: '1',
  cycle: false,
};

const DESC_WITH_IDENTITY: SchemaDescription = {
  ...DESC,
  tables: [
    { ...DESC.tables[0]!, columns: [{ ...DESC.tables[0]!.columns[0]!, identity: IDENTITY }, DESC.tables[0]!.columns[1]!] },
    DESC.tables[1]!,
  ],
};

const DESC_WITH_GENERATED_NICKNAME: SchemaDescription = {
  ...DESC_WITH_EXTRA_COLUMN,
  tables: [
    {
      ...DESC_WITH_EXTRA_COLUMN.tables[0]!,
      columns: [
        DESC_WITH_EXTRA_COLUMN.tables[0]!.columns[0]!,
        DESC_WITH_EXTRA_COLUMN.tables[0]!.columns[1]!,
        {
          ...DESC_WITH_EXTRA_COLUMN.tables[0]!.columns[2]!,
          generated: { expression: 'upper(email)', stored: true },
        },
      ],
    },
    DESC_WITH_EXTRA_COLUMN.tables[1]!,
  ],
};

const DESC_WITH_LEGACY_MONEY: SchemaDescription = {
  tables: [
    {
      schema: null,
      name: 'orders',
      columns: [
        { name: 'id', sqlType: 'serial', notNull: true, default: null, identity: null, generated: null },
        { name: 'amount', sqlType: 'legacy_money', notNull: true, default: null, identity: null, generated: null },
      ],
      primaryKey: { name: null, columns: ['id'] },
      uniques: [],
      checks: [],
      foreignKeys: [],
      indexes: [],
    },
  ],
  enums: [],
  groups: [],
  unsupported: [],
};

describe('importDrizzle', () => {
  it('seeds zones and colours from the description on a first import', () => {
    const { model } = importDrizzle(DESC, null);
    expect(model.groups.map((g) => g.id)).toEqual(['workspace', 'structure']);
    expect(model.colors.get('workspace')).toBe('#7aa2ff');
  });

  it('derives the posts -> users relationship from the fk constraint', () => {
    const { model } = importDrizzle(DESC, null);
    expect(model.relationships).toHaveLength(1);
    expect(model.relationships[0]).toMatchObject({ source: 'users', target: 'posts', kind: 'fk' });
  });

  it('preserves zone, position, colour and column titles on re-import', () => {
    const first = importDrizzle(DESC, null).model;
    first.entityById.get('users')!.group = 'structure';
    first.entityById.get('users')!.columns[0]!.title = 'ID';
    const moved = new Map(first.colors).set('users', '#ff0000');

    const { model } = importDrizzle(DESC_WITH_EXTRA_COLUMN, { ...first, colors: moved });

    const users = model.entityById.get('users')!;
    expect(users.group).toBe('structure'); // not reset to the SCHEMA_GROUPS default
    expect(users.columns[0]!.title).toBe('ID'); // UI-only data survives
    expect(model.colors.get('users')).toBe('#ff0000');
    expect(users.columns).toHaveLength(DESC_WITH_EXTRA_COLUMN.tables[0]!.columns.length);
  });

  it('reports added, changed and removed tables with their canvas effect', () => {
    const before = importDrizzle(DESC, null).model;
    const { report } = importDrizzle(DESC_MINUS_POSTS, before);
    expect(report.removedTables).toEqual([
      { table: 'posts', detail: expect.any(String), canvasEffect: expect.stringContaining('leave the canvas') },
    ]);
  });

  it('drops the removed table from the returned model itself, not just the report', () => {
    const before = importDrizzle(DESC, null).model;
    const { model } = importDrizzle(DESC_MINUS_POSTS, before);
    expect(model.entityById.has('posts')).toBe(false);
    expect(model.entities.map((e) => e.id)).toEqual(['users']);
  });

  it('reports a changed column type', () => {
    const before = importDrizzle(DESC, null).model;
    const { report } = importDrizzle(DESC_WITH_EXTRA_COLUMN, before);
    expect(report.changedTables).toEqual([
      { table: 'users', detail: expect.stringContaining('nickname'), canvasEffect: expect.any(String) },
    ]);
    expect(report.addedTables).toEqual([]);
  });

  it('reports a brand new table as added, with an edge in its canvas effect when it carries a fk', () => {
    const { report } = importDrizzle(DESC, null);
    expect(report.addedTables).toEqual([
      { table: 'users', detail: expect.any(String), canvasEffect: expect.not.stringContaining('edge') },
      { table: 'posts', detail: expect.any(String), canvasEffect: expect.stringContaining('edge') },
    ]);
  });

  it('blocks export when a column type is unknown', () => {
    const { report } = importDrizzle(DESC_WITH_LEGACY_MONEY, null);
    expect(report.unknownTypes).toEqual([{ table: 'orders', column: 'amount', type: 'legacy_money' }]);
    expect(report.blocksExport).toBe(true);
  });

  it('does not block export when every type is known and nothing is unsupported', () => {
    const { report } = importDrizzle(DESC, null);
    expect(report.blocksExport).toBe(false);
    expect(report.unsupported).toEqual([]);
  });

  it('passes unsupported constructs straight through into the report and blocks export', () => {
    const descWithUnsupported: SchemaDescription = {
      ...DESC,
      unsupported: [
        { kind: 'relations', where: 'userRelations', detail: 'relations() has no SQL representation', blocksExport: true },
      ],
    };
    const { report } = importDrizzle(descWithUnsupported, null);
    expect(report.unsupported).toHaveLength(1);
    expect(report.blocksExport).toBe(true);
  });

  // ---- Finding 1: a table whose only delta is a constraint / index /
  // identity / generated change must still show up as CHANGED — the report
  // IS the consent, and these deltas are real SQL facts that land on Apply.

  it('reports a table as changed when only an existing index gains UNIQUE', () => {
    const before = importDrizzle(DESC_WITH_INDEX, null).model;
    const { report } = importDrizzle(DESC_WITH_UNIQUE_INDEX, before);
    expect(report.changedTables.map((r) => r.table)).toContain('posts');
  });

  it('reports a table as changed when a new unique constraint is added with no column delta', () => {
    const before = importDrizzle(DESC, null).model;
    const { report } = importDrizzle(DESC_WITH_UNIQUE_CONSTRAINT, before);
    expect(report.changedTables.map((r) => r.table)).toContain('posts');
  });

  it('reports a table as changed when a column gains an identity', () => {
    const before = importDrizzle(DESC, null).model;
    const { report } = importDrizzle(DESC_WITH_IDENTITY, before);
    expect(report.changedTables.map((r) => r.table)).toContain('users');
  });

  it('reports a table as changed when a column gains a generated expression', () => {
    const before = importDrizzle(DESC_WITH_EXTRA_COLUMN, null).model;
    const { report } = importDrizzle(DESC_WITH_GENERATED_NICKNAME, before);
    expect(report.changedTables.map((r) => r.table)).toContain('users');
  });

  // ---- Finding 2: colour overrides must not outlive their table ----

  it('prunes a colour override for a table that has since been removed', () => {
    const first = importDrizzle(DESC, null).model;
    const withOverride = new Map(first.colors).set('posts', '#123456');
    const { model } = importDrizzle(DESC_MINUS_POSTS, { ...first, colors: withOverride });
    expect(model.colors.has('posts')).toBe(false);
  });

  // ---- Finding 3: type comparison must go through the pg-types codec ----

  it('does not report a changed column when the sql type is only a codec-equivalent alias', () => {
    const base: SchemaDescription = {
      tables: [
        {
          schema: null,
          name: 'accounts',
          columns: [{ name: 'id', sqlType: 'integer', notNull: true, default: null, identity: null, generated: null }],
          primaryKey: { name: null, columns: ['id'] },
          uniques: [],
          checks: [],
          foreignKeys: [],
          indexes: [],
        },
      ],
      enums: [],
      groups: [],
      unsupported: [],
    };
    const reimport: SchemaDescription = {
      ...base,
      tables: [{ ...base.tables[0]!, columns: [{ ...base.tables[0]!.columns[0]!, sqlType: 'int4' }] }],
    };
    const before = importDrizzle(base, null).model;
    const { report } = importDrizzle(reimport, before);
    expect(report.changedTables).toEqual([]);
  });
});
