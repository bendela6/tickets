import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { itemLinks } from '@tickets/db';
import { resetDb, seedFixture, seedPlanFixture, testDb, type Fixture } from '../../test/db';
import { runCommand } from '../run-command';
import { itemCreate } from './create';
import { itemLink } from './link';

beforeEach(resetDb);
afterAll(resetDb);

// A plan blocker is a `blocks` link from the blocker to the item that waits
// on it: blocks(B, X, why) is the plans' X.blockedBy [{ id: B, why }].

const WHERE = [{ repo: 'tickets', part: 'apps/api' }];
type Made = { id: number; key: string };

function envelope(fx: Fixture) {
  return { commandId: crypto.randomUUID(), actorId: fx.actorId };
}

async function make(fx: Fixture, typeKey: string, parent?: Made): Promise<Made> {
  const created = await runCommand(testDb, itemCreate, envelope(fx), {
    projectKey: fx.projectKey, typeKey, parentId: parent?.id ?? null,
    values: { title: `Add a ${typeKey}`, ...(typeKey === 'feature' ? { where: WHERE } : {}) },
  });
  return { id: created.id, key: created.key };
}

// `item` waits on `blocker`, for `why`
function block(fx: Fixture, item: Made, blocker: Made, why: string | null = `${item.key} needs ${blocker.key}`) {
  return runCommand(testDb, itemLink, envelope(fx), {
    linkTypeKey: 'blocks', sourceItemId: blocker.id, targetItemId: item.id, ...(why === null ? {} : { why }),
  });
}

function refused(promise: Promise<unknown>, message: string) {
  return expect(promise).rejects.toMatchObject({ statusCode: 422, message });
}

// PLN/E1 ─ PLN-1 ─ PLN-1.1 ─ PLN-1.1.1
//        │       └ PLN-1.2
//        └ PLN-2 ─ PLN-2.1
// PLN/E2 ─ PLN-3 ─ PLN-3.1
async function plan(fx: Fixture) {
  const e1 = await make(fx, 'epic');
  const f1 = await make(fx, 'feature', e1);
  const t11 = await make(fx, 'ticket', f1);
  const s111 = await make(fx, 'subticket', t11);
  const t12 = await make(fx, 'ticket', f1);
  const f2 = await make(fx, 'feature', e1);
  const t21 = await make(fx, 'ticket', f2);
  const e2 = await make(fx, 'epic');
  const f3 = await make(fx, 'feature', e2);
  const t31 = await make(fx, 'ticket', f3);
  return { e1, f1, t11, s111, t12, f2, t21, e2, f3, t31 };
}

