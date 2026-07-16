import type { Item } from '../api/types';
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

// AND across rules; every rule targets one field by key.
export function evaluateFilters(
  rules: FilterRule[],
  query: string,
  item: Item,
  indexes: BoardIndexes,
): boolean {
  if (query.length > 0) {
    const haystack = [
      String(item.number),
      ...Object.values(item.values).map((value) => String(value ?? '')),
    ]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(query.toLowerCase())) {
      return false;
    }
  }
  for (const rule of rules) {
    const field = indexes.fieldByKey.get(rule.fieldKey);
    if (!field) {
      continue;
    }
    const raw = item.values[field.key];
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
      // Kind lives on the option the workflow field's value resolves to —
      // no more standalone Status row/kind on the ticket.
      const option = typeof raw === 'string' ? indexes.optionByValue(field, raw) : undefined;
      if (!option || option.kind === null || !rule.values.includes(option.kind)) {
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
