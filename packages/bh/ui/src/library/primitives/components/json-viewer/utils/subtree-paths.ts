import type { JsonRow } from '../types';

/**
 * Every container inside the one opening at `index`, itself included - what an alt-click folds or
 * opens in one go, so a deep branch does not have to be walked a chevron at a time.
 */
export function subtreePaths(rows: JsonRow[], index: number): string[] {
  const start = rows[index]?.container ?? null;
  if (start === null) {
    return [];
  }
  const through = start.closeRow;
  const paths: string[] = [];
  rows.forEach((row, at) => {
    if (at < index || at > through) {
      return;
    }
    if (row.container !== null && row.container.size > 0) {
      paths.push(row.path);
    }
  });
  return paths;
}
