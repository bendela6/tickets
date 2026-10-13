// Checks tasks/*.json: each file against tasks/tasks.schema.json, then what a schema can't say:
// ids unique across files and numbered under their parent, every id named in the text exists,
// only items without children store `approved` or `cancelled` (never both), every title starts with a verb, and `blockedBy`
// names real items, never an item's own parent or child, and makes no cycle.
// `node scripts/tasks-check.mjs [dir]`; exits 1 on a problem.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR =
  process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'tasks');
const schema = JSON.parse(fs.readFileSync(path.join(DIR, 'tasks.schema.json'), 'utf8'));

/** Titles start with one of these; add a verb here when a title needs a new one. */
const VERBS = new Set(
  `Add Bring Build Change Check Clear Compile Count Create Cut Dedupe Define Delete Deploy Design Document Drop Edit Enqueue
  Export Fix Flag Fold Format Generate Give Highlight Import Leave Let Light Link Load Make Mark Measure Merge Migrate Mount Move
  Name Open Pass Plan Point Publish Put Rebuild Redesign Release Remove Rename Replace Report Retire Run Say Scroll Serve Set Show
  Simplify Smoke-test Split Stop Store Swap Switch Sync Take Test Title Update Upload Write`.split(
    /\s+/,
  ),
);

const problems = [];
const problem = (file, where, text) => problems.push(`${file}: ${where}: ${text}`);

/** The part of JSON Schema that tasks.schema.json uses. */
function validate(value, node, at, file) {
  if (node.$ref) return validate(value, schema.$defs[node.$ref.replace('#/$defs/', '')], at, file);
  if (node.oneOf) {
    const fits = node.oneOf.filter((option) => {
      const before = problems.length;
      validate(value, option, at, file);
      const ok = problems.length === before;
      problems.length = before;
      return ok;
    });
    if (fits.length !== 1)
      problem(file, at, `fits ${fits.length} of the ${node.oneOf.length} shapes`);
    return;
  }
  const type = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
  if (node.type && node.type !== type) return problem(file, at, `is ${type}, not ${node.type}`);
  if (node.enum && !node.enum.includes(value))
    problem(file, at, `"${value}" is not one of ${node.enum.join(', ')}`);
  if (node.pattern && !new RegExp(node.pattern).test(value))
    problem(file, at, `"${value}" doesn't match ${node.pattern}`);
  if (node.minLength && value.length < node.minLength) problem(file, at, 'is empty');
  if (node.minItems && value.length < node.minItems)
    problem(file, at, `needs at least ${node.minItems}`);
  if (type === 'array' && node.items)
    value.forEach((v, i) => validate(v, node.items, `${at}[${i}]`, file));
  if (type === 'object') {
    for (const key of node.required ?? [])
      if (!(key in value)) problem(file, at, `has no "${key}"`);
    for (const [key, v] of Object.entries(value)) {
      const sub = node.properties?.[key];
      if (sub) validate(v, sub, `${at}.${key}`, file);
      else if (node.additionalProperties === false) problem(file, at, `has an unknown "${key}"`);
    }
  }
}

const files = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.json') && f !== 'tasks.schema.json')
  .sort();
const docs = files.map((file) => ({
  file,
  doc: JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8')),
}));
const ids = new Map();
const walk = (t) => [t, ...(t.subtickets ?? []).flatMap(walk)];

for (const { file, doc } of docs) {
  validate(doc, schema, doc.repo ?? file, file);
  const epics = new Set();
  for (const epic of doc.epics ?? []) {
    if (epics.has(epic.id)) problem(file, epic.id, 'is a second epic with this id');
    epics.add(epic.id);
    const titled = [epic];
    for (const feature of epic.features ?? []) {
      if (!feature.id?.startsWith(`${doc.prefix}-`))
        problem(file, feature.id, `doesn't start with ${doc.prefix}-`);
      titled.push(feature);
      const number = (list, parent) =>
        list.forEach((t, i) => {
          if (t.id !== `${parent}.${i + 1}`)
            problem(
              file,
              t.id,
              `should be ${parent}.${i + 1}: tickets number from 1 under their parent`,
            );
          number(t.subtickets ?? [], t.id);
        });
      number(feature.plan ?? [], feature.id);
      for (const item of [feature, ...(feature.plan ?? []).flatMap(walk)]) {
        if (ids.has(item.id)) problem(file, item.id, `is also in ${ids.get(item.id)}`);
        const children = item === feature ? feature.plan : item.subtickets;
        if ('approved' in item && children?.length)
          problem(file, item.id, 'has children, so its approval is theirs: drop its `approved`');
        if ('cancelled' in item && children?.length)
          problem(
            file,
            item.id,
            'has children, so whether it is cancelled is theirs: drop its `cancelled`',
          );
        if (item.approved && item.cancelled)
          problem(file, item.id, 'is both approved and cancelled');
        if (item.cancelled && (item.done || item.status === 'Done'))
          problem(file, item.id, 'is both done and cancelled: a cancelled item is not done');
        // A parent whose items are all cancelled is cancelled, so it isn't done either.
        const under = (x) => {
          const kids = x === feature ? (x.plan ?? []) : (x.subtickets ?? []);
          return kids.length ? kids.flatMap(under) : [x];
        };
        if (
          children?.length &&
          (item.done || item.status === 'Done') &&
          under(item).every((leaf) => leaf.cancelled)
        )
          problem(file, item.id, 'has only cancelled items under it, so it is cancelled, not done');
        ids.set(item.id, file);
        if (item !== feature) titled.push(item);
      }
    }
    for (const item of titled) {
      const verb = item.title?.split(' ')[0];
      if (!VERBS.has(verb))
        problem(
          file,
          item.id,
          `title starts with "${verb}", not a verb (add it to VERBS in scripts/tasks-check.mjs if it is one)`,
        );
    }
  }
}

