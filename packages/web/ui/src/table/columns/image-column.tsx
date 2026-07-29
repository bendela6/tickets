import type { Renderer } from '@tickets/table';
import { Avatar } from '../../components/avatar';

type ImageColumnOpts = {
  /** Derives the name an Avatar falls back to when there is no image. */
  fallback?: (row: unknown) => string | undefined;
};

/** Falls back to Avatar rather than hand-rolling an initial disc, so a row
 *  thumbnail and the same person's avatar elsewhere look identical. */
export function ImageColumn(opts: ImageColumnOpts = {}): Renderer<string | null | undefined> {
  return ({ value, row }) => {
    if (value) {
      // `alt` is left undefined rather than `""` when there is no fallback
      // mapper: an empty `alt` maps to the `presentation` role (a deliberate
      // "this image is decorative"), which is wrong for row content and also
      // makes the element unreachable via `getByRole('img')`. Omitting the
      // attribute keeps the implicit `img` role; a fallback mapper supplies a
      // real accessible name when the caller has one to give.
      return (
        <img
          src={value}
          alt={opts.fallback?.(row)}
          loading="lazy"
          className="size-6 rounded-sm object-cover"
        />
      );
    }
    return <Avatar name={opts.fallback?.(row) ?? '?'} size="sm" />;
  };
}
