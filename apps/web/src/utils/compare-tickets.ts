import type { Item } from '../api/types';
import { childProgress } from './child-progress';
import type { BoardIndexes } from './index-board';
import type { ViewSort } from './view-config';

// Comparator honoring the view's stored sort. Options order by their position
// (never alphabetically); number tiebreak keeps it stable. ItemType has no
// ordering column in the items model, so a 'type' sort ranks by typeId.
export function compareTickets(
  indexes: BoardIndexes,
  sort: ViewSort,
): (left: Item, right: Item) => number {
  const direction = sort?.dir === 'desc' ? -1 : 1;
  const rank = (item: Item): number | string => {
    if (!sort || sort.source === 'number') {
      return item.number;
    }
    if (sort.source === 'type') {
      return item.typeId;
    }
    if (sort.source === 'progress') {
      const progress = childProgress(item, indexes);
      return progress.total === 0 ? -1 : progress.done / progress.total;
    }
    const field = sort.fieldKey === undefined ? undefined : indexes.fieldByKey.get(sort.fieldKey);
    if (!field) {
      return item.number;
    }
    const raw = item.values[field.key];
    if (raw === null || raw === undefined) {
      return direction === 1 ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER;
    }
    if (field.type === 'option') {
      const options = field.optionSetId === null ? [] : (indexes.optionsBySetId.get(field.optionSetId) ?? []);
      return options.findIndex((option) => option.value === raw);
    }
    if (field.type === 'number') {
      return Number(raw);
    }
    if (field.type === 'date' || field.type === 'datetime') {
      return Date.parse(String(raw)) || 0;
    }
    if (field.type === 'boolean') {
      return raw === true ? 1 : 0;
    }
    return String(raw).toLowerCase();
  };
  return (left, right) => {
    const leftRank = rank(left);
    const rightRank = rank(right);
    if (leftRank < rightRank) {
      return -1 * direction;
    }
    if (leftRank > rightRank) {
      return 1 * direction;
    }
    return left.number - right.number;
  };
}
