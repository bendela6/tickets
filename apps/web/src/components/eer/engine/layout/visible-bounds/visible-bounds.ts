// Bounding box of every entity outside the hidden groups — what "Fit" frames.
// Falls back to the full content box when everything is hidden.

import type { Model } from '../../model/types';

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function visibleBounds(model: Model, hiddenGroups: ReadonlySet<string>): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const e of model.entities) {
    if (hiddenGroups.has(e.group)) continue;
    minX = Math.min(minX, e.x);
    minY = Math.min(minY, e.y);
    maxX = Math.max(maxX, e.x + e._w);
    maxY = Math.max(maxY, e.y + e._h);
  }
  if (!isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: model._content.w, maxY: model._content.h };
  }
  return { minX, minY, maxX, maxY };
}
