// packages/db/src/schema/describe-schema.test.ts
import { describe, expect, it } from 'vitest';
import { describeSchema, resolveGroupKey } from './describe-schema';
import { SCHEMA_GROUPS } from './schema-groups';

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
    expect(commentId.fk).toEqual({ table: 'comments', column: 'id' });
    expect(commentId.notNull).toBe(true);
  });

  it('derives a nullable self-FK', () => {
    const comments = byName.get('comments')!;
    const parentId = comments.columns.find((c) => c.name === 'parent_id')!;
    expect(parentId.fk).toEqual({ table: 'comments', column: 'id' });
    expect(parentId.notNull).toBe(false);
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
    expect(records.tables).toContain('comment_reactions');
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
