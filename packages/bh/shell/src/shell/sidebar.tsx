// The left sidebar: one column that is either ~240px of labelled rows or a 48px
// icon rail. Both states share the same vertical rhythm — brand row, search,
// scrolling nav, footer — so collapsing moves nothing but the labels.

import type { ReactNode } from 'react';
import { cn, usePanelWidth } from '@bh/ui';
import { NavGroup, RailNav, type NavSection } from '../nav';
import { BrandRow } from './brand-row';
import { NavSearch } from './nav-search';
import type { ShellBrand } from './shell-brand';

/** Props for Sidebar component. */
export interface SidebarProps {
  /** The app's nav, in the order it is drawn. */
  sections: readonly NavSection[];
  /** The app's mark and name, in the top row. */
  brand: ShellBrand;
  /** The app's footer block, told whether it is drawn at rail width. */
  footer?: (collapsed: boolean) => ReactNode;
  /** Where the width and the open groups are remembered, e.g. `myapp-nav`. */
  storagePrefix: string;
  /** The path on screen, which lights the destination it is at or under. */
  currentPath: string;
  /** At rail width: icons only, 48px wide. */
  collapsed: boolean;
  /** The top row's control: collapses or expands the sidebar; in the drawer, closes it. */
  onToggleCollapsed: () => void;
  /** Expands the sidebar, for the rail's search icon and the search shortcut. */
  onExpand: () => void;
  /** Called when the reader follows any destination: AppShell's drawer closes on it. */
  onNavigate?: () => void;
  /** Opens the app's own search; see NavSearch. */
  onSearch?: () => void;
  /**
   * Inside the phone's drawer: it fills the drawer, has no drag handle, and
   * its top row's control closes the drawer.
   *
   * The width, the collapse control's meaning and the drag handle all follow
   * from this one fact, so the fact is the prop.
   */
  inDrawer?: boolean;
}

/**
 * The sidebar in whichever of its two states the caller asks for: about 240px
 * of labelled rows, which the reader can drag between 180 and 400, or a 48px
 * rail of icons.
 */
export function Sidebar({
  sections,
  brand,
  footer,
  storagePrefix,
  currentPath,
  collapsed,
  onToggleCollapsed,
  onExpand,
  onNavigate,
  onSearch,
  inDrawer = false,
}: SidebarProps) {
  const { width, panelRef, getSeparatorProps } = usePanelWidth({
    side: 'left',
    defaultWidth: 240,
    minWidth: 180,
    maxWidth: 400,
    storageKey: `${storagePrefix}:width`,
    label: 'Navigation',
  });
  const docked = !inDrawer && !collapsed;
  return (
    <aside
      ref={panelRef}
      aria-label="Navigation"
      style={docked ? { '--sidebar-w': `${width}px` } : undefined}
      className={cn(
        'border-gray-6 bg-gray-1 relative flex h-full min-h-0 shrink-0 flex-col border-r-1',
        // In the drawer the width belongs to the drawer, so the sidebar fills it
        // rather than imposing a width of its own.
        collapsed ? 'w-48' : docked ? 'w-(--sidebar-w)' : 'w-full',
      )}
    >
      {docked ? (
        <div
          {...getSeparatorProps()}
          className="hover:bg-indigo-9 absolute inset-y-0 right-0 z-10 w-6 cursor-col-resize"
        />
      ) : null}
      <BrandRow
        brand={brand}
        collapsed={collapsed}
        onToggle={onToggleCollapsed}
        inDrawer={inDrawer}
      />
      <NavSearch collapsed={collapsed} onRequestExpand={onExpand} onSearch={onSearch} />
      {collapsed ? (
        <RailNav sections={sections} currentPath={currentPath} onNavigate={onNavigate} />
      ) : (
        <nav aria-label="Sections" className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-12">
          {sections.map((section) => {
            return (
              <NavGroup
                key={section.id}
                section={section}
                currentPath={currentPath}
                storagePrefix={storagePrefix}
                onNavigate={onNavigate}
              />
            );
          })}
        </nav>
      )}
      {footer?.(collapsed)}
    </aside>
  );
}
