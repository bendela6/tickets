// Entity colour — the single source of the diagram's hue language. Edges are
// coloured by their SOURCE entity, and the detail panel echoes the same colour so
// a row in the sidebar and its edge on the canvas read as the same thing.
// Dataviz dark-theme categorical palette, validated against #0b0d12.

import type { Model } from './types';

export const EDGE_PALETTE = ['#3987e5', '#199e70', '#c98500', '#008300', '#9085e9', '#e66767', '#d55181', '#d95926'];

export function entityColor(model: Model, entityId: string): string {
  const i = model.entities.findIndex((e) => e.id === entityId);
  return EDGE_PALETTE[(i < 0 ? 0 : i) % EDGE_PALETTE.length]!;
}
