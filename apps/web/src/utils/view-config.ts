import type { Board } from '../api/types';

export type ViewColumn =
  | { source: 'number'; width?: number; hidden?: boolean }
  | { source: 'type'; width?: number; hidden?: boolean }
  | { source: 'progress'; width?: number; hidden?: boolean }
  | { source: 'field'; fieldKey: string; width?: number; hidden?: boolean };

export type ViewSort = {
  source: 'number' | 'type' | 'progress' | 'field';
  fieldKey?: string;
  dir: 'asc' | 'desc';
} | null;

export type FilterRule = {
  fieldKey: string;
  op: 'any-of' | 'none-of' | 'contains' | 'empty' | 'not-empty' | 'kinds';
  values: string[];
};

export type ViewMode = 'table' | 'board';
export type ViewDensity = 'comfortable' | 'compact';

export type ViewConfig = {
  columns: ViewColumn[];
  sort: ViewSort;
  filters: { rules: FilterRule[] };
  /** Renderer for the board area. Defaults to 'table'. */
  mode: ViewMode;
  /** Table row density. Defaults to 'comfortable'. */
  density: ViewDensity;
  /** Whether the KPI strip is shown. Defaults to true. */
  kpi: boolean;
};

const FILTER_OPS = new Set(['any-of', 'none-of', 'contains', 'empty', 'not-empty', 'kinds']);

// Legacy stored configs (pre field-key migration) carry a numeric fieldId;
// resolve it to the field's key via the board's id->key map. Returns
// undefined when neither a valid fieldKey nor a resolvable fieldId is present.
function resolveFieldKey(
  entry: Record<string, unknown>,
  fieldKeyById: Map<number, string>,
): string | undefined {
  if (typeof entry.fieldKey === 'string') {
    return entry.fieldKey;
  }
  if (typeof entry.fieldId === 'number') {
    return fieldKeyById.get(entry.fieldId);
  }
  return undefined;
}

// fieldKeyById defaults empty for callers without board context (e.g. the
// view route's URL search-param parser, which only ever sees rules already
// carrying fieldKey since that's all clients write going forward).
export function normalizeFilterRules(
  raw: unknown,
  fieldKeyById: Map<number, string> = new Map(),
): FilterRule[] {
  const record = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rawRules = Array.isArray(record.rules) ? record.rules : Array.isArray(raw) ? raw : [];
  const rules: FilterRule[] = [];
  for (const entry of rawRules) {
    if (entry === null || typeof entry !== 'object') {
      continue;
    }
    const rule = entry as Record<string, unknown>;
    const fieldKey = resolveFieldKey(rule, fieldKeyById);
    if (
      fieldKey !== undefined &&
      typeof rule.op === 'string' &&
      FILTER_OPS.has(rule.op)
    ) {
      rules.push({
        fieldKey,
        op: rule.op as FilterRule['op'],
        values: Array.isArray(rule.values) ? rule.values.map((value) => String(value)) : [],
      });
    }
  }
  return rules;
}

// Views store loose jsonb; normalize to something the table can trust. A view
// with no columns falls back to number + type + every unarchived field.
// Legacy configs may carry numeric fieldId instead of fieldKey; the board's
// id->key map (built from board.fields) translates them on the way in.
export function normalizeViewConfig(raw: unknown, board: Board): ViewConfig {
  const fieldKeyById = new Map<number, string>(board.fields.map((field) => [field.id, field.key]));
  const record = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rawColumns = Array.isArray(record.columns) ? record.columns : [];
  const columns: ViewColumn[] = [];
  for (const entry of rawColumns) {
    if (entry === null || typeof entry !== 'object') {
      continue;
    }
    const column = entry as Record<string, unknown>;
    const shared = {
      width: typeof column.width === 'number' ? column.width : undefined,
      hidden: column.hidden === true,
    };
    if (column.source === 'number' || column.source === 'type' || column.source === 'progress') {
      columns.push({ source: column.source, ...shared });
    }
    if (column.source === 'field') {
      const fieldKey = resolveFieldKey(column, fieldKeyById);
      if (fieldKey !== undefined) {
        columns.push({ source: 'field', fieldKey, ...shared });
      }
    }
  }
  if (columns.length === 0) {
    columns.push({ source: 'number' }, { source: 'type' });
    for (const field of board.fields) {
      if (!field.archivedAt) {
        columns.push({ source: 'field', fieldKey: field.key });
      }
    }
    columns.push({ source: 'progress' });
  }
  const rawSort =
    record.sort !== null && typeof record.sort === 'object'
      ? (record.sort as Record<string, unknown>)
      : null;
  const sort: ViewSort =
    rawSort &&
    (rawSort.source === 'number' ||
      rawSort.source === 'type' ||
      rawSort.source === 'progress' ||
      rawSort.source === 'field')
      ? {
          source: rawSort.source,
          fieldKey: resolveFieldKey(rawSort, fieldKeyById),
          dir: rawSort.dir === 'desc' ? 'desc' : 'asc',
        }
      : null;
  return {
    columns,
    sort,
    filters: { rules: normalizeFilterRules(record.filters, fieldKeyById) },
    mode: record.mode === 'board' ? 'board' : 'table',
    density: record.density === 'compact' ? 'compact' : 'comfortable',
    kpi: record.kpi !== false,
  };
}
