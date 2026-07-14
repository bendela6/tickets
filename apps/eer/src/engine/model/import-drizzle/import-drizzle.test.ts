import { describe, expect, it } from 'vitest';

import type { SchemaDescription } from '../../../node/describe-drizzle';
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
});
