// Serves the task viewer on this machine alone, for a look at the plans in a
// browser: `node scripts/tasks-view.mjs`, then http://127.0.0.1:4741. `/` is
// tasks/viewer.html; `/tasks.json` is every tasks/*.json in one array (each
// with its `file`), which the page reads every two seconds, so an edit shows
// without a reload. `POST /edit` is the page's buttons: approve or cancel an
// item (or every item under it), add or delete a note, answer an open
// question. It writes the file back through prettier. `/agents` is what each
// agent (the planner, the builder, every worker it dispatched) last said it's
// doing, posted to `POST /agents` (scripts/tasks-agents.mjs) and shown in the
// page's corner and on the cards it works on; it's kept in
// tasks/.runtime/agents.json, which git ignores. Nothing else in the repo is
// served or written.

import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { DIR, files, find, leaves, put, read, readAll, write } from './tasks-lib.mjs';

const PORT = Number(process.env.PORT ?? 4741);
const ORIGINS = [`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`];

/**
 * Every agent's last word, by name: {name, role, state, item?, text, at, since}. `at` is when it
 * last said anything, `since` when it took up this state and item. The page works out from them
 * who is working, who went quiet (abandoned?) and who isn't running. Words older than a week go.
 */
const AGENTS = DIR + '.runtime/agents.json';
let agents = {};
try {
  agents = JSON.parse(await readFile(AGENTS, 'utf8'));
} catch {
  // none yet
}
const STATES = ['listening', 'working', 'done', 'failed', 'abandoned', 'stopped'];
const ROLES = ['planner', 'builder', 'worker'];
const WEEK = 7 * 24 * 60 * 60_000;

/** One agent's word: `{name, state, role?, item?, text?}`; state `clear` forgets the agent. */
async function tell(said) {
  const name = typeof said.name === 'string' ? said.name.trim() : '';
  if (!/^[a-z0-9][a-z0-9.-]{0,47}$/.test(name))
    throw new Error('Send a name: lowercase letters, digits, dots and dashes, like worker-tk-7.');
  if (said.state === 'clear') delete agents[name];
  else {
    if (!STATES.includes(said.state))
      throw new Error(`Send {name, state: ${STATES.join(' | ')} | clear, item?, text?}.`);
    const role = said.role ?? (ROLES.includes(name) ? name : 'worker');
    if (!ROLES.includes(role)) throw new Error(`A role is ${ROLES.join(', ')}.`);
    const item = said.item || undefined;
    if (item !== undefined && !/^[A-Z]+(-\d+(\.\d+)*|\/E\d+)$/.test(item))
      throw new Error('An item is an id: TK-7, TK-7.2 or TK/E4.');
    const at = new Date().toISOString();
    const before = agents[name];
    const same = before && before.state === said.state && before.item === item;
    agents[name] = {
      name,
      role,
      state: said.state,
      ...(item ? { item } : {}),
      text: typeof said.text === 'string' ? said.text.trim().slice(0, 300) : '',
      at,
      since: same ? before.since : at,
    };
  }
  for (const [key, a] of Object.entries(agents))
    if (Date.now() - new Date(a.at).getTime() > WEEK) delete agents[key];
  await mkdir(DIR + '.runtime', { recursive: true });
  await writeFile(AGENTS, JSON.stringify(agents, null, 2) + '\n');
  return agents[name] ?? null;
}

