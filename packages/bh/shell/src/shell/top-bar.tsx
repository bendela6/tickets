// The phone's header: the button that opens the drawer, the mark and the
// wordmark, and whatever the app wants at the far end (a status dot the rail
// would otherwise show, since the rail is inside the drawer here).

import type { ReactNode } from 'react';
import { Menu as MenuIcon, Search } from 'lucide-react';
import { Button } from '@bh/ui';
import type { ShellBrand } from './shell-brand';

/** Props for TopBar component. */
export interface TopBarProps {
  /** The app's mark and name, after the menu button. */
  brand: ShellBrand;
  /** The menu button's action: opens the drawer that holds the sidebar. */
  onOpenNav: () => void;
  /** Given, a search button sits before `end`: on a phone there is no sidebar field. */
  onSearch?: () => void;
  /** At the far end of the bar: what the rail would otherwise show, like a status. */
  end?: ReactNode;
}

/** The phone's 48px bar in the sidebar's place: the menu button, the brand, and the app's end. */
export function TopBar({ brand, onOpenNav, onSearch, end }: TopBarProps) {
  return (
    <div className="border-gray-6 bg-gray-1 flex h-48 shrink-0 items-center gap-6 border-b-1 px-8">
      <Button
        variant="ghost"
        tone="neutral"
        icon={<MenuIcon size={18} strokeWidth={1.75} />}
        label="Open navigation"
        onClick={onOpenNav}
      />
      {brand.mark}
      <span className="text-15 font-600 text-gray-12 flex-1 truncate font-mono">{brand.name}</span>
      {onSearch ? (
        <Button
          variant="ghost"
          tone="neutral"
          icon={<Search size={18} strokeWidth={1.75} />}
          label="Search"
          aria-haspopup="dialog"
          onClick={onSearch}
        />
      ) : null}
      {end}
    </div>
  );
}
