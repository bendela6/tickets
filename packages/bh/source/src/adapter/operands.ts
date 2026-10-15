import type { Scalar } from '@bh/resource';
import type { Operand } from '../types/translation';

/** A condition's values, as an adapter translates them: one as a list of one, none as []. */
export function valuesOf(operand: Operand): Scalar[] {
  if (operand === undefined) {
    return [];
  }
  return Array.isArray(operand) ? operand : [operand];
}
