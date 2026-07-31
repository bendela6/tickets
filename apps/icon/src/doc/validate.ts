import { SAFE_ZONE } from './constants';
import { extentOf } from './geometry';
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
 * Hidden objects are not measured — they are not in the picture.
 */
export function safeZoneWarnings(doc: IconDoc): SafeZoneWarning[] {
  return doc.objects
    .filter((object) => !object.hidden && extentOf(object, doc.artboard) > SAFE_ZONE)
    .map((object) => ({
      id: object.id,
      name: object.name,
      percent: Math.round(extentOf(object, doc.artboard) * 100),
    }));
}
