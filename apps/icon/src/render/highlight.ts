/**
 * The rendered markup, split into the three things there are to tell apart:
 * element names, attribute names and attribute values.
 *
 * A tokeniser rather than a highlighting library, because the grammar it has to
 * cover is the one `svg.ts` writes and nothing else — no text nodes, no
 * comments, no entities beyond the five `escapeAttribute` produces, and every
 * value in double quotes. That is a dozen lines here against a dependency in an
 * app whose only one is a geometry engine.
 *
 * The split is lossless by construction: everything between two matches comes
 * back as `plain`, so joining the pieces gives the input character for
 * character. The viewer promises to show exactly what the export writes, and a
 * tokeniser that dropped a space would quietly break that promise.
 */

export type TokenKind = 'tag' | 'name' | 'value' | 'plain';

export interface SourceToken {
  kind: TokenKind;
  text: string;
}

/**
 * `<tag` or `</tag`, then an attribute name up to its `=`, then a quoted value,
 * then the brackets that close a tag. Order matters only where two could start
 * at the same character, and none can: a value begins at its opening quote, so
 * the whole run to the closing quote is taken before anything inside it can
 * look like a name.
 */
const TOKEN = /<\/?[A-Za-z][\w:.-]*|[A-Za-z][\w:.-]*(?==)|"[^"]*"|\/?>/g;

function kindOf(text: string): TokenKind {
  if (text.startsWith('<') || text.endsWith('>')) return 'tag';
  if (text.startsWith('"')) return 'value';
  return 'name';
}

export function tokenizeSvg(markup: string): SourceToken[] {
  const tokens: SourceToken[] = [];
  let at = 0;

  TOKEN.lastIndex = 0;
  for (let match = TOKEN.exec(markup); match !== null; match = TOKEN.exec(markup)) {
    if (match.index > at) tokens.push({ kind: 'plain', text: markup.slice(at, match.index) });
    tokens.push({ kind: kindOf(match[0]), text: match[0] });
    at = match.index + match[0].length;
  }
  if (at < markup.length) tokens.push({ kind: 'plain', text: markup.slice(at) });

  return tokens;
}
