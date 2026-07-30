// packages/db/src/schema/drizzle-roundtrip/render-sql/render-sql.ts
//
// A default is either a JS literal (`.default(0)`) or a sql template
// (`.defaultNow()` → sql`now()`). Both become SQL text: once flattened you can
// no longer tell a SQL string literal from a JS string, so the exporter emits
// everything through sql`…` and never guesses (spec: "SQL text is SQL text").
import { isSQLWrapper, SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

const dialect = new PgDialect();

export function renderSql(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (value instanceof SQL || isSQLWrapper(value)) {
    const query = dialect.sqlToQuery(value instanceof SQL ? value : (value as { getSQL(): SQL }).getSQL());
    return query.sql;
  }
  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
}
