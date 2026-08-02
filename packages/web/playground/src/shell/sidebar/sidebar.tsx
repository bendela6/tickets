import { useState } from 'react';
import { cn, SidePanel, type CollectedDemo } from '@tickets/ui';
import type { GalleryNavigation } from '../navigation';

type LiveDemo = Extract<CollectedDemo, { slug: string }>;

const SIDEBAR_MIN = 180;
export const SIDEBAR_MAX = 400;
const SIDEBAR_DEFAULT = 224;

export function Sidebar({
  demos,
  selected,
  linkProps,
  onOpenPalette,
}: {
  demos: LiveDemo[];
  selected: string | null;
  linkProps: GalleryNavigation['linkProps'];
  onOpenPalette: () => void;
}) {
  const [filterQuery, setFilterQuery] = useState('');

  const groups = [...new Set(demos.map((d) => d.meta.group))];
  const filtered = demos.filter((d) =>
    d.meta.title.toLowerCase().includes(filterQuery.toLowerCase()),
  );
  const shownGroups = groups.filter((g) => filtered.some((d) => d.meta.group === g));

  return (
    <SidePanel
      label="Components"
      storageKey="gallery-sidebar"
      defaultWidth={SIDEBAR_DEFAULT}
      minWidth={SIDEBAR_MIN}
      maxWidth={SIDEBAR_MAX}
      collapsible
      collapsedTo="edge"
      overlayBelow="lg"
      // The gallery scrolls the document, not a pane: GalleryShell's root is
      // `flex min-h-screen`, so a `relative` aside (SidePanel's base) stretches
      // to the full row height, its inner `overflow-y-auto` never engages, and
      // the nav scrolls away with the page. Pinning it to a viewport-tall
      // sticky box is what makes the component list scroll on its own.
      // twMerge keeps the last position utility, so `sticky` replaces the base
      // `relative`.
      className="sticky top-0 z-40 h-screen bg-surface-raised"
    >
      <nav className="pg-scroll flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-4 py-6">
        <div className="flex h-7.5 min-w-0 shrink-0 items-center gap-1.5 rounded-lg border-1 border-gray-6 bg-surface-inset px-1.5 pl-2.5">
          <input
            type="text"
            placeholder="Filter components…"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-13/19 text-gray-11 outline-none placeholder:text-gray-9"
          />
          <button
            type="button"
            onClick={onOpenPalette}
            className="h-4.5 shrink-0 rounded-sm border-1 border-gray-7 bg-surface-raised px-1.5 text-11/13 tracking-wider text-gray-9 hover:text-gray-11"
          >
            ⌘K
          </button>
        </div>

        <a
          {...linkProps({ slug: null })}
          className={cn(
            'shrink-0 truncate rounded-md px-2 py-1 text-13/19',
            selected === null ? 'bg-indigo-3 text-indigo-9' : 'text-gray-11 hover:text-gray-12',
          )}
        >
          All
        </a>
        {shownGroups.map((group) => (
          <div key={group} className="flex shrink-0 flex-col gap-0.5">
            <span className="truncate px-2 font-mono text-11/13 uppercase tracking-wider text-gray-9">
              {group}
            </span>
            {filtered
              .filter((d) => d.meta.group === group)
              .map((d) => (
                <a
                  key={d.slug}
                  {...linkProps({ slug: d.slug })}
                  title={d.meta.title}
                  className={cn(
                    'shrink-0 truncate rounded-md px-2 py-1 text-13/19',
                    selected === d.slug
                      ? 'bg-indigo-3 text-indigo-9'
                      : 'text-gray-11 hover:text-gray-12',
                  )}
                >
                  {d.meta.title}
                </a>
              ))}
          </div>
        ))}
      </nav>
    </SidePanel>
  );
}
