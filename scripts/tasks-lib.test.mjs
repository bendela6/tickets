// tasks-lib.mjs: the lock that makes the viewer, the planner and the builder take turns.
import assert from 'node:assert/strict';
import { access, mkdir, readFile, unlink, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { after, beforeEach, test } from 'node:test';
import { LIB, code, plan, put, sleep, tasksDir, viewer } from './tasks-testing.mjs';

const dir = await tasksDir(after);
const { edit, locked, read, STALE_MS } = await import('./tasks-lib.mjs');
const FILE = 'test.json';
const LOCK = join(dir, '.runtime', `${FILE}.lock`);
const exists = (path) =>
  access(path).then(
    () => true,
    () => false,
  );
const notesOf = async () => (await read(FILE)).epics[0].features[0].notes ?? [];

beforeEach(() => put(dir, FILE, plan()));

/** Code for a process of its own that adds `n` notes to TT-1, each edit taking a while. */
const editor = (who, n) => `
  import { edit } from ${JSON.stringify(LIB)};
  for (let i = 0; i < ${n}; i++)
    await edit('TT-1', async (item) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      item.notes = [...(item.notes ?? []), { at: new Date().toISOString(), text: '${who}-' + i }];
    });
`;

test('two processes editing one file at once both land', async () => {
  const [a, b] = await Promise.all([code(editor('a', 15)), code(editor('b', 15))]);
  assert.equal(a.code, 0, a.stderr);
  assert.equal(b.code, 0, b.stderr);
  const texts = (await notesOf()).map((n) => n.text).sort();
  const want = ['a', 'b'].flatMap((who) => [...Array(15).keys()].map((i) => `${who}-${i}`));
  assert.deepEqual(texts, want.sort());
  assert.equal(await exists(LOCK), false, 'the lock is let go');
});

test("the viewer's /edit and another process take turns too", async (t) => {
  const url = await viewer((hook) => t.after(hook));
  const posts = [...Array(15).keys()].map((i) =>
    fetch(`${url}/edit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ op: 'note', id: 'TT-1', text: `viewer-${i}` }),
    }).then(async (r) => assert.equal(r.status, 200, await r.text())),
  );
  const [other] = await Promise.all([code(editor('other', 15)), ...posts]);
  assert.equal(other.code, 0, other.stderr);
  const texts = (await notesOf()).map((n) => n.text);
  assert.equal(texts.length, 30, texts.join(', '));
  assert.equal(new Set(texts).size, 30);
});

test('a lock held by a live writer makes an edit wait its turn', async () => {
  await mkdir(join(dir, '.runtime'), { recursive: true });
  await writeFile(LOCK, 'someone-else');
  let finished = false;
  const editing = edit('TT-1', (item) => {
    item.notes = [{ at: new Date().toISOString(), text: 'waited' }];
  }).then(() => (finished = true));
  await sleep(300);
  assert.equal(finished, false, 'it waits while the lock is held');
  await unlink(LOCK);
  await editing;
  assert.deepEqual(
    (await notesOf()).map((n) => n.text),
    ['waited'],
  );
});

test('a stale lock (over 30 s old) is taken over', async () => {
  await mkdir(join(dir, '.runtime'), { recursive: true });
  await writeFile(LOCK, 'a-writer-that-died');
  const old = new Date(Date.now() - STALE_MS - 1_000);
  await utimes(LOCK, old, old);
  const started = Date.now();
  await edit('TT-1', (item) => {
    item.notes = [{ at: new Date().toISOString(), text: 'took over' }];
  });
  assert.ok(Date.now() - started < 5_000, 'without waiting for it');
  assert.deepEqual(
    (await notesOf()).map((n) => n.text),
    ['took over'],
  );
  assert.equal(await exists(LOCK), false, 'and lets it go after');
});

test('a lock is let go when the change throws', async () => {
  await assert.rejects(
    edit('TT-1', () => {
      throw new Error('the change failed');
    }),
    /the change failed/,
  );
  assert.equal(await exists(LOCK), false);
  const started = Date.now();
  await edit('TT-1', (item) => {
    item.notes = [{ at: new Date().toISOString(), text: 'next' }];
  });
  assert.ok(Date.now() - started < 2_000, 'the next edit needs no wait');
  assert.deepEqual(
    (await notesOf()).map((n) => n.text),
    ['next'],
  );
});

test("a writer whose lock was taken over doesn't write, nor let the new holder's lock go", async () => {
  const before = await readFile(join(dir, FILE), 'utf8');
  await assert.rejects(
    edit('TT-1', async (item) => {
      item.notes = [{ at: new Date().toISOString(), text: 'too late' }];
      await writeFile(LOCK, 'the-writer-that-took-it-over'); // as a takeover would leave it
    }),
    /taken over/,
  );
  assert.equal(await readFile(join(dir, FILE), 'utf8'), before, 'nothing written');
  assert.equal(await readFile(LOCK, 'utf8'), 'the-writer-that-took-it-over');
  await unlink(LOCK);
});

test('locked() hands back what its act returns', async () => {
  assert.equal(await locked(FILE, async () => 42), 42);
  assert.equal(await exists(LOCK), false);
});
