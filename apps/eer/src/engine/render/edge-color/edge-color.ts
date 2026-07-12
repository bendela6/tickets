// Edge colour = an entity's colour (state-level convenience wrapper). Edges are
// coloured by their FK-side (target) entity — the table that holds the key.

import { entityColor } from '../entity-color';
import type { EngineState } from '../../model/types';

export function edgeColor(state: EngineState, entityId: string): string {
  return entityColor(state.model, entityId);
}
