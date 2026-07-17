import type { WhenClause } from '../types/when';

export function evaluateWhen(clause: WhenClause, values: Record<string, unknown>): boolean {
  if ('all' in clause) {
    return clause.all.every((c) => evaluateWhen(c, values));
  }
  if ('any' in clause) {
    return clause.any.some((c) => evaluateWhen(c, values));
  }
  if ('not' in clause) {
    return !evaluateWhen(clause.not, values);
  }

  const v = values[clause.field];
  if ('eq' in clause) {
    return v === clause.eq;
  }
  if ('neq' in clause) {
    return v !== clause.neq;
  }
  if ('in' in clause) {
    return clause.in.includes(v);
  }
  if ('truthy' in clause) {
    return Boolean(v);
  }

  // exhaustiveness — all variants handled above
  const _exhaustive: never = clause;
  return _exhaustive;
}
