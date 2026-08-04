// Maps the outline's own tree (OutlineNode[], from build-outline.ts) onto the
// shape @tickets/ui's useTreeView walks. Pure data mapping — no React — so the
// row renderer and outline.tsx can both read it without re-walking the model.

import type { TreeNode } from '@tickets/ui';
import type { Entity } from '../../engine/model/types';
import { outlineCount, type OutlineNode } from './build-outline';

// Row ids are PREFIXED because a group and a table can share a name — a schema
// with a `core` group and a `core` table would otherwise collapse two rows into
// one id, and the tree keys, focus and selection all go by id.
export const groupRowId = (id: string) => `g:${id}`;
export const entityRowId = (id: string) => `e:${id}`;
export const columnRowId = (entityId: string, column: string) => `c:${entityId}:${column}`;

export type OutlineRowData =
  | { kind: 'group'; node: OutlineNode; count: number }
  | { kind: 'entity'; entity: Entity }
  | { kind: 'column'; entityId: string; column: string };

/** The shape useTreeView walks. Subgroups come before this group's own tables,
 *  matching how the recursive renderer used to order them. `label` carries the
 *  hook's first-letter typeahead — every node gets one, so the outline gains
 *  working typeahead it never had. */
export function outlineToTreeNodes(nodes: OutlineNode[]): TreeNode[] {
  return nodes.map((n) => ({
    id: groupRowId(n.group.id),
    label: n.group.label,
    children: [
      ...outlineToTreeNodes(n.children),
      ...n.entities.map((e) => ({
        id: entityRowId(e.entity.id),
        label: e.entity.label,
        // Matching columns are child rows; a table with none is a leaf.
        children: e.columns.map((c) => ({ id: columnRowId(e.entity.id, c), label: c, children: [] })),
      })),
    ],
  }));
}

/** id → what that row IS, so the renderer never re-walks the outline per row. */
export function indexOutline(
  nodes: OutlineNode[],
  into: Map<string, OutlineRowData> = new Map(),
): Map<string, OutlineRowData> {
  for (const n of nodes) {
    into.set(groupRowId(n.group.id), { kind: 'group', node: n, count: outlineCount(n) });
    indexOutline(n.children, into);
    for (const e of n.entities) {
      into.set(entityRowId(e.entity.id), { kind: 'entity', entity: e.entity });
      for (const c of e.columns) {
        into.set(columnRowId(e.entity.id, c), { kind: 'column', entityId: e.entity.id, column: c });
      }
    }
  }
  return into;
}

/** Dispatches a row click. Split on the FIRST colon only — entity ids are
 *  schema-qualified (`terminal.sessions`) and column ids carry two separators. */
export function parseRowId(rowId: string): { kind: string; rest: string } {
  const at = rowId.indexOf(':');
  return { kind: rowId.slice(0, at), rest: rowId.slice(at + 1) };
}
