// Entity colour — an entity takes its GROUP's colour (zones own the diagram's
// hue language; see group-color). The detail panel echoes the same colour so a
// row in the sidebar and its table on the canvas read as the same thing.

import { groupColor } from '../group-color';
import type { Model } from '../../model/types';

export function entityColor(model: Model, entityId: string): string {
  const e = model.entityById.get(entityId);
  return groupColor(model, e?.group ?? '');
}
