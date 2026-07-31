// packages/db/src/schema/describe-schema.ts
import type { SQL } from 'drizzle-orm';
import { PgDialect, getTableConfig, uniqueKeyName, type PgColumn, type PgTable } from 'drizzle-orm/pg-core';
import { allEnums, allTables } from './registry';
import { SCHEMA_GROUPS, type SchemaGroup } from './schema-groups';

const dialect = new PgDialect();
const renderSql = (sql: SQL | unknown): string => dialect.sqlToQuery(sql as SQL).sql;

export type ColumnMeta = {
  name: string;
  type: string;
  notNull: boolean;
  pk: boolean;
  // `schema` is the REFERENCED table's schema (null = public). Without it a
  // reference to `sessions` is ambiguous — terminal.sessions and agent.sessions
  // share that bare name — so conformance could not tell an fk pointing at the
  // wrong subsystem from a correct one. See qualifiedName().
  fk: { schema: string | null; table: string; column: string } | null;
};
export type UniqueMeta = { name: string; columns: string[] };
export type CheckMeta = { name: string; expression: string };
export type IndexMeta = {
  name: string;
  columns: string[];
  unique: boolean;
  method: string | null;
  where: string | null;
};
export type TableMeta = {
  name: string;
  // The Postgres schema the table lives in. null = public — matching the SSOT
  // model's `schema: string | null`, so conformance can compare the two sides
  // without normalising.
  schema: string | null;
  group: string;
  columns: ColumnMeta[];
  primaryKey: string[];
  uniques: UniqueMeta[];
  checks: CheckMeta[];
  indexes: IndexMeta[];
};
// `tables` holds QUALIFIED names (see qualifiedName) — the ERD renderer keys
// its card/row/column maps by these, and a bare "sessions" would name two
// different tables.
export type GroupMeta = { key: string; label: string; color: string; tables: string[] };
export type EnumMeta = { name: string; values: string[]; schema: string | null };
export type SchemaGraph = { tables: TableMeta[]; groups: GroupMeta[]; enums: EnumMeta[] };

// The identity of a table or enum: its bare name in public, `schema.name`
// otherwise. This is the SSOT model's own convention (tableId/enumId, as
// produced by the import-drizzle step that generated items-platform.json) —
// conformance keys both sides by this, so `terminal.sessions` and
// `agent.sessions` stay distinct instead of silently collapsing into one map
// entry.
export function qualifiedName(schema: string | null, name: string): string {
  return schema && schema !== 'public' ? `${schema}.${name}` : name;
}

const normalizeType = (t: string): string =>
  t === 'timestamp with time zone' ? 'timestamptz' : t;

// An enum column's defining enum — name and schema — as set by
// pgEnum()/pgSchema.enum() on the column's `.enum` property. That property
// only exists on the PgEnumColumn/PgEnumObjectColumn subclasses (the base
// PgColumn type getTableConfig().columns is typed as omits it), so this
// narrows via `columnType` before reading it. Needed because getSQLType()
// alone can't disambiguate: terminal.session_status and agent.session_status
// are two different enums that both print the bare string "session_status".
function enumIdentity(c: PgColumn): { schema: string | null; name: string } | null {
  if (c.columnType !== 'PgEnumColumn' && c.columnType !== 'PgEnumObjectColumn') return null;
  const e = (c as unknown as { enum: { enumName: string; schema: string | undefined } }).enum;
  return { schema: e.schema ?? null, name: e.enumName };
}

