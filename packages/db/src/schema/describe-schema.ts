// packages/db/src/schema/describe-schema.ts
import { getTableName } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { PgDialect, getTableConfig, uniqueKeyName } from 'drizzle-orm/pg-core';
import { allEnums, allTables } from './registry';
import { SCHEMA_GROUPS, type SchemaGroup } from './schema-groups';

const dialect = new PgDialect();
const renderSql = (sql: SQL | unknown): string => dialect.sqlToQuery(sql as SQL).sql;

export type ColumnMeta = {
  name: string;
  type: string;
  notNull: boolean;
  pk: boolean;
  fk: { table: string; column: string } | null;
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
  group: string;
  columns: ColumnMeta[];
  primaryKey: string[];
  uniques: UniqueMeta[];
  checks: CheckMeta[];
  indexes: IndexMeta[];
};
export type GroupMeta = { key: string; label: string; color: string; tables: string[] };
export type EnumMeta = { name: string; values: string[] };
export type SchemaGraph = { tables: TableMeta[]; groups: GroupMeta[]; enums: EnumMeta[] };

const normalizeType = (t: string): string =>
  t === 'timestamp with time zone' ? 'timestamptz' : t;

// Every table must belong to exactly one group. Throws otherwise, so the config
// can't silently fall behind the schema.
export function resolveGroupKey(tableName: string, groups: SchemaGroup[]): string {
  const owners = groups.filter((g) => g.tables.includes(tableName));
  if (owners.length === 0) throw new Error(`table "${tableName}" is in no group`);
  if (owners.length > 1) {
    throw new Error(`table "${tableName}" is in multiple groups: ${owners.map((g) => g.key).join(', ')}`);
  }
  return owners[0]!.key;
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

    // local column name -> { table, column } from foreign keys (all single-column here)
    const fkByColumn = new Map<string, { table: string; column: string }>();
    for (const fk of cfg.foreignKeys) {
      const ref = fk.reference();
      const local = ref.columns[0]!.name;
      fkByColumn.set(local, {
        table: getTableName(ref.foreignTable),
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
      group: resolveGroupKey(name, SCHEMA_GROUPS),
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

  // order tables by group declaration for deterministic output
  const order = new Map<string, number>();
  SCHEMA_GROUPS.forEach((g, gi) =>
    g.tables.forEach((t, ti) => order.set(t, gi * 1000 + ti)),
  );
  metas.sort((a, b) => (order.get(a.name) ?? 0) - (order.get(b.name) ?? 0));

  const groups: GroupMeta[] = SCHEMA_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    color: g.color,
    tables: [...g.tables],
  }));

  const enums: EnumMeta[] = allEnums.map((e) => ({ name: e.enumName, values: [...e.enumValues] }));

  return { tables: metas, groups, enums };
}
