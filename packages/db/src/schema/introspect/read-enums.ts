import type postgres from 'postgres';
import type { EnumMeta } from '../describe-schema';

/**
 * Enum declarations, values in declaration order.
 *
 * `enumsortorder`, not `enumlabel`: the label order is the enum's meaning
 * (a status ladder, a priority scale), and sorting alphabetically would
 * silently reorder it.
 */
export async function readEnums(sql: postgres.Sql): Promise<EnumMeta[]> {
  const rows = await sql<{ name: string; schema: string; value: string }[]>`
    SELECT t.typname  AS name,
           n.nspname  AS schema,
           e.enumlabel AS value
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e      ON e.enumtypid = t.oid
    WHERE t.typtype = 'e'
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY n.nspname, t.typname, e.enumsortorder
  `;

  const byId = new Map<string, EnumMeta>();
  for (const row of rows) {
    const schema = row.schema === 'public' ? null : row.schema;
    const id = `${row.schema}.${row.name}`;
    const existing = byId.get(id);
    if (existing) existing.values.push(row.value);
    else byId.set(id, { name: row.name, schema, values: [row.value] });
  }
  return [...byId.values()];
}
