// Global search. By default it is a field: the ⌘K / Ctrl K shortcut focuses
// it, and the results dropdown is deliberately not built — an app without a
// search behind it would get a dropdown that invents matches, which is worse
// than none. An app with a search of its own passes `onSearch`: the field
// becomes the button that opens it, and the shortcut is the shell's.

import { useRef } from 'react';
import { Search } from 'lucide-react';
import { cn, Tooltip } from '@bh/ui';
import { NAV_STYLES } from '../nav';
import { shortcutLabel } from './shortcut-label';
import { useSearchShortcut } from './use-search-shortcut';

/** Props for NavSearch component. */
export interface NavSearchProps {
  /** At rail width: a search icon in place of the field. */
  collapsed: boolean;
  /**
   * Expands the sidebar. Without `onSearch`, the rail's search icon and the
   * shortcut call it, and the field takes the focus once it is drawn.
   */
  onRequestExpand: () => void;
  /** Opens the app's own search. The shortcut is then AppShell's, not this field's. */
  onSearch?: () => void;
}

const KBD =
  'rounded-4 border-gray-6 bg-surface-raised text-12 text-gray-10 shrink-0 border-1 px-5 font-mono leading-16';

/** The search field (or the button to the app's search), or the rail's search button when the sidebar is shut. */
export function NavSearch({ collapsed, onRequestExpand, onSearch }: NavSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // The shortcut is global, so it has to reach the field even when the rail is
  // showing — hence the expand request rather than an early return. Expanding
  // mounts the input in the same commit, so the focus waits a frame.
  useSearchShortcut(
    onSearch
      ? undefined
      : () => {
          onRequestExpand();
          requestAnimationFrame(() => {
            inputRef.current?.focus();
          });
        },
  );

  if (collapsed) {
    return (
      <div className="mb-8 flex shrink-0 justify-center">
        <Tooltip content="Search" side="right">
          <button
            type="button"
            aria-label="Search"
            aria-haspopup={onSearch ? 'dialog' : undefined}
            onClick={onSearch ?? onRequestExpand}
            className={cn(
              'rounded-4 flex size-32 items-center justify-center',
              NAV_STYLES.focusRing,
              NAV_STYLES.control,
            )}
          >
            <Search size={16} strokeWidth={1.75} />
          </button>
        </Tooltip>
      </div>
    );
  }

  if (onSearch) {
    return (
      <div className="shrink-0 px-8 pb-6">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={onSearch}
          className="rounded-4 border-gray-6 bg-surface-field hover:border-gray-7 flex h-30 w-full items-center gap-8 border-1 px-8 text-left outline-none focus-visible:shadow-[0_0_0_2px_var(--color-indigo-9)]"
        >
          <Search size={16} strokeWidth={1.75} className="text-gray-10 shrink-0" />
          <span className="text-13 text-gray-10 min-w-0 flex-1 truncate">Search…</span>
          <kbd className={KBD}>{shortcutLabel()}</kbd>
        </button>
      </div>
    );
  }

  return (
    <div className="shrink-0 px-8 pb-6">
      <div className="rounded-4 border-gray-6 bg-surface-field flex h-30 items-center gap-8 border-1 px-8 focus-within:shadow-[0_0_0_2px_var(--color-indigo-9)]">
        <Search size={16} strokeWidth={1.75} className="text-gray-10 shrink-0" />
        <input
          ref={inputRef}
          type="search"
          aria-label="Search"
          placeholder="Search…"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.currentTarget.value = '';
              event.currentTarget.blur();
            }
          }}
          className="text-13 text-gray-12 caret-indigo-9 placeholder:text-gray-10 min-w-0 flex-1 bg-transparent outline-none"
        />
        <kbd className={KBD}>{shortcutLabel()}</kbd>
      </div>
    </div>
  );
}
