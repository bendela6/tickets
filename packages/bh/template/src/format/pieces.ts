// A formatted value as pieces, in the spirit of `Intl`'s `formatToParts`: the
// text of a value in its format, split where a reader can tell its parts
// apart, so a card draws a unit smaller than its number and a table cell
// joins them.

/**
 * One piece of a value's text. A size is `12.4`, a space and `MiB`; a duration
 * `2`, `h`, a space, `5` and `m`; a percent `43` and `%`. A piece with nothing
 * to tell it from the rest is just `text`.
 */
export interface FormatPiece {
  /** What it writes, as it is joined into the value's text. */
  text: string;
  /**
   * It is a unit, which a reader takes in beside the number it follows and a
   * card may draw smaller: `MiB`, `h`, `%`, `K`, a currency's symbol.
   */
  unit?: true;
}

/**
 * The pieces joined into the value's text, as a cell, a tooltip, a filter
 * chip, an export and an answer from MCP write it: `12.4 MiB`, `2h 5m`.
 */
export function formatText(pieces: readonly FormatPiece[]): string {
  return pieces
    .map((piece) => {
      return piece.text;
    })
    .join('');
}

/** A number and the unit it is counted in, as a size or a length is written. */
export interface Measure {
  /** The number, with its sign: `1.5`, `64`, `-2`. */
  amount: string;
  /** The unit: `KiB`, `h`, `ms`. */
  unit: string;
}

/**
 * Measures as pieces, each a number and its unit, a space between: `2h 5m`
 * is `2`, `h`, a space, `5`, `m`. The `suffix` goes on the last unit (the
 * `/s` of a rate); a measure's number and its unit are apart by `gap`.
 */
export function measuresAsPieces(
  measures: readonly Measure[],
  { gap = '', suffix = '' }: { gap?: string; suffix?: string } = {},
): FormatPiece[] {
  return measures.flatMap((measure, index) => {
    const unit = `${measure.unit}${index === measures.length - 1 ? suffix : ''}`;
    return [
      ...(index === 0 ? [] : [{ text: ' ' }]),
      { text: measure.amount },
      ...(gap === '' ? [] : [{ text: gap }]),
      { text: unit, unit: true as const },
    ];
  });
}
