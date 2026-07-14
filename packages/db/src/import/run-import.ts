// packages/db/src/import/run-import.ts
// Thin entry point: read the restored legacy database, write it into the
// (already-migrated) target database, close both connections, log counts.
import { createDbClient } from '../client';
import { importLegacy } from './import-legacy';
import { createLegacyClient } from './legacy-client';
import { readLegacy } from './read-legacy';

const target = createDbClient({ max: 1 });
const legacyClient = createLegacyClient();

const legacy = await readLegacy(legacyClient.sql);
const result = await importLegacy(target.db, legacy);

await target.sql.end();
await legacyClient.sql.end();

console.log(
  `imported ${legacy.tickets.length} items, ${legacy.ticketValues.length} values, ` +
    `${legacy.comments.length} comments, ${legacy.ticketLinks.length} links, ` +
    `${legacy.projects.length} projects into scheme #${result.schemeId}`,
);