/**
 * Group membership lookup, or null when the table belongs to no configured
 * group. Genuine ambiguity (one table or schema claimed by two groups) still
 * throws — that is a config bug regardless of caller.
 *
 * Live introspection needs the null: a database the config never described
 * (or a table added to the database but not the code) has no curated group,
 * and that is expected rather than fatal. See introspect/group-tables.ts.
 *
 * The ERD's visual group is independent of a table's real Postgres schema —
 * e.g. `core.users` renders in the WORKSPACE group alongside `core.projects`,
 * not in the WORKDIRS group with `core.workdirs`, even though all three carry
 * schema `core`. So a hand-listed `SchemaGroup.tables` entry (bare name)
 * always wins when present, regardless of schema. Only a table with NO
 * hand-listed entry falls back to schema-derived membership via
 * `SchemaGroup.schemas` — that's how `core.workdirs`, `terminal.sessions` and
 * `agent.*` resolve, since group and schema happen to coincide 1:1 for them.
 * This also keeps `terminal.sessions` and `agent.sessions` — the same bare
 * name — resolving unambiguously: each carries its own pgSchema, so there is
 * no bare name collision to trip the "in multiple groups" check.
 */
export function findGroupKey(
  tableName: string,
  groups: SchemaGroup[],
  schema: string | null = null,
): string | null {
  const byTable = groups.filter((g) => g.tables.includes(tableName));
  if (byTable.length > 1) {
    throw new Error(`table "${tableName}" is in multiple groups: ${byTable.map((g) => g.key).join(', ')}`);
  }
  if (byTable.length === 1) return byTable[0]!.key;
  if (schema !== null) {
    const owners = groups.filter((g) => g.schemas?.includes(schema));
    if (owners.length > 1) {
      throw new Error(`schema "${schema}" is in multiple groups: ${owners.map((g) => g.key).join(', ')}`);
    }
    return owners[0]?.key ?? null;
  }
  return null;
}

// Every table in the drizzle registry must belong to exactly one group.
// Throws otherwise, so the config can't silently fall behind the schema.
export function resolveGroupKey(
  tableName: string,
  groups: SchemaGroup[],
  schema: string | null = null,
): string {
  const key = findGroupKey(tableName, groups, schema);
  if (key !== null) return key;
  if (schema !== null) throw new Error(`schema "${schema}" (table "${tableName}") is in no group`);
  throw new Error(`table "${tableName}" is in no group`);
}

// A table's Postgres schema, or null for public. drizzle leaves `schema`
// undefined on a plain pgTable and sets it on one built from a pgSchema.
export function schemaOf(table: PgTable): string | null {
  return getTableConfig(table).schema ?? null;
}

