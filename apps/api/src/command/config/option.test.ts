import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, options } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { loadSchemeVocab } from '../../vocab/load-scheme-vocab';
import { runCommand } from '../run-command';
import { optionCreate } from './option';

beforeEach(resetDb);
afterAll(resetDb);

it('adds a status option (an option with a kind) and emits option.created', async () => {
  const fx = await seedFixture();
  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });
  const typeId = [...vocab.typeById.keys()].find((id) => vocab.workflowField(id))!;
  const statusFieldId = vocab.workflowField(typeId)!.id;
  const res = await runCommand(testDb, optionCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    fieldId: statusFieldId, value: 'archived-status', label: 'Archived', kind: 'done',
  });
  const row = (await testDb.select().from(options).where(eq(options.id, res.id)))[0]!;
  expect(row.kind).toBe('done');
  expect((await testDb.select().from(events).where(eq(events.kind, 'option.created')))).toHaveLength(1);
});
