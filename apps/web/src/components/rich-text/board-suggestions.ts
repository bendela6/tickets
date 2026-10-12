import type { BoardIndexes } from '../../utils/index-board';
import type { RichTextSuggestions } from './suggestions';

// Wires the Mention (@) and ticket-ref (#) popovers to the board already
// loaded for the drawer/page — no extra fetch, just re-shaping indexes the
// caller already has in scope. A ticket ref's label is the item's key.
export function boardSuggestions(indexes: BoardIndexes): RichTextSuggestions {
  return {
    users: () => [...indexes.userById.values()].map((u) => ({ id: u.id, label: u.name, kind: u.kind })),
    tickets: (query) => {
      const q = query.toLowerCase();
      return [...indexes.itemByKey.values()]
        .map((item) => {
          // Same lookup kanban-view/statusPill use to color a card's status
          // dot: the item's type owns a workflow field, whose current option
          // value carries the lifecycle `kind`. Types with no workflow field
          // (or an item whose value doesn't resolve to a live option) fall
          // back to the row's neutral dot — same as the read-only ticket-ref
          // chip, which can't derive a kind at render time at all.
          const workflowField = indexes.workflowField(item.typeId);
          const statusValue = workflowField ? String(item.values[workflowField.key] ?? '') : '';
          const statusKind = workflowField
            ? (indexes.optionByValue(workflowField, statusValue)?.kind ?? null)
            : null;
          return {
            id: item.id,
            label: item.key,
            title: String(item.values['title'] ?? ''),
            statusKind,
          };
        })
        .filter((t) => t.label.toLowerCase().includes(q) || t.title.toLowerCase().includes(q))
        .slice(0, 8);
    },
  };
}
