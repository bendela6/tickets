// The builder session's ears (see .claude/skills/building-the-plan).
//
//   node scripts/tasks-builder.mjs ready   Prints what's ready to build, what's approved but waits
//                                          on something not done, and what's approved but isn't
//                                          the builder's (a feature without a plan, a ticket that's
//                                          yours).
//   node scripts/tasks-builder.mjs wait    Waits until any of that changes, telling the viewer the
//                                          builder is listening meanwhile; then prints it and exits.
//
// Ready: an item without children, approved, neither done nor cancelled, not `byYou`, whose
// blockers (its own and its parents') are all done. Approved but waiting: the same with a blocker
// not done, a feature without a plan included (it's planned in what it waits on). Done means
// `done: true` on a ticket, status Done on a feature, every feature Done on an epic; a cancelled
// blocker isn't done.
import { readAll, readAllOrNull, tell } from './tasks-lib.mjs';

const POLL_MS = 5_000;
/** How soon a read that didn't parse is tried again. */
const RETRY_MS = 500;
const BEAT_MS = 20_000;

export function readiness(docs) {
  const index = new Map(); // id → {item, kind, parent, file, feature}
  for (const doc of docs)
    for (const epic of doc.epics) {
      const epicId = `${doc.prefix}/${epic.id}`;
      index.set(epicId, { item: epic, kind: 'epic', parent: null, file: doc.file });
      for (const feature of epic.features) {
        index.set(feature.id, {
          item: feature,
          kind: 'feature',
          parent: epicId,
          file: doc.file,
          feature,
        });
        const walk = (t, parent) => {
          index.set(t.id, { item: t, kind: 'ticket', parent, file: doc.file, feature });
          for (const s of t.subtickets ?? []) walk(s, t.id);
        };
        for (const t of feature.plan ?? []) walk(t, feature.id);
      }
    }
  const doneOf = (id) => {
    const at = index.get(id);
    if (!at) return false;
    if (at.kind === 'epic') return at.item.features.every((f) => f.status === 'Done');
    if (at.kind === 'feature') return at.item.status === 'Done';
    return at.item.done === true;
  };
  const chain = (id) => {
    const out = [];
    for (let at = id; at; at = index.get(at)?.parent) out.push(at);
    return out;
  };
  const ready = [];
  const waiting = [];
  const notMine = [];
  for (const [id, at] of index) {
    const { item, kind, file, feature } = at;
    if (kind === 'epic') continue;
    const children = kind === 'feature' ? item.plan : item.subtickets;
    if (children?.length || !item.approved || item.cancelled || doneOf(id)) continue;
    const row = { file, feature: feature.id, id, title: item.title };
    // What it waits on comes first: a feature without a plan that waits on another is planned
    // there (BH-16 waits on GW-13, whose tickets are its plan), so it waits, and isn't to plan.
    const waitsOn = [
      ...new Set(chain(id).flatMap((x) => (index.get(x)?.item.blockedBy ?? []).map((b) => b.id))),
    ].filter((b) => !doneOf(b));
    if (waitsOn.length) waiting.push({ ...row, waitsOn });
    else if (kind === 'feature')
      notMine.push({ ...row, why: 'an approved feature without a plan: write its plan first' });
    else if (chain(id).some((x) => index.get(x)?.item.byYou))
      notMine.push({ ...row, why: 'yours (byYou)' });
    else {
      const asked = (feature.openChoices ?? []).filter((c) => !c.answer).length;
      ready.push({ ...row, ...(asked ? { openQuestions: asked } : {}) });
    }
  }
  return { ready, waiting, notMine };
}

const print = (r) =>
  console.log(
    `${r.ready.length} ready, ${r.waiting.length} approved but waiting, ${r.notMine.length} approved but not the builder's:\n${JSON.stringify(r, null, 2)}`,
  );
const keyOf = (r) =>
  JSON.stringify([
    r.ready.map((x) => x.id),
    r.waiting.map((x) => [x.id, x.waitsOn]),
    r.notMine.map((x) => x.id),
  ]);

const [command] = process.argv.slice(2);
if (command === 'ready') print(readiness(await readAll()));
else if (command === 'wait') {
  let start; // what the first read found
  let beat = 0;
  let warned = false;
  for (;;) {
    if (Date.now() - beat >= BEAT_MS) {
      await tell({ name: 'builder', state: 'listening' }).catch((error) => {
        if (!warned) console.error(`The viewer didn't take the builder's word: ${error.message}`);
        warned = true;
      });
      beat = Date.now();
    }
    const docs = await readAllOrNull();
    if (!docs) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
      continue;
    }
    const now = readiness(docs);
    start ??= keyOf(now);
    if (keyOf(now) !== start) {
      print(now);
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
} else {
  console.error('Usage: node scripts/tasks-builder.mjs ready | wait');
  process.exit(1);
}
