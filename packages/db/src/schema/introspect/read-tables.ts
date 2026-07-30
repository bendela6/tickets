import type postgres from 'postgres';

export type RawColumn = {
  attnum: number;
  name: string;
  type: string;
  notNull: boolean;
};

export type RawTable = {
  oid: number;
  name: string;
  /** null = public, matching TableMeta.schema. */
  schema: string | null;
  columns: RawColumn[];
};

// 'r' ordinary, 'p' partitioned. Views, matviews, indexes and sequences are
// deliberately absent — the ERD draws tables.
const TABLE_KINDS = ['r', 'p'];

/**
 * Namespaces that hold no modelled schema. `drizzle` is migration bookkeeping
 * (`__drizzle_migrations`), owned by drizzle-kit rather than by the domain —
 * without this it lands in a fallback group and the diagram grows a stray
 * DRIZZLE zone containing one bookkeeping table. This is a decision, not an
 * oversight: it is the only table in tickets_test that describeSchema() does
 * not declare.
 */
export const EXCLUDED_NAMESPACES = ['pg_catalog', 'information_schema', 'drizzle'];

/**
 * The namespace filter every catalog reader applies, as one reusable SQL
 * fragment. It is a fragment rather than a copied WHERE clause because the
 * list must not drift between readers: an enum hidden in a namespace whose
 * tables are excluded (or vice versa) would produce a graph that describes
 * two different databases at once. Assumes the caller aliased `pg_namespace`
 * as `n`, which every reader here does.
 */
export function inModelledNamespace(sql: postgres.Sql) {
  return sql`
    n.nspname <> ALL(${EXCLUDED_NAMESPACES})
    AND n.nspname NOT LIKE 'pg\\_toast%'
    AND n.nspname NOT LIKE 'pg\\_temp%'
  `;
}

/**
 * Tables and their columns, straight from the catalog.
 *
 * `format_type` rather than a `pg_type` join: it is what renders
 * `numeric(10,2)`, `varchar(64)` and `integer[]` the way Postgres itself
 * prints them, which is the same spelling the drizzle-derived path produces.
 */
export async function readTables(sql: postgres.Sql): Promise<RawTable[]> {
  const tableRows = await sql<{ oid: number; name: string; schema: string }[]>`
    SELECT c.oid::int AS oid, c.relname AS name, n.nspname AS schema
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = ANY(${TABLE_KINDS})
      AND ${inModelledNamespace(sql)}
    ORDER BY n.nspname, c.relname
  `;
  if (tableRows.length === 0) return [];

  const oids = tableRows.map((t) => t.oid);
  const columnRows = await sql<
    { attrelid: number; attnum: number; name: string; type: string; not_null: boolean }[]
  >`
    SELECT a.attrelid::int AS attrelid,
           a.attnum::int   AS attnum,
           a.attname       AS name,
           format_type(a.atttypid, a.atttypmod) AS type,
           a.attnotnull    AS not_null
    FROM pg_attribute a
    WHERE a.attrelid = ANY(${oids})
      AND a.attnum > 0
      AND NOT a.attisdropped
    ORDER BY a.attrelid, a.attnum
  `;

  const byTable = new Map<number, RawColumn[]>();
  for (const r of columnRows) {
    const list = byTable.get(r.attrelid) ?? [];
    list.push({ attnum: r.attnum, name: r.name, type: r.type, notNull: r.not_null });
    byTable.set(r.attrelid, list);
  }

  return tableRows.map((t) => ({
    oid: t.oid,
    name: t.name,
    schema: t.schema === 'public' ? null : t.schema,
    columns: byTable.get(t.oid) ?? [],
  }));
}
