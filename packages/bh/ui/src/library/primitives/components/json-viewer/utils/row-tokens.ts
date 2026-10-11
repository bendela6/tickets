import type { JsonRow, JsonToken } from '../types';
import { containerSummary } from './container-summary';

/**
 * The line as a list of runs, which is what both the render and the copy read.
 *
 * The folded form is built here too, because it is a property of the line rather than of the tree:
 * a closed container draws its own closing bracket and a count of what is inside it, so the fold
 * costs no line of its own.
 */
export function rowTokens(row: JsonRow, folded: boolean): JsonToken[] {
  const tokens: JsonToken[] = [];
  if (row.key !== null) {
    tokens.push({ text: JSON.stringify(row.key), kind: 'key' });
    tokens.push({ text: ': ', kind: 'punctuation' });
  }

  if (row.close !== null) {
    tokens.push({ text: row.close, kind: 'punctuation' });
  } else if (row.container !== null) {
    const isArray = row.container.type === 'array';
    const opener = isArray ? '[' : '{';
    const closer = isArray ? ']' : '}';
    if (row.container.size === 0) {
      tokens.push({ text: `${opener}${closer}`, kind: 'punctuation' });
    } else if (folded) {
      tokens.push({ text: opener, kind: 'punctuation' });
      tokens.push({
        text: ` ${containerSummary(row.container.type, row.container.size)} `,
        kind: 'summary',
      });
      tokens.push({ text: closer, kind: 'punctuation' });
    } else {
      tokens.push({ text: opener, kind: 'punctuation' });
    }
  } else if (row.value !== null) {
    tokens.push(row.value);
  }

  // The comma belongs to whichever line ends the value - the scalar itself, the closing bracket,
  // or the opening bracket when the container is empty or folded shut.
  const endsTheValue = row.container === null || row.container.size === 0 || folded;
  if (row.comma && endsTheValue) {
    tokens.push({ text: ',', kind: 'punctuation' });
  }
  return tokens;
}
