import type { Item } from '../api/types';
import type { BoardIndexes } from './index-board';

// Progress = children with done-kind status / children not dropped-kind.
// Each child resolves its own workflow field — types aren't required to share one.
export function childProgress(item: Item, indexes: BoardIndexes) {
  const children = indexes.childrenByParent.get(item.id) ?? [];
  let done = 0;
  let total = 0;
  let blocked = 0;
  for (const child of children) {
    const wf = indexes.workflowField(child.typeId);
    const raw = wf ? child.values[wf.key] : undefined;
    const option = wf && typeof raw === 'string' ? indexes.optionByValue(wf, raw) : undefined;
    const kind = option?.kind ?? 'todo';
    if (kind === 'blocked') {
      blocked += 1;
    }
    if (kind !== 'dropped') {
      total += 1;
      if (kind === 'done') {
        done += 1;
      }
    }
  }
  return { any: children.length > 0, done, total, blocked };
}
