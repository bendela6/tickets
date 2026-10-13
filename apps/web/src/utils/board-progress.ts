import type { Board } from '../api/types';
import type { BoardIndexes } from './index-board';

/**
 * How far a project is along: its top-level, unarchived items, and the share
 * of them whose status (their own type's workflow field's option) is of the
 * `done` kind, as a whole percent. A project with no items is 0% done.
 */
export function boardProgress(
  board: Board,
  indexes: BoardIndexes,
): { count: number; donePercent: number } {
  const topLevel = board.items.filter((item) => !item.archivedAt && item.parentId === null);
  const doneCount = topLevel.filter((item) => {
    const workflowField = indexes.workflowField(item.typeId);
    const raw = workflowField ? item.values[workflowField.key] : undefined;
    return (
      typeof raw === 'string' &&
      workflowField &&
      indexes.optionByValue(workflowField, raw)?.kind === 'done'
    );
  }).length;
  const donePercent = topLevel.length > 0 ? Math.round((doneCount / topLevel.length) * 100) : 0;
  return { count: topLevel.length, donePercent };
}
