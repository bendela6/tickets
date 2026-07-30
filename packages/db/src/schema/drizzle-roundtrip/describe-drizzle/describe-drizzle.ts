// packages/db/src/schema/drizzle-roundtrip/describe-drizzle/describe-drizzle.ts
//
// Node-only: introspects a loaded drizzle schema module (via getTableConfig /
// isPgEnum) and emits a plain-JSON SchemaDescription. Pure function of its
// inputs — the module and the caller-supplied group metadata — so it is
// testable without touching @tickets/db or the filesystem.
//
// The one rule that matters: a column's runtime default (`.$defaultFn()`) is
// detected by reading `column.defaultFn` directly. It is NEVER inferred from
// `hasDefault` — a type-borne default (serial, identity, generated) also sets
// `hasDefault: true` with `default: undefined`, and there are 16 serial
// columns in the real schema that would be false-flagged by that heuristic.
import { is, Relations, SQL } from 'drizzle-orm';
import { getTableConfig, isPgEnum, PgTable, uniqueKeyName } from 'drizzle-orm/pg-core';

import type { EnumDecl, FkAction, Generated, Identity, IndexColumn } from '../types';
import { renderSql } from '../render-sql';

// ---- wire types --------------------------------------------------------
// Spec of record: docs/superpowers/specs/2026-07-14-eer-drizzle-roundtrip-design.md
// (## Types, "wire format: Node-side reader → pure transforms").

export interface SchemaGroupDescription {
  key: string;
  label: string;
  color: string;
  tables: string[];
}

export interface ColumnDescription {
  name: string;
  sqlType: string; // straight from a built column's getSQLType()
  notNull: boolean;
  default: string | null; // sql chunks rendered to text through the pg dialect
  identity: Identity | null;
  generated: Generated | null;
}

export interface TableDescription {
  schema: string | null;
  name: string;
  columns: ColumnDescription[];
  primaryKey: { name: string | null; columns: string[] } | null;
  uniques: { name: string; columns: string[]; nullsNotDistinct: boolean }[];
  checks: { name: string; expression: string }[];
  foreignKeys: {
    name: string;
    columns: string[];
    refSchema: string | null;
    refTable: string;
    refColumns: string[];
    onDelete: FkAction | null;
    onUpdate: FkAction | null;
  }[];
  indexes: {
    name: string;
    columns: IndexColumn[];
    unique: boolean;
    method: string | null;
    only: boolean;
    where: string | null;
  }[];
}

export interface UnsupportedConstruct {
  kind:
    | 'view'
    | 'materialized-view'
    | 'sequence'
    | 'policy'
    | 'role'
    | 'default-fn'
    | 'on-update'
    | 'relations';
  where: string; // 'comments.body' or 'ticketRelations'
  detail: string; // what it is, and what happens on export
  blocksExport: boolean;
}

export interface SchemaDescription {
  tables: TableDescription[];
  enums: EnumDecl[];
  groups: SchemaGroupDescription[];
  unsupported: UnsupportedConstruct[];
}

// ---- introspection ------------------------------------------------------

// Minimal shape of `column.generatedIdentity` — not exported by drizzle-orm,
// so declared here from the verified probe.
interface GeneratedIdentityConfig {
  type: 'always' | 'byDefault';
  sequenceName?: string;
  sequenceOptions?: {
    increment?: number | string;
    minValue?: number | string;
    maxValue?: number | string;
    startWith?: number | string;
    cache?: number | string;
    cycle?: boolean;
  };
}

// Minimal shape of `column.generated` — Postgres only has STORED.
interface GeneratedConfig {
  as: unknown; // a JS value or a SQL template; rendered through renderSql
  mode?: string;
}

function normaliseIdentity(gi: unknown): Identity | null {
  if (!gi) return null;
  const g = gi as GeneratedIdentityConfig;
  const opts = g.sequenceOptions ?? {};
  const str = (v: number | string | undefined): string | null => (v === undefined ? null : String(v));
  return {
    always: g.type === 'always',
    name: g.sequenceName ?? null,
    increment: str(opts.increment),
    minValue: str(opts.minValue),
    maxValue: str(opts.maxValue),
    startWith: str(opts.startWith),
    cache: str(opts.cache),
    cycle: opts.cycle ?? null,
  };
}

function normaliseGenerated(g: unknown): Generated | null {
  if (!g) return null;
  const gg = g as GeneratedConfig;
  const expression = renderSql(gg.as);
  if (expression === null) return null;
  return { expression, stored: true };
}

