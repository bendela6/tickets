// The shape a JSON document takes on screen: one row per printed line, flat rather than nested.
// A nested render would have had to count its own descendants to know what line it was on, and
// the gutter, the fold and the copy all want that number. Flat, a line number is an index and a
// fold is a jump.

/** What a run of the document is drawn as. */
export type JsonTokenKind =
  'key' | 'string' | 'number' | 'boolean' | 'null' | 'punctuation' | 'summary' | 'invalid';

/** One run of a single kind. Never spans a line: lines are the unit that renders. */
export interface JsonToken {
  text: string;
  kind: JsonTokenKind;
}

/** The container a line opens, for the lines that open one. */
export interface JsonContainer {
  type: 'object' | 'array';
  /** How many members it holds, which is what the folded line reads in their place. */
  size: number;
  /** Index of the row carrying the matching bracket. An empty container closes on its own row. */
  closeRow: number;
}

/** One printed line. */
export interface JsonRow {
  /**
   * JSON-pointer identity of the value on this line; the fold set is keyed by it. A closing row
   * repeats the path of the line it closes, which is harmless: only rows that open a container
   * are ever looked up in the fold set.
   */
  path: string;
  depth: number;
  /** The object key this line is introduced by. Array members, the root and closing rows have none. */
  key: string | null;
  /** The scalar on this line. Null when the line opens or closes a container. */
  value: JsonToken | null;
  /** Set when this line opens a container. */
  container: JsonContainer | null;
  /** Set when this line is nothing but a closing bracket. */
  close: '}' | ']' | null;
  /** Whether a comma follows the value this line belongs to. */
  comma: boolean;
}
