import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { agentReports } from '@tickets/db';
import { resetDb, testDb } from '../test/db';
import { buildApp } from '../app';

beforeEach(resetDb);
afterAll(resetDb);

async function post(body: unknown) {
  const app = buildApp({ db: testDb });
  const res = await app.inject({ method: 'POST', url: '/api/agents', payload: body as object });
  await app.close();
  return res;
}

describe('POST /api/agents', () => {
  it("takes the viewer's body and answers the report", async () => {
    const res = await post({ name: 'worker-tk-7', state: 'working', item: 'TK-7.2', text: 'Testing' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({
      name: 'worker-tk-7', role: 'worker', state: 'working', item: 'TK-7.2', itemId: null, text: 'Testing',
    });
  });

  it.each([
    [{ state: 'working' }, 'name: '],
    [{ name: 'Worker TK-7', state: 'working' }, 'name: a name is lowercase letters, digits, dots and dashes, like worker-tk-7'],
    [{ name: 'worker-tk-7', state: 'thinking' }, 'state: a state is listening, working, done, failed, abandoned, stopped, or clear'],
    [{ name: 'worker-tk-7' }, 'state: '],
    [{ name: 'worker-tk-7', state: 'working', role: 'reviewer' }, 'role: a role is planner, builder, worker'],
    [{ name: 'worker-tk-7', state: 'working', item: 'the sort' }, 'item: an item is a key: TK-7, TK-7.2 or TK/E4'],
    [{ name: 'worker-tk-7', state: 'working', item: 7 }, 'item: '],
    [{ name: 'worker-tk-7', state: 'working', text: ['Testing'] }, 'text: '],
  ])('refuses %j with 400', async (body, error) => {
    const res = await post(body);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain(error);
    expect(await testDb.select().from(agentReports)).toEqual([]);
  });

  it('takes every item key form: a numbered key, an epic, a ticket, a subticket', async () => {
    for (const item of ['TIX-90', 'TK/E14', 'TK-80.3', 'TK-11.2.1', 'demo-3']) {
      const res = await post({ name: 'worker-tk-7', state: 'working', item });
      expect(res.statusCode, item).toBe(200);
      expect(res.json().data.item).toBe(item);
    }
  });
});

describe('GET /api/agents', () => {
  it('answers every report', async () => {
    await post({ name: 'builder', state: 'listening' });
    await post({ name: 'worker-tk-7', state: 'failed', item: 'TK-7', text: 'The tests fail' });
    const app = buildApp({ db: testDb });
    const res = await app.inject({ method: 'GET', url: '/api/agents' });
    await app.close();
    expect(res.statusCode).toBe(200);
    const data = res.json().data as { name: string; state: string; shown: unknown; at: string; since: string }[];
    expect(data.map((r) => [r.name, r.state, r.shown])).toEqual([
      ['builder', 'listening', { state: 'listening', dismissible: false }],
      ['worker-tk-7', 'failed', { state: 'failed', dismissible: true }],
    ]);
    expect(Number.isNaN(Date.parse(data[0]!.at))).toBe(false);
  });
});

describe('DELETE /api/agents/:name', () => {
  it('dismisses the agent, and 404s one it does not know', async () => {
    await post({ name: 'worker-tk-7', state: 'failed', item: 'TK-7' });
    const app = buildApp({ db: testDb });
    const gone = await app.inject({ method: 'DELETE', url: '/api/agents/worker-tk-7' });
    expect(gone.statusCode).toBe(204);
    expect(await testDb.select().from(agentReports)).toEqual([]);
    const again = await app.inject({ method: 'DELETE', url: '/api/agents/worker-tk-7' });
    expect(again.statusCode).toBe(404);
    expect(again.json().error).toBe('no agent worker-tk-7');
    await app.close();
  });
});
