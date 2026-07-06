import type { Board } from '../api/types';

export type ViewColumn =
  | { source: 'number'; width?: number; hidden?: boolean }
  | { source: 'type'; width?: number; hidden?: boolean }
  | { source: 'progress'; width?: number; hidden?: boolean }
  | { source: 'field'; fieldId: number; width?: number; hidden?: boolean };

export type ViewSort = {
  source: 'number' | 'type' | 'progress' | 'field';
  fieldId?: number;
  dir: 'asc' | 'desc';
} | null;

export type FilterRule = {
  fieldId: number;
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

export function normalizeFilterRules(raw: unknown): FilterRule[] {
  const record = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rawRules = Array.isArray(record.rules) ? record.rules : Array.isArray(raw) ? raw : [];
  const rules: FilterRule[] = [];
  for (const entry of rawRules) {
    if (entry === null || typeof entry !== 'object') {
      continue;
    }
    const rule = entry as Record<string, unknown>;
    if (
      typeof rule.fieldId === 'number' &&
      typeof rule.op === 'string' &&
      FILTER_OPS.has(rule.op)
    ) {
      rules.push({
        fieldId: rule.fieldId,
        op: rule.op as FilterRule['op'],
        values: Array.isArray(rule.values) ? rule.values.map((value) => String(value)) : [],
      });
    }
  }
  return rules;
}

// Views store loose jsonb; normalize to something the table can trust. A view
// with no columns falls back to number + type + every unarchived field.
export function normalizeViewConfig(raw: unknown, board: Board): ViewConfig {
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
    if (column.source === 'field' && typeof column.fieldId === 'number') {
      columns.push({ source: 'field', fieldId: column.fieldId, ...shared });
    }
  }
  if (columns.length === 0) {
    columns.push({ source: 'number' }, { source: 'type' });
    for (const field of board.fields) {
      if (!field.archivedAt) {
        columns.push({ source: 'field', fieldId: field.id });
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
          fieldId: typeof rawSort.fieldId === 'number' ? rawSort.fieldId : undefined,
          dir: rawSort.dir === 'desc' ? 'desc' : 'asc',
        }
      : null;
  return {
    columns,
    sort,
    filters: { rules: normalizeFilterRules(record.filters) },
    mode: record.mode === 'board' ? 'board' : 'table',
    density: record.density === 'compact' ? 'compact' : 'comfortable',
    kpi: record.kpi !== false,
  };
}
