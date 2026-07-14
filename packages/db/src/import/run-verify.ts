// packages/db/src/import/run-verify.ts
// Thin entry point: diff the logical state of every item between
// tickets_legacy and the target database, print the report, and exit
// non-zero if anything's wrong. A real tool, not just a test — see
// .superpowers/sdd/task-12-brief.md.
import { createDbClient } from '../client';
import { createLegacyClient } from './legacy-client';
import { verifyImport } from './verify-import';

const target = createDbClient({ max: 1 });
const legacyClient = createLegacyClient();

const report = await verifyImport(target.db, legacyClient.sql);

await target.sql.end();
await legacyClient.sql.end();

console.log('Row counts:');
for (const c of report.counts) {
  const status = c.ok ? 'OK  ' : 'FAIL';
  console.log(`  ${status}  ${c.table.padEnd(18)} legacy ${c.legacy}  imported ${c.imported}`);
}

console.log(`\nItem diffs: ${report.itemDiffs.length}`);
const MAX_PRINTED_DIFFS = 50;
for (const d of report.itemDiffs.slice(0, MAX_PRINTED_DIFFS)) {
  console.log(`  item ${d.itemId} field "${d.field}": legacy=${JSON.stringify(d.legacy)} imported=${JSON.stringify(d.imported)}`);
}
if (report.itemDiffs.length > MAX_PRINTED_DIFFS) {
  console.log(`  ...and ${report.itemDiffs.length - MAX_PRINTED_DIFFS} more`);
}

console.log(`\n${report.ok ? 'PASS' : 'FAIL'}: ${report.ok ? '0 differences, all counts match' : 'differences found — see above'}`);

if (!report.ok) {
  process.exitCode = 1;
}
