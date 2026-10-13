// One page under a destination in the expanded sidebar: indented under its
// parent's label, shorter than a destination row, and without an icon, so the
// eye reads it as part of the row above.

import { Link } from '@tanstack/react-router';
import { cn } from '@bh/ui';
import { EXACT_MATCH } from './exact-match';
import { NAV_STYLES } from './nav-styles';
import type { NavLeaf } from './nav-types';

/** Props for NavLeafRow component. */
export interface NavLeafRowProps {
  /** The page it links to. */
  leaf: NavLeaf;
  /** Lit: the page on screen, or the page it sits under (currentLeaf). */
  current: boolean;
  /** Its own page is the one on screen — what the router marks (EXACT_MATCH). */
  atPage: boolean;
  /** Called when the reader follows it. */
  onNavigate?: () => void;
}

/** One page under a destination: indented under its label, 32px tall, with no icon. */
export function NavLeafRow({ leaf, current, atPage, onNavigate }: NavLeafRowProps) {
  return (
    <Link
      to={leaf.path}
      onClick={onNavigate}
      activeOptions={EXACT_MATCH}
      aria-current={atPage ? 'page' : undefined}
      className={cn(
        // pl-40 lines the label up with the parent's label: 14px gutter, 18px
        // icon and the 8px gap between them.
        'rounded-4 text-13 relative flex h-32 shrink-0 items-center gap-8 pr-12 pl-40',
        NAV_STYLES.focusRing,
        current ? 'text-indigo-11 font-500' : cn(NAV_STYLES.resting, 'font-400'),
      )}
    >
      <span className="flex-1 truncate">{leaf.label}</span>
      {leaf.count === undefined ? null : (
        <span className="text-12 text-gray-10 font-400 shrink-0 font-mono tabular-nums">
          {leaf.count}
        </span>
      )}
    </Link>
  );
}
