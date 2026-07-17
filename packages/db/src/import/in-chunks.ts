// packages/db/src/import/in-chunks.ts
// postgres.js hard-caps a single statement at 65,534 bind parameters (the
// Postgres wire protocol's limit). Drizzle does not chunk multi-row
// inserts/updates itself, so any statement whose (row count * params per
// row) can approach that ceiling must be split into several statements.
// 1,000 rows per statement keeps every table this importer writes far under
// the limit even as row counts grow between now and the next (cutover) run.
const DEFAULT_CHUNK_SIZE = 1000;

// Runs `fn` once per chunk of `rows`, sequentially (each chunk's statement
// must complete — and its FK/unique constraints must be checked — before the
// next one starts; see import-legacy.ts's NULL-then-UPDATE parent_id note
// for why statement boundaries matter here). Rows are consumed exactly once
// in order, so callers can rely on chunk N covering rows
// [N*size, (N+1)*size).
export async function inChunks<T>(
  rows: readonly T[],
  fn: (chunk: T[]) => Promise<unknown>,
  size = DEFAULT_CHUNK_SIZE,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    await fn(rows.slice(i, i + size));
  }
}
