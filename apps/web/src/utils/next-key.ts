import type { Board } from '../api/types';
import type { BoardIndexes } from './index-board';

// The key the API will give a new item (apps/api/src/command/item/keys.ts),
// shown as a hint before it is made: the server decides. In a numbered
// project the prefix and the next number; in a plan project an epic's
// PREFIX/E<n>, a feature's PREFIX-<n>, anything else its parent's key and the
// next number under it (null without a parent, which the API refuses).
export function nextKey(
  board: Board,
  indexes: BoardIndexes,
  input: { typeKey: string; parentId: number | null },
): string | null {
  const prefix = board.project.itemPrefix;
  if (!board.plan) {
    return `${prefix}-${board.items.reduce((max, item) => Math.max(max, item.number), 0) + 1}`;
  }
  const after = (keys: string[], pattern: RegExp) =>
    keys.reduce((max, key) => Math.max(max, Number(pattern.exec(key)?.[1] ?? 0)), 0) + 1;
  const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ofType = () =>
    board.items.filter((item) => indexes.typeById.get(item.typeId)?.key === input.typeKey).map((item) => item.key);
  if (input.typeKey === 'epic') {
    return `${prefix}/E${after(ofType(), new RegExp(`^${escaped(prefix)}/E(\\d+)$`))}`;
  }
  if (input.typeKey === 'feature') {
    return `${prefix}-${after(ofType(), new RegExp(`^${escaped(prefix)}-(\\d+)$`))}`;
  }
  const parent = input.parentId !== null ? indexes.itemById.get(input.parentId) : undefined;
  if (!parent) {
    return null;
  }
  const siblings = board.items.filter((item) => item.parentId === parent.id).map((item) => item.key);
  return `${parent.key}.${after(siblings, new RegExp(`^${escaped(parent.key)}\\.(\\d+)$`))}`;
}
