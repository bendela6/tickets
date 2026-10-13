// The frame every routed page mounts inside: the sidebar and the main area.
// Below the md breakpoint a top bar takes the sidebar's place and a drawer
// holds the same sidebar, expanded.

import { useEffect, useState, type ReactNode } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { Drawer, useIsNarrow, usePersistedFlag } from '@bh/ui';
import type { NavSection } from '../nav';
import type { ShellBrand } from './shell-brand';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';
import { useSearchShortcut } from './use-search-shortcut';

/** Props for AppShell component. */
export interface AppShellProps {
  /** The app's nav, in the order it is drawn. */
  sections: readonly NavSection[];
  /** The mark and the name at the top of the sidebar, and in the phone's top bar. */
  brand: ShellBrand;
  /** The app's footer block (an account menu, a deployment line), told whether it is at rail width. */
  footer?: (collapsed: boolean) => ReactNode;
  /** Drawn at the far end of the phone's top bar. */
  topBarEnd?: ReactNode;
  /**
   * Opens the app's own search (a dialog, a page). Given, the sidebar's field
   * becomes the button to it, the phone's bar gets a search button, and ⌘K /
   * Ctrl K calls it from anywhere. Left out, the field is a plain field.
   */
  onSearch?: () => void;
  /**
   * Where the collapsed flag, the width and the open groups are remembered,
   * e.g. `myapp-nav`. Two apps on one origin must not share it.
   */
  storagePrefix: string;
  /** The page on screen, drawn in the `<main>` beside the sidebar, which scrolls. */
  children: ReactNode;
}

/**
 * The frame every page of an app mounts inside: a docked sidebar on desktop,
 * and below the md breakpoint a top bar and a drawer holding the same sidebar.
 *
 * It reads the path on screen from TanStack Router, so it renders inside the
 * app's `RouterProvider`; its tooltips need a `TooltipProvider` above it.
 */
export function AppShell({
  sections,
  brand,
  footer,
  topBarEnd,
  onSearch,
  storagePrefix,
  children,
}: AppShellProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = usePersistedFlag(`${storagePrefix}:collapsed`, false);
  // Gated in JS, not by `md:hidden`: a class only reaches the drawer's own
  // panel, leaving the scrim painted, the focus trap armed and
  // `pointer-events: none` on <body> when a phone rotates to landscape with the
  // nav open — the desktop UI it uncovers would read as frozen.
  // `useIsNarrow('md')` is the exact complement of Tailwind's `md:`.
  const narrow = useIsNarrow('md');
  // Nothing else clears the flag on a viewport change, so a nav left open on a
  // phone would spring back open the next time the window narrowed.
  useEffect(() => {
    if (!narrow) {
      setNavOpen(false);
    }
  }, [narrow]);
  const closeNav = () => setNavOpen(false);
  // Bound here, not in the field: on a phone the field only exists while the
  // drawer is open, and the shortcut has to work either way.
  useSearchShortcut(onSearch);
  // From inside the drawer, the drawer shuts first so the search is not
  // opened underneath it.
  const searchFromDrawer = onSearch
    ? () => {
        closeNav();
        onSearch();
      }
    : undefined;
  const shared = { sections, brand, footer, storagePrefix, currentPath: pathname };
  // h-dvh, not h-screen: a phone's 100vh is its height with the address bar
  // hidden, so while the bar showed, the frame overflowed the screen and the
  // page scrolled twice, the document by the bar's height and <main> inside.
  return (
    <div className="bg-gray-1 text-gray-12 flex h-dvh flex-col font-sans md:flex-row">
      {narrow ? (
        <>
          <TopBar
            brand={brand}
            onOpenNav={() => setNavOpen(true)}
            onSearch={onSearch}
            end={topBarEnd}
          />
          <Drawer
            open={navOpen}
            onOpenChange={setNavOpen}
            side="left"
            size="sm"
            label="Navigation"
            className="bg-gray-1"
          >
            {/* In the drawer the sidebar is always expanded, and its brand-row
                control shuts the drawer instead — there is no rail to collapse
                to when the sidebar IS the overlay. */}
            <Sidebar
              {...shared}
              collapsed={false}
              onToggleCollapsed={closeNav}
              onExpand={closeNav}
              onNavigate={closeNav}
              onSearch={searchFromDrawer}
              inDrawer
            />
          </Drawer>
        </>
      ) : (
        <Sidebar
          {...shared}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed(!collapsed)}
          onExpand={() => setCollapsed(false)}
          onSearch={onSearch}
        />
      )}
      <main className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</main>
    </div>
  );
}
