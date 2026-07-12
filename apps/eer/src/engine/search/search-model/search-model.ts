import type { Model, SearchResult } from '../../model/types';

export function searchModel(model: Model, q: string): SearchResult[] {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  const idx: SearchResult[] = [];
  for (const e of model.entities) {
    idx.push({
      kind: 'entity',
      label: e.label,
      entityId: e.id,
      entityLabel: e.label,
      search: (e.label + ' ' + e.id).toLowerCase(),
    });
    for (const f of e.fields) {
      idx.push({
        kind: 'field',
        label: f.name,
        field: f.name,
        entityId: e.id,
        entityLabel: e.label,
        search: (f.name + ' ' + e.label).toLowerCase(),
      });
    }
  }
  return idx.filter((m) => m.search.includes(query)).slice(0, 20);
}
