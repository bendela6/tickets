import type { Board, FieldType, Project } from '../../api/types';
import { hexToOptionColor, kindColor, type OptionColor } from '../../registry/option-color';
import type { BoardIndexes } from '../../utils/index-board';

export type ProjectEntry = { project: Project; board: Board; indexes: BoardIndexes };

export type SharedField = {
  key: string;
  label: string;
  type: FieldType;
  /** True when every project defines this key as its workflow field. */
  workflow: boolean;
  /** True when every project defines this key as accepting multiple values. */
  multiple: boolean;
  /** Union of value options across projects (workflow options for the workflow field), first label/color wins. */
  options: { value: string; label: string; color: OptionColor }[];
};

export type UnsharedField = {
  key: string;
  label: string;
  /** How many of the loaded projects define this key. */
  coverage: number;
};

/**
 * A field is SHARED when the same key exists — unarchived, same type, and
 * same workflow-ness — in EVERY loaded project's board. Global columns and
 * filters operate on shared fields only; anything else is listed as
 * unavailable with its project coverage.
 */
export function computeSharedFields(entries: ProjectEntry[]): {
  shared: SharedField[];
  unshared: UnsharedField[];
} {
  const seen = new Map<
    string,
    {
      label: string;
      type: FieldType;
      workflow: boolean;
      multiple: boolean;
      count: number;
      sameShape: boolean;
    }
  >();
  for (const entry of entries) {
    for (const field of entry.board.fields) {
      if (field.archivedAt) {
        continue;
      }
      const workflow = field.config.workflow === true;
      const multiple = field.config.multiple === true;
      const existing = seen.get(field.key);
      if (!existing) {
        seen.set(field.key, { label: field.label, type: field.type, workflow, multiple, count: 1, sameShape: true });
      } else {
        existing.count += 1;
        existing.sameShape =
          existing.sameShape &&
          existing.type === field.type &&
          existing.workflow === workflow &&
          existing.multiple === multiple;
      }
    }
  }

  const shared: SharedField[] = [];
  const unshared: UnsharedField[] = [];
  for (const [key, info] of seen) {
    if (entries.length > 0 && info.count === entries.length && info.sameShape) {
      shared.push({
        key,
        label: info.label,
        type: info.type,
        workflow: info.workflow,
        multiple: info.multiple,
        options: unionOptions(key, info.type, entries),
      });
    } else {
      unshared.push({ key, label: info.label, coverage: info.count });
    }
  }
  return { shared, unshared };
}

function unionOptions(key: string, type: FieldType, entries: ProjectEntry[]): SharedField['options'] {
  if (type !== 'option') {
    return [];
  }
  const union = new Map<string, { value: string; label: string; color: OptionColor }>();
  for (const entry of entries) {
    const field = entry.indexes.fieldByKey.get(key);
    if (!field || field.optionSetId === null) {
      continue;
    }
    const isWorkflow = field.config.workflow === true;
    for (const option of entry.indexes.optionsBySetId.get(field.optionSetId) ?? []) {
      if (!union.has(option.value)) {
        union.set(option.value, {
          value: option.value,
          label: option.label,
          color: isWorkflow ? kindColor(option.kind) : hexToOptionColor(option.config.color),
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
  return field.type === 'user' && ASSIGNEE_PATTERN.test(`${field.key} ${field.label}`);
}

function isDefaultColumn(field: SharedField): boolean {
  if (field.workflow) {
    return true;
  }
  const haystack = `${field.key} ${field.label}`;
  if (field.type === 'option') {
    return PRIORITY_PATTERN.test(haystack);
  }
  if (field.type === 'user') {
    return ASSIGNEE_PATTERN.test(haystack);
  }
  return (field.type === 'date' || field.type === 'datetime') && DUE_PATTERN.test(haystack);
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
// — the workflow field plus conventionally named option/user/date fields,
// matched by pattern because the scheme is user-defined (same heuristics as
// the kanban cards).
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
    case 'option':
      if (field.workflow) {
        return '140px';
      }
      return field.multiple ? '150px' : '92px';
    case 'date':
    case 'datetime':
      return '96px';
    case 'number':
      return '72px';
    case 'boolean':
      return '56px';
    case 'user':
      return '90px';
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
