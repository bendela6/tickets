// A destination with pages of its own: its row, a chevron drawn over the end of
// it, and — when open — its pages under it. It opens by itself while one of
// its pages is on screen and shuts again when you leave; the chevron opens or
// shuts it by hand without navigating, and that choice stands until you move
// in or out of it.

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@bh/ui';
import { currentLeaf } from './current-leaf';
import { isCurrentPath } from './is-current-path';
import { NavLeafRow } from './nav-leaf-row';
import { NavRow } from './nav-row';
import { NAV_STYLES } from './nav-styles';
import type { NavItem, NavLeaf } from './nav-types';

/** Props for NavBranch component. */
export interface NavBranchProps {
  /** The destination, with at least one page. */
  item: NavItem & { children: readonly NavLeaf[] };
  /** The path on screen. */
  currentPath: string;
  /** Called when the reader follows the destination or one of its pages. */
  onNavigate?: () => void;
}

/**
 * A destination with pages of its own: its row, a chevron at its end, and its
 * pages under it while it is open.
 *
 * It opens by itself while one of its pages is on screen and shuts when the
 * reader leaves. The chevron opens or shuts it without navigating, and that
 * choice stands until the reader moves in or out of it. Its pages need not
 * sit under its own path.
 */
export function NavBranch({ item, currentPath, onNavigate }: NavBranchProps) {
  const lit = currentLeaf(item.children, currentPath);
  // Inside it on its own page or on one of its pages, wherever that page is.
  const inside = isCurrentPath(item.path, currentPath) || lit !== undefined;
  // null: follow the route. A boolean: the chevron's choice, kept while the
  // route stays on the same side of this destination.
  const [chosen, setChosen] = useState<{ open: boolean; inside: boolean } | null>(null);
  const open = chosen?.inside === inside ? chosen.open : inside;
  const ChevronComponent = open ? ChevronDown : ChevronRight;
  return (
    <div>
      <div className="relative">
        <NavRow
          item={item}
          current={inside}
          exact
          atPage={item.path === currentPath}
          onNavigate={onNavigate}
          endGap
        />
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${item.label} pages`}
          onClick={() => setChosen({ open: !open, inside })}
          className={cn(
            'rounded-4 absolute top-7 right-6 flex size-28 items-center justify-center',
            NAV_STYLES.focusRing,
            NAV_STYLES.control,
          )}
        >
          <ChevronComponent size={14} strokeWidth={1.75} />
        </button>
      </div>
      {open
        ? item.children.map((leaf) => {
            return (
              <NavLeafRow
                key={leaf.path}
                leaf={leaf}
                current={leaf.path === lit}
                atPage={leaf.path === currentPath}
                onNavigate={onNavigate}
              />
            );
          })
        : null}
    </div>
  );
}