const text = (value, what) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Send ${what} as text.`);
  return value.trim();
};

/**
 * One edit: `{op, id, …}`. approve {approved}: sets or clears `approved` on the item or every
 * item under it, clearing `cancelled`. cancel {cancelled}: the same the other way round.
 * note {text, quote?, nth?}: adds a note, on a fragment of the description when it quotes one. unnote {at}: deletes the note written then. close {key, closed}: closes or reopens a thread. answer {index, answer}:
 * answers the feature's question `index`; an empty answer takes it back.
 */
function apply(item, edit) {
  switch (edit.op) {
    case 'approve':
    case 'cancel': {
      const on = edit.op === 'approve' ? edit.approved : edit.cancelled;
      if (typeof on !== 'boolean')
        throw new Error(
          `Send {op: "${edit.op}", id, ${edit.op === 'approve' ? 'approved' : 'cancelled'}: true|false}.`,
        );
      const key = edit.op === 'approve' ? 'approved' : 'cancelled';
      const other = edit.op === 'approve' ? 'cancelled' : 'approved';
      const targets = leaves(item);
      // Approving or cancelling a parent touches only what's left to build: done items stay as
      // they are, and approving leaves cancelled ones cancelled. Taking either back touches all.
      const done = (leaf) => leaf.done === true || leaf.status === 'Done';
      const touched = on
        ? targets.filter(
            (l) => !done(l) && !(edit.op === 'approve' && targets.length > 1 && l.cancelled),
          )
        : targets;
      let changed = 0;
      for (const leaf of touched) {
        if (Boolean(leaf[key]) === on && !(on && leaf[other])) continue;
        put(leaf, { [key]: on || undefined, ...(on ? { [other]: undefined } : {}) });
        changed++;
      }
      return changed;
    }
    case 'note': {
      // A note may be about a fragment of the item's description: `quote` is that text, `nth`
      // which place it is when the text has it more than once.
      const quote = edit.quote === undefined ? undefined : text(edit.quote, 'the quote');
      if (quote && quote.length > 1000) throw new Error('Quote at most 1000 characters.');
      const nth = quote && Number.isInteger(edit.nth) && edit.nth > 0 ? edit.nth : undefined;
      const note = {
        at: new Date().toISOString(),
        ...(quote ? { quote } : {}),
        ...(nth ? { nth } : {}),
        text: text(edit.text, 'the note'),
      };
      put(item, { notes: [...(item.notes ?? []), note] });
      return 1;
    }
    case 'unnote': {
      const notes = (item.notes ?? []).filter((n) => n.at !== edit.at);
      if (notes.length === (item.notes ?? []).length) throw new Error('No note was written then.');
      put(item, { notes: notes.length ? notes : undefined });
      return 1;
    }
    case 'close': {
      // A thread is the item's own notes (key "") or a quoted fragment's ("nth:quote"); closing
      // it marks each of its notes, and a note added to it later opens it again.
      if (typeof edit.key !== 'string' || typeof edit.closed !== 'boolean')
        throw new Error('Send {op: "close", id, key, closed: true|false}.');
      const keyOf = (n) => (n.quote ? `${n.nth ?? 0}:${n.quote}` : '');
      const thread = (item.notes ?? []).filter((n) => keyOf(n) === edit.key);
      if (!thread.length) throw new Error('No notes in that thread.');
      const at = new Date().toISOString();
      for (const n of thread) put(n, { closed: edit.closed ? (n.closed ?? at) : undefined });
      return thread.length;
    }
    case 'answer': {
      const choice = item.openChoices?.[edit.index];
      if (!choice) throw new Error(`${item.id} has no question ${edit.index}.`);
      const answer = typeof edit.answer === 'string' ? edit.answer.trim() : '';
      if (answer) {
        choice.answer = answer;
        choice.answeredOn = new Date().toISOString().slice(0, 10);
      } else {
        delete choice.answer;
        delete choice.answeredOn;
      }
      return 1;
    }
    default:
      throw new Error('Send an op: approve, cancel, note, unnote, close or answer.');
  }
}

async function edit(request) {
  if (typeof request.id !== 'string') throw new Error('Send the id of the item.');
  for (const file of await files()) {
    const doc = await read(file);
    const item = find(doc, request.id);
    if (!item) continue;
    const changed = apply(item, request);
    if (changed) await write(file, doc);
    return { file, changed };
  }
  throw new Error(`No ${request.id} in tasks/.`);
}

async function body(request) {
  let text = '';
  for await (const chunk of request) {
    text += chunk;
    if (text.length > 100_000) throw new Error('Too long.');
  }
  return JSON.parse(text);
}

const send = (response, status, type, text) =>
  response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' }).end(text);

createServer(async (request, response) => {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname;
  try {
    if (request.method === 'GET' && path === '/') {
      send(response, 200, 'text/html; charset=utf-8', await readFile(DIR + 'viewer.html'));
    } else if (request.method === 'GET' && path === '/tasks.json') {
      send(response, 200, 'application/json; charset=utf-8', JSON.stringify(await readAll()));
    } else if (request.method === 'GET' && path === '/agents') {
      send(response, 200, 'application/json; charset=utf-8', JSON.stringify(Object.values(agents)));
    } else if (request.method === 'GET' && path === '/planner') {
      send(
        response,
        200,
        'application/json; charset=utf-8',
        JSON.stringify(agents.planner ?? null),
      );
    } else if (
      request.method === 'POST' &&
      (path === '/edit' || path === '/agents' || path === '/planner')
    ) {
      // Only this page (and the agents, from this machine) may write: JSON, which another site
      // can't send without asking first, from this origin or none.
      const origin = request.headers.origin;
      if (
        !request.headers['content-type']?.startsWith('application/json') ||
        (origin && !ORIGINS.includes(origin))
      ) {
        send(response, 403, 'text/plain; charset=utf-8', 'Only the viewer itself may edit.');
        return;
      }
      if (path !== '/edit') {
        // POST /planner is the planner's word, from before every agent had one.
        const said = await body(request);
        const told = await tell(path === '/planner' ? { ...said, name: 'planner' } : said);
        send(response, 200, 'application/json; charset=utf-8', JSON.stringify(told));
        return;
      }
      send(
        response,
        200,
        'application/json; charset=utf-8',
        JSON.stringify(await edit(await body(request))),
      );
    } else {
      send(
        response,
        404,
        'text/plain; charset=utf-8',
        'Only /, /tasks.json, /agents, POST /edit and POST /agents are served.',
      );
    }
  } catch (error) {
    send(response, 500, 'text/plain; charset=utf-8', error.message);
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`tasks: http://127.0.0.1:${PORT}`);
});
