import type { Option as Choice, OptionGroup } from '@bh/ui';
import type { Option, StatusKind } from '../api/types';
import { KIND_ICON, KIND_TONE } from './status';

// The status kinds as a picker's headings, in the order work moves through them.
export const STATUS_KIND_GROUPS: { key: StatusKind; label: string }[] = [
  { key: 'todo', label: 'To do' },
  { key: 'active', label: 'Active' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'done', label: 'Done' },
  { key: 'dropped', label: 'Dropped' },
];

export interface StatusChoices {
  options: Choice[];
  groupOf: (choice: Choice) => string;
  groups: OptionGroup[];
}

/**
 * What a status picker offers, for bh's `Combobox` with `searchable={false}`
 * (spread it in): each of a type's statuses under its kind, with its kind's
 * icon and color, and each one the workflow doesn't allow shown but disabled,
 * saying why.
 *
 * `legal` is what the workflow allows (legalStatusTargets); `from` is the
 * status the item is in, null for a new item, whose statuses are where the
 * workflow starts one. `from` and `selected` (the one shown, `from` unless
 * said otherwise) can always be picked.
 */
export function statusChoices(
  statuses: Option[],
  legal: Option[],
  from: string | null,
  selected: string | null = from,
): StatusChoices {
  const allowed = new Set([...legal.map((status) => status.value), from, selected]);
  const fromLabel = statuses.find((status) => status.value === from)?.label;
  const kindOf = new Map(statuses.map((status) => [status.value, status.kind ?? 'todo']));
  return {
    options: statuses.map((status) => {
      const kind = status.kind ?? 'todo';
      const choice: Choice = {
        value: status.value,
        label: status.label,
        icon: KIND_ICON[kind],
        color: KIND_TONE[kind],
      };
      if (allowed.has(status.value)) {
        return choice;
      }
      return {
        ...choice,
        disabled: true,
        disabledReason: fromLabel
          ? `The workflow doesn't go from ${fromLabel} to ${status.label}.`
          : `The workflow doesn't start at ${status.label}.`,
      };
    }),
    groupOf: (choice) => kindOf.get(choice.value) ?? 'todo',
    groups: STATUS_KIND_GROUPS,
  };
}
