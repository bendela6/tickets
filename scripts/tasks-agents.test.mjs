// tasks-agents.mjs against a viewer of the test's own (tasks-view.mjs on a free port, with
// tasks/ in the system's temp folder), never the real one on 4741.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { SCRIPTS, node, tasksDir, viewer } from './tasks-testing.mjs';

await tasksDir(after);
const agents = (...args) => node([join(SCRIPTS, 'tasks-agents.mjs'), ...args]);
const url = await viewer(after);
const names = async () => (await (await fetch(`${url}/agents`)).json()).map((a) => a.name);

test('say <name> <state> tells the viewer, and answers with what it took', async () => {
  const said = await agents('say', 'worker-tt-1', 'working', '--item', 'TT-1', 'Testing');
  assert.equal(said.code, 0, said.stderr);
  assert.equal(said.stdout.trim(), 'worker-tt-1: working on TT-1');
  assert.deepEqual(await names(), ['worker-tt-1']);
});

test('say <name> clear forgets the agent and answers as clear <name> does', async () => {
  await agents('say', 'worker-tt-2', 'working');
  const said = await agents('say', 'worker-tt-2', 'clear');
  assert.equal(said.code, 0, said.stderr);
  assert.equal(said.stdout.trim(), 'worker-tt-2: cleared');
  assert.equal(said.stderr, '');
  assert.ok(!(await names()).includes('worker-tt-2'));

  await agents('say', 'worker-tt-3', 'working');
  const cleared = await agents('clear', 'worker-tt-3');
  assert.equal(cleared.code, 0, cleared.stderr);
  assert.equal(cleared.stdout.trim(), said.stdout.trim().replace('tt-2', 'tt-3'));
  assert.ok(!(await names()).includes('worker-tt-3'));
});
