// Edge colour = an entity's colour. Edges are coloured by their FK-side (target)
// entity — the table that holds the key.

import { entityColor } from '../entity-color';
import type { Model } from '../../model/types';

export function edgeColor(model: Model, entityId: string, overrides?: ReadonlyMap<string, string>): string {
  return entityColor(model, entityId, overrides);
}
