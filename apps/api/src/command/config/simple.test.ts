import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, projects, users } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../run-command';
import { HttpError } from '../../errors';
import { projectCreate, projectUpdate } from './project';
import { schemeFork } from './scheme';
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

it('forks a scheme then repoints the project to it, emitting project.updated', async () => {
  const fx = await seedFixture();
  const forked = await runCommand(testDb, schemeFork, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    sourceSchemeId: fx.schemeId, key: 'test-fork', name: 'Test (fork)',
  });
  await runCommand(testDb, projectUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    id: fx.projectId, schemeId: forked.schemeId,
  });
  const row = (await testDb.select().from(projects).where(eq(projects.id, fx.projectId)))[0]!;
  expect(row.schemeId).toBe(forked.schemeId);
  const updated = await testDb.select().from(events).where(eq(events.kind, 'project.updated'));
  expect(updated).toHaveLength(1);
  expect((updated[0]!.payload as { changes: { schemeId?: number } }).changes.schemeId).toBe(forked.schemeId);
});

it('404s updating a missing project', async () => {
  const fx = await seedFixture();
  await expect(
    runCommand(testDb, projectUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
      id: 999999, schemeId: fx.schemeId,
    }),
  ).rejects.toThrow(HttpError);
});
