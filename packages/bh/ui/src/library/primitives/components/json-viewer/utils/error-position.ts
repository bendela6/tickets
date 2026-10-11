import { jsonFault } from './json-fault';
import { lineColumn, type JsonErrorPosition } from './line-column';

// V8 has worded the same failure three ways: a bare `at position 42` for years, a
// `(line 2 column 3)` suffix more recently, and - for the whole family of "unexpected token"
// errors - a quoted window of the text and no offset at all. Safari and Firefox word it
// differently again.
const EXPLICIT = /line (\d+) column (\d+)/;
const OFFSET = /at position (\d+)/;

/**
 * Where a failed parse points, or null when nothing can say.
 *
 * The engine goes first, because it is the parser that actually rejected the document and its
 * answer is the one a stack trace elsewhere would agree with. Only when it named no position at
 * all does the scanner in ./json-fault walk the text to find one, which is the common case for a
 * multi-line document.
 */
export function errorPosition(message: string, text: string): JsonErrorPosition | null {
  const explicit = EXPLICIT.exec(message);
  if (explicit !== null) {
    return { line: Number(explicit[1]), column: Number(explicit[2]) };
  }
  const offset = OFFSET.exec(message);
  if (offset !== null) {
    return lineColumn(text, Number(offset[1]));
  }
  const fault = jsonFault(text);
  return fault === null ? null : lineColumn(text, fault);
}
