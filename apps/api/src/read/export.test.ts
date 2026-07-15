import { afterAll, beforeEach, expect, it } from 'vitest';
import { resetDb, seedFixture, testDb } from '../test/db';
import { buildExport } from './export';

beforeEach(resetDb);
afterAll(resetDb);

it('exports a project snapshot with a version tag', async () => {
  const fx = await seedFixture();
  const out = await buildExport(testDb, fx.projectKey);
  expect(out.version).toBe(1);
  expect(out.exportedProject.project.key).toBe(fx.projectKey);
});
