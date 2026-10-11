import type { Renderer } from '@bh/table';
import { cn } from '../../../style';
import { ClippedText } from '../parts/clipped-text';

interface TextColumnOpts {
  /** Sets the value in the mono face, at 12 pixels: ids, codes, paths. */
  mono?: boolean;
  /**
   * Keep the value on one line, fading it out where it runs past the column
   * and offering the whole of it on hover. Default true.
   *
   * `false` lets the text wrap, which only makes sense alongside a row height
   * that leaves somewhere for it to wrap TO.
   */
  truncate?: boolean;
  /** Follows the column's own alignment, so a right-aligned value fades at the
   *  end it actually runs off. */
  align?: 'left' | 'right' | 'center';
}

/**
 * A cell of text, on one line, faded where it runs past the column, with the
 * whole of it on hover. An empty value draws nothing.
 */
export function TextColumn(opts: TextColumnOpts = {}): Renderer<string | null | undefined> {
  const { mono, truncate = true, align } = opts;
  return ({ value }) => {
    if (value == null) {
      return null;
    }
    const type = mono ? 'text-12/17 font-mono' : undefined;
    // The fade and the tooltip come as a pair — see ClippedText. A column that
    // has opted out of truncating has nothing to fade and nothing to reveal.
    if (!truncate) {
      return <span className={cn('block', type)}>{value}</span>;
    }
    return (
      <ClippedText align={align} className={type}>
        {value}
      </ClippedText>
    );
  };
}
