// The collapsed sidebar's icon list. Every destination shows here, including
// those in a group the expanded sidebar has collapsed: the rail has no headers,
// so a hidden group would simply be unreachable. A destination with pages of
// its own opens a menu of them instead of navigating (rail-menu.tsx), for the
// same reason.

import { Link } from '@tanstack/react-router';
import { cn, Tooltip } from '@bh/ui';
import { ActiveBar } from './active-bar';
import { isCurrentPath } from './is-current-path';
import { NavStatusDot } from './nav-status-dot';
import { NAV_STYLES } from './nav-styles';
import type { NavSection } from './nav-types';
import { RailMenu } from './rail-menu';

/** Props for RailNav component. */
export interface RailNavProps {
  /** The app's nav: every destination of every section, shut groups included. */
  sections: readonly NavSection[];
  /** The path on screen. */
  currentPath: string;
  /** Called when the reader follows any destination. */
  onNavigate?: () => void;
}

// Where a dot sits on a 42px rail icon: over its top-right corner, ringed in
// the sidebar's own colour so it reads against the icon under it.
const CORNER =
  'absolute top-[calc(50%-12px)] right-8 rounded-full shadow-[0_0_0_2px_var(--color-gray-1)]';

/** Icons at rail width, with each section separated by a short rule. */
export function RailNav({ sections, currentPath, onNavigate }: RailNavProps) {
  return (
    <nav
      aria-label="Sections"
      className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto"
    >
      {sections.map((section, sectionIndex) => {
        return (
          <div key={section.id} className="flex w-full flex-col items-center">
            {sectionIndex === 0 ? null : (
              <div aria-hidden className="bg-gray-6 my-7 h-px w-24 shrink-0" />
            )}
            {section.items.map((item) => {
              const { children } = item;
              if (children && children.length > 0) {
                return (
                  <RailMenu
                    key={item.path}
                    item={{ ...item, children }}
                    currentPath={currentPath}
                    onNavigate={onNavigate}
                  />
                );
              }
              const current = isCurrentPath(item.path, currentPath);
              const IconComponent = item.icon;
              return (
                <Tooltip key={item.path} content={item.label} side="right">
                  <Link
                    to={item.path}
                    onClick={onNavigate}
                    aria-label={item.label}
                    aria-current={current ? 'page' : undefined}
                    className={cn(
                      'rounded-4 relative flex h-42 w-full shrink-0 items-center justify-center',
                      NAV_STYLES.focusRing,
                      current ? 'bg-indigo-3 text-indigo-9' : NAV_STYLES.control,
                    )}
                  >
                    {current ? <ActiveBar /> : null}
                    <IconComponent size={18} strokeWidth={1.75} />
                    {item.dot ? (
                      <span aria-hidden className={cn('bg-red-9 size-6', CORNER)} />
                    ) : null}
                    {item.status ? <NavStatusDot status={item.status} className={CORNER} /> : null}
                  </Link>
                </Tooltip>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
