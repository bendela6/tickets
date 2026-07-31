import type postgres from 'postgres';
import type { CheckMeta, UniqueMeta } from '../describe-schema';
import type { RawTable } from './read-tables';

export type RawFk = {
  column: string;
  /** The REFERENCED table's schema (null = public), never the referencing one. */
  refSchema: string | null;
  refTable: string;
  refColumn: string;
};

export type RawConstraints = {
  primaryKey: string[];
  uniques: UniqueMeta[];
  checks: CheckMeta[];
  fks: RawFk[];
};

/**
 * pk / unique / check / fk per table, keyed by table oid.
 *
 * `conkey` and `confkey` are attnum arrays, not names, so this resolves them
 * through the columns `readTables` already read rather than re-querying
 * pg_attribute. A referenced table outside the introspected set (impossible
 * today, since readTables covers every user namespace) yields no fk rather
 * than a dangling name.
 */
export async function readConstraints(
  sql: postgres.Sql,
  tables: RawTable[],
): Promise<Map<number, RawConstraints>> {
  const out = new Map<number, RawConstraints>();
  for (const t of tables) {
    out.set(t.oid, { primaryKey: [], uniques: [], checks: [], fks: [] });
  }
  if (tables.length === 0) return out;

  // oid -> (attnum -> column name), for both sides of a foreign key.
  const nameByAttnum = new Map<number, Map<number, string>>();
  const tableByOid = new Map<number, RawTable>();
  for (const t of tables) {
    tableByOid.set(t.oid, t);
    nameByAttnum.set(t.oid, new Map(t.columns.map((c) => [c.attnum, c.name])));
  }

  const rows = await sql<
    {
      conrelid: number;
      name: string;
      contype: string;
      conkey: number[] | null;
      confrelid: number;
      confkey: number[] | null;
      expression: string | null;
    }[]
  >`
    SELECT c.conrelid::int AS conrelid,
           c.conname       AS name,
           c.contype::text AS contype,
           c.conkey::int[] AS conkey,
           c.confrelid::int AS confrelid,
           c.confkey::int[] AS confkey,
           pg_get_expr(c.conbin, c.conrelid) AS expression
    FROM pg_constraint c
    WHERE c.conrelid = ANY(${tables.map((t) => t.oid)})
      AND c.contype IN ('p', 'u', 'f', 'c')
    ORDER BY c.conrelid, c.conname
  `;

  const columnsOf = (oid: number, keys: number[] | null): string[] => {
    const names = nameByAttnum.get(oid);
    if (!names || !keys) return [];
    return keys.map((k) => names.get(k)).filter((n): n is string => n !== undefined);
  };

  for (const row of rows) {
    const entry = out.get(row.conrelid);
    if (!entry) continue;

    if (row.contype === 'p') {
      entry.primaryKey = columnsOf(row.conrelid, row.conkey);
    } else if (row.contype === 'u') {
      entry.uniques.push({ name: row.name, columns: columnsOf(row.conrelid, row.conkey) });
    } else if (row.contype === 'c') {
      entry.checks.push({ name: row.name, expression: row.expression ?? '' });
    } else if (row.contype === 'f') {
      const local = columnsOf(row.conrelid, row.conkey);
      const foreign = columnsOf(row.confrelid, row.confkey);
      const refTable = tableByOid.get(row.confrelid);
      if (!refTable) continue;
      // ColumnMeta.fk is single-column; a composite fk contributes one entry
      // per column pair, which is how the drizzle-derived path models it too.
      for (const [i, column] of local.entries()) {
        const refColumn = foreign[i];
        if (refColumn === undefined) continue;
        entry.fks.push({
          column,
          refSchema: refTable.schema,
          refTable: refTable.name,
          refColumn,
        });
      }
    }
  }

  return out;
}
