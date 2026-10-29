// packages/db/src/schema/describe-schema.test.ts
import { describe, expect, it } from 'vitest';
import { pgSchema, pgTable, serial } from 'drizzle-orm/pg-core';
import { describeSchema, findGroupKey, resolveGroupKey, schemaOf } from './describe-schema';
import { SCHEMA_GROUPS, type SchemaGroup } from './schema-groups';

describe('describeSchema', () => {
  const graph = describeSchema();
  const byName = new Map(graph.tables.map((t) => [t.name, t]));

  it('includes comment_reactions, item_type_child_types, and comments', () => {
    expect(byName.has('comment_reactions')).toBe(true);
    expect(byName.has('item_type_child_types')).toBe(true);
    expect(byName.has('comments')).toBe(true);
  });

  it('derives a single-column FK', () => {
    const cr = byName.get('comment_reactions')!;
    const commentId = cr.columns.find((c) => c.name === 'comment_id')!;
    expect(commentId.fk).toEqual({ schema: 'records', table: 'comments', column: 'id' });
    expect(commentId.notNull).toBe(true);
  });

  it('derives a nullable self-FK', () => {
    const comments = byName.get('comments')!;
    const parentId = comments.columns.find((c) => c.name === 'parent_id')!;
    expect(parentId.fk).toEqual({ schema: 'records', table: 'comments', column: 'id' });
    expect(parentId.notNull).toBe(false);
  });

  it('reports the REFERENCED table\'s schema, not the referencing table\'s', () => {
    // records.items.created_by crosses into `core`, item_values.option_id into
    // `structure`: the fk carries the referenced side's own schema.
    const items = graph.tables.find((t) => t.schema === 'records' && t.name === 'items')!;
    expect(items.columns.find((c) => c.name === 'created_by')!.fk).toEqual({
      schema: 'core', table: 'users', column: 'id',
    });
    const values = graph.tables.find((t) => t.schema === 'records' && t.name === 'item_values')!;
    expect(values.columns.find((c) => c.name === 'option_id')!.fk).toEqual({
      schema: 'structure', table: 'options', column: 'id',
    });
  });

  it('derives a composite primary key', () => {
    const cct = byName.get('item_type_child_types')!;
    expect([...cct.primaryKey].sort()).toEqual(['child_type_id', 'parent_type_id']);
    expect(cct.columns.find((c) => c.name === 'parent_type_id')!.pk).toBe(true);
  });

  it('normalizes timestamp types', () => {
    const comments = byName.get('comments')!;
    expect(comments.columns.find((c) => c.name === 'created_at')!.type).toBe('timestamptz');
  });

  it('assigns every table to exactly one group', () => {
    for (const t of graph.tables) {
      expect(graph.groups.some((g) => g.key === t.group)).toBe(true);
    }
  });

  it('exposes groups with their table lists', () => {
    const records = graph.groups.find((g) => g.key === 'rc')!;
    expect(records.color).toBe('orange');
    expect(records.tables).toContain('records.comment_reactions');
  });

  it('names tables in a group qualified', () => {
    // The ERD renderer resolves every one of these names against graph.tables;
    // a bare name shared by two schemas would resolve to one table twice.
    const named = graph.groups.flatMap((g) => g.tables);
    expect(named.every((name) => name.includes('.'))).toBe(true);
    expect(new Set(named).size).toBe(named.length);
    expect(named).toContain('records.items');
  });
});

describe('resolveGroupKey', () => {
  it('throws when a table is in no group', () => {
    expect(() => resolveGroupKey('nope', SCHEMA_GROUPS)).toThrow(/no group/i);
  });
  it('resolves a known table', () => {
    expect(resolveGroupKey('items', SCHEMA_GROUPS)).toBe('rc');
  });
});

describe('resolveGroupKey — schema-derived membership', () => {
  it('resolves a schema-owned table with no `tables` entry at all', () => {
    // A group claiming `schemas: [...]` owns every table in that schema it
    // doesn't hand-list, so the same bare name resolves by its schema.
    const groups: SchemaGroup[] = [
      ...SCHEMA_GROUPS,
      { key: 'lg', label: 'Logs', color: 'green', tables: [], schemas: ['logs'] },
      { key: 'au', label: 'Audit', color: 'cyan', tables: [], schemas: ['audit'] },
    ];
    expect(resolveGroupKey('entries', groups, 'logs')).toBe('lg');
    expect(resolveGroupKey('entries', groups, 'audit')).toBe('au');
  });
  it('throws when a schema is owned by no group', () => {
    expect(() => resolveGroupKey('x', SCHEMA_GROUPS, 'nope')).toThrow(/no group/i);
  });
});

