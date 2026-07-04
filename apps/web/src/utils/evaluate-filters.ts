import type { BoardTicket } from '../api/types';
import type { BoardIndexes } from './index-board';
import type { FilterRule } from './view-config';

function isEmptyValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

function asValueList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry));
  }
  if (value === null || value === undefined) {
    return [];
  }
  return [String(value)];
}

// AND across rules; every rule targets one field by id.
export function evaluateFilters(
  rules: FilterRule[],
  query: string,
  ticket: BoardTicket,
  indexes: BoardIndexes,
): boolean {
  if (query.length > 0) {
    const haystack = [
      String(ticket.number),
      ...Object.values(ticket.values).map((value) => String(value ?? '')),
    ]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(query.toLowerCase())) {
      return false;
    }
  }
  for (const rule of rules) {
    const field = indexes.fieldById.get(rule.fieldId);
    if (!field) {
      continue;
    }
    const raw = ticket.values[field.key];
    if (rule.op === 'empty') {
      if (!isEmptyValue(raw)) {
        return false;
      }
      continue;
    }
    if (rule.op === 'not-empty') {
      if (isEmptyValue(raw)) {
        return false;
      }
      continue;
    }
    if (rule.op === 'contains') {
      if (
        !String(raw ?? '')
          .toLowerCase()
          .includes((rule.values[0] ?? '').toLowerCase())
      ) {
        return false;
      }
      continue;
    }
    if (rule.op === 'kinds') {
      const status = typeof raw === 'string' ? indexes.statusByKey.get(raw) : undefined;
      if (!status || !rule.values.includes(status.kind)) {
        return false;
      }
      continue;
    }
    const present = asValueList(raw);
    const overlap = present.some((value) => rule.values.includes(value));
    if (rule.op === 'any-of' && !overlap) {
      return false;
    }
    if (rule.op === 'none-of' && overlap) {
      return false;
    }
  }
  return true;
}
