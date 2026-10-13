// One labelled destination in the expanded sidebar: 42px, full-bleed, with the
// count, the attention dot and the status dot the nav data may carry.

import { Link } from '@tanstack/react-router';
import { cn } from '@bh/ui';
import { ActiveBar } from './active-bar';
import { EXACT_MATCH } from './exact-match';
import { NavStatusDot } from './nav-status-dot';
import { NAV_STYLES } from './nav-styles';
import type { NavItem } from './nav-types';

/** Props for NavRow component. */
export interface NavRowProps {
  /** The destination it links to. Its `children` are not drawn here: NavBranch draws them. */
  item: NavItem;
  /** Lit: the indigo fill and the bar on the left edge, and, unless `exact`, `aria-current`. */
  current: boolean;
  /** Called when the reader follows it. */
  onNavigate?: () => void;
  /**
   * Match its page exactly (EXACT_MATCH): for a destination with pages of its
   * own, which is lit while any of them is on screen but is only "the page"
   * when it is the page itself. The mark then follows the router's.
   */
  exact?: boolean;
  /** With `exact`: whether the row's own page is the one on screen. */
  atPage?: boolean;
  /** Room at the end for a control drawn over the row, e.g. its chevron. */
  endGap?: boolean;
}

/**
 * One destination in the expanded sidebar, as a 42px link: its icon, label,
 * count, attention dot and status dot.
 *
 * Rows run edge to edge — no side margin — so the active fill reaches the
 * sidebar's border and the indicator bar can sit on it. That is also why the
 * focus ring is inset: an outset ring on a full-bleed row would be clipped.
 */
export function NavRow({
  item,
  current,
  onNavigate,
  exact = false,
  atPage = false,
  endGap = false,
}: NavRowProps) {
  const IconComponent = item.icon;
  return (
    <Link
      to={item.path}
      onClick={onNavigate}
      activeOptions={exact ? EXACT_MATCH : undefined}
      aria-current={(exact ? atPage : current) ? 'page' : undefined}
      className={cn(
        'rounded-4 text-13 relative flex h-42 shrink-0 items-center gap-8 pl-14',
        endGap ? 'pr-40' : 'pr-12',
        NAV_STYLES.focusRing,
        current ? cn(NAV_STYLES.active, 'font-500') : cn(NAV_STYLES.resting, 'font-400'),
      )}
    >
      {current ? <ActiveBar /> : null}
      <IconComponent
        size={18}
        strokeWidth={1.75}
        className={cn('shrink-0', current ? 'text-indigo-9' : 'text-gray-10')}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {item.count === undefined ? null : (
        <span className="text-12 text-gray-10 font-400 shrink-0 font-mono tabular-nums">
          {item.count}
        </span>
      )}
      {item.dot ? <span aria-hidden className="bg-red-9 size-6 shrink-0 rounded-full" /> : null}
      {item.status ? <NavStatusDot status={item.status} /> : null}
    </Link>
  );
}
