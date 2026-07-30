import type postgres from 'postgres';
import type { IndexMeta } from '../describe-schema';
import type { RawTable } from './read-tables';

/**
 * Non-primary indexes per table oid.
 *
 * The pk's backing index is excluded (`NOT indisprimary`): it restates the
 * primary key constraint readConstraints already reports, and drawing it as an
 * index too would double-count.
 *
 * Each column position is resolved through `pg_get_indexdef(indexrelid, colno,
 * true)` — the correct API for a single index column, whether it's a named
 * column (returns the name) or an expression (returns just that expression).
 * `indkey` still supplies the position count (`cardinality(string_to_array(...))`);
 * it is not re-parsed into attnums, since pg_get_indexdef resolves each
 * position on its own. An earlier version tried to render expression columns
 * by string-slicing the whole-index `pg_get_indexdef(indexrelid)` text, which
 * silently produced the WRONG result on a mixed index (named column +
 * expression): the expression slot got the entire column list, duplicating
 * the named column into it. That path is what this replaces.
 */
export async function readIndexes(
  sql: postgres.Sql,
  tables: RawTable[],
): Promise<Map<number, IndexMeta[]>> {
  const out = new Map<number, IndexMeta[]>();
  for (const t of tables) out.set(t.oid, []);
  if (tables.length === 0) return out;

  const rows = await sql<
    {
      indrelid: number;
      name: string;
      is_unique: boolean;
      method: string;
      where_expr: string | null;
      columns: string[];
    }[]
  >`
    SELECT i.indrelid::int    AS indrelid,
           ic.relname         AS name,
           i.indisunique      AS is_unique,
           am.amname          AS method,
           pg_get_expr(i.indpred, i.indrelid) AS where_expr,
           (
             SELECT array_agg(pg_get_indexdef(i.indexrelid, gs.colno, true) ORDER BY gs.colno)
             FROM generate_series(1, cardinality(string_to_array(i.indkey::text, ' '))) AS gs(colno)
           ) AS columns
    FROM pg_index i
    JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_am am    ON am.oid = ic.relam
    WHERE i.indrelid = ANY(${tables.map((t) => t.oid)})
      AND NOT i.indisprimary
    ORDER BY i.indrelid, ic.relname
  `;

  for (const row of rows) {
    const bucket = out.get(row.indrelid);
    if (!bucket) continue;
    bucket.push({
      name: row.name,
      columns: row.columns,
      unique: row.is_unique,
      method: row.method,
      where: row.where_expr,
    });
  }

  return out;
}
