// Edge colour = an entity's colour. Edges are coloured by their PK-side (source)
// entity — the table being referenced.

import { entityColor } from '../entity-color';
import type { Model } from '../../model/types';

export function edgeColor(model: Model, entityId: string, overrides?: ReadonlyMap<string, string>): string {
  return entityColor(model, entityId, overrides);
}
