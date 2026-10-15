// The links at a page's foot to the pages either side of it in reading order.
// Which pages those are is the app's: it keeps the order, and hands in the two.

import { Link } from '@tanstack/react-router';
import { cn, focusRing } from '@bh/ui';

/** A page the pager links to. */
export interface PagerPage {
  /** Its name, under the way it lies. */
  label: string;
  /** Where it links. */
  path: string;
}

/** Props for Pager component. */
export interface PagerProps {
  /** The page before this one. Left out on the first page. */
  previous?: PagerPage;
  /** The page after this one. Left out on the last page. */
  next?: PagerPage;
  /** Called with the page as the reader follows its link, which goes there all the same. */
  onNavigate?: (page: PagerPage) => void;
  /** The links' name, as a group, for a screen reader. */
  label?: string;
  /** Classes on the `<nav>`, for its place at the page's foot. */
  className?: string;
}

type Direction = 'Previous' | 'Next';

/**
 * The links to the pages before and after this one, under a rule at the foot
 * of a page: the previous on the left, the next on the right, each with the
 * way it lies over its name.
 *
 * Draws nothing with neither, so a page that stands alone needs no condition.
 */
export function Pager({
  previous,
  next,
  onNavigate,
  label = 'Previous and next',
  className,
}: PagerProps) {
  if (!previous && !next) {
    return null;
  }
  return (
    <nav
      aria-label={label}
      className={cn('border-gray-6 grid grid-cols-2 gap-12 border-t-1 pt-24', className)}
    >
      {previous ? <PagerLink page={previous} direction="Previous" onNavigate={onNavigate} /> : null}
      {next ? <PagerLink page={next} direction="Next" onNavigate={onNavigate} /> : null}
    </nav>
  );
}

interface PagerLinkProps {
  page: PagerPage;
  direction: Direction;
  onNavigate: ((page: PagerPage) => void) | undefined;
}

function PagerLink({ page, direction, onNavigate }: PagerLinkProps) {
  return (
    <Link
      to={page.path}
      rel={direction === 'Previous' ? 'prev' : 'next'}
      onClick={onNavigate ? () => onNavigate(page) : undefined}
      // Its words apart, "Next, Theme": stacked, they would be read as one.
      aria-label={`${direction}, ${page.label}`}
      className={cn(
        'border-gray-6 hover:bg-surface-inset rounded-8 flex min-w-0 flex-col gap-2 border-1 px-16 py-12 transition-colors',
        // A card's ring: its border lit, and the halo around it.
        focusRing('indigo'),
        // The next page keeps to the right, with or without a previous one.
        direction === 'Next' && 'col-start-2 text-right',
      )}
    >
      <span className="text-11 text-gray-9 font-mono tracking-wider uppercase">{direction}</span>
      <span className="text-14 font-500 text-gray-12">{page.label}</span>
    </Link>
  );
}
