import type { AiSession } from '../../api/types';

export interface SessionTreeNode {
  session: AiSession;
  children: SessionTreeNode[];
}

// Turn the flat session list into the dispatch tree (TIX-211): a session with a
// parent_session_id nests under that parent. Orphans (parent not in the list)
// surface at the top level so nothing is hidden. Input order is preserved, so
// the caller's sort (newest first) carries through. Pure — unit-tested.
export function buildSessionTree(sessions: AiSession[]): SessionTreeNode[] {
  const byId = new Set(sessions.map((s) => s.id));
  const childrenOf = new Map<number, AiSession[]>();
  const roots: AiSession[] = [];

  for (const session of sessions) {
    const parent = session.parentSessionId;
    if (parent != null && byId.has(parent)) {
      const list = childrenOf.get(parent) ?? [];
      list.push(session);
      childrenOf.set(parent, list);
    } else {
      roots.push(session);
    }
  }

  const build = (session: AiSession): SessionTreeNode => ({
    session,
    children: (childrenOf.get(session.id) ?? []).map(build),
  });
  return roots.map(build);
}