export function describeDrizzle(module: Record<string, unknown>, groups: SchemaGroupDescription[]): SchemaDescription {
  const tables: TableDescription[] = [];
  const enums: EnumDecl[] = [];
  const unsupported: UnsupportedConstruct[] = [];

  for (const [exportName, value] of Object.entries(module)) {
    if (value instanceof PgTable) {
      const cfg = getTableConfig(value);
      const tableName = cfg.name;

      // PK: an inline `.primaryKey()` marks the column (`column.primary`), not
      // `cfg.primaryKeys` — the real schema uses inline PKs everywhere, so
      // both are read and normalised into one table-level pk.
      const inlinePkColumns = cfg.columns.filter((c) => c.primary).map((c) => c.name);
      const primaryKey = cfg.primaryKeys[0]
        ? { name: cfg.primaryKeys[0].name ?? null, columns: cfg.primaryKeys[0].columns.map((c) => c.name) }
        : inlinePkColumns.length > 0
          ? { name: null, columns: inlinePkColumns }
          : null;

      const columns: ColumnDescription[] = cfg.columns.map((c) => {
        if (c.defaultFn !== undefined) {
          unsupported.push({
            kind: 'default-fn',
            where: `${tableName}.${c.name}`,
            detail: `.$defaultFn() on column '${c.name}' is invisible to introspection and cannot be reproduced on export`,
            blocksExport: true,
          });
        }
        if (c.onUpdateFn !== undefined) {
          unsupported.push({
            kind: 'on-update',
            where: `${tableName}.${c.name}`,
            detail: `.$onUpdate() on column '${c.name}' is invisible to introspection and cannot be reproduced on export`,
            blocksExport: true,
          });
        }
        return {
          name: c.name,
          sqlType: c.getSQLType(),
          notNull: c.notNull,
          default: renderSql(c.default),
          identity: normaliseIdentity(c.generatedIdentity),
          generated: normaliseGenerated(c.generated),
        };
      });

      // Uniques: table-level `unique(...)` constraints, plus column-level
      // `.unique()` modifiers — the latter never appear in
      // `cfg.uniqueConstraints`, only as `column.isUnique` / `.uniqueName`.
      const tableUniques = cfg.uniqueConstraints.map((u) => ({
        // drizzle assigns a default name internally when `unique(...)` is
        // anonymous, so `u.name` is populated in practice; the type still
        // allows undefined, so fall back the same way drizzle itself does.
        name: u.name ?? uniqueKeyName(value, u.columns.map((c) => c.name)),
        columns: u.columns.map((c) => c.name),
        nullsNotDistinct: u.nullsNotDistinct,
      }));
      const columnUniques = cfg.columns
        .filter((c) => c.isUnique)
        .map((c) => ({
          name: c.uniqueName!,
          columns: [c.name],
          nullsNotDistinct: c.uniqueType === 'not distinct',
        }));

      const foreignKeys = cfg.foreignKeys.map((fk) => {
        const ref = fk.reference();
        const foreignCfg = getTableConfig(ref.foreignTable);
        return {
          name: fk.getName(),
          columns: ref.columns.map((c) => c.name),
          refSchema: foreignCfg.schema ?? null,
          refTable: foreignCfg.name,
          refColumns: ref.foreignColumns.map((c) => c.name),
          onDelete: (fk.onDelete ?? null) as FkAction | null,
          onUpdate: (fk.onUpdate ?? null) as FkAction | null,
        };
      });

      const indexes = cfg.indexes.map((idx) => {
        const indexColumns: IndexColumn[] = idx.config.columns.map((col) => {
          if (is(col, SQL)) {
            return {
              expression: renderSql(col) ?? '',
              isExpression: true,
              order: null,
              nulls: null,
              opClass: null,
            };
          }
          const named = col as { name: string; indexConfig?: { order?: 'asc' | 'desc'; nulls?: 'first' | 'last'; opClass?: string } };
          const ic = named.indexConfig;
          return {
            expression: named.name,
            isExpression: false,
            order: ic?.order ?? null,
            nulls: ic?.nulls ?? null,
            opClass: ic?.opClass ?? null,
          };
        });
        // A name is required in practice (every index in the real schema is
        // named explicitly); drizzle's own type allows an anonymous index, so
        // fall back to a deterministic name for that edge case.
        const name = idx.config.name ?? uniqueKeyName(value, indexColumns.map((c) => c.expression));
        return {
          name,
          columns: indexColumns,
          unique: idx.config.unique,
          method: idx.config.method ?? null,
          only: idx.config.only,
          where: renderSql(idx.config.where),
        };
      });

      tables.push({
        schema: cfg.schema ?? null,
        name: tableName,
        columns,
        primaryKey,
        uniques: [...tableUniques, ...columnUniques],
        checks: cfg.checks.map((c) => ({ name: c.name, expression: renderSql(c.value) ?? '' })),
        foreignKeys,
        indexes,
      });
      continue;
    }

    if (isPgEnum(value)) {
      enums.push({ name: value.enumName, values: [...value.enumValues], schema: value.schema ?? null });
      continue;
    }

    if (value instanceof Relations) {
      unsupported.push({
        kind: 'relations',
        where: exportName,
        detail: `relations() is TypeScript-only sugar with no SQL representation; it cannot be reproduced on export`,
        blocksExport: true,
      });
    }
  }

  return { tables, enums, groups, unsupported };
}
