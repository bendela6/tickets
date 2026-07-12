// Group colour — top-level zones own the diagram's hue language. A zone takes a
// palette entry by its index among zones; a subgroup inherits its parent zone's
// colour, so everything inside one domain reads as one family.
// Dataviz dark-theme categorical palette, validated against #0b0d12. Ordered so
// the first few entries are maximally distinct — models rarely have >5 zones.

import { zoneIdOf } from '../../groups/zone-id-of';
import type { Model } from '../../model/types';

export const GROUP_PALETTE = ['#3987e5', '#199e70', '#c98500', '#9085e9', '#e66767', '#d55181', '#d95926', '#008300'];

export function groupColor(model: Model, groupId: string): string {
  const zoneId = zoneIdOf(model, groupId);
  const zones = model.groups.filter((g) => !g.parent);
  const i = zones.findIndex((g) => g.id === zoneId);
  return GROUP_PALETTE[(i < 0 ? 0 : i) % GROUP_PALETTE.length]!;
}
