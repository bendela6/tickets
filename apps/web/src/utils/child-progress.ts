import type { BoardTicket } from '../api/types';
import type { BoardIndexes } from './index-board';

// Progress = children with done-kind status / children not dropped-kind.
export function childProgress(ticket: BoardTicket, indexes: BoardIndexes) {
  const children = indexes.childrenByParent.get(ticket.id) ?? [];
  const statusField = indexes.statusField;
  let done = 0;
  let total = 0;
  let blocked = 0;
  for (const child of children) {
    const key = statusField ? child.values[statusField.key] : undefined;
    const status = typeof key === 'string' ? indexes.statusByKey.get(key) : undefined;
    const kind = status?.kind ?? 'todo';
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
