// One section of the expanded sidebar: a header that toggles the group, an
// action beside it when the section has one, and the group's rows. Open state
// is per-section and remembered under the app's prefix.

import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button, cn, Tooltip, usePersistedFlag } from '@bh/ui';
import { isCurrentPath } from './is-current-path';
import { NAV_STYLES } from './nav-styles';
import type { NavSection, NavSectionAction } from './nav-types';
import { NavBranch } from './nav-branch';
import { NavRow } from './nav-row';

/** Props for NavGroup component. */
export interface NavGroupProps {
  /** The section it draws: its header, from `label`, and its rows. */
  section: NavSection;
  /** The path on screen. */
  currentPath: string;
  /**
   * Where the app keeps its nav state, e.g. `myapp-nav`: the open flag is
   * `<prefix>:group:<section id>`. Two apps on one origin must not share it.
   */
  storagePrefix: string;
  /** Called when the reader follows any of its destinations. */
  onNavigate?: () => void;
}

/** A section's own button, at the right of its header: an icon, named and tipped by its label. */
function SectionAction({ action }: { action: NavSectionAction }) {
  const IconComponent = action.icon;
  return (
    <Tooltip content={action.label}>
      <Button
        variant="ghost"
        size="sm"
        aria-label={action.label}
        onClick={action.onSelect}
        className="mr-6 w-28 shrink-0 p-0"
      >
        <IconComponent size={14} strokeWidth={1.75} />
      </Button>
    </Tooltip>
  );
}

/**
 * One section of the expanded sidebar: a header that opens and shuts it, and
 * its rows. Shut, the header shows how many rows it hides. A section with no
 * label draws its rows alone, with no header.
 *
 * The header is the toggle — a chevron-sized hit area is not worth the
 * precision — except for the section's `action`, a button of its own at the
 * right, which runs without opening or shutting the section.
 */
export function NavGroup({ section, currentPath, storagePrefix, onNavigate }: NavGroupProps) {
  const [open, setOpen] = usePersistedFlag(`${storagePrefix}:group:${section.id}`, true);
  const ChevronComponent = open ? ChevronDown : ChevronRight;
  const rows = section.items.map((item) => {
    const { children } = item;
    if (children && children.length > 0) {
      return (
        <NavBranch
          key={item.path}
          item={{ ...item, children }}
          currentPath={currentPath}
          onNavigate={onNavigate}
        />
      );
    }
    return (
      <NavRow
        key={item.path}
        item={item}
        current={isCurrentPath(item.path, currentPath)}
        onNavigate={onNavigate}
      />
    );
  });

  // A section with no label is the leading one: its rows sit above the first
  // header, so there is nothing to toggle and no chevron to draw.
  if (section.label === undefined) {
    return <div>{rows}</div>;
  }

  const { action } = section;
  return (
    <div>
      <div className="mt-6 flex h-28 items-center">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className={cn(
            NAV_STYLES.focusRing,
            'text-12 font-500 text-gray-10 hover:text-gray-12 flex h-28 min-w-0 flex-1 items-center pl-14 tracking-[0.04em] uppercase',
            action ? 'pr-6' : 'pr-12',
          )}
        >
          <span className="flex-1 truncate text-left">{section.label}</span>
          {open ? null : (
            <span className="text-12 text-gray-10 mr-6 shrink-0 font-mono tracking-normal tabular-nums">
              {section.items.length}
            </span>
          )}
          <ChevronComponent size={14} strokeWidth={1.75} className="text-gray-8 shrink-0" />
        </button>
        {action ? <SectionAction action={action} /> : null}
      </div>
      {open ? rows : null}
    </div>
  );
}
