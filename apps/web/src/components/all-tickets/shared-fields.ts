import type { Board, FieldType, Project } from '../../api/types';
import { hexToOptionColor } from '../../registry/option-color';
import type { OptionColor } from '../../ui/option-chip';
import type { BoardIndexes } from '../../utils/index-board';

export type ProjectEntry = { project: Project; board: Board; indexes: BoardIndexes };

export type SharedField = {
  key: string;
  label: string;
  type: FieldType;
  /** Union of value options across projects (statuses for status fields), first label/color wins. */
  options: { value: string; label: string; color: OptionColor }[];
};

export type UnsharedField = {
  key: string;
  label: string;
  /** How many of the loaded projects define this key. */
  coverage: number;
};

/**
 * A field is SHARED when the same key exists — unarchived and with the same
 * type — in EVERY loaded project's board. Global columns and filters operate
 * on shared fields only; anything else is listed as unavailable with its
 * project coverage.
 */
export function computeSharedFields(entries: ProjectEntry[]): {
  shared: SharedField[];
  unshared: UnsharedField[];
} {
  const seen = new Map<
    string,
    { label: string; type: FieldType; count: number; sameType: boolean }
  >();
  for (const entry of entries) {
    for (const field of entry.board.fields) {
      if (field.archivedAt) {
        continue;
      }
      const existing = seen.get(field.key);
      if (!existing) {
        seen.set(field.key, { label: field.label, type: field.type, count: 1, sameType: true });
      } else {
        existing.count += 1;
        existing.sameType = existing.sameType && existing.type === field.type;
      }
    }
  }

  const shared: SharedField[] = [];
  const unshared: UnsharedField[] = [];
  for (const [key, info] of seen) {
    if (entries.length > 0 && info.count === entries.length && info.sameType) {
      shared.push({
        key,
        label: info.label,
        type: info.type,
        options: unionOptions(key, info.type, entries),
      });
    } else {
      unshared.push({ key, label: info.label, coverage: info.count });
    }
  }
  return { shared, unshared };
}

function unionOptions(
  key: string,
  type: FieldType,
  entries: ProjectEntry[],
): SharedField['options'] {
  const union = new Map<string, { value: string; label: string; color: OptionColor }>();
  for (const entry of entries) {
    if (type === 'status') {
      const statuses = [...entry.board.statuses]
        .filter((status) => !status.archivedAt)
        .sort((left, right) => left.position - right.position);
      for (const status of statuses) {
        if (!union.has(status.key)) {
          union.set(status.key, {
            value: status.key,
            label: status.label,
            color: hexToOptionColor(status.config.color),
          });
        }
      }
      continue;
    }
    if (type !== 'select' && type !== 'multi_select') {
      continue;
    }
    const field = entry.indexes.fieldByKey.get(key);
    if (!field) {
      continue;
    }
    for (const option of entry.indexes.optionsByFieldId.get(field.id) ?? []) {
      if (!union.has(option.value)) {
        union.set(option.value, {
          value: option.value,
          label: option.label,
          color: hexToOptionColor(option.config.color),
        });
      }
    }
  }
  return [...union.values()];
}

const ASSIGNEE_PATTERN = /assignee|owner/i;
const PRIORITY_PATTERN = /prio|priority|severity/i;
const DUE_PATTERN = /due/i;

export function isAssigneeish(field: Pick<SharedField, 'key' | 'label' | 'type'>): boolean {
  return field.type === 'select' && ASSIGNEE_PATTERN.test(`${field.key} ${field.label}`);
}

function isDefaultColumn(field: SharedField): boolean {
  if (field.type === 'status') {
    return true;
  }
  if (field.type === 'select') {
    const haystack = `${field.key} ${field.label}`;
    return PRIORITY_PATTERN.test(haystack) || ASSIGNEE_PATTERN.test(haystack);
  }
  return field.type === 'date' && DUE_PATTERN.test(`${field.key} ${field.label}`);
}

// Key and Title are fixed; everything else is a toggleable column id:
// 'type', 'subs', or a shared field key. Canonical order drives the grid.
export function canonicalColumns(shared: SharedField[]): string[] {
  return [
    'type',
    ...shared.filter((field) => field.key !== 'title').map((field) => field.key),
    'subs',
  ];
}

// Mirrors screen 02's default table: Key/Title/Type/Status/Priority/Asgn/Due/Subs
// — status plus conventionally named select/date fields, matched by pattern
// because the schema is user-defined (same heuristics as the kanban cards).
export function defaultColumns(shared: SharedField[]): string[] {
  const wanted = shared.filter((field) => field.key !== 'title' && isDefaultColumn(field));
  return ['type', ...wanted.map((field) => field.key), 'subs'];
}

/** Grid column widths per docs/design/02-all-tickets.html line 126. */
export function columnWidthFor(id: string, sharedByKey: Map<string, SharedField>): string {
  if (id === 'type') {
    return '92px';
  }
  if (id === 'subs') {
    return '78px';
  }
  const field = sharedByKey.get(id);
  if (!field) {
    return '96px';
  }
  if (isAssigneeish(field)) {
    return '64px';
  }
  switch (field.type) {
    case 'status':
      return '140px';
    case 'select':
      return '92px';
    case 'multi_select':
      return '150px';
    case 'date':
      return '96px';
    case 'number':
      return '72px';
    case 'boolean':
      return '56px';
    default:
      return '160px';
  }
}

export function columnLabelFor(id: string, sharedByKey: Map<string, SharedField>): string {
  if (id === 'type') {
    return 'Type';
  }
  if (id === 'subs') {
    return 'Subs';
  }
  return sharedByKey.get(id)?.label ?? id;
}
