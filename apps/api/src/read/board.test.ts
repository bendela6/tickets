import { afterAll, beforeEach, expect, it } from 'vitest';
import { resetDb, seedFixture, testDb } from '../test/db';
import { runCommand } from '../command/run-command';
import { itemCreate } from '../command/item/create';
import { buildBoard } from './board';

beforeEach(resetDb);
afterAll(resetDb);

it('assembles a board with items whose option values render as strings', async () => {
  const fx = await seedFixture();
  await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'Board me' },
  });
  const board = await buildBoard(testDb, fx.projectKey);
  expect(board.project.key).toBe(fx.projectKey);
  expect(board.items).toHaveLength(1);
  expect(board.items[0]!.values.title).toBe('Board me');
  expect(typeof board.items[0]!.values.status).toBe('string'); // option renders to its value
  expect(board.options.length).toBeGreaterThan(0);
});
