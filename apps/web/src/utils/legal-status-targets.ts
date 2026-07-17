import type { Board, Item, Option } from '../api/types';
import type { BoardIndexes } from './index-board';

// Mirrors the server's checkTransition: no applicable edges ⇒ anything goes;
// with edges, only current + matching from→to targets are legal.
export function legalStatusTargets(
  board: Board,
  indexes: BoardIndexes,
  item: Item | null,
  typeId: number,
): Option[] {
  const wf = indexes.workflowField(typeId);
  if (!wf) return [];
  const options = indexes.optionsForField(typeId, wf).filter((o) => !o.archivedAt);
  const applicable = board.transitions.filter(
    (e) => e.fieldId === wf.id && (e.itemTypeId === null || e.itemTypeId === typeId),
  );
  if (applicable.length === 0) return options;

  if (!item) {
    const entry = applicable.filter((e) => e.fromOptionId === null);
    if (entry.length === 0) return options;
    return options.filter((o) => entry.some((e) => e.toOptionId === o.id));
  }
  const currentValue = item.values[wf.key];
  const current = typeof currentValue === 'string' ? indexes.optionByValue(wf, currentValue) : undefined;
  const fromCurrent = applicable.filter((e) => e.fromOptionId === (current?.id ?? null));
  return options.filter((o) => o.id === current?.id || fromCurrent.some((e) => e.toOptionId === o.id));
}
