import type { BoardTicket } from '../api/types';
import { childProgress } from './child-progress';
import type { BoardIndexes } from './index-board';
import type { ViewSort } from './view-config';

// Comparator honoring the view's stored sort. Options and statuses order by
// their position (never alphabetically); number tiebreak keeps it stable.
export function compareTickets(
  indexes: BoardIndexes,
  sort: ViewSort,
): (left: BoardTicket, right: BoardTicket) => number {
  const direction = sort?.dir === 'desc' ? -1 : 1;
  const rank = (ticket: BoardTicket): number | string => {
    if (!sort || sort.source === 'number') {
      return ticket.number;
    }
    if (sort.source === 'type') {
      return indexes.typeById.get(ticket.typeId)?.position ?? 0;
    }
    if (sort.source === 'progress') {
      const progress = childProgress(ticket, indexes);
      return progress.total === 0 ? -1 : progress.done / progress.total;
    }
    const field = sort.fieldId === undefined ? undefined : indexes.fieldById.get(sort.fieldId);
    if (!field) {
      return ticket.number;
    }
    const raw = ticket.values[field.key];
    if (raw === null || raw === undefined) {
      return direction === 1 ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER;
    }
    if (field.type === 'select') {
      const options = indexes.optionsByFieldId.get(field.id) ?? [];
      return options.findIndex((option) => option.value === raw);
    }
    if (field.type === 'status') {
      return indexes.statusByKey.get(String(raw))?.position ?? 0;
    }
    if (field.type === 'number') {
      return Number(raw);
    }
    if (field.type === 'date') {
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
