// packages/db/src/schema/model-conformance.test.ts
// The drizzle schema and apps/eer/models/items-platform.json must agree, in BOTH
// directions. A stray table in drizzle fails as loudly as a missing one.
import { describe, expect, it } from 'vitest';
import { describeSchema } from './describe-schema';
import { loadModel, topLevelGroup } from './model';

// model type name -> the type string drizzle's getSQLType() produces.
//
// The two sides spell the same types differently, so this is not an identity
// map: the model stores canonical Postgres SQL names (what apps/eer's type
// catalogue emits, e.g. "timestamp with time zone"), while drizzle's
// getSQLType() prints its own shorthand ("timestamptz"). A key that stops
// matching the model fails loudly via the `unmapped model type` assertion
// below rather than silently skipping the column.
const TYPE_MAP: Record<string, string> = {
  serial: 'serial',
  bigserial: 'bigserial',
  integer: 'integer',
  bigint: 'bigint',
  text: 'text',
  numeric: 'numeric',
  boolean: 'boolean',
  jsonb: 'jsonb',
  uuid: 'uuid',
  'timestamp with time zone': 'timestamptz',
  user_kind: 'user_kind',
  status_kind: 'status_kind',
  field_type: 'field_type',
};

const normalizeExpression = (s: string): string =>
  s.replace(/"/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

// MID-MIGRATION EXEMPTION — remove in Task 11 of
// docs/superpowers/plans/2026-07-17-terminal-agent-split.md.
//
// The ai_* tables and their enums arrived with the main merge and are exempt
// from conformance until the split lands. Adding them to the SSOT in this shape
// would be waste: Tasks 3-5 replace them with core.workdirs + terminal.* +
// agent.*, and Task 11 authors that final shape into the model and deletes this
// list. Nothing else is exempt — every product table is still gated in both
// directions.
const PENDING_SPLIT_TABLES = new Set([
  'ai_workspaces',
  'ai_sessions',
  'ai_session_output',
  'ai_agents',
  'ai_messages',
  'ai_permission_requests',
]);
const PENDING_SPLIT_ENUMS = new Set([
  'session_kind',
  'session_status',
  'runner_kind',
  'permission_mode',
  'permission_status',
]);

describe('drizzle ⇔ items-platform.json', () => {
  const model = loadModel();
  const graph = describeSchema();
  const modelById = new Map(model.entities.map((e) => [e.id, e]));
  const tableByName = new Map(
    graph.tables.filter((t) => !PENDING_SPLIT_TABLES.has(t.name)).map((t) => [t.name, t]),
  );

  it('has exactly the model\'s tables — no more, no less', () => {
    expect([...tableByName.keys()].sort()).toEqual([...modelById.keys()].sort());
  });

  it('the split exemption stays honest — every exempt table really is in drizzle', () => {
    // If a name here stops existing, the list is stale and must shrink.
    const inDrizzle = new Set(graph.tables.map((t) => t.name));
    for (const name of PENDING_SPLIT_TABLES) expect(inDrizzle).toContain(name);
  });

  it.each([...modelById.keys()])('%s: columns match', (id) => {
    const entity = modelById.get(id)!;
    const table = tableByName.get(id)!;
    expect(table.columns.map((c) => c.name)).toEqual(entity.columns.map((c) => c.name));
  });

  it.each([...modelById.keys()])('%s: types and nullability match', (id) => {
    const entity = modelById.get(id)!;
    const table = tableByName.get(id)!;
    for (const column of entity.columns) {
      const actual = table.columns.find((c) => c.name === column.name)!;
      const expectedType = TYPE_MAP[column.type];
      expect(expectedType, `unmapped model type "${column.type}"`).toBeDefined();
      expect(actual.type, `${id}.${column.name} type`).toBe(expectedType);
      expect(actual.notNull, `${id}.${column.name} nullability`).toBe(!column.nullable);
    }
  });

  it.each([...modelById.keys()])('%s: primary key matches', (id) => {
    const entity = modelById.get(id)!;
    const table = tableByName.get(id)!;
    const pk = entity.constraints.find((c) => c.kind === 'pk');
    expect([...table.primaryKey].sort()).toEqual([...(pk?.columns ?? [])].sort());
  });

  it.each([...modelById.keys()])('%s: foreign keys match', (id) => {
    const entity = modelById.get(id)!;
    const table = tableByName.get(id)!;
    const modelFks = entity.constraints
      .filter((c) => c.kind === 'fk')
      .map((c) => `${c.columns[0]} -> ${c.refTable}.${c.refColumns[0]}`)
      .sort();
    const drizzleFks = table.columns
      .filter((c) => c.fk)
      .map((c) => `${c.name} -> ${c.fk!.table}.${c.fk!.column}`)
      .sort();
    expect(drizzleFks).toEqual(modelFks);
  });

  it.each([...modelById.keys()])('%s: uniques match', (id) => {
    const entity = modelById.get(id)!;
    const table = tableByName.get(id)!;
    const expected = entity.constraints
      .filter((c) => c.kind === 'unique')
      .map((c) => `${c.name}(${c.columns.join(',')})`)
      .sort();
    const actual = table.uniques.map((u) => `${u.name}(${u.columns.join(',')})`).sort();
    expect(actual).toEqual(expected);
  });

  it.each([...modelById.keys()])('%s: checks match', (id) => {
    const entity = modelById.get(id)!;
    const table = tableByName.get(id)!;
    const expected = entity.constraints
      .filter((c) => c.kind === 'check')
      .map((c) => `${c.name}:${normalizeExpression(c.expression)}`)
      .sort();
    const actual = table.checks
      .map((c) => `${c.name}:${normalizeExpression(c.expression)}`)
      .sort();
    expect(actual).toEqual(expected);
  });

  it.each([...modelById.keys()])('%s: indexes match', (id) => {
    const entity = modelById.get(id)!;
    const table = tableByName.get(id)!;
    const expected = entity.indexes
      .map((i) =>
        [
          i.name,
          i.columns.map((c) => c.expression).join(','),
          i.unique ? 'unique' : 'plain',
          i.where ? normalizeExpression(i.where) : '-',
        ].join('|'),
      )
      .sort();
    const actual = table.indexes
      .map((i) =>
        [
          i.name,
          i.columns.join(','),
          i.unique ? 'unique' : 'plain',
          i.where ? normalizeExpression(i.where) : '-',
        ].join('|'),
      )
      .sort();
    expect(actual).toEqual(expected);
  });

  it('enums match', () => {
    const expected = model.enums
      .map((e) => `${e.name}(${e.values.join(',')})`)
      .sort();
    const actual = graph.enums
      .filter((e) => !PENDING_SPLIT_ENUMS.has(e.name))
      .map((e) => `${e.name}(${e.values.join(',')})`)
      .sort();
    expect(actual).toEqual(expected);
  });

  it('every table sits in the group the model puts it in', () => {
    for (const entity of model.entities) {
      const table = tableByName.get(entity.id)!;
      expect(table.group, entity.id).toBe(topLevelGroup(model, entity.group));
    }
  });
});