// blockedBy: each blocker exists and isn't the item, its own parent or child, or a blocker its
// parent has already (children inherit those); and nothing waits on itself through others.
// An item waits on its blockers, its children (to be done) and its parents' blockers.
const node = new Map(); // id (epics as "TK/E4") → { file, ancestors, children, blockedBy }
for (const { file, doc } of docs) {
  for (const epic of doc.epics ?? []) {
    const ref = `${doc.prefix}/${epic.id}`;
    node.set(ref, {
      file,
      ancestors: [],
      children: (epic.features ?? []).map((f) => f.id),
      blockedBy: epic.blockedBy ?? [],
    });
    const add = (t, ancestors, kids) =>
      node.set(t.id, {
        file,
        ancestors,
        children: kids.map((k) => k.id),
        blockedBy: t.blockedBy ?? [],
      });
    for (const feature of epic.features ?? []) {
      add(feature, [ref], feature.plan ?? []);
      for (const word of feature.waitingOn ?? [])
        if (/^[A-Z]+-\d+(\.\d+)*$/.test(word))
          problem(
            file,
            feature.id,
            `waitingOn names ${word}: an item goes in blockedBy, with a why`,
          );
      const tickets = (t, ancestors) => {
        add(t, ancestors, t.subtickets ?? []);
        for (const s of t.subtickets ?? []) tickets(s, [...ancestors, t.id]);
      };
      for (const t of feature.plan ?? []) tickets(t, [ref, feature.id]);
    }
  }
}
const below = (id) => (node.get(id)?.children ?? []).flatMap((c) => [c, ...below(c)]);
const waitsOn = (id) => (node.get(id)?.blockedBy ?? []).map((b) => b.id);
for (const [id, n] of node) {
  const seen = new Set();
  for (const { id: b } of n.blockedBy) {
    if (!node.has(b)) problem(n.file, id, `waits on ${b}, which no file has`);
    else if (b === id) problem(n.file, id, 'waits on itself');
    else if (n.ancestors.includes(b))
      problem(n.file, id, `waits on ${b}, its own parent: a parent is done after its children`);
    else if (below(id).includes(b))
      problem(n.file, id, `waits on ${b}, its own child: a parent waits on its children already`);
    if (seen.has(b)) problem(n.file, id, `lists ${b} twice in blockedBy`);
    seen.add(b);
    const from = n.ancestors.find((a) => waitsOn(a).includes(b));
    if (from)
      problem(n.file, id, `waits on ${b}, as its parent ${from} does: children inherit that`);
  }
}
const next = (id) => {
  const n = node.get(id);
  return n ? [...waitsOn(id), ...n.children, ...n.ancestors.flatMap(waitsOn)] : [];
};
const visiting = new Set();
const visited = new Set();
const trail = [];
const cycles = new Set();
const visit = (id) => {
  visiting.add(id);
  trail.push(id);
  for (const n of next(id)) {
    if (visiting.has(n)) {
      const loop = trail.slice(trail.indexOf(n));
      const key = [...loop].sort().join(' ');
      if (loop.some((x) => waitsOn(x).length) && !cycles.has(key)) {
        cycles.add(key);
        problem(node.get(n).file, n, `waits on itself: ${[...loop, n].join(' → ')}`);
      }
    } else if (!visited.has(n)) visit(n);
  }
  trail.pop();
  visiting.delete(id);
  visited.add(id);
};
for (const id of node.keys()) if (!visited.has(id)) visit(id);

// Every id named anywhere (in text, in blockedBy) exists, for the prefixes these files own.
const prefixes = docs.map(({ doc }) => doc.prefix).join('|');
const named = new RegExp(`\\b(?:${prefixes})-\\d+(?:\\.\\d+)*\\b`, 'g');
for (const { file, doc } of docs) {
  for (const id of new Set(JSON.stringify(doc).match(named) ?? []))
    if (!ids.has(id)) problem(file, id, 'is named but no feature or ticket has this id');
}

const count = (kind) =>
  docs.reduce(
    (n, { doc }) =>
      n +
      doc.epics
        .flatMap((e) => e.features)
        .reduce((m, f) => m + (kind === 'features' ? 1 : (f.plan ?? []).flatMap(walk).length), 0),
    0,
  );
if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} problems in tasks/`);
  process.exit(1);
}
console.log(
  `tasks/: ${docs.length} files, ${count('features')} features, ${count('tickets')} tickets and subtickets, all fine`,
);
