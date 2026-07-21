// packages/db/src/schema/describe-schema.test.ts
import { describe, expect, it } from 'vitest';
import { pgSchema, pgTable, serial } from 'drizzle-orm/pg-core';
import { describeSchema, resolveGroupKey, schemaOf } from './describe-schema';
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
    // terminal.sessions.workdir_id crosses into `core`. Without the referenced
    // side's own schema, an fk to `sessions` could not be told apart from an
    // fk to the other subsystem's `sessions`.
    const ts = graph.tables.find((t) => t.schema === 'terminal' && t.name === 'sessions')!;
    expect(ts.columns.find((c) => c.name === 'workdir_id')!.fk).toEqual({
      schema: 'core', table: 'workdirs', column: 'id',
    });
    const out = graph.tables.find((t) => t.schema === 'terminal' && t.name === 'output')!;
    expect(out.columns.find((c) => c.name === 'session_id')!.fk).toEqual({
      schema: 'terminal', table: 'sessions', column: 'id',
    });
    const am = graph.tables.find((t) => t.schema === 'agent' && t.name === 'messages')!;
    expect(am.columns.find((c) => c.name === 'session_id')!.fk).toEqual({
      schema: 'agent', table: 'sessions', column: 'id',
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

  it('group table lists include schema-derived tables, not just hand-listed ones', () => {
    // The ERD renderer iterates GroupMeta.tables to lay out cards — if this
    // list only reflected SCHEMA_GROUPS' raw `tables` array, workdirs and
    // every terminal.*/agent.* table (never hand-listed) would silently stop
    // being rendered.
    const core = graph.groups.find((g) => g.key === 'core')!;
    expect(core.tables).toContain('core.workdirs');
    const terminal = graph.groups.find((g) => g.key === 'terminal')!;
    expect(terminal.tables).toContain('terminal.output');
    const agent = graph.groups.find((g) => g.key === 'agent')!;
    expect(agent.tables).toContain('agent.agents');
    expect(agent.tables).toContain('agent.messages');
    expect(agent.tables).toContain('agent.permission_requests');
  });

  it('the two subsystems are separate groups, not one AI bucket', () => {
    // The split's whole point: terminal and agent are independent subsystems,
    // and workdirs is core — not an AI concept. One group each, and the
    // same-named `sessions` table lands in exactly one of them.
    const terminal = graph.groups.find((g) => g.key === 'terminal')!;
    const agent = graph.groups.find((g) => g.key === 'agent')!;
    expect(terminal.tables).toContain('terminal.sessions');
    expect(agent.tables).toContain('agent.sessions');
    expect(terminal.tables).not.toContain('agent.sessions');
    expect(agent.tables).not.toContain('terminal.sessions');
    expect(graph.groups.map((g) => g.label)).not.toContain('AI sessions');
  });

  it('names tables in a group qualified, so the two `sessions` stay distinct', () => {
    // The ERD renderer resolves every one of these names against graph.tables.
    // A bare "sessions" appearing in two groups would resolve to the same
    // table twice — one subsystem drawn double, the other not at all.
    const named = graph.groups.flatMap((g) => g.tables);
    expect(named).not.toContain('sessions');
    expect(new Set(named).size).toBe(named.length);
    // items moved into `records` in Plan 2 — qualified like every other
    // namespaced table now.
    expect(named).toContain('records.items');
  });

  it('gives each same-named table its own ordering slot', () => {
    // The `order` map is keyed by qualified name; a bare key would hand
    // terminal.sessions and agent.sessions ONE shared slot, the second
    // overwriting the first's position and leaving the two sorting as equals.
    const slots = graph.tables
      .filter((t) => t.name === 'sessions')
      .map((t) => graph.tables.indexOf(t));
    expect(slots).toHaveLength(2);
    expect(slots[0]).not.toBe(slots[1]);
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
    // workdirs lives in schema `core` and is not listed under any group's
    // `tables` array — it only resolves because the `core` group claims
    // `schemas: ['core']`. This is what stops SCHEMA_GROUPS and the real
    // schema from drifting apart for terminal/agent/core tables. The two
    // `sessions` show it doing real work: same bare name, different schema,
    // different group.
    expect(resolveGroupKey('workdirs', SCHEMA_GROUPS, 'core')).toBe('core');
    expect(resolveGroupKey('sessions', SCHEMA_GROUPS, 'terminal')).toBe('terminal');
    expect(resolveGroupKey('sessions', SCHEMA_GROUPS, 'agent')).toBe('agent');
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
    // Task 3 moved `workdirs` into `core`. Task 4 moved terminal's `sessions`
    // and `output` into `terminal`. Task 5 moved agent.{sessions,messages,
    // permission_requests,agents} into `agent`. Plan 2 moved the 22
    // items-platform tables into core/structure/records/history — nothing is
    // left in public. `sessions` is a bare name shared by BOTH
    // terminal.sessions and agent.sessions, so it can't key a name->schema
    // map any more; it's asserted separately below.
    const SCHEMA_BY_TABLE: Record<string, string> = {
      workdirs: 'core',
      output: 'terminal',
      messages: 'agent',
      permission_requests: 'agent',
      agents: 'agent',
      users: 'core',
      schemes: 'structure',
      projects: 'structure',
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
      commands: 'history',
      events: 'history',
      outbox: 'history',
      item_activity: 'history',
    };
    const graph = describeSchema();
    for (const table of graph.tables) {
      expect(table).toHaveProperty('schema');
      if (table.name === 'sessions') continue;
      expect(table.schema).toBe(SCHEMA_BY_TABLE[table.name] ?? null);
    }
    const sessionSchemas = graph.tables
      .filter((t) => t.name === 'sessions')
      .map((t) => t.schema)
      .sort();
    expect(sessionSchemas).toEqual(['agent', 'terminal']);
  });
});
