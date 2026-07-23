import type { BoardIndexes } from '../../utils/index-board';
import type { RichTextSuggestions } from './suggestions';

// Wires the Mention (@) and ticket-ref (#) popovers to the board already
// loaded for the drawer/page — no extra fetch, just re-shaping indexes the
// caller already has in scope. `prefix` comes from `board.project.itemPrefix`
// since BoardIndexes itself carries no project-level fields (it only indexes
// board.{types,fields,users,items,options,placements}).
export function boardSuggestions(indexes: BoardIndexes, prefix: string): RichTextSuggestions {
  return {
    users: () => [...indexes.userById.values()].map((u) => ({ id: u.id, label: u.name })),
    tickets: (query) => {
      const q = query.toLowerCase();
      return [...indexes.itemByNumber.values()]
        .map((item) => ({
          id: item.id,
          label: `${prefix}-${item.number}`,
          title: String(item.values['title'] ?? ''),
        }))
        .filter((t) => t.label.toLowerCase().includes(q) || t.title.toLowerCase().includes(q))
        .slice(0, 8);
    },
  };
}