describe('a plan blocker', () => {
  it('links any two plan items, epics included, keeping its why', async () => {
    const fx = await seedPlanFixture();
    const p = await plan(fx);
    const tickets = await block(fx, p.t12, p.t11, 'needs the keys first');
    const epics = await block(fx, p.e2, p.e1);
    const across = await block(fx, p.t31, p.f2);
    const rows = await testDb.select().from(itemLinks).where(eq(itemLinks.id, tickets.id));
    expect(rows[0]).toMatchObject({ sourceItemId: p.t11.id, targetItemId: p.t12.id, why: 'needs the keys first' });
    expect(epics.id).toBeGreaterThan(0);
    expect(across.id).toBeGreaterThan(0);
  });

  it('needs a why', async () => {
    const fx = await seedPlanFixture();
    const p = await plan(fx);
    const message = 'a blocker says why: why does PLN-1.2 wait on PLN-1.1?';
    await refused(block(fx, p.t12, p.t11, null), message);
    await refused(block(fx, p.t12, p.t11, '   '), message);
  });

  it('is never the item itself', async () => {
    const fx = await seedPlanFixture();
    const p = await plan(fx);
    await refused(block(fx, p.t11, p.t11), 'PLN-1.1 waits on itself');
  });

  it('is never its own parent, at any height', async () => {
    const fx = await seedPlanFixture();
    const p = await plan(fx);
    await refused(block(fx, p.t11, p.f1), 'PLN-1.1 waits on PLN-1, its own parent: a parent is done after its children');
    await refused(block(fx, p.s111, p.e1), 'PLN-1.1.1 waits on PLN/E1, its own parent: a parent is done after its children');
  });

  it('is never its own child, at any depth', async () => {
    const fx = await seedPlanFixture();
    const p = await plan(fx);
    await refused(block(fx, p.f1, p.t11), 'PLN-1 waits on PLN-1.1, its own child: a parent waits on its children already');
    await refused(block(fx, p.e1, p.s111), 'PLN/E1 waits on PLN-1.1.1, its own child: a parent waits on its children already');
  });

  it('is never the same one twice', async () => {
    const fx = await seedPlanFixture();
    const p = await plan(fx);
    await block(fx, p.t12, p.t21);
    await refused(block(fx, p.t12, p.t21), 'PLN-1.2 lists PLN-2.1 twice in blockedBy');
  });

  it('is never one a parent of it waits on already: children inherit that', async () => {
    const fx = await seedPlanFixture();
    const p = await plan(fx);
    await block(fx, p.f1, p.f3);
    await refused(
      block(fx, p.s111, p.f3),
      'PLN-1.1.1 waits on PLN-3, as its parent PLN-1 does: children inherit that',
    );
  });

  it('is never one a child of it waits on already, which would then inherit it twice', async () => {
    const fx = await seedPlanFixture();
    const p = await plan(fx);
    await block(fx, p.t11, p.f3);
    await refused(
      block(fx, p.f1, p.f3),
      "PLN-1.1 waits on PLN-3 already, and children inherit their parents' blockers: take it off PLN-1.1 before PLN-1 waits on it",
    );
  });

  it('never closes a cycle through blockers', async () => {
    const fx = await seedPlanFixture();
    const p = await plan(fx);
    await block(fx, p.t12, p.t21); // PLN-1.2 waits on PLN-2.1
    await block(fx, p.t21, p.t31); // PLN-2.1 waits on PLN-3.1
    await refused(block(fx, p.t31, p.t12), 'PLN-3.1 waits on itself: PLN-3.1 → PLN-1.2 → PLN-2.1 → PLN-3.1');
  });

  it('never closes a cycle through children', async () => {
    const fx = await seedPlanFixture();
    const p = await plan(fx);
    // PLN-3 waits on its ticket PLN-3.1 (a parent waits on its children), so
    // PLN-3.1 can't wait on what waits on PLN-3.
    await block(fx, p.t21, p.f3); // PLN-2.1 waits on PLN-3
    await refused(block(fx, p.t31, p.t21), 'PLN-3.1 waits on itself: PLN-3.1 → PLN-2.1 → PLN-3 → PLN-3.1');
  });

  it("never closes a cycle through a parent's blockers", async () => {
    const fx = await seedPlanFixture();
    const p = await plan(fx);
    // PLN-2 waits on PLN-1.2: PLN-2.1 inherits it. PLN-1.2 waiting on PLN-2.1
    // would wait on what waits on it.
    await block(fx, p.f2, p.t12);
    await refused(block(fx, p.t12, p.t21), 'PLN-1.2 waits on itself: PLN-1.2 → PLN-2.1 → PLN-1.2');
  });

  it('never closes a cycle that runs through an item below the one that would wait', async () => {
    const fx = await seedPlanFixture();
    const p = await plan(fx);
    // PLN-3.1 waits on PLN-1.1.1. If PLN-1.1 waited on PLN-3.1, PLN-1.1.1
    // would inherit that: PLN-1.1.1 → PLN-3.1 → PLN-1.1.1.
    await block(fx, p.t31, p.s111);
    await refused(block(fx, p.t11, p.t31), 'PLN-1.1.1 waits on itself: PLN-1.1.1 → PLN-3.1 → PLN-1.1.1');
  });
});

describe("the software scheme's blocks", () => {
  it('needs no why and keeps no plan rule', async () => {
    const fx = await seedFixture();
    const a = await runCommand(testDb, itemCreate, envelope(fx), { projectKey: fx.projectKey, typeKey: 'task', values: { title: 'A' } });
    const b = await runCommand(testDb, itemCreate, envelope(fx), { projectKey: fx.projectKey, typeKey: 'task', values: { title: 'B' } });
    await runCommand(testDb, itemLink, envelope(fx), { linkTypeKey: 'blocks', sourceItemId: a.id, targetItemId: b.id });
    // a cycle the plan would refuse
    const back = await runCommand(testDb, itemLink, envelope(fx), { linkTypeKey: 'blocks', sourceItemId: b.id, targetItemId: a.id });
    expect(back.id).toBeGreaterThan(0);
  });
});
