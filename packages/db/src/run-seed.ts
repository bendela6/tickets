import { createDbClient } from './client';
import { ensureScheme } from './seed/ensure-scheme';
import { planScheme } from './seed/plan-scheme';
import { seedProject } from './seed/seed-project';
import { softwareScheme } from './seed/software-scheme';

const SCHEMES = { software: softwareScheme, plan: planScheme };

const [key, name, itemPrefix, schemeKey = 'software'] = process.argv.slice(2);
const scheme = SCHEMES[schemeKey as keyof typeof SCHEMES];
if (!key || !name || !itemPrefix || !scheme) {
  console.error(`usage: pnpm db:seed <key> <name> <item-prefix> [${Object.keys(SCHEMES).join('|')}]`);
  process.exit(1);
}

const { db, sql } = createDbClient({ max: 1 });

const { schemeId } = await ensureScheme(db, scheme);
const seeded = await seedProject(db, { key, name, itemPrefix, schemeId, view: scheme.defaultView });
await sql.end();
console.log(
  `seeded project ${seeded.project.key} (#${seeded.project.id}) bound to the ${scheme.key} scheme #${schemeId}`,
);
