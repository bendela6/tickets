import { and, eq, inArray, sql } from 'drizzle-orm';
import type { DbExecutor } from '@tickets/db';
import { itemLinks, items, itemTypes, linkTypes, projects, schemes } from '@tickets/db';
import { HttpError } from '../../errors';

// A plan's blockers: a `blocks` link from B to X says X waits on B (B must be
// done first), as the software scheme's `blocks` does, and as the plans'
// `X.blockedBy: [{ id: B, why }]` did. These are the checks of
// `scripts/tasks-check.mjs` (blockedBy, lines 178-219), made on the write so
// nothing is left for it to find. An item waits on its blockers, on its
// children (to be done) and on its parents' blockers; every plan item, in any
// plan project, is one graph.

type PlanNode = { id: number; key: string; parentId: number | null };

async function loadPlanGraph(tx: DbExecutor) {
  const planProjects = tx
    .select({ id: projects.id })
    .from(projects)
    .innerJoin(schemes, eq(schemes.id, projects.schemeId))
    .where(sql`${schemes.config} @> '{"plan": true}'::jsonb`);
  const nodes: PlanNode[] = await tx
    .select({ id: items.id, key: items.key, parentId: items.parentId })
    .from(items)
    .where(inArray(items.projectId, planProjects));
  const blockerLinks = await tx
    .select({ source: itemLinks.sourceItemId, target: itemLinks.targetItemId })
    .from(itemLinks)
    .innerJoin(linkTypes, eq(linkTypes.id, itemLinks.linkTypeId))
    .innerJoin(itemTypes, eq(itemTypes.id, linkTypes.itemTypeId))
    .innerJoin(schemes, eq(schemes.id, itemTypes.schemeId))
    .where(and(eq(linkTypes.key, 'blocks'), sql`${schemes.config} @> '{"plan": true}'::jsonb`));

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<number, number[]>();
  for (const n of nodes) {
    if (n.parentId === null) continue;
    children.set(n.parentId, [...(children.get(n.parentId) ?? []), n.id]);
  }
  const blockers = new Map<number, number[]>(); // item → what it waits on
  for (const l of blockerLinks) blockers.set(l.target, [...(blockers.get(l.target) ?? []), l.source]);

  // root first, as tasks-check lists them
  const ancestors = (id: number): number[] => {
    const up: number[] = [];
    for (let p = byId.get(id)?.parentId ?? null; p !== null; p = byId.get(p)?.parentId ?? null) {
      if (up.includes(p)) break;
      up.unshift(p);
    }
    return up;
  };
  const below = (id: number): number[] =>
    (children.get(id) ?? []).flatMap((c) => [c, ...below(c)]);
  const waitsOn = (id: number) => blockers.get(id) ?? [];
  // what an item waits on: its blockers, its children and its parents' blockers
  const next = (id: number) => [...waitsOn(id), ...(children.get(id) ?? []), ...ancestors(id).flatMap(waitsOn)];
  const keyOf = (id: number) => byId.get(id)?.key ?? `#${id}`;
  return { ancestors, below, waitsOn, next, keyOf };
}

// Refuses (422, with the rule's message) a blocker the plan's rules don't
// allow: `item` would wait on `blocker`.
export async function checkPlanBlocker(
  tx: DbExecutor,
  input: { item: { id: number; key: string }; blocker: { id: number; key: string } },
): Promise<void> {
  const { item, blocker } = input;
  const refuse = (message: string) => {
    throw new HttpError(422, message);
  };
  if (blocker.id === item.id) refuse(`${item.key} waits on itself`);

  const g = await loadPlanGraph(tx);
  const ancestors = g.ancestors(item.id);
  const below = g.below(item.id);
  if (ancestors.includes(blocker.id)) {
    refuse(`${item.key} waits on ${blocker.key}, its own parent: a parent is done after its children`);
  }
  if (below.includes(blocker.id)) {
    refuse(`${item.key} waits on ${blocker.key}, its own child: a parent waits on its children already`);
  }
  if (g.waitsOn(item.id).includes(blocker.id)) {
    refuse(`${item.key} lists ${blocker.key} twice in blockedBy`);
  }
  const from = ancestors.find((a) => g.waitsOn(a).includes(blocker.id));
  if (from !== undefined) {
    refuse(`${item.key} waits on ${blocker.key}, as its parent ${g.keyOf(from)} does: children inherit that`);
  }
  // The other way round: a child that waits on it already would then wait on
  // it as its parent does.
  const child = below.find((d) => g.waitsOn(d).includes(blocker.id));
  if (child !== undefined) {
    refuse(
      `${g.keyOf(child)} waits on ${blocker.key} already, and children inherit their parents' blockers: ` +
        `take it off ${g.keyOf(child)} before ${item.key} waits on it`,
    );
  }

  // A cycle. The new wait (item → blocker, and each item below it, which
  // inherits it, → blocker) closes one when the blocker already reaches the
  // item or one below it.
  const closing = new Set([item.id, ...below]);
  const cameFrom = new Map<number, number>([[blocker.id, blocker.id]]);
  const queue = [blocker.id];
  while (queue.length > 0) {
    const at = queue.shift()!;
    for (const n of g.next(at)) {
      if (cameFrom.has(n)) continue;
      cameFrom.set(n, at);
      if (closing.has(n)) {
        const trail = [n];
        for (let step = at; step !== blocker.id; step = cameFrom.get(step)!) trail.unshift(step);
        const loop = [n, blocker.id, ...trail];
        refuse(`${g.keyOf(n)} waits on itself: ${loop.map(g.keyOf).join(' → ')}`);
      }
      queue.push(n);
    }
  }
}
