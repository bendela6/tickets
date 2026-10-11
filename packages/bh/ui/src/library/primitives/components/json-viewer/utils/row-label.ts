import type { JsonRow } from '../types';

/**
 * How a fold control names what it opens. A keyed line says its key, which is what the reader sees
 * on it; an array member has no name of its own, so it is named by where it is.
 */
export function rowLabel(row: JsonRow, line: number): string {
  if (row.key !== null) {
    return row.key;
  }
  return `the ${row.container?.type ?? 'value'} on line ${line}`;
}
