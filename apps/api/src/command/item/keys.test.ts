import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDbClient, items } from '@tickets/db';
import { buildApp } from '../../app';
import { resetDb, seedFixture, seedPlanFixture, testDb, type Fixture } from '../../test/db';
import { runCommand } from '../run-command';
import { itemCreate } from './create';
import { itemUpdate } from './update';

beforeEach(resetDb);
afterAll(resetDb);

const WHERE = [{ repo: 'tickets', part: 'apps/api' }];

function envelope(fx: Fixture) {
  return { commandId: crypto.randomUUID(), actorId: fx.actorId };
}

function make(fx: Fixture, typeKey: string, parent?: { id: number }, values: Record<string, unknown> = {}) {
  const where = typeKey === 'feature' ? { where: WHERE } : {};
  return runCommand(testDb, itemCreate, envelope(fx), {
    projectKey: fx.projectKey, typeKey, parentId: parent?.id ?? null, values: { title: `Add a ${typeKey}`, ...where, ...values },
  });
}

async function keyOf(id: number) {
  return (await testDb.select({ key: items.key }).from(items).where(eq(items.id, id)))[0]?.key;
}

describe('a numbered project', () => {
  it('keys each item by its prefix and number', async () => {
    const fx = await seedFixture();
    const first = await make(fx, 'task');
    const second = await make(fx, 'bug');
    const child = await make(fx, 'subtask', first);
    expect([first.key, second.key, child.key]).toEqual(['TST-1', 'TST-2', 'TST-3']);
    expect(await keyOf(child.id)).toBe('TST-3');
  });
});

describe('a plan project', () => {
  it('keys an epic PREFIX/E<n> and a feature PREFIX-<n>, each numbered apart from the items', async () => {
    const fx = await seedPlanFixture();
    const e1 = await make(fx, 'epic');
    const f1 = await make(fx, 'feature', e1);
    await make(fx, 'ticket', f1);
    const e2 = await make(fx, 'epic');
    const f2 = await make(fx, 'feature', e2);
    const f3 = await make(fx, 'feature', e1);
    expect([e1.key, e2.key]).toEqual(['PLN/E1', 'PLN/E2']);
    expect([f1.key, f2.key, f3.key]).toEqual(['PLN-1', 'PLN-2', 'PLN-3']);
    expect(f3.number).toBe(6); // the item's number goes on counting every item
  });

  it("keys a ticket and a subticket by their parent's key and the next number under it", async () => {
    const fx = await seedPlanFixture();
    const epic = await make(fx, 'epic');
    const feature = await make(fx, 'feature', epic);
    const t1 = await make(fx, 'ticket', feature);
    const t2 = await make(fx, 'ticket', feature);
    const s1 = await make(fx, 'subticket', t1);
    const s2 = await make(fx, 'subticket', t1);
    const s11 = await make(fx, 'subticket', s1);
    const t3 = await make(fx, 'ticket', feature);
    expect([t1.key, t2.key, t3.key]).toEqual(['PLN-1.1', 'PLN-1.2', 'PLN-1.3']);
    expect([s1.key, s2.key, s11.key]).toEqual(['PLN-1.1.1', 'PLN-1.1.2', 'PLN-1.1.1.1']);
  });

  it('never gives a number again: an archived ticket keeps its key and the next takes one past it', async () => {
    const fx = await seedPlanFixture();
    const feature = await make(fx, 'feature', await make(fx, 'epic'));
    const t1 = await make(fx, 'ticket', feature);
    const t2 = await make(fx, 'ticket', feature);
    await runCommand(testDb, itemUpdate, envelope(fx), { id: t2.id, expectedUpdatedAt: t2.updatedAt, archived: true });
    const t3 = await make(fx, 'ticket', feature);
    expect([t1.key, t2.key, t3.key]).toEqual(['PLN-1.1', 'PLN-1.2', 'PLN-1.3']);
  });

  it('gives creates racing under one parent each their own number', async () => {
    const fx = await seedPlanFixture();
    const feature = await make(fx, 'feature', await make(fx, 'epic'));
    // a client of its own with room for every create at once, so they race for
    // the project's row lock instead of queueing on testDb's one connection
    const racing = createDbClient({ max: 6 });
    try {
      const created = await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          runCommand(racing.db, itemCreate, envelope(fx), {
            projectKey: fx.projectKey, typeKey: 'ticket', parentId: feature.id, values: { title: `Add ticket ${i}` },
          })),
      );
      expect(created.map((c) => c.key).sort()).toEqual(
        ['PLN-1.1', 'PLN-1.2', 'PLN-1.3', 'PLN-1.4', 'PLN-1.5', 'PLN-1.6'],
      );
    } finally {
      await racing.sql.end();
    }
  });

  it('refuses a ticket or a subticket without a parent, since its key is its parent\'s', async () => {
    const fx = await seedPlanFixture();
    await expect(make(fx, 'ticket')).rejects.toMatchObject({
      statusCode: 422,
      message: "a ticket is made under its parent in a plan: its key is its parent's and the next number under it",
    });
  });

  it('refuses moving a plan item to another parent, or off its parent', async () => {
    const fx = await seedPlanFixture();
    const epic = await make(fx, 'epic');
    const f1 = await make(fx, 'feature', epic);
    const f2 = await make(fx, 'feature', epic);
    const ticket = await make(fx, 'ticket', f1);
    const message =
      'PLN-1.1 never moves to another parent, since its key says where it sits: cancel it and write it anew under the other';
    await expect(
      runCommand(testDb, itemUpdate, envelope(fx), { id: ticket.id, expectedUpdatedAt: ticket.updatedAt, parentId: f2.id }),
    ).rejects.toMatchObject({ statusCode: 422, message });
    await expect(
      runCommand(testDb, itemUpdate, envelope(fx), { id: ticket.id, expectedUpdatedAt: ticket.updatedAt, parentId: null }),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(await keyOf(ticket.id)).toBe('PLN-1.1');
  });
});

