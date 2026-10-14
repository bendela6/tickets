/**
 * A multi-line entry: a line, and the lines after it that belong to it, as
 * a stack trace belongs to its error. `start` is the first line's index and
 * `end` one past the last's, so an entry holds `end - start - 1` lines under
 * its first, always at least one.
 */
export interface LogEntry {
  start: number;
  end: number;
}

// A stack frame, which belongs to the line above it however it is indented:
// a JavaScript or Java `at …` ending in its place (`(file.js:1:2)`,
// `file.js:1:2`, `(Main.java:5)`, `(native)`), Java's `... 3 more`, and the
// `Caused by:` and `Suppressed:` that start a nested trace.
const CONTINUATION = [
  /^\s*at\s.*(?:\(.*\)|:\d+)\s*\{?$/,
  /^\s*\.\.\.\s*\d+\s+more\b/,
  /^\s*(?:Caused by|Suppressed):\s/,
];

const OPENER = /[{[(]$/;
const CLOSER = /^[}\])]/;

// A tab counts as four columns, so a line indented by a tab is deeper than
// one indented by a couple of spaces.
function indentOf(text: string): number {
  let columns = 0;
  for (const char of text) {
    if (char === ' ') {
      columns += 1;
    } else if (char === '\t') {
      columns += 4;
    } else {
      break;
    }
  }
  return columns;
}

function isBlank(text: string): boolean {
  return text.trim() === '';
}

function isContinuation(text: string): boolean {
  return CONTINUATION.some((pattern) => pattern.test(text));
}

/**
 * The log's multi-line entries, in order, none inside another.
 *
 * An entry is a line and the lines after it indented deeper than it, as an
 * error's stack trace is, with a stack frame (`at …`, `... 3 more`, `Caused
 * by:`) counted as deeper whatever its indent. Blank lines inside an entry
 * stay in it when a line after them does; at its end, they are left out. A
 * printed object's closing bracket, back at the first line's indent, ends
 * the entry and belongs to it when a line in the entry opened one.
 *
 * Reads the lines' plain text, with their escape codes taken out.
 */
export function groupLogEntries(texts: readonly string[]): LogEntry[] {
  const entries: LogEntry[] = [];
  let start = 0;
  while (start < texts.length) {
    const head = texts[start] ?? '';
    if (isBlank(head)) {
      start += 1;
      continue;
    }
    const headIndent = indentOf(head);
    // Brackets left open by the lines so far: the closer that brings the
    // entry back to its first line's indent belongs to it.
    let open = OPENER.test(head.trimEnd()) ? 1 : 0;
    let end = start + 1;
    let next = start + 1;
    while (next < texts.length) {
      const text = texts[next] ?? '';
      if (isBlank(text)) {
        next += 1;
        continue;
      }
      const trimmed = text.trim();
      if (indentOf(text) > headIndent || isContinuation(text)) {
        open += (OPENER.test(trimmed) ? 1 : 0) - (CLOSER.test(trimmed) ? 1 : 0);
        end = next + 1;
        next += 1;
        continue;
      }
      if (open > 0 && CLOSER.test(trimmed)) {
        end = next + 1;
      }
      break;
    }
    if (end - start > 1) {
      entries.push({ start, end });
    }
    start = end;
  }
  return entries;
}
