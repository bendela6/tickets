import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { comments, events } from '@tickets/db';
import { resetDb, seedFixture, testDb, type Fixture } from '../../test/db';
import { buildApp } from '../../app';
import { runCommand } from '../run-command';
import { itemCreate } from './create';
import { itemComment } from './comment';

beforeEach(resetDb);
afterAll(resetDb);

const envelope = (actorId: number) => ({ commandId: crypto.randomUUID(), actorId });

async function createItem(fx: Fixture, title = 'X') {
  return runCommand(testDb, itemCreate, envelope(fx.actorId), {
    projectKey: fx.projectKey, typeKey: 'task', values: { title },
  });
}

async function comment(fx: Fixture, input: Record<string, unknown>) {
  return runCommand(testDb, itemComment, envelope(fx.actorId), input);
}

async function row(id: number) {
  return (await testDb.select().from(comments).where(eq(comments.id, id)))[0]!;
}

it('adds a comment and emits comment.added', async () => {
  const fx = await seedFixture();
  const item = await createItem(fx);
  const res = await comment(fx, { itemId: item.id, body: 'hello' });
  expect((await testDb.select().from(comments).where(eq(comments.id, res.id)))).toHaveLength(1);
  expect((await testDb.select().from(events).where(eq(events.kind, 'comment.added')))).toHaveLength(1);
});

