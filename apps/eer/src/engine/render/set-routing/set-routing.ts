// Switch the line mode (curved / avoid / ortho) and redraw everything.

import { drawAllEdges } from '../draw-all-edges';
import type { EngineState } from '../../model/types';

export function setRouting(state: EngineState, routing: EngineState['view']['routing']): void {
  state.view.routing = routing;
  drawAllEdges(state);
}
