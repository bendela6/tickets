// The sidebar's 44px top row: the mark, the wordmark, and the control that
// shuts the sidebar.

import { PanelLeft, X } from 'lucide-react';
import { cn, Tooltip } from '@bh/ui';
import { NAV_STYLES } from '../nav';
import type { ShellBrand } from './shell-brand';

/** Props for BrandRow component. */
export interface BrandRowProps {
  /** The app's mark and name. */
  brand: ShellBrand;
  /** At rail width: the mark alone, and it is the button that expands the sidebar. */
  collapsed: boolean;
  /** Collapses the docked sidebar; inside the drawer it shuts the drawer. */
  onToggle: () => void;
  /**
   * Inside the phone's drawer: the control is named Close navigation, and
   * `onToggle` closes the drawer.
   *
   * Inside the phone's drawer the sidebar IS the overlay: there is no rail to
   * collapse to, so the control closes the drawer and says so, rather than
   * naming something that cannot happen there.
   */
  inDrawer?: boolean;
}

/**
 * The sidebar's top row: the mark, the name, and the control that collapses
 * the sidebar (or, in the phone's drawer, closes it).
 *
 * Expanded, the mark sits beside the wordmark with the control trailing.
 * Collapsed, the mark IS the control: the rail has no room for a separate
 * button, and a sidebar you can shut but not reopen is a trap.
 */
export function BrandRow({ brand, collapsed, onToggle, inDrawer = false }: BrandRowProps) {
  if (collapsed) {
    return (
      <div className="flex h-44 shrink-0 items-center justify-center">
        <Tooltip content="Expand sidebar" side="right">
          <button
            type="button"
            aria-label="Expand sidebar"
            aria-expanded={false}
            onClick={onToggle}
            className={cn(
              'rounded-6 flex size-32 items-center justify-center',
              NAV_STYLES.focusRing,
            )}
          >
            {brand.mark}
          </button>
        </Tooltip>
      </div>
    );
  }
  const label = inDrawer ? 'Close navigation' : 'Collapse sidebar';
  const IconComponent = inDrawer ? X : PanelLeft;
  return (
    <div className="flex h-44 shrink-0 items-center gap-8 pr-8 pl-14">
      {brand.mark}
      <span className="text-13 font-500 text-gray-12 flex-1 truncate font-mono">{brand.name}</span>
      <button
        type="button"
        aria-label={label}
        aria-expanded={inDrawer ? undefined : true}
        onClick={onToggle}
        className={cn(
          'rounded-4 flex size-28 shrink-0 items-center justify-center',
          NAV_STYLES.focusRing,
          NAV_STYLES.control,
        )}
      >
        <IconComponent size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}
