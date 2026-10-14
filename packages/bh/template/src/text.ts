import type { FieldPath, Template } from '@bh/resource';

// A text template, @bh/resource's Template: text with field paths in braces,
// '{project}-{number} {title}'. A part shows one (TextPart), and so will a
// link's target (TK-79.5).

/** A text template's pieces, in order: its text, and the paths its braces name. */
type Piece = string | { path: FieldPath };

/**
 * A text template's pieces. '{{' and '}}' are a brace. Throws, saying where,
 * on a brace that opens and never closes, one that closes with none open, and
 * braces naming no path.
 */
function piecesOf(text: Template): Piece[] {
  const pieces: Piece[] = [];
  let literal = '';
  let at = 0;
  while (at < text.length) {
    const char = text.charAt(at);
    const next = text.charAt(at + 1);
    if ((char === '{' || char === '}') && next === char) {
      literal += char;
      at += 2;
      continue;
    }
    if (char === '}') {
      throw new Error(
        `The text template ${JSON.stringify(text)} closes a brace at ${at} that none opened; '}}' is a brace.`,
      );
    }
    if (char !== '{') {
      literal += char;
      at += 1;
      continue;
    }
    const close = text.indexOf('}', at + 1);
    const open = text.indexOf('{', at + 1);
    if (close === -1 || (open !== -1 && open < close)) {
      throw new Error(
        `The text template ${JSON.stringify(text)} opens a brace at ${at} that never closes; '{{' is a brace.`,
      );
    }
    if (close === at + 1) {
      throw new Error(
        `The text template ${JSON.stringify(text)} names no field in its braces at ${at}.`,
      );
    }
    if (literal !== '') {
      pieces.push(literal);
      literal = '';
    }
    pieces.push({ path: text.slice(at + 1, close) });
    at = close + 1;
  }
  if (literal !== '') {
    pieces.push(literal);
  }
  return pieces;
}

/**
 * The field paths a text template names, each once, in the order they first
 * come: '{project}-{number} {title}' → ['project', 'number', 'title']. What a
 * template shows needs them on the record, and a check of it, in the
 * resource's fields. Throws on a malformed one, as fillText does.
 */
export function textPaths(text: Template): FieldPath[] {
  const paths = piecesOf(text).flatMap((piece) => {
    return typeof piece === 'string' ? [] : [piece.path];
  });
  return [...new Set(paths)];
}

/**
 * A text template filled, by @bh/resource's Template's rules: each
 * placeholder shows what `show` gives for its path, then the result is
 * trimmed and its runs of spaces fold into one, so a placeholder left empty
 * leaves no gap. '{{' and '}}' are a brace.
 *
 * `show` gives a path's value as text: an option its label, a ref the title
 * of the row it points at, a formatted field in its format, a many field its
 * values joined by ', ', an empty value ''. Throws, saying where, on a brace
 * that opens and never closes, one that closes with none open, and braces
 * naming no path.
 */
export function fillText(text: Template, show: (path: FieldPath) => string): string {
  return piecesOf(text)
    .map((piece) => {
      return typeof piece === 'string' ? piece : show(piece.path);
    })
    .join('')
    .replace(/ {2,}/g, ' ')
    .trim();
}
