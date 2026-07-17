import type { BoardIndexes } from '../../utils/index-board';
import { readLocal } from '../../utils/read-local';
import { STORAGE_KEYS } from '../../utils/storage-keys';
import type { FilterRule } from '../../utils/view-config';
import { writeLocal } from '../../utils/write-local';

// Cross-project filter rules address fields by KEY: field ids are per-project,
// but a shared field (same key + type in every project) is identified by its
// key everywhere. Rules translate to per-project fieldIds at evaluation time.
export type GlobalFilterRule = {
  fieldKey: string;
  op: FilterRule['op'];
  values: string[];
};

export type GlobalGroup = 'project' | 'kind';

export type GlobalViewConfig = {
  filters: GlobalFilterRule[];
  group: GlobalGroup;
  /** Enabled column ids ('type', 'subs' or shared field keys); null = the default set. */
  columns: string[] | null;
  density: 'comfortable' | 'compact';
  kpi: boolean;
};

export type GlobalView = { id: string; name: string; config: GlobalViewConfig };

// The built-in tab. Its config is the baseline every session starts from.
export const DEFAULT_GLOBAL_VIEW: GlobalView = {
  id: 'default',
  name: 'All open',
  config: {
    filters: [{ fieldKey: 'status', op: 'kinds', values: ['todo', 'active', 'blocked'] }],
    group: 'project',
    columns: null,
    density: 'comfortable',
    kpi: true,
  },
};

const FILTER_OPS = new Set(['any-of', 'none-of', 'contains', 'empty', 'not-empty', 'kinds']);

/**
 * Adapter for utils/evaluate-filters: board-level FilterRule is field-key
 * addressed too, so this is a passthrough. Kept as an explicit boundary since
 * evaluate-filters resolves via the target board's own fieldByKey — a key
 * that board lacks simply misses (rule skipped), same as before.
 */
export function toBoardRules(rules: GlobalFilterRule[], _indexes: BoardIndexes): FilterRule[] {
  return rules.map((rule) => ({
    fieldKey: rule.fieldKey,
    op: rule.op,
    values: rule.values,
  }));
}

function normalizeConfig(raw: unknown): GlobalViewConfig {
  const record = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const filters: GlobalFilterRule[] = [];
  if (Array.isArray(record.filters)) {
    for (const entry of record.filters) {
      if (entry === null || typeof entry !== 'object') {
        continue;
      }
      const rule = entry as Record<string, unknown>;
      if (
        typeof rule.fieldKey === 'string' &&
        typeof rule.op === 'string' &&
        FILTER_OPS.has(rule.op)
      ) {
        filters.push({
          fieldKey: rule.fieldKey,
          op: rule.op as FilterRule['op'],
          values: Array.isArray(rule.values) ? rule.values.map((value) => String(value)) : [],
        });
      }
    }
  }
  return {
    filters,
    group: record.group === 'kind' ? 'kind' : 'project',
    columns: Array.isArray(record.columns) ? record.columns.map((column) => String(column)) : null,
    density: record.density === 'compact' ? 'compact' : 'comfortable',
    kpi: record.kpi !== false,
  };
}

/** Order-stable serialization so "unsaved changes" compares content, not identity. */
function canon(config: GlobalViewConfig): string {
  return JSON.stringify({
    filters: config.filters.map((rule) => ({
      fieldKey: rule.fieldKey,
      op: rule.op,
      values: rule.values,
    })),
    group: config.group,
    columns: config.columns,
    density: config.density,
    kpi: config.kpi,
  });
}

export function sameConfig(left: GlobalViewConfig, right: GlobalViewConfig): boolean {
  return canon(left) === canon(right);
}

export function cloneConfig(config: GlobalViewConfig): GlobalViewConfig {
  return normalizeConfig(JSON.parse(canon(config)));
}

// Global views are deliberately localStorage-only: views are a per-project
// resource on the server and there is no cross-project view API, so the
// workspace-wide tabs persist client-side under 'tickets-global-views'.
export function readGlobalViews(): GlobalView[] {
  const raw = readLocal(STORAGE_KEYS.globalViews);
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const views: GlobalView[] = [];
    for (const entry of parsed) {
      if (entry === null || typeof entry !== 'object') {
        continue;
      }
      const view = entry as Record<string, unknown>;
      if (typeof view.id === 'string' && typeof view.name === 'string') {
        views.push({ id: view.id, name: view.name, config: normalizeConfig(view.config) });
      }
    }
    return views;
  } catch {
    return [];
  }
}

export function writeGlobalViews(views: GlobalView[]): void {
  writeLocal(STORAGE_KEYS.globalViews, JSON.stringify(views));
}

export function newViewId(): string {
  return `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
