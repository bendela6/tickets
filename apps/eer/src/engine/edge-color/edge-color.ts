// Edge colour = its source entity's colour (state-level convenience wrapper).

import { entityColor } from '../entity-color';
import type { EngineState } from '../types';

export function edgeColor(state: EngineState, entityId: string): string {
  return entityColor(state.model, entityId);
}
