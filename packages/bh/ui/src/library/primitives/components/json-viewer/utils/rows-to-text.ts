import type { JsonRow } from '../types';
import { rowTokens } from './row-tokens';

/**
 * The document as text, exactly as the fully unfolded viewer draws it - a fold is a way of looking
 * at the document, not an edit to it, so what gets copied never depends on what is open. For
 * anything `JSON.stringify` can serialise this is character-for-character its two-space output.
 */
export function rowsToText(rows: JsonRow[]): string {
  return rows
    .map((row) => {
      const text = rowTokens(row, false)
        .map((token) => token.text)
        .join('');
      return `${'  '.repeat(row.depth)}${text}`;
    })
    .join('\n');
}
