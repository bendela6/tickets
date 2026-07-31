// Group colour — top-level zones own the diagram's hue language. A zone takes a
// palette entry by its index among zones; a subgroup inherits its parent zone's
// colour, so everything inside one domain reads as one family. A user override
// (keyed by group id) beats inheritance: own override, then the zone's, then the
// palette.

import { zoneIdOf } from '../../groups/zone-id-of';
import type { Model } from '../../model/types';

// Instrument option hues at their solid step. Values, not names: these flow
// straight into color-mix() recipes at the element (see ui/color-mix.ts), so
// they must be usable wherever a colour is. `gray` is absent — it reads as
// "no group" rather than a hue. Ordered so the first few entries stay
// maximally distinct — models rarely have >5 zones.
export const GROUP_PALETTE = [
  'var(--color-blue-9)',
  'var(--color-green-9)',
  'var(--color-orange-9)',
  'var(--color-purple-9)',
  'var(--color-red-9)',
  'var(--color-pink-9)',
  'var(--color-teal-9)',
  'var(--color-cyan-9)',
];

export function groupColor(model: Model, groupId: string, overrides?: ReadonlyMap<string, string>): string {
  const own = overrides?.get(groupId);
  if (own) return own;
  const zoneId = zoneIdOf(model, groupId);
  const zone = overrides?.get(zoneId);
  if (zone) return zone;
  const zones = model.groups.filter((g) => !g.parent);
  const i = zones.findIndex((g) => g.id === zoneId);
  return GROUP_PALETTE[(i < 0 ? 0 : i) % GROUP_PALETTE.length]!;
}
