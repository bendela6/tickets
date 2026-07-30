// What a column IS, derived from the table's constraints — the diagram's PK/FK
// badges and colours read this instead of a stored `role`, so they can never
// disagree with the schema.

import type { Entity } from '../types';

export interface ColumnRole {
  pk: boolean;
  fk: boolean;
  unique: boolean;
}

export function columnRoles(entity: Entity): Map<string, ColumnRole> {
  const roles = new Map<string, ColumnRole>();
  for (const f of entity.columns) roles.set(f.name, { pk: false, fk: false, unique: false });

  for (const c of entity.constraints) {
    if (c.kind === 'pk') {
      for (const name of c.columns) {
        const r = roles.get(name);
        if (r) {
          r.pk = true;
          if (c.columns.length === 1) r.unique = true; // a single-column pk is unique by definition
        }
      }
    } else if (c.kind === 'fk') {
      for (const name of c.columns) {
        const r = roles.get(name);
        if (r) r.fk = true;
      }
    } else if (c.kind === 'unique' && c.columns.length === 1) {
      const r = roles.get(c.columns[0]!);
      if (r) r.unique = true;
    }
  }
  return roles;
}
