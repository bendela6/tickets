import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, optionTransitions } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { loadSchemeVocab } from '../../vocab/load-scheme-vocab';
import { runCommand } from '../run-command';
import { transitionCreate, transitionDelete } from './transition';

beforeEach(resetDb);
afterAll(resetDb);

it('creates and deletes an option transition, emitting the right events', async () => {
  const fx = await seedFixture();
  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });
  const typeId = [...vocab.typeById.keys()].find((id) => vocab.workflowField(id))!;
  const wf = vocab.workflowField(typeId)!;
  const opts = vocab.optionsForField(typeId, wf.id);
  const created = await runCommand(testDb, transitionCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    fieldId: wf.id, fromOptionId: opts[0]!.id, toOptionId: opts[1]!.id,
  });
  expect((await testDb.select().from(optionTransitions).where(eq(optionTransitions.id, created.id)))).toHaveLength(1);
  await runCommand(testDb, transitionDelete, { commandId: crypto.randomUUID(), actorId: fx.actorId }, { id: created.id });
  expect((await testDb.select().from(optionTransitions).where(eq(optionTransitions.id, created.id)))).toHaveLength(0);
  const kinds = (await testDb.select().from(events)).map((e) => e.kind);
  expect(kinds).toContain('transition.created');
  expect(kinds).toContain('transition.deleted');
});
