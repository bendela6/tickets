import { afterAll, beforeEach, expect, it } from 'vitest';
import { resetDb, seedFixture, testDb } from './db';
import { items, projects } from '@tickets/db';

beforeEach(resetDb);
afterAll(resetDb);

it('seeds a project bound to the software scheme, on a clean db', async () => {
  const fx = await seedFixture();
  expect(fx.projectId).toBeGreaterThan(0);
  expect(fx.typeIdByKey.size).toBeGreaterThan(0);
  const projectRows = await testDb.select().from(projects);
  expect(projectRows).toHaveLength(1);
  const itemRows = await testDb.select().from(items);
  expect(itemRows).toHaveLength(0);
});
