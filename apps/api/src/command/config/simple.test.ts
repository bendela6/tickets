import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, projects, users } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../run-command';
import { projectCreate } from './project';
import { userCreate } from './user';

beforeEach(resetDb);
afterAll(resetDb);

it('creates a project and a user, each emitting its typed event', async () => {
  const fx = await seedFixture();
  const p = await runCommand(testDb, projectCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    key: 'p2', name: 'Second', itemPrefix: 'P2', schemeId: fx.schemeId,
  });
  expect((await testDb.select().from(projects).where(eq(projects.id, p.id)))).toHaveLength(1);
  const u = await runCommand(testDb, userCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    name: 'agent-bot', kind: 'agent',
  });
  expect((await testDb.select().from(users).where(eq(users.id, u.id)))).toHaveLength(1);
  const kinds = (await testDb.select().from(events)).map((e) => e.kind);
  expect(kinds).toContain('project.created');
  expect(kinds).toContain('user.created');
});
