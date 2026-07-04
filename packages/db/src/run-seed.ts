import { createDbClient } from './client';
import { seedProject } from './seed/seed-project';

const [key, name, ticketPrefix] = process.argv.slice(2);
if (!key || !name || !ticketPrefix) {
  console.error('usage: pnpm db:seed <key> <name> <ticket-prefix>');
  process.exit(1);
}

const { db, sql } = createDbClient({ max: 1 });
const seeded = await seedProject(db, { key, name, ticketPrefix });
await sql.end();
console.log(
  `seeded project ${seeded.project.key} (#${seeded.project.id}): ` +
    `${Object.keys(seeded.typeByKey).length} types, ` +
    `${Object.keys(seeded.statusByKey).length} statuses, ` +
    `${Object.keys(seeded.fieldByKey).length} fields`,
);
