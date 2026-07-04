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

export type ViewConfig = {
  columns: ViewColumn[];
  sort: ViewSort;
  filters: Record<string, unknown>;
};

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
    if (column.source === 'number' || column.source === 'type' || column.source === 'progress') {
      columns.push({
        source: column.source,
        width: typeof column.width === 'number' ? column.width : undefined,
        hidden: column.hidden === true,
      });
    }
    if (column.source === 'field' && typeof column.fieldId === 'number') {
      columns.push({
        source: 'field',
        fieldId: column.fieldId,
        width: typeof column.width === 'number' ? column.width : undefined,
        hidden: column.hidden === true,
      });
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
  const filters =
    record.filters !== null && typeof record.filters === 'object'
      ? (record.filters as Record<string, unknown>)
      : {};
  return { columns, sort, filters };
}
