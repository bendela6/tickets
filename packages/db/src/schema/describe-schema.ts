// packages/db/src/schema/describe-schema.ts
import type { SQL } from 'drizzle-orm';
import { PgDialect, getTableConfig, uniqueKeyName, type PgTable } from 'drizzle-orm/pg-core';
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
export type GroupMeta = { key: string; label: string; color: string; tables: string[] };
export type EnumMeta = { name: string; values: string[]; schema: string | null };
export type SchemaGraph = { tables: TableMeta[]; groups: GroupMeta[]; enums: EnumMeta[] };

// The identity of a table or enum: its bare name in public, `schema.name`
// otherwise. This is the SSOT model's own convention (tableId/enumId in
// apps/eer/src/engine/model/import-drizzle) — conformance keys both sides by
// this, so `terminal.sessions` and `agent.sessions` stay distinct instead of
// silently collapsing into one map entry.
export function qualifiedName(schema: string | null, name: string): string {
  return schema && schema !== 'public' ? `${schema}.${name}` : name;
}

const normalizeType = (t: string): string =>
  t === 'timestamp with time zone' ? 'timestamptz' : t;

// Every table must belong to exactly one group. Throws otherwise, so the config
// can't silently fall behind the schema.
//
// A table with a real Postgres schema (schema !== null) resolves via
// `SchemaGroup.schemas` — derived, not hand-listed. A public table (schema
// === null) falls back to the hand-listed `SchemaGroup.tables`, because most
// of the platform has no real schema yet (see schema-groups.ts). This is also
// what lets `terminal.sessions` and `agent.sessions` — the same bare name —
// resolve unambiguously: each carries its own pgSchema, so there is no bare
// name collision to trip the "in multiple groups" check.
export function resolveGroupKey(
  tableName: string,
  groups: SchemaGroup[],
  schema: string | null = null,
): string {
  if (schema !== null) {
    const owners = groups.filter((g) => g.schemas?.includes(schema));
    if (owners.length === 0) throw new Error(`schema "${schema}" (table "${tableName}") is in no group`);
    if (owners.length > 1) {
      throw new Error(`schema "${schema}" is in multiple groups: ${owners.map((g) => g.key).join(', ')}`);
    }
    return owners[0]!.key;
  }
  const owners = groups.filter((g) => g.tables.includes(tableName));
  if (owners.length === 0) throw new Error(`table "${tableName}" is in no group`);
  if (owners.length > 1) {
    throw new Error(`table "${tableName}" is in multiple groups: ${owners.map((g) => g.key).join(', ')}`);
  }
  return owners[0]!.key;
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

    const columns: ColumnMeta[] = cfg.columns.map((c) => ({
      name: c.name,
      type: normalizeType(c.getSQLType()),
      notNull: c.notNull,
      pk: pkNames.has(c.name),
      fk: fkByColumn.get(c.name) ?? null,
    }));

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
  const order = new Map<string, number>();
  SCHEMA_GROUPS.forEach((g, gi) =>
    g.tables.forEach((t, ti) => order.set(t, gi * 1000 + ti)),
  );
  let schemaTableSlot = 500;
  for (const table of allTables) {
    const cfg = getTableConfig(table);
    const schema = cfg.schema ?? null;
    if (schema === null || order.has(cfg.name)) continue;
    const gi = SCHEMA_GROUPS.findIndex((g) => g.schemas?.includes(schema));
    if (gi === -1) continue;
    order.set(cfg.name, gi * 1000 + schemaTableSlot++);
  }
  metas.sort((a, b) => (order.get(a.name) ?? 0) - (order.get(b.name) ?? 0));

  // Derived from resolved membership (not the raw config) so schema-owned
  // tables — never listed in `SchemaGroup.tables` — still show up here; the
  // ERD renderer (apps/web/src/components/schema/erd-engine.ts) iterates
  // this array to lay out each group's cards.
  const groups: GroupMeta[] = SCHEMA_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    color: g.color,
    tables: metas.filter((m) => m.group === g.key).map((m) => m.name),
  }));

  const enums: EnumMeta[] = allEnums.map((e) => ({
    name: e.enumName,
    values: [...e.enumValues],
    schema: e.schema ?? null,
  }));

  return { tables: metas, groups, enums };
}