describe('GET /api/items/by-key/:key', () => {
  it('finds an item by its key in any project, an epic by its encoded slash or a plain one', async () => {
    const plan = await seedPlanFixture();
    const numbered = await seedFixture();
    const epic = await make(plan, 'epic');
    const feature = await make(plan, 'feature', epic);
    const ticket = await make(plan, 'ticket', feature, { status: 'done' });
    const task = await make(numbered, 'task');
    const app = buildApp({ db: testDb });
    try {
      const byTicket = await app.inject({ method: 'GET', url: '/api/items/by-key/PLN-1.1' });
      expect(byTicket.statusCode).toBe(200);
      expect(byTicket.json()).toMatchObject({
        id: ticket.id, key: 'PLN-1.1', projectKey: 'plan', typeKey: 'ticket', parentId: feature.id,
        values: { title: 'Add a ticket', status: 'done' },
      });
      const byTask = await app.inject({ method: 'GET', url: '/api/items/by-key/TST-1' });
      expect(byTask.json()).toMatchObject({ id: task.id, key: 'TST-1', projectKey: 'test', typeKey: 'task' });
      for (const url of ['/api/items/by-key/PLN%2FE1', '/api/items/by-key/PLN/E1']) {
        const byEpic = await app.inject({ method: 'GET', url });
        expect(byEpic.json()).toMatchObject({ id: epic.id, key: 'PLN/E1', typeKey: 'epic' });
      }
      const missing = await app.inject({ method: 'GET', url: '/api/items/by-key/PLN-9' });
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toEqual({ error: 'no item PLN-9' });
    } finally {
      await app.close();
    }
  });

  it('gives the board its items with their keys', async () => {
    const fx = await seedPlanFixture();
    const epic = await make(fx, 'epic');
    const app = buildApp({ db: testDb });
    try {
      const board = (await app.inject({ method: 'GET', url: `/api/projects/${fx.projectKey}/board` })).json() as {
        plan: boolean; items: { id: number; key: string }[];
      };
      expect(board.plan).toBe(true);
      expect(board.items).toEqual([expect.objectContaining({ id: epic.id, key: 'PLN/E1' })]);
    } finally {
      await app.close();
    }
  });
});
