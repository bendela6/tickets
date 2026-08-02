import { SAFE_ZONE } from './constants';
import { extentOfBox, rotatedBounds } from './geometry';
import { boxThrough, visibleShapes } from './tree';
import type { IconDoc } from './types';

export interface SafeZoneWarning {
  id: string;
  name: string;
  /** How far the object reaches, as a whole percentage of the tile. */
  percent: number;
}

/**
 * Objects that reach past Android's maskable circle.
 *
 * Android crops a maskable icon to a circle and cuts everything past 80% of
 * the tile. This is a warning and never a lock: it affects the Android and PWA
 * maskable output only, and plenty of icons are exported for other targets
 * where it does not matter.
 *
 * Hidden objects are not measured — they are not in the picture, and neither is
 * anything inside a hidden group.
 *
 * Measured where each shape actually lands rather than where its own numbers
 * say: a shape inside a group is stated in the group's frame, and the platform
 * crops what is drawn on the artboard.
 */
export function safeZoneWarnings(doc: IconDoc): SafeZoneWarning[] {
  const warnings: SafeZoneWarning[] = [];
  for (const { shape, frame } of visibleShapes(doc.objects)) {
    const extent = extentOfBox(boxThrough(rotatedBounds(shape), frame), doc.artboard);
    if (extent <= SAFE_ZONE) continue;
    warnings.push({ id: shape.id, name: shape.name, percent: Math.round(extent * 100) });
  }
  return warnings;
}
