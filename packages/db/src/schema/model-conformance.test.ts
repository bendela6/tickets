// packages/db/src/schema/model-conformance.test.ts
// The drizzle schema and apps/eer/models/items-platform.json must agree, in BOTH
// directions. A stray table in drizzle fails as loudly as a missing one.
import { describe, expect, it } from 'vitest';
import { describeSchema, qualifiedName } from './describe-schema';
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
  // agent.sessions.cost_usd is the only precision-carrying numeric; drizzle
  // prints the parameters, so the parameterised spelling is its own key.
  'numeric(10, 4)': 'numeric(10, 4)',
  boolean: 'boolean',
  jsonb: 'jsonb',
  uuid: 'uuid',
  'timestamp with time zone': 'timestamptz',
  user_kind: 'user_kind',
  status_kind: 'status_kind',
  field_type: 'field_type',
  // Enum columns: getSQLType() prints the BARE enum name with no schema, so
  // terminal.sessions.status and agent.sessions.status both read
  // `session_status`. The schema each resolves to is pinned by the enum
  // assertions below, not here.
  runner_kind: 'runner_kind',
  session_status: 'session_status',
  permission_mode: 'permission_mode',
  permission_status: 'permission_status',
};

const normalizeExpression = (s: string): string =>
  s.replace(/"/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

// Nothing is exempt. Every table and every enum is compared in both
// directions: the model is the SSOT and drizzle must match it exactly.
//
// Identity on both sides is the SCHEMA-QUALIFIED name (`terminal.sessions`,
// bare `items` for public) — the model's own convention, see qualifiedName().
// A bare name would silently collapse terminal.sessions and agent.sessions
// into one map entry and stop comparing one of them altogether.
describe('drizzle ⇔ items-platform.json', () => {
  const model = loadModel();
  const graph = describeSchema();
  const modelById = new Map(model.entities.map((e) => [e.id, e]));
  const tableByName = new Map(
    graph.tables.map((t) => [qualifiedName(t.schema, t.name), t]),
  );

  it('every table has a distinct qualified identity', () => {
    // Guards the two maps above: a duplicate key would silently drop a table
    // from every it.each below instead of failing.
    expect(tableByName.size).toBe(graph.tables.length);
    expect(modelById.size).toBe(model.entities.length);
  });

  it('has exactly the model\'s tables — no more, no less', () => {
    expect([...tableByName.keys()].sort()).toEqual([...modelById.keys()].sort());
  });

  it.each([...modelById.keys()])('%s: sits in the schema the model gives it', (id) => {
    const entity = modelById.get(id)!;
    const table = tableByName.get(id)!;
    // Both sides spell public as null, so this compares directly. Without this
    // assertion conformance would pass with every table in the wrong schema.
    expect(table.schema).toBe(entity.schema ?? null);
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
    // The model spells refTable with the same qualified identity as an entity
    // id, so an fk pointing at terminal.sessions can't pass as one pointing at
    // agent.sessions.
    const drizzleFks = table.columns
      .filter((c) => c.fk)
      .map((c) => `${c.name} -> ${qualifiedName(c.fk!.schema, c.fk!.table)}.${c.fk!.column}`)
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

  it('enums match — name, schema and values, in both directions', () => {
    // Qualified, because `session_status` is TWO different enums:
    // terminal.session_status and agent.session_status carry different values
    // and neither may drift into the other's schema.
    const expected = model.enums
      .map((e) => `${qualifiedName(e.schema ?? null, e.name)}(${e.values.join(',')})`)
      .sort();
    const actual = graph.enums
      .map((e) => `${qualifiedName(e.schema, e.name)}(${e.values.join(',')})`)
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
