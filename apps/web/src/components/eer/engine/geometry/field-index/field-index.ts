// Row index of a field inside its entity (-1 when missing) — the row index is
// what positions a field's port vertically.

import type { Entity } from '../../model/types';

export function fieldIndex(e: Entity, name: string): number {
  return e.columns.findIndex((f) => f.name === name);
}
