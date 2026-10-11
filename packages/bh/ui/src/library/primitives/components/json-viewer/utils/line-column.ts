/** A place in a document, counted the way an editor's status bar counts it: both 1-based. */
export interface JsonErrorPosition {
  line: number;
  column: number;
}

/** Turns an offset into a line and a column. An offset past the end lands at the end. */
export function lineColumn(text: string, offset: number): JsonErrorPosition {
  const before = text.slice(0, Math.max(0, offset)).split('\n');
  return { line: before.length, column: (before.at(-1)?.length ?? 0) + 1 };
}
