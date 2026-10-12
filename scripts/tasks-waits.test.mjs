// The planner's and the builder's waits (tasks-planner.mjs wait, tasks-builder.mjs wait) read
// tasks/ again when a file doesn't parse, instead of crashing.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { SCRIPTS, node, plan, put, sleep, tasksDir } from './tasks-testing.mjs';

const dir = await tasksDir(after);
const HALF = '{\n  "repo": "test",\n  "prefix": "TT",\n  "epi';

/** Starts a wait; resolves with the child once it has said it can't read tasks/. */
function start(script, env = {}) {
  let child;
  const ended = node([join(SCRIPTS, script), 'wait'], { env, started: (c) => (child = c) });
  let said = '';
  const unreadable = new Promise((resolve, reject) => {
    child.stderr.on('data', (chunk) => /doesn't parse/.test((said += chunk)) && resolve());
    ended.then(({ code, stderr }) => reject(new Error(`It ended (${code}): ${stderr}`)));
  });
  return { child, ended, unreadable };
}

test("the planner's wait survives a file that doesn't parse", async (t) => {
  await writeFile(join(dir, 'planner.json'), HALF);
  const wait = start('tasks-planner.mjs', { SETTLE_MS: '300' });
  t.after(() => wait.child.kill());
  await wait.unreadable;
  await sleep(1_000); // it reads again meanwhile, and still doesn't crash
  await put(dir, 'planner.json', plan({ notes: [{ at: '2026-10-13T00:00:00.000Z', text: 'Hi' }] }));
  const { code, stdout, stderr } = await wait.ended;
  assert.equal(code, 0, stderr);
  assert.match(stdout, /1 note to take in/);
  assert.match(stderr, /tasks\/planner\.json doesn't parse/);
  await writeFile(join(dir, 'planner.json'), JSON.stringify(plan()));
});

test("the builder's wait survives a file that doesn't parse", async (t) => {
  await writeFile(join(dir, 'planner.json'), JSON.stringify(plan()));
  await writeFile(join(dir, 'builder.json'), HALF.replaceAll('TT', 'BB'));
  const wait = start('tasks-builder.mjs');
  t.after(() => wait.child.kill());
  await wait.unreadable;
  // Whole again, nothing approved: what the wait starts from. Then TT-1.1 approved: ready.
  await put(dir, 'builder.json', { ...plan(), prefix: 'BB', epics: [] });
  await sleep(2_000);
  await put(dir, 'planner.json', plan({ approved: true }));
  const { code, stdout, stderr } = await wait.ended;
  assert.equal(code, 0, stderr);
  assert.match(stdout, /^1 ready/);
  assert.match(stdout, /"id": "TT-1\.1"/);
});
