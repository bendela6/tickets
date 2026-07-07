import type { StatusDef, TransitionDef, TypeDef } from './scheme-types';

// Expands a type's ordered status list into a transition graph: entry, forward
// (happy path), kickback (active→first active), block/unblock, drop, and reopen
// edges. Guards attach to the target: →merged needs a PR; closing a drop status
// (or a bug's `fixed`) needs a comment.
export function buildTransitions(type: TypeDef): TransitionDef[] {
  const statuses = type.statuses;
  const byKind = (k: StatusDef['kind']) => statuses.filter((s) => s.kind === k);
  const flow = statuses.filter(
    (s) => s.kind === 'todo' || s.kind === 'active' || s.kind === 'done',
  );
  const activeStatuses = byKind('active');
  const firstActive = activeStatuses[0];
  const blocked = byKind('blocked')[0];
  const drops = byKind('dropped');
  const dones = byKind('done');
  const initial = statuses.find((s) => s.initial) ?? flow[0];

  const guardFor = (toKey: string, toKind: string): TransitionDef['config'] => {
    if (toKey === 'merged') return { guard: { requiresField: 'pr' } };
    if (toKind === 'dropped' || toKey === 'fixed') return { guard: { requiresComment: true } };
    return undefined;
  };

  const edges: TransitionDef[] = [];
  const push = (fromKey: string | null, to: StatusDef) => {
    const config = guardFor(to.key, to.kind);
    edges.push({ fromKey, toKey: to.key, ...(config ? { config } : {}) });
  };

  // entry
  if (initial) push(null, initial);
  // forward (happy path)
  for (let i = 0; i < flow.length - 1; i++) push(flow[i]!.key, flow[i + 1]!);
  // kickback: any active after the first back to the first active
  if (firstActive) for (const a of activeStatuses.slice(1)) push(a.key, firstActive);
  // block / unblock across non-done flow statuses
  if (blocked) {
    for (const f of flow.filter((s) => s.kind !== 'done')) {
      push(f.key, blocked);
      push(blocked.key, f);
    }
  }
  // drop from every non-terminal (todo/active/blocked)
  const nonTerminal = statuses.filter(
    (s) => s.kind === 'todo' || s.kind === 'active' || s.kind === 'blocked',
  );
  for (const n of nonTerminal) for (const d of drops) push(n.key, d);
  // reopen
  if (firstActive) for (const d of dones) push(d.key, firstActive);
  if (initial) for (const d of drops) push(d.key, initial);

  return edges;
}
