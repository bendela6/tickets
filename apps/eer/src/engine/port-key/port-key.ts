// Identity of one side of a pin: entity + field + L/R side. Pin fanning and pin
// bar sizing group edge-ends by this key.

import type { Side } from '../types';

export function portKey(entity: string, field: string, side: Side): string {
  return entity + '|' + field + '|' + side;
}
