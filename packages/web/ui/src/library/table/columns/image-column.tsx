import type { Renderer } from '@tickets/table';
import { Avatar } from '../../primitives/components/avatar';

type ImageColumnOpts = {
  /** Derives the name an Avatar falls back to when there is no image. */
  fallback?: (row: unknown) => string | undefined;
};

/** Falls back to Avatar rather than hand-rolling an initial disc, so a row
 *  thumbnail and the same person's avatar elsewhere look identical. */
export function ImageColumn(opts: ImageColumnOpts = {}): Renderer<string | null | undefined> {
  return ({ value, row }) => {
    if (value) {
      // `alt` must ALWAYS be present. A missing `alt` leaves role `img` with no
      // accessible name — a WCAG 1.1.1 / axe `image-alt` failure, and exactly
      // the shape this repo's own a11y-integration test uses as its canonical
      // violation fixture. `alt=""` is the valid degrade path (a declared
      // decorative image), so fall back to it when no name mapper is supplied.
      // Note this drops the element's role to `presentation`, so a test wanting
      // getByRole('img') must pass a `fallback`.
      return (
        <img
          src={value}
          alt={opts.fallback?.(row) ?? ''}
          loading="lazy"
          className="size-24 rounded-4 object-cover"
        />
      );
    }
    return <Avatar name={opts.fallback?.(row) ?? '?'} size="sm" />;
  };
}
