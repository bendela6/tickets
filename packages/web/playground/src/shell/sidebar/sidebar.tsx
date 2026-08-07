import { useState } from 'react';
import { Button, cn, Input, SidePanel, type CollectedDemo } from '@tickets/ui';
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
      <nav className="pg-scroll flex min-w-0 flex-1 flex-col gap-16 overflow-y-auto overflow-x-hidden px-16 py-24">
        <Input
          size="xs"
          type="text"
          aria-label="Filter components"
          placeholder="Filter components…"
          value={filterQuery}
          onChange={(next) => setFilterQuery(next)}
          className="shrink-0"
          // The shortcut hint belongs inside the field's border — it is about
          // this field, not next to it.
          trailing={
            <Button
              variant="outline"
              tone="neutral"
              size="sm"
              onClick={onOpenPalette}
              className="h-18 shrink-0 px-6 text-11/13 tracking-wider"
            >
              ⌘K
            </Button>
          }
        />

        <a
          {...linkProps({ slug: null })}
          className={cn(
            'shrink-0 truncate rounded-6 px-8 py-4 text-13/19',
            selected === null ? 'bg-indigo-3 text-indigo-9' : 'text-gray-11 hover:text-gray-12',
          )}
        >
          All
        </a>
        {shownGroups.map((group) => (
          <div key={group} className="flex shrink-0 flex-col gap-2">
            <span className="truncate px-8 font-mono text-11/13 uppercase tracking-wider text-gray-9">
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
                    'shrink-0 truncate rounded-6 px-8 py-4 text-13/19',
                    selected === d.slug
                      ? 'bg-indigo-3 text-indigo-9'
                      : 'text-gray-11 hover:text-gray-12',
                  )}
                >
                  {d.meta.title}
                  {d.meta.deprecated && (
                    <span className="ml-4 text-11/13 text-gray-9">Deprecated</span>
                  )}
                </a>
              ))}
          </div>
        ))}
      </nav>
    </SidePanel>
  );
}
