// A card's world rect plus its centre — the layout/routing view of an entity.

import type { Entity } from '../types';

export function entityRect(e: Entity) {
  return { x: e.x, y: e.y, w: e._w, h: e._h, cx: e.x + e._w / 2, cy: e.y + e._h / 2 };
}
