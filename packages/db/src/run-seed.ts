import { createDbClient } from './client';
import { ensureSoftwareScheme } from './seed/ensure-software-scheme';
import { seedProject } from './seed/seed-project';

const [key, name, ticketPrefix] = process.argv.slice(2);
if (!key || !name || !ticketPrefix) {
  console.error('usage: pnpm db:seed <key> <name> <ticket-prefix>');
  process.exit(1);
}

const { db, sql } = createDbClient({ max: 1 });

const { schemeId } = await ensureSoftwareScheme(db);
const seeded = await seedProject(db, { key, name, ticketPrefix, schemeId });
await sql.end();
console.log(`seeded project ${seeded.project.key} (#${seeded.project.id}) bound to scheme #${schemeId}`);
