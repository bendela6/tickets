// packages/db/src/import/run-verify.ts
// Thin entry point: diff the logical state of every item between
// tickets_legacy and the target database, print the report, and exit
// non-zero if anything's wrong. A real tool, not just a test — see
// .superpowers/sdd/task-12-brief.md.
import { createDbClient } from '../client';
import { assertNotProductionDatabase } from './guard-not-production';
import { createLegacyClient } from './legacy-client';
import { verifyImport } from './verify-import';

assertNotProductionDatabase();

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

const MAX_PRINTED_DIFFS = 50;

function printDiffs<T extends { field: string; legacy: string | null; imported: string | null }>(
  label: string,
  diffs: T[],
  describe: (d: T) => string,
) {
  console.log(`\n${label}: ${diffs.length}`);
  for (const d of diffs.slice(0, MAX_PRINTED_DIFFS)) {
    console.log(`  ${describe(d)} field "${d.field}": legacy=${JSON.stringify(d.legacy)} imported=${JSON.stringify(d.imported)}`);
  }
  if (diffs.length > MAX_PRINTED_DIFFS) {
    console.log(`  ...and ${diffs.length - MAX_PRINTED_DIFFS} more`);
  }
}

printDiffs('Item value diffs', report.itemDiffs, (d) => `item ${d.itemId}`);
printDiffs('Item skeleton diffs', report.skeletonDiffs, (d) => `item ${d.itemId}`);
printDiffs('Comment diffs', report.commentDiffs, (d) => `comment ${d.commentId}`);
printDiffs('Item link diffs', report.linkDiffs, (d) => `link ${d.linkId}`);

const totalDiffs =
  report.itemDiffs.length + report.skeletonDiffs.length + report.commentDiffs.length + report.linkDiffs.length;
console.log(`\n${report.ok ? 'PASS' : 'FAIL'}: ${report.ok ? '0 differences, all counts match' : `${totalDiffs} difference(s) found — see above`}`);

if (!report.ok) {
  process.exitCode = 1;
}
