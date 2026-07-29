import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { cn, type CollectedDemo, Icon, runtimeStyle } from '@tickets/ui';
import { loadFlag, loadLayout, saveFlag, saveLayout } from '../persisted-layout';
import type { GalleryNavigation } from '../navigation';

type LiveDemo = Extract<CollectedDemo, { slug: string }>;

export const SIDEBAR_MIN = 180;
export const SIDEBAR_MAX = 400;
const SIDEBAR_DEFAULT = 224;

// Below this the sidebar can't sit beside the content without squeezing it,
// so it collapses — and reopens as an overlay rather than pushing the page.
const NARROW_QUERY = '(max-width: 1023px)';

const WIDTH_KEY = 'gallery-sidebar';
const COLLAPSED_KEY = 'gallery-sidebar-collapsed';

export const clampWidth = (px: number) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, px));

function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(NARROW_QUERY);
    const onChange = () => setNarrow(query.matches);
    query.addEventListener('change', onChange);
    onChange();
    return () => query.removeEventListener('change', onChange);
  }, []);
  return narrow;
}

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
  const [width, setWidth] = useState(() =>
    clampWidth(loadLayout(WIDTH_KEY)?.width ?? SIDEBAR_DEFAULT),
  );
  const [collapsed, setCollapsed] = useState(() => loadFlag(COLLAPSED_KEY) ?? false);
  const narrow = useIsNarrow();
  const asideRef = useRef<HTMLElement>(null);

  // A narrow window forces the sidebar shut; widening restores whatever the
  // user last chose, rather than leaving it stuck closed.
  useEffect(() => {
    setCollapsed(narrow ? true : (loadFlag(COLLAPSED_KEY) ?? false));
  }, [narrow]);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    // A temporary peek at the overlay isn't a preference worth remembering.
    if (!narrow) saveFlag(COLLAPSED_KEY, next);
  }

  // Pointer capture on the handle, so a fast drag that outruns the pointer
  // keeps resizing instead of dropping the gesture.
  const startResize = useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    let latest = 0;
    const move = (e: globalThis.PointerEvent) => {
      const left = asideRef.current?.getBoundingClientRect().left ?? 0;
      latest = clampWidth(e.clientX - left);
      setWidth(latest);
    };
    const end = (e: globalThis.PointerEvent) => {
      handle.releasePointerCapture(e.pointerId);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      if (latest) saveLayout(WIDTH_KEY, { width: latest });
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
  }, []);

  const groups = [...new Set(demos.map((d) => d.meta.group))];
  const filtered = demos.filter((d) =>
    d.meta.title.toLowerCase().includes(filterQuery.toLowerCase()),
  );
  const shownGroups = groups.filter((g) => filtered.some((d) => d.meta.group === g));

  if (collapsed) {
    // Fixed, so a closed sidebar costs the content no horizontal space.
    return (
      <button
        type="button"
        aria-label="Show component list"
        aria-expanded={false}
        onClick={toggle}
        className="fixed left-3 top-3 z-40 flex h-9 w-9 items-center justify-center rounded-md border-1 border-gray-6 bg-surface-raised text-gray-11 shadow-sm hover:text-gray-12"
      >
        <Icon name="rows" size="md" />
      </button>
    );
  }

  return (
    <>
      {narrow && (
        // Clicking away closes the overlay, the way any drawer behaves.
        <div className="fixed inset-0 z-30 bg-black/40" aria-hidden onClick={toggle} />
      )}
      <aside
        ref={asideRef}
        style={runtimeStyle({ '--sidebar-width': `${width}px` })}
        className={cn(
          // Width rides a custom property: a drag updates it every frame, and
          // Tailwind can't scan a class name built at runtime.
          'sticky top-0 z-40 flex h-screen w-(--sidebar-width) shrink-0 border-r-1 border-gray-6 bg-surface-raised',
          narrow && 'fixed left-0 shadow-lg',
        )}
      >
        <nav className="pg-scroll flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-4 py-6">
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex h-7.5 min-w-0 flex-1 items-center gap-1.5 rounded-lg border-1 border-gray-6 bg-surface-inset px-1.5 pl-2.5">
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
            <button
              type="button"
              aria-label="Hide component list"
              aria-expanded
              onClick={toggle}
              className="flex h-7.5 w-7 shrink-0 items-center justify-center rounded-md text-gray-9 hover:bg-surface-inset hover:text-gray-12"
            >
              <Icon name="chevron-left" size="md" />
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
              <span className="truncate px-2 font-mono text-11/13 tracking-wider uppercase tracking-wider text-gray-9">
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

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize component list"
          onPointerDown={startResize}
          className="pg-sidebar-resize w-1.5 shrink-0 cursor-col-resize"
        />
      </aside>
    </>
  );
}
