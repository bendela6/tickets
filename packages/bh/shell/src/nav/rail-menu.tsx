// A destination with pages of its own, at rail width: its icon opens a menu of
// those pages, which is how every page stays reachable in 48px. The menu is
// Instrument's (a Radix dropdown), so the keyboard gets it for free — Enter or
// Space opens it, the arrows move, Enter picks — and picking navigates.

import { useNavigate } from '@tanstack/react-router';
import { cn, Menu, MenuContent, MenuItem, MenuTrigger, Tooltip } from '@bh/ui';
import { ActiveBar } from './active-bar';
import { currentLeaf } from './current-leaf';
import { isCurrentPath } from './is-current-path';
import { NavStatusDot } from './nav-status-dot';
import { NAV_STYLES } from './nav-styles';
import type { NavItem, NavLeaf } from './nav-types';

/** Props for RailMenu component. */
export interface RailMenuProps {
  /** The destination, with at least one page. */
  item: NavItem & { children: readonly NavLeaf[] };
  /** The path on screen. */
  currentPath: string;
  /** Called when the reader picks one of its pages. */
  onNavigate?: () => void;
}

/**
 * A destination with pages, at rail width: its icon opens a menu of its pages,
 * headed by its label, and picking one navigates there.
 */
export function RailMenu({ item, currentPath, onNavigate }: RailMenuProps) {
  const navigate = useNavigate();
  const lit = currentLeaf(item.children, currentPath);
  // Lit on its own page or on one of its pages, wherever that page is.
  const inside = isCurrentPath(item.path, currentPath) || lit !== undefined;
  const IconComponent = item.icon;
  return (
    <Menu>
      <Tooltip content={item.label} side="right">
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label={item.label}
            className={cn(
              'rounded-4 relative flex h-42 w-full shrink-0 items-center justify-center',
              NAV_STYLES.focusRing,
              inside ? 'bg-indigo-3 text-indigo-9' : NAV_STYLES.control,
            )}
          >
            {inside ? <ActiveBar /> : null}
            <IconComponent size={18} strokeWidth={1.75} />
            {item.status ? (
              <NavStatusDot
                status={item.status}
                className="absolute top-[calc(50%-12px)] right-8 rounded-full shadow-[0_0_0_2px_var(--color-gray-1)]"
              />
            ) : null}
          </button>
        </MenuTrigger>
      </Tooltip>
      <MenuContent side="right" align="start">
        <div className="text-12 font-500 text-gray-10 px-8 pt-4 pb-6 tracking-[0.04em] uppercase">
          {item.label}
        </div>
        {item.children.map((leaf) => {
          const current = leaf.path === lit;
          return (
            <MenuItem
              key={leaf.path}
              aria-current={current ? 'page' : undefined}
              className={current ? 'text-indigo-11 font-500' : undefined}
              onSelect={() => {
                void navigate({ to: leaf.path });
                onNavigate?.();
              }}
            >
              {leaf.label}
            </MenuItem>
          );
        })}
      </MenuContent>
    </Menu>
  );
}
