import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, projects } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { buildApp } from '../../app';
import { runCommand } from '../run-command';
import { projectUpdate } from './project';

beforeEach(resetDb);
afterAll(resetDb);

const envelope = (actorId: number) => ({ commandId: crypto.randomUUID(), actorId });

async function projectRow(id: number) {
  return (await testDb.select().from(projects).where(eq(projects.id, id)))[0]!;
}

it('a project starts with no repository', async () => {
  const fx = await seedFixture();
  const row = await projectRow(fx.projectId);
  expect(row.repositoryUrl).toBeNull();
  expect(row.defaultBranch).toBeNull();
});

it('sets the repository link and branch, trimmed, and says so in project.updated', async () => {
  const fx = await seedFixture();
  await runCommand(testDb, projectUpdate, envelope(fx.actorId), {
    id: fx.projectId, repositoryUrl: '  https://github.com/bendela6/tickets ', defaultBranch: ' main ',
  });
  const row = await projectRow(fx.projectId);
  expect(row.repositoryUrl).toBe('https://github.com/bendela6/tickets');
  expect(row.defaultBranch).toBe('main');
  const updated = await testDb.select().from(events).where(eq(events.kind, 'project.updated'));
  expect((updated[0]!.payload as { changes: Record<string, unknown> }).changes).toEqual({
    repositoryUrl: 'https://github.com/bendela6/tickets', defaultBranch: 'main',
  });
});

it('refuses a link that is no git link, naming the field', async () => {
  const fx = await seedFixture();
  const attempt = runCommand(testDb, projectUpdate, envelope(fx.actorId), {
    id: fx.projectId, repositoryUrl: 'not a link',
  });
  await expect(attempt).rejects.toThrow(/^invalid command input: repositoryUrl: /);
  expect((await projectRow(fx.projectId)).repositoryUrl).toBeNull();
});

it('refuses a branch name git would not take', async () => {
  const fx = await seedFixture();
  await expect(
    runCommand(testDb, projectUpdate, envelope(fx.actorId), {
      id: fx.projectId, repositoryUrl: 'git@github.com:bendela6/tickets.git', defaultBranch: 'my branch',
    }),
  ).rejects.toThrow(/^invalid command input: defaultBranch: /);
});

it('refuses a branch with no repository to belong to', async () => {
  const fx = await seedFixture();
  await expect(
    runCommand(testDb, projectUpdate, envelope(fx.actorId), { id: fx.projectId, defaultBranch: 'main' }),
  ).rejects.toThrow(/^invalid command input: defaultBranch: /);
});

it('keeps the branch when only the link changes, and clears both when the link is cleared', async () => {
  const fx = await seedFixture();
  await runCommand(testDb, projectUpdate, envelope(fx.actorId), {
    id: fx.projectId, repositoryUrl: 'https://github.com/bendela6/tickets', defaultBranch: 'main',
  });
  await runCommand(testDb, projectUpdate, envelope(fx.actorId), {
    id: fx.projectId, repositoryUrl: 'git@github.com:bendela6/tickets.git',
  });
  expect(await projectRow(fx.projectId)).toMatchObject({
    repositoryUrl: 'git@github.com:bendela6/tickets.git', defaultBranch: 'main',
  });

  await runCommand(testDb, projectUpdate, envelope(fx.actorId), { id: fx.projectId, repositoryUrl: '' });
  expect(await projectRow(fx.projectId)).toMatchObject({ repositoryUrl: null, defaultBranch: null });
});

it('clears the branch alone, back to the remote\'s own default', async () => {
  const fx = await seedFixture();
  await runCommand(testDb, projectUpdate, envelope(fx.actorId), {
    id: fx.projectId, repositoryUrl: 'https://github.com/bendela6/tickets', defaultBranch: 'main',
  });
  await runCommand(testDb, projectUpdate, envelope(fx.actorId), { id: fx.projectId, defaultBranch: null });
  expect(await projectRow(fx.projectId)).toMatchObject({
    repositoryUrl: 'https://github.com/bendela6/tickets', defaultBranch: null,
  });
});

it('answers the repository with the project, on the list and on the board', async () => {
  const fx = await seedFixture();
  const app = buildApp({ db: testDb });
  const patched = await app.inject({
    method: 'PATCH',
    url: `/api/projects/${fx.projectId}`,
    payload: {
      commandId: crypto.randomUUID(), actorId: fx.actorId,
      repositoryUrl: 'https://github.com/bendela6/tickets', defaultBranch: 'main',
    },
  });
  expect(patched.statusCode).toBe(200);

  const list = (await app.inject({ method: 'GET', url: '/api/projects' })).json() as {
    data: { key: string; repositoryUrl: string | null; defaultBranch: string | null }[];
  };
  expect(list.data.find((p) => p.key === fx.projectKey)).toMatchObject({
    repositoryUrl: 'https://github.com/bendela6/tickets', defaultBranch: 'main',
  });

  const board = (await app.inject({ method: 'GET', url: `/api/projects/${fx.projectKey}/board` })).json() as {
    project: { repositoryUrl: string | null; defaultBranch: string | null };
  };
  expect(board.project).toMatchObject({ repositoryUrl: 'https://github.com/bendela6/tickets', defaultBranch: 'main' });
  await app.close();
});

it('answers a refused link with 400 and the field it is about', async () => {
  const fx = await seedFixture();
  const app = buildApp({ db: testDb });
  const res = await app.inject({
    method: 'PATCH',
    url: `/api/projects/${fx.projectId}`,
    payload: { commandId: crypto.randomUUID(), actorId: fx.actorId, repositoryUrl: 'C:/Users/me/tickets' },
  });
  expect(res.statusCode).toBe(400);
  expect((res.json() as { error: string }).error).toMatch(/^invalid command input: repositoryUrl: .*folder/);
  await app.close();
});