describe('a comment on a fragment of the description', () => {
  it('is on the item as a whole when it quotes nothing', async () => {
    const fx = await seedFixture();
    const item = await createItem(fx);
    const res = await comment(fx, { itemId: item.id, body: 'hello' });
    expect(await row(res.id)).toMatchObject({ quote: null, nth: null });
  });

  it('keeps the quote with its whitespace collapsed, at its first place unless told', async () => {
    const fx = await seedFixture();
    const item = await createItem(fx);
    const res = await comment(fx, { itemId: item.id, body: 'why?', quote: '  the  first\n\tline  ' });
    expect(await row(res.id)).toMatchObject({ quote: 'the first line', nth: 0 });
  });

  it('keeps which place of the quote it is', async () => {
    const fx = await seedFixture();
    const item = await createItem(fx);
    const res = await comment(fx, { itemId: item.id, body: 'this one', quote: 'twice', nth: 1 });
    expect(await row(res.id)).toMatchObject({ quote: 'twice', nth: 1 });
  });

  it('takes a quote of 1000 characters and refuses a longer one', async () => {
    const fx = await seedFixture();
    const item = await createItem(fx);
    const res = await comment(fx, { itemId: item.id, body: 'long', quote: 'a'.repeat(1000) });
    expect((await row(res.id)).quote).toHaveLength(1000);
    await expect(comment(fx, { itemId: item.id, body: 'too long', quote: 'a'.repeat(1001) }))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('quote') });
  });

  it('measures the quote after collapsing its whitespace', async () => {
    const fx = await seedFixture();
    const item = await createItem(fx);
    const res = await comment(fx, { itemId: item.id, body: 'spaced', quote: `${'a '.repeat(500)}    ` });
    expect((await row(res.id)).quote).toHaveLength(999);
  });

  it('refuses a quote that is only whitespace', async () => {
    const fx = await seedFixture();
    const item = await createItem(fx);
    await expect(comment(fx, { itemId: item.id, body: 'empty', quote: ' \n ' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('refuses a place without a quote, and a negative place', async () => {
    const fx = await seedFixture();
    const item = await createItem(fx);
    await expect(comment(fx, { itemId: item.id, body: 'where?', nth: 1 }))
      .rejects.toMatchObject({ statusCode: 422 });
    await expect(comment(fx, { itemId: item.id, body: 'where?', quote: 'x', nth: -1 }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(await testDb.select().from(comments)).toHaveLength(0);
  });

  it("puts a reply on its thread's fragment", async () => {
    const fx = await seedFixture();
    const item = await createItem(fx);
    const thread = await comment(fx, { itemId: item.id, body: 'why?', quote: 'twice', nth: 1 });
    const reply = await comment(fx, { itemId: item.id, body: 'because', parentId: thread.id });
    const replyToReply = await comment(fx, { itemId: item.id, body: 'ok', parentId: reply.id });
    expect(await row(reply.id)).toMatchObject({ parentId: thread.id, quote: 'twice', nth: 1 });
    expect(await row(replyToReply.id)).toMatchObject({ quote: 'twice', nth: 1 });
  });

  it('leaves a reply on the item as a whole when its thread is', async () => {
    const fx = await seedFixture();
    const item = await createItem(fx);
    const thread = await comment(fx, { itemId: item.id, body: 'hello' });
    const reply = await comment(fx, { itemId: item.id, body: 'hi', parentId: thread.id });
    expect(await row(reply.id)).toMatchObject({ quote: null, nth: null });
  });

  it("refuses a reply that names its own quote or place", async () => {
    const fx = await seedFixture();
    const item = await createItem(fx);
    const thread = await comment(fx, { itemId: item.id, body: 'why?', quote: 'this' });
    await expect(comment(fx, { itemId: item.id, body: 'no', parentId: thread.id, quote: 'that' }))
      .rejects.toMatchObject({ statusCode: 422, message: expect.stringContaining('reply') });
    await expect(comment(fx, { itemId: item.id, body: 'no', parentId: thread.id, nth: 0 }))
      .rejects.toMatchObject({ statusCode: 422 });
    expect(await testDb.select().from(comments)).toHaveLength(1);
  });

  it('comes back on the board with its quote and place', async () => {
    const fx = await seedFixture();
    const item = await createItem(fx);
    const thread = await comment(fx, { itemId: item.id, body: 'why?', quote: 'twice', nth: 1 });
    await comment(fx, { itemId: item.id, body: 'because', parentId: thread.id });
    await comment(fx, { itemId: item.id, body: 'and the rest?' });
    const app = buildApp({ db: testDb });
    const res = await app.inject({ method: 'GET', url: `/api/projects/${fx.projectKey}/board` });
    await app.close();
    const board = res.json() as { items: Array<{ id: number; comments: Array<Record<string, unknown>> }> };
    const shown = board.items.find((candidate) => candidate.id === item.id)!.comments;
    expect(shown.map(({ body, parentId, quote, nth }) => ({ body, parentId, quote, nth }))).toEqual(
      expect.arrayContaining([
        { body: 'why?', parentId: null, quote: 'twice', nth: 1 },
        { body: 'because', parentId: thread.id, quote: 'twice', nth: 1 },
        { body: 'and the rest?', parentId: null, quote: null, nth: null },
      ]),
    );
    expect(shown).toHaveLength(3);
  });

  it('comes in through the comments route', async () => {
    const fx = await seedFixture();
    const item = await createItem(fx);
    const app = buildApp({ db: testDb });
    const res = await app.inject({
      method: 'POST',
      url: `/api/items/${item.id}/comments`,
      payload: { ...envelope(fx.actorId), body: 'on this', quote: 'the\nfragment', nth: 2 },
    });
    await app.close();
    expect(res.statusCode).toBe(201);
    expect(await row((res.json() as { id: number }).id)).toMatchObject({ quote: 'the fragment', nth: 2 });
  });
});

describe('a reply', () => {
  it('goes under a comment on the same item', async () => {
    const fx = await seedFixture();
    const item = await createItem(fx);
    const thread = await comment(fx, { itemId: item.id, body: 'hello' });
    const reply = await comment(fx, { itemId: item.id, body: 'hi', parentId: thread.id });
    expect(await row(reply.id)).toMatchObject({ itemId: item.id, parentId: thread.id });
  });

  it('is refused under a comment on another item', async () => {
    const fx = await seedFixture();
    const here = await createItem(fx, 'Here');
    const there = await createItem(fx, 'There');
    const elsewhere = await comment(fx, { itemId: there.id, body: 'over there' });
    await expect(comment(fx, { itemId: here.id, body: 'stray', parentId: elsewhere.id }))
      .rejects.toMatchObject({ statusCode: 422, message: 'the parent comment is on another item' });
    expect(await testDb.select().from(comments).where(eq(comments.itemId, here.id))).toHaveLength(0);
    expect(await testDb.select().from(events).where(eq(events.kind, 'comment.added'))).toHaveLength(1);
  });

  it('is refused under a comment that does not exist', async () => {
    const fx = await seedFixture();
    const item = await createItem(fx);
    await expect(comment(fx, { itemId: item.id, body: 'stray', parentId: 999_999 }))
      .rejects.toMatchObject({ statusCode: 404, message: 'parent comment not found' });
  });

  it('answers 422 through the comments route', async () => {
    const fx = await seedFixture();
    const here = await createItem(fx, 'Here');
    const there = await createItem(fx, 'There');
    const elsewhere = await comment(fx, { itemId: there.id, body: 'over there' });
    const app = buildApp({ db: testDb });
    const res = await app.inject({
      method: 'POST',
      url: `/api/items/${here.id}/comments`,
      payload: { ...envelope(fx.actorId), body: 'stray', parentId: elsewhere.id },
    });
    await app.close();
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ error: 'the parent comment is on another item' });
  });
});
