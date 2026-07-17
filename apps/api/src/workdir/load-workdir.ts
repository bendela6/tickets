import { eq } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { workdirs } from '@tickets/db';
import { HttpError } from '../errors';
import { assertWorkdirDir } from './workdir-fs';

// Load + validate a workdir before a route inserts a session row or starts a
// run: a bad id is a 404 and a typo'd path a 400, never a session that dies
// immediately. Shared by both subsystems — terminal/routes.ts (session
// create), agent/routes.ts (session create) and agent/dispatch.ts — so the
// three never drift.
export async function loadRunnableWorkdir(db: Db, workdirId: number) {
  const [wd] = await db.select().from(workdirs).where(eq(workdirs.id, workdirId));
  if (!wd) throw new HttpError(404, 'workdir not found');
  if (wd.runner === 'container') {
    throw new HttpError(400, 'container runner is not supported yet');
  }
  await assertWorkdirDir(wd.path);
  return wd;
}
