// The group → entity tree the outline renders, and the query that prunes it.
//
// Pure: no React, no context. The tree shape is derived entirely from the model
// and the query string, which is what makes the filter testable without
// rendering anything.

import type { Entity, Group, Model } from '../../engine/model/types';

export interface OutlineEntity {
  entity: Entity;
  /**
   * Column names that matched the query. Empty when the query is empty, when
   * the entity's own name matched (the columns are then not the REASON it is
   * on screen), or when the whole group is in scope. Rendering these as child
   * rows is what keeps field search alive now that the search box filters a
   * tree instead of dropping a result list.
   */
  columns: string[];
}

export interface OutlineNode {
  group: Group;
  /** Nested subgroups, in the model's declared order. */
  children: OutlineNode[];
  /** Entities belonging DIRECTLY to this group — a subgroup's own members are its node's. */
  entities: OutlineEntity[];
}

/** Entities under a node and everything nested below it — what the row's count shows. */
export function outlineCount(node: OutlineNode): number {
  return node.entities.length + node.children.reduce((n, c) => n + outlineCount(c), 0);
}

function matchEntity(entity: Entity, q: string, inScope: boolean): OutlineEntity[] {
  if (inScope) return [{ entity, columns: [] }];
  // `id` as well as `label`: on a database graph the id is the QUALIFIED name
  // (`terminal.sessions`) while the label is bare, so searching by schema only
  // works if the id is searched too.
  if (entity.label.toLowerCase().includes(q) || entity.id.toLowerCase().includes(q)) {
    return [{ entity, columns: [] }];
  }
  const columns = entity.columns.filter((c) => c.name.toLowerCase().includes(q)).map((c) => c.name);
  return columns.length > 0 ? [{ entity, columns }] : [];
}

/**
 * Build the outline tree for `model`, keeping only what matches `query`.
 *
 * An empty query keeps everything. Otherwise a group survives when its own
 * label matches (its whole subtree then comes along whole — matching a group
 * means "show me this group"), when one of its entities matches by name or by
 * column, or when a descendant group survives. Everything else is pruned, so
 * the tree never shows a group whose contents are all filtered away.
 */
export function buildOutline(model: Model, query: string): OutlineNode[] {
  const q = query.trim().toLowerCase();

  const byGroup = new Map<string, Entity[]>();
  for (const e of model.entities) {
    const list = byGroup.get(e.group);
    if (list) list.push(e);
    else byGroup.set(e.group, [e]);
  }
  // Alphabetical within a group. Model order is PACKING order (whatever the
  // layout happened to produce), which is meaningless to read down a list.
  for (const list of byGroup.values()) list.sort((a, b) => a.label.localeCompare(b.label));

  const childrenOf = new Map<string, Group[]>();
  const roots: Group[] = [];
  for (const g of [...model.groups].sort((a, b) => a.order - b.order)) {
    if (g.parent == null) {
      roots.push(g);
      continue;
    }
    const list = childrenOf.get(g.parent);
    if (list) list.push(g);
    else childrenOf.set(g.parent, [g]);
  }

  // `inherited` = an ancestor's label already matched, so this whole subtree is
  // in scope and nothing below is filtered further.
  const build = (g: Group, inherited: boolean): OutlineNode | null => {
    const inScope = !q || inherited || g.label.toLowerCase().includes(q);
    const entities = (byGroup.get(g.id) ?? []).flatMap((e) => matchEntity(e, q, inScope));
    const children = (childrenOf.get(g.id) ?? [])
      .map((c) => build(c, inScope))
      .filter((n): n is OutlineNode => n !== null);
    if (!inScope && entities.length === 0 && children.length === 0) return null;
    return { group: g, children, entities };
  };

  return roots.map((g) => build(g, false)).filter((n): n is OutlineNode => n !== null);
}