export function describeSchema(): SchemaGraph {
  const metas: TableMeta[] = allTables.map((table) => {
    const cfg = getTableConfig(table);
    const name = cfg.name;

    // composite PK columns (inline `.primaryKey()` marks the column instead)
    const compositePk = cfg.primaryKeys.flatMap((pk) => pk.columns.map((c) => c.name));
    const pkNames = new Set<string>([
      ...cfg.columns.filter((c) => c.primary).map((c) => c.name),
      ...compositePk,
    ]);

    // local column name -> { schema, table, column } from foreign keys (all
    // single-column here). The referenced table's schema is read from its own
    // config, not assumed from this table's — an fk routinely crosses schemas
    // (terminal.sessions.workdir_id -> core.workdirs.id).
    const fkByColumn = new Map<string, { schema: string | null; table: string; column: string }>();
    for (const fk of cfg.foreignKeys) {
      const ref = fk.reference();
      const local = ref.columns[0]!.name;
      const foreignCfg = getTableConfig(ref.foreignTable);
      fkByColumn.set(local, {
        schema: foreignCfg.schema ?? null,
        table: foreignCfg.name,
        column: ref.foreignColumns[0]!.name,
      });
    }

    const columns: ColumnMeta[] = cfg.columns.map((c) => {
      const enumId = enumIdentity(c);
      return {
        name: c.name,
        // Enum columns are qualified by the defining enum's own schema (see
        // enumIdentity), using the same qualifiedName() convention as table
        // identity and FK targets — otherwise a column rebound to the wrong
        // same-named enum (e.g. terminal.sessions.status -> agent's
        // session_status) would compare bare "session_status" ==
        // "session_status" and conformance would never see the drift.
        type: enumId ? qualifiedName(enumId.schema, enumId.name) : normalizeType(c.getSQLType()),
        notNull: c.notNull,
        pk: pkNames.has(c.name),
        fk: fkByColumn.get(c.name) ?? null,
      };
    });

    const checks: CheckMeta[] = cfg.checks.map((c) => ({
      name: c.name,
      expression: renderSql(c.value),
    }));

    const indexes: IndexMeta[] = cfg.indexes.map((ix) => {
      const c = ix.config;
      return {
        name: c.name ?? '',
        columns: (c.columns ?? []).map((col) =>
          'name' in col ? (col as { name: string }).name : renderSql(col),
        ),
        unique: c.unique === true,
        method: c.method ?? null,
        where: c.where ? renderSql(c.where) : null,
      };
    });

    return {
      name,
      schema: cfg.schema ?? null,
      group: resolveGroupKey(name, SCHEMA_GROUPS, cfg.schema ?? null),
      columns,
      primaryKey: [...pkNames],
      uniques: cfg.uniqueConstraints.map((u) => ({
        // drizzle only requires an explicit name when `unique(...)` is called
        // anonymously; fall back to the same default name postgres/drizzle-kit
        // would generate so this is always a string (per UniqueMeta).
        name: u.name ?? uniqueKeyName(table, u.columns.map((c) => c.name)),
        columns: u.columns.map((c) => c.name),
      })),
      checks,
      indexes,
    };
  });

  // order tables by group declaration for deterministic output. Explicit
  // `tables` entries get their declared slot; schema-derived tables (no
  // `tables` entry to draw a position from) are placed after them, in
  // registry declaration order, so they can't collide with a hand-listed
  // table's slot.
  //
  // Keyed by QUALIFIED name: a bare key would give terminal.sessions and
  // agent.sessions one shared slot, so whichever was seen second would
  // overwrite the first's position and the two would sort as equals. A
  // `SchemaGroup.tables` entry is always a public table, so it keys as its
  // bare name either way.
  const order = new Map<string, number>();
  SCHEMA_GROUPS.forEach((g, gi) =>
    g.tables.forEach((t, ti) => order.set(t, gi * 1000 + ti)),
  );
  let schemaTableSlot = 500;
  for (const table of allTables) {
    const cfg = getTableConfig(table);
    const schema = cfg.schema ?? null;
    const id = qualifiedName(schema, cfg.name);
    if (schema === null || order.has(id)) continue;
    const gi = SCHEMA_GROUPS.findIndex((g) => g.schemas?.includes(schema));
    if (gi === -1) continue;
    order.set(id, gi * 1000 + schemaTableSlot++);
  }
  const slotOf = (m: TableMeta) => order.get(qualifiedName(m.schema, m.name)) ?? 0;
  metas.sort((a, b) => slotOf(a) - slotOf(b));

  // Derived from resolved membership (not the raw config) so schema-owned
  // tables — never listed in `SchemaGroup.tables` — still show up here; the
  // diagram adapter (apps/web/src/components/eer/adapter/schema-graph-to-model.ts)
  // reads this array to build the model's groups, resolving each name against
  // `tables`. Qualified, therefore: emitting a bare "sessions" in both the
  // terminal and the agent group would have the renderer resolve BOTH to
  // whichever table its own map happened to keep, drawing one subsystem's
  // card twice and never drawing the other's.
  const groups: GroupMeta[] = SCHEMA_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    color: g.color,
    tables: metas.filter((m) => m.group === g.key).map((m) => qualifiedName(m.schema, m.name)),
  }));

  const enums: EnumMeta[] = allEnums.map((e) => ({
    name: e.enumName,
    values: [...e.enumValues],
    schema: e.schema ?? null,
  }));

  return { tables: metas, groups, enums };
}
