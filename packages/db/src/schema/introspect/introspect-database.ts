import type { ColumnMeta, SchemaGraph, TableMeta } from '../describe-schema';
import { withDatabase } from './connect';
import { groupTables } from './group-tables';
import { readConstraints } from './read-constraints';
import { readEnums } from './read-enums';
import { readIndexes } from './read-indexes';
import { readTables } from './read-tables';

/**
 * The live half of the schema graph: what a database ACTUALLY contains, read
 * from pg_catalog, in the same shape describeSchema() derives from the drizzle
 * table objects. Same shape by design — the renderer must not care which path
 * produced its input, and the two being comparable is what makes drift
 * detectable.
 *
 * One connection for the whole read (all four readers share it), closed by
 * withDatabase before this resolves.
 */
export async function introspectDatabase(name: string): Promise<SchemaGraph> {
  return withDatabase(name, async (sql) => {
    const raw = await readTables(sql);
    const constraints = await readConstraints(sql, raw);
    const indexes = await readIndexes(sql, raw);
    const enums = await readEnums(sql);

    const described: Omit<TableMeta, 'group'>[] = raw.map((t) => {
      const c = constraints.get(t.oid)!;
      const pk = new Set(c.primaryKey);
      const fkByColumn = new Map(c.fks.map((fk) => [fk.column, fk]));

      const columns: ColumnMeta[] = t.columns.map((col) => {
        const fk = fkByColumn.get(col.name);
        return {
          name: col.name,
          type: col.type,
          notNull: col.notNull,
          pk: pk.has(col.name),
          fk: fk
            ? { schema: fk.refSchema, table: fk.refTable, column: fk.refColumn }
            : null,
        };
      });

      return {
        name: t.name,
        schema: t.schema,
        columns,
        primaryKey: c.primaryKey,
        uniques: c.uniques,
        checks: c.checks,
        indexes: indexes.get(t.oid) ?? [],
      };
    });

    const { tables, groups } = groupTables(described);
    return { tables, groups, enums };
  });
}
