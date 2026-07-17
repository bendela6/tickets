import type { WhenClause } from '../types/when';

export function collectWhenDeps(
  clause: WhenClause,
  into: Set<string> = new Set<string>(),
): Set<string> {
  if ('all' in clause) {
    clause.all.forEach((c) => collectWhenDeps(c, into));
  } else if ('any' in clause) {
    clause.any.forEach((c) => collectWhenDeps(c, into));
  } else if ('not' in clause) {
    collectWhenDeps(clause.not, into);
  } else {
    into.add(clause.field);
  }
  return into;
}