describe('describeSchema — SQL truth', () => {
  const graph = describeSchema();
  const byName = new Map(graph.tables.map((t) => [t.name, t]));

  it('exposes indexes with their partial predicate', () => {
    const iv = byName.get('item_values')!;
    const single = iv.indexes.find((i) => i.name === 'iv_scalar')!;
    expect(single.unique).toBe(true);
    expect(single.where).toMatch(/option_id IS NULL/i);
  });

  it('exposes check constraints', () => {
    // items carries no check constraints; the array must still exist
    expect(Array.isArray(byName.get('items')!.checks)).toBe(true);
  });

  it('exposes the declared enums', () => {
    const names = graph.enums.map((e) => e.name).sort();
    expect(names).toContain('field_type');
    expect(names).toContain('user_kind');
  });
});

describe('schemaOf', () => {
  const demo = pgSchema('demo');
  const plain = pgTable('plain', { id: serial('id').primaryKey() });
  const scoped = demo.table('scoped', { id: serial('id').primaryKey() });

  it('reports null for a public table and the name for a namespaced one', () => {
    expect(schemaOf(plain)).toBeNull();
    expect(schemaOf(scoped)).toBe('demo');
  });
});

describe('describeSchema schemas', () => {
  it('carries a schema field on every table', () => {
    // Plan 2 moved the items-platform tables into core/structure/records/
    // history — nothing is left in public.
    const SCHEMA_BY_TABLE: Record<string, string> = {
      users: 'core',
      projects: 'core',
      schemes: 'structure',
      item_types: 'structure',
      item_type_child_types: 'structure',
      fields: 'structure',
      item_type_fields: 'structure',
      option_sets: 'structure',
      options: 'structure',
      option_transitions: 'structure',
      link_types: 'structure',
      link_type_target_types: 'structure',
      views: 'structure',
      items: 'records',
      item_values: 'records',
      item_links: 'records',
      comments: 'records',
      comment_reactions: 'records',
      attachments: 'records',
      commands: 'history',
      events: 'history',
      outbox: 'history',
      item_activity: 'history',
    };
    const graph = describeSchema();
    for (const table of graph.tables) {
      expect(table).toHaveProperty('schema');
      expect(table.schema).toBe(SCHEMA_BY_TABLE[table.name] ?? null);
    }
  });
});

describe('findGroupKey', () => {
  const groups: SchemaGroup[] = [
    { key: 'ws', label: 'Workspace', color: 'blue', tables: ['users'] },
    { key: 'core', label: 'Core', color: 'green', tables: [], schemas: ['core'] },
  ];

  it('resolves a hand-listed table regardless of its schema', () => {
    expect(findGroupKey('users', groups, 'core')).toBe('ws');
  });

  it('falls back to schema ownership when no table is listed', () => {
    expect(findGroupKey('projects', groups, 'core')).toBe('core');
  });

  it('returns null instead of throwing for an unknown table', () => {
    expect(findGroupKey('audit_log', groups, null)).toBeNull();
  });

  it('returns null instead of throwing for an unowned schema', () => {
    expect(findGroupKey('jobs', groups, 'scheduler')).toBeNull();
  });

  it('still throws when a table is claimed by two groups', () => {
    const dupe: SchemaGroup[] = [
      { key: 'a', label: 'A', color: 'blue', tables: ['items'] },
      { key: 'b', label: 'B', color: 'red', tables: ['items'] },
    ];
    expect(() => findGroupKey('items', dupe, null)).toThrow(/multiple groups/);
  });

  it('still throws when a schema is claimed by two groups', () => {
    const dupe: SchemaGroup[] = [
      { key: 'a', label: 'A', color: 'blue', tables: [], schemas: ['shared'] },
      { key: 'b', label: 'B', color: 'red', tables: [], schemas: ['shared'] },
    ];
    expect(() => findGroupKey('anything', dupe, 'shared')).toThrow(/multiple groups/);
  });

  it('resolveGroupKey still throws for an unknown table', () => {
    expect(() => resolveGroupKey('audit_log', groups, null)).toThrow(/in no group/);
  });
});
