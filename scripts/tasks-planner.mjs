// The planner session's ears and voice (see .claude/skills/keeping-the-plan).
//
//   node scripts/tasks-planner.mjs wait     Waits until the user has said something in the viewer
//                                           that no session has taken in (an answered question, a
//                                           note without `seen`), and their words have settled for
//                                           a while, then prints them as JSON and exits. Meanwhile
//                                           it tells the viewer the planner is listening.
//   node scripts/tasks-planner.mjs pending  Prints them now and exits.
//   node scripts/tasks-planner.mjs say <listening|working|stopped> [text]
//                                           Tells the viewer what the planner is doing.
import { VIEWER, pendingOf, readAll, readAllOrNull, tell } from './tasks-lib.mjs';

/** How long the user's words must stay as they are before the planner takes them in. */
const SETTLE_MS = Number(process.env.SETTLE_MS ?? 15_000);
const POLL_MS = 2_000;
/** How soon a read that didn't parse is tried again. */
const RETRY_MS = 500;
const BEAT_MS = 20_000;

let warned = false;
async function say(state, text = '') {
  try {
    await tell({ name: 'planner', state, text });
    return true;
  } catch (error) {
    if (!warned)
      console.error(
        `The viewer at ${VIEWER} didn't take it (${error.message}): start it (launch config "tasks", or node scripts/tasks-view.mjs).`,
      );
    warned = true;
    return false;
  }
}

const summary = (pending) => {
  const answers = pending.filter((p) => p.kind === 'answer').length;
  const notes = pending.length - answers;
  return [
    answers && `${answers} ${answers === 1 ? 'answer' : 'answers'}`,
    notes && `${notes} ${notes === 1 ? 'note' : 'notes'}`,
  ]
    .filter(Boolean)
    .join(' and ');
};

const print = (pending) =>
  console.log(
    pending.length
      ? `${summary(pending)} to take in:\n${JSON.stringify(pending, null, 2)}`
      : 'Nothing to take in.',
  );

const [command, ...rest] = process.argv.slice(2);
if (command === 'pending') {
  print(pendingOf(await readAll()));
} else if (command === 'say') {
  const [state, ...words] = rest;
  if (!(await say(state, words.join(' ')))) process.exit(1);
} else if (command === 'wait') {
  let seen = null;
  let since = 0;
  let beat = 0;
  for (;;) {
    if (Date.now() - beat >= BEAT_MS) {
      await say('listening');
      beat = Date.now();
    }
    const docs = await readAllOrNull();
    if (!docs) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
      continue;
    }
    const pending = pendingOf(docs);
    const key = JSON.stringify(pending);
    if (key !== seen) {
      seen = key;
      since = Date.now();
    }
    if (pending.length && Date.now() - since >= SETTLE_MS) {
      await say('working', `Taking in ${summary(pending)}`);
      print(pending);
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
} else {
  console.error('Usage: node scripts/tasks-planner.mjs wait | pending | say <state> [text]');
  process.exit(1);
}
