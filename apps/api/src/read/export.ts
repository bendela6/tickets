import type { Db } from '@tickets/db';
import { buildBoard } from './board';

// The board payload is already the full project snapshot; export wraps it with
// a version tag so a future importer can branch on shape.
export async function buildExport(db: Db, key: string) {
  const board = await buildBoard(db, key);
  return { version: 1, exportedProject: board };
}
