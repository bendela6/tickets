// Write the pan/zoom view state to the world element's transform.

import type { EngineState } from '../../model/types';

export function applyTransform(state: EngineState): void {
  const v = state.view;
  state.els.world.style.transform = `translate(${v.panX}px, ${v.panY}px) scale(${v.zoom})`;
}
