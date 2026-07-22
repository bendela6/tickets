// Called by docker/entrypoint.sh before db:migrate. Reads the target database
// (POSTGRES_DATABASE) and refuses to proceed if it looks like the OLD schema —
// so a container boot can never fire the new baseline at an un-swapped prod.
// Read-only and deliberately NOT behind assertNotProductionDatabase: inspecting
// `tickets` is exactly what we want here.
import { createDbClient } from './client';
import { environment } from './environment';
import { classifySchema } from './schema-classify';

const { sql } = createDbClient({ max: 1 });
const rows = await sql<{ table_name: string }[]>`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
`;
await sql.end();

const target = environment.postgres.database;
const kind = classifySchema(rows.map((r) => r.table_name));

if (kind === 'old') {
  console.error(
    `schema-guard: refusing to migrate — target "${target}" looks like the OLD ` +
      '(pre-items) schema. Run the SP4c cutover swap before deploying ' +
      '(see docs/runbooks/sp4c-cutover.md).',
  );
  process.exit(1);
}
console.log(`schema-guard: target "${target}" is ${kind}; proceeding with db:migrate.`);
