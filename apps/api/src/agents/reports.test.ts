import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { agentReports, commands, events, outbox } from '@tickets/db';
import { resetDb, seedFixture, testDb, type Fixture } from '../test/db';
import { runCommand } from '../command/run-command';
import { itemCreate } from '../command/item/create';
import { KEPT_FOR_MS, agentWordInput, listReports, saveReport } from './reports';

beforeEach(resetDb);
afterAll(resetDb);

const T0 = new Date('2026-10-15T09:00:00.000Z');
const later = (ms: number) => new Date(T0.getTime() + ms);
const MINUTE = 60_000;

const say = (word: Record<string, unknown>, now = T0) => saveReport(testDb, v.parse(agentWordInput, word), now);

function makeItem(fx: Fixture) {
  return runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'Add the agent reports' },
  });
}

describe('an agent\'s word', () => {
  it('is kept as its report, with its role worked out from its name', async () => {
    const worker = await say({ name: 'worker-tk-7', state: 'working', item: 'TK-7.2', text: 'Writing the Sort type' });
    const planner = await say({ name: 'planner', state: 'listening' });
    expect(worker).toEqual({
      name: 'worker-tk-7', role: 'worker', state: 'working', item: 'TK-7.2', itemId: null,
      text: 'Writing the Sort type', at: T0.toISOString(), since: T0.toISOString(),
    });
    expect(planner).toMatchObject({ role: 'planner', item: null, text: '' });
    expect((await say({ name: 'builder', state: 'listening' }))?.role).toBe('builder');
    expect((await say({ name: 'reviewer', role: 'builder', state: 'working' }))?.role).toBe('builder');
  });

  it('writes over its last word, one row per agent', async () => {
    await say({ name: 'worker-tk-7', state: 'working', item: 'TK-7', text: 'Reading' });
    await say({ name: 'worker-tk-7', state: 'working', item: 'TK-7', text: 'Testing' }, later(MINUTE));
    const rows = await testDb.select().from(agentReports);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.text).toBe('Testing');
  });

  it('keeps `since` while its state and its item stay the same, and moves `at`', async () => {
    await say({ name: 'worker-tk-7', state: 'working', item: 'TK-7', text: 'Reading' });
    const again = await say({ name: 'worker-tk-7', state: 'working', item: 'TK-7', text: 'Testing' }, later(MINUTE));
    expect(again).toMatchObject({ at: later(MINUTE).toISOString(), since: T0.toISOString() });
    // a role is not what it is doing: `since` stays
    const role = await say({ name: 'worker-tk-7', role: 'builder', state: 'working', item: 'TK-7' }, later(2 * MINUTE));
    expect(role?.since).toBe(T0.toISOString());
  });

  it('moves `since` when its state or its item changes', async () => {
    await say({ name: 'worker-tk-7', state: 'working', item: 'TK-7' });
    const item = await say({ name: 'worker-tk-7', state: 'working', item: 'TK-7.2' }, later(MINUTE));
    expect(item?.since).toBe(later(MINUTE).toISOString());
    const state = await say({ name: 'worker-tk-7', state: 'done', item: 'TK-7.2' }, later(2 * MINUTE));
    expect(state?.since).toBe(later(2 * MINUTE).toISOString());
    const none = await say({ name: 'worker-tk-7', state: 'done' }, later(3 * MINUTE));
    expect(none).toMatchObject({ item: null, since: later(3 * MINUTE).toISOString() });
    const still = await say({ name: 'worker-tk-7', state: 'done', item: '' }, later(4 * MINUTE));
    expect(still?.since).toBe(later(3 * MINUTE).toISOString());
  });

  it('links its item when a tickets item has that key, and keeps a plans id unlinked', async () => {
    const fx = await seedFixture();
    const item = await makeItem(fx);
    const linked = await say({ name: 'worker-tst-1', state: 'working', item: item.key });
    expect(linked).toMatchObject({ item: 'TST-1', itemId: item.id });
    const unlinked = await say({ name: 'worker-tk-7', state: 'working', item: 'TST-2' });
    expect(unlinked).toMatchObject({ item: 'TST-2', itemId: null });
    // the link is the key's: an item made with it later is the report's item
    const next = await makeItem(fx);
    expect(next.key).toBe('TST-2');
    const reports = await listReports(testDb, T0);
    expect(reports.find((r) => r.name === 'worker-tk-7')?.itemId).toBe(next.id);
  });

  it('cuts its words to 300 characters', async () => {
    const report = await say({ name: 'worker-tk-7', state: 'working', text: `  ${'x'.repeat(400)}  ` });
    expect(report?.text).toHaveLength(300);
  });

  it('`clear` forgets the agent', async () => {
    await say({ name: 'worker-tk-7', state: 'working' });
    expect(await say({ name: 'worker-tk-7', state: 'clear' })).toBeNull();
    expect(await testDb.select().from(agentReports)).toEqual([]);
  });

  it('goes a week after it was said: no read answers it, and the next word drops it', async () => {
    await say({ name: 'worker-tk-7', state: 'failed' });
    await say({ name: 'worker-tk-8', state: 'working' }, later(MINUTE));
    const weekOn = later(KEPT_FOR_MS + 1);
    expect((await listReports(testDb, weekOn)).map((r) => r.name)).toEqual(['worker-tk-8']);
    expect(await testDb.select().from(agentReports)).toHaveLength(2);
    await say({ name: 'planner', state: 'listening' }, weekOn);
    const names = (await testDb.select().from(agentReports)).map((r) => r.name).sort();
    expect(names).toEqual(['planner', 'worker-tk-8']);
  });

  it('starts afresh when the agent was quiet for a week', async () => {
    await say({ name: 'worker-tk-7', state: 'working', item: 'TK-7' });
    const back = await say({ name: 'worker-tk-7', state: 'working', item: 'TK-7' }, later(KEPT_FOR_MS + 1));
    expect(back?.since).toBe(later(KEPT_FOR_MS + 1).toISOString());
  });

  it('is not a command: it writes no command, event or outbox row', async () => {
    await say({ name: 'builder', state: 'listening' });
    await say({ name: 'builder', state: 'listening' }, later(20_000));
    expect(await testDb.select().from(commands)).toEqual([]);
    expect(await testDb.select().from(events)).toEqual([]);
    expect(await testDb.select().from(outbox)).toEqual([]);
  });
});

describe('the reports', () => {
  it('answer the planner, the builder, then the workers by when they took up their work', async () => {
    await say({ name: 'worker-tk-9', state: 'working' }, later(MINUTE));
    await say({ name: 'worker-tk-7', state: 'working' }, later(2 * MINUTE));
    await say({ name: 'builder', state: 'listening' }, later(3 * MINUTE));
    await say({ name: 'planner', state: 'listening' }, later(4 * MINUTE));
    await say({ name: 'worker-tk-8', state: 'working' });
    const names = (await listReports(testDb, later(5 * MINUTE))).map((r) => r.name);
    expect(names).toEqual(['planner', 'builder', 'worker-tk-8', 'worker-tk-9', 'worker-tk-7']);
  });
});
