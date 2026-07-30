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
 * `indkey` is an int2vector of attnums where 0 means "an expression". Expression
 * columns are rendered from `pg_get_indexdef` rather than named, matching the
 * drizzle-derived path's use of rendered SQL text for expression columns.
 */
export async function readIndexes(
  sql: postgres.Sql,
  tables: RawTable[],
): Promise<Map<number, IndexMeta[]>> {
  const out = new Map<number, IndexMeta[]>();
  for (const t of tables) out.set(t.oid, []);
  if (tables.length === 0) return out;

  const nameByAttnum = new Map<number, Map<number, string>>(
    tables.map((t) => [t.oid, new Map(t.columns.map((c) => [c.attnum, c.name]))]),
  );

  const rows = await sql<
    {
      indrelid: number;
      name: string;
      is_unique: boolean;
      method: string;
      where_expr: string | null;
      indkey: string;
      definition: string;
    }[]
  >`
    SELECT i.indrelid::int    AS indrelid,
           ic.relname         AS name,
           i.indisunique      AS is_unique,
           am.amname          AS method,
           pg_get_expr(i.indpred, i.indrelid) AS where_expr,
           i.indkey::text     AS indkey,
           pg_get_indexdef(i.indexrelid)      AS definition
    FROM pg_index i
    JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_am am    ON am.oid = ic.relam
    WHERE i.indrelid = ANY(${tables.map((t) => t.oid)})
      AND NOT i.indisprimary
    ORDER BY i.indrelid, ic.relname
  `;

  for (const row of rows) {
    const names = nameByAttnum.get(row.indrelid);
    if (!names) continue;
    // int2vector prints space-separated; 0 marks an expression column.
    const attnums = row.indkey.split(' ').filter((s) => s.length > 0).map(Number);
    const columns = attnums.map((n) => names.get(n) ?? expressionColumn(row.definition));
    out.get(row.indrelid)!.push({
      name: row.name,
      columns,
      unique: row.is_unique,
      method: row.method,
      where: row.where_expr,
    });
  }

  return out;
}

/**
 * The parenthesised column list from `CREATE INDEX … ON t USING m (…)`, used
 * verbatim for an expression column. Deliberately coarse: the exact rendering
 * of an expression index is display text, and the alternative — reimplementing
 * Postgres' expression deparser — buys nothing the ERD can use.
 */
function expressionColumn(definition: string): string {
  const open = definition.indexOf('(');
  const close = definition.lastIndexOf(')');
  return open >= 0 && close > open ? definition.slice(open + 1, close) : definition;
}
