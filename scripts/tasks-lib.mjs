// What the viewer's server (tasks-view.mjs) and the planner (tasks-planner.mjs) share: reading
// and writing tasks/*.json, finding an item by id, setting keys in the schema's order, and
// what of the user's words in the viewer no session has taken in yet.
//
// A session editing the plan can use it too: `edit('TK-11', (item, doc) => …)` reads the file
// that holds TK-11, hands over the item, and writes the file back through prettier.
import { randomUUID } from 'node:crypto';
import { link, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';

/** tasks/ beside these scripts; `TASKS_DIR` points them at another folder (the tests' own). */
export const DIR = process.env.TASKS_DIR
  ? resolve(process.env.TASKS_DIR) + sep
  : fileURLToPath(new URL('../tasks/', import.meta.url));
/** What the scripts keep for themselves, which git ignores: the locks, what the agents said. */
export const RUNTIME = DIR + '.runtime' + sep;

/** tasks/*.json but the schema: tickets' own first, then the rest by name. */
export async function files() {
  return (await readdir(DIR))
    .filter((f) => f.endsWith('.json') && f !== 'tasks.schema.json')
    .sort((a, b) => (a === 'tickets.json' ? -1 : b === 'tickets.json' ? 1 : a.localeCompare(b)));
}

export const read = async (file) => JSON.parse(await readFile(DIR + file, 'utf8'));

export async function write(file, doc) {
  const options = { ...(await prettier.resolveConfig(DIR + file)), filepath: DIR + file };
  await writeFile(DIR + file, await prettier.format(JSON.stringify(doc, null, 2), options));
}

/** Every file, each with its `file`. */
export const readAll = async () =>
  Promise.all((await files()).map(async (file) => ({ file, ...(await read(file)) })));

/** The epic ("GW/E1"), feature ("GW-3") or ticket ("GW-3.2") with this id, if the file holds it. */
export function find(doc, id) {
  const [prefix, epicId] = id.split('/');
  if (epicId) return prefix === doc.prefix ? doc.epics.find((e) => e.id === epicId) : undefined;
  const walk = (t) => [t, ...(t.subtickets ?? []).flatMap(walk)];
  for (const feature of doc.epics.flatMap((e) => e.features)) {
    const hit = [feature, ...(feature.plan ?? []).flatMap(walk)].find((x) => x.id === id);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Reads the file holding `id`, calls `change(item, doc)`, and writes the file back unless it
 * returns false (or 0). It holds the file's lock from the read to the write, so the viewer, the
 * planner and the builder take turns and none loses another's edit; check in `change` that what
 * you decided on is still there. Keep `change` quick: a lock held 30 seconds is taken over, and
 * an edit whose lock was taken over throws instead of writing.
 */
export async function edit(id, change) {
  for (const file of await files()) {
    const done = await locked(file, async (held) => {
      const doc = await read(file);
      const item = find(doc, id);
      if (!item) return undefined;
      const result = await change(item, doc);
      if (result !== false && result !== 0) {
        await held.check();
        await write(file, doc);
      }
      return { file, result };
    });
    if (done) return done;
  }
  throw new Error(`No ${id} in tasks/.`);
}

/** A lock older than this was left by a writer that died holding it, and is taken over. */
export const STALE_MS = 30_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Windows refuses a rename or delete while another process has the file open: try again. */
const BUSY = new Set(['EPERM', 'EACCES', 'EBUSY']);
async function patiently(act, ms = 10_000) {
  const until = Date.now() + ms;
  for (let wait = 5; ; wait = Math.min(wait * 2, 100)) {
    try {
      return await act();
    } catch (error) {
      if (!BUSY.has(error.code) || Date.now() > until) throw error;
      await sleep(wait);
    }
  }
}

/** How long ago the file was last written: null when it's gone, 0 while Windows won't say. */
async function ageOf(path) {
  try {
    return Date.now() - (await stat(path)).mtimeMs;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    if (BUSY.has(error.code)) return 0;
    throw error;
  }
}

/**
 * Runs `act(held)` holding `file`'s lock, `tasks/.runtime/<file>.lock`, and lets it go after,
 * also when `act` throws. The lock is a file made exclusively, holding a token of its own; a
 * writer that finds it waits its turn, and takes it over once it is 30 seconds old (its writer
 * died holding it). `held.check()` throws if that happened to this one meanwhile, so a writer
 * that held it too long doesn't write over the one that took it over.
 */
export async function locked(file, act) {
  const path = `${RUNTIME}${file}.lock`;
  const token = `${process.pid}-${randomUUID()}`;
  await mkdir(RUNTIME, { recursive: true });
  const until = Date.now() + 2 * STALE_MS;
  for (;;) {
    try {
      await writeFile(path, token, { flag: 'wx' });
      break;
    } catch (error) {
      // EEXIST: someone holds it. On Windows a lock being deleted can't be made again until
      // it's gone (EPERM), which is the same wait.
      if (error.code !== 'EEXIST' && !BUSY.has(error.code)) throw error;
    }
    const age = await ageOf(path);
    if (age !== null && age >= STALE_MS) await takeOver(path);
    else if (Date.now() > until) throw new Error(`${file} stayed locked; try again.`);
    else await sleep(age === null ? 1 : 10 + Math.random() * 40);
  }
  const mine = async () => (await readFile(path, 'utf8').catch(() => null)) === token;
  const held = {
    async check() {
      if (!(await mine()))
        throw new Error(`${file}'s lock was taken over after ${STALE_MS / 1000} s; not written.`);
    },
  };
  try {
    return await act(held);
  } finally {
    if (await mine()) await patiently(() => unlink(path)).catch(() => {});
  }
}

/** Removes a stale lock, moving it aside first so that two writers can't both take it over. */
async function takeOver(path) {
  const aside = `${path}.${process.pid}-${randomUUID()}.stale`;
  try {
    await rename(path, aside);
  } catch {
    // gone, another writer moved it first, or Windows refused: try for the lock again
    return sleep(10);
  }
  // Between the look at its age and the move, another writer may have taken it over and made
  // a fresh lock; if what was moved is fresh, it's theirs: put it back.
  const age = await ageOf(aside);
  if (age !== null && age < STALE_MS) await link(aside, path).catch(() => {});
  await patiently(() => unlink(aside)).catch(() => {});
}

/** The items under one that keep their own approval: those without children. */
export function leaves(item) {
  const children = item.features ?? item.plan ?? item.subtickets ?? [];
  return children.length ? children.flatMap(leaves) : [item];
}

/** Each kind's keys in the schema's order, so a key set here lands where a person would write it. */
export const ORDER = {
  epic: ['id', 'title', 'description', 'blockedBy', 'notes', 'features'],
  feature: [
    'id',
    'title',
    'description',
    'status',
    'waitingOn',
    'blockedBy',
    'statusNote',
    'approved',
    'cancelled',
    'notes',
    'where',
    'today',
    'stays',
    'rule',
    'chosen',
    'chosenOn',
    'openChoices',
    'design',
    'plan',
  ],
  ticket: [
    'id',
    'title',
    'description',
    'where',
    'done',
    'blockedBy',
    'approved',
    'cancelled',
    'notes',
    'byYou',
    'subtickets',
  ],
  note: ['at', 'by', 'quote', 'nth', 'text', 'seen', 'closed'],
  choice: ['question', 'context', 'options', 'recommended', 'notes', 'answer', 'answeredOn'],
};
export const kindOf = (item) =>
  item.features
    ? 'epic'
    : 'status' in item
      ? 'feature'
      : 'question' in item
        ? 'choice'
        : 'text' in item && 'at' in item
          ? 'note'
          : 'ticket';

/** Sets (or, with undefined, removes) keys on an item, keeping the schema's key order. */
export function put(item, fields) {
  const order = ORDER[kindOf(item)];
  const next = { ...item, ...fields };
  for (const [key, value] of Object.entries(fields)) if (value === undefined) delete next[key];
  const keys = Object.keys(next).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  for (const key of Object.keys(item)) delete item[key];
  for (const key of keys) item[key] = next[key];
}

export const now = () => new Date().toISOString();

export const VIEWER = `http://127.0.0.1:${process.env.PORT ?? 4741}`;

/**
 * Tells the viewer what an agent is doing: `{name, state, item?, text?, role?}`, state one of
 * listening, working, done, failed, abandoned, stopped, or clear to forget the agent. Throws when
 * the viewer isn't running or refuses it.
 */
export async function tell(word) {
  const response = await fetch(`${VIEWER}/agents`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(word),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

/**
 * A note from the planner, to add to an item's or a question's `notes`. Pass the note it answers
 * as `to` and a reply to a note on a fragment stays beside that fragment.
 */
export const reply = (text, to) => ({
  at: now(),
  by: 'claude',
  ...(to?.quote ? { quote: to.quote, ...(to.nth ? { nth: to.nth } : {}) } : {}),
  text,
});

/**
 * The user's words no session has taken in yet: answered questions (a session folds each into
 * `chosen` and the plan, or replies to it and clears it) and the user's notes without `seen`
 * (a session replies to each, acts on it, or just reads it, then sets `seen`).
 */
export function pendingOf(docs) {
  const out = [];
  for (const doc of docs) {
    const walk = (t) => [t, ...(t.subtickets ?? []).flatMap(walk)];
    for (const epic of doc.epics) {
      const items = [
        [`${doc.prefix}/${epic.id}`, epic],
        ...epic.features.flatMap((f) => [f, ...(f.plan ?? []).flatMap(walk)]).map((x) => [x.id, x]),
      ];
      for (const [id, x] of items) {
        for (const n of x.notes ?? [])
          if (n.by !== 'claude' && !n.seen)
            out.push({
              kind: 'note',
              file: doc.file,
              id,
              title: x.title,
              at: n.at,
              ...(n.quote ? { quote: n.quote, nth: n.nth ?? 0 } : {}),
              text: n.text,
            });
        (x.openChoices ?? []).forEach((c, index) => {
          if (c.answer)
            out.push({
              kind: 'answer',
              file: doc.file,
              id,
              index,
              question: c.question,
              answer: c.answer,
              picked: c.options.includes(c.answer) ? c.options.indexOf(c.answer) : null,
            });
        });
      }
    }
  }
  return out;
}
