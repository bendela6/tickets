import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { cn } from '@tickets/ui/cn';
import { Icon } from '@tickets/ui/icon';
import { runtimeStyle } from '@tickets/ui/runtime-style';
import type { CollectedDemo } from '@tickets/ui/gallery';
import { loadFlag, loadLayout, saveFlag, saveLayout } from './persisted-layout';
import type { GalleryNavigation } from './navigation';

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
        className="fixed left-3 top-3 z-40 flex h-9 w-9 items-center justify-center rounded-ctrl border border-hairline bg-raised text-ink-2 shadow-sm hover:text-ink"
      >
        <Icon name="rows" size={14} />
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
          'sticky top-0 z-40 flex h-screen w-(--sidebar-width) shrink-0 border-r border-hairline bg-raised',
          narrow && 'fixed left-0 shadow-lg',
        )}
      >
        <nav className="pg-scroll flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-4 py-6">
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex h-7.5 min-w-0 flex-1 items-center gap-1.5 rounded-card border border-hairline bg-inset px-1.5 pl-2.5">
              <input
                type="text"
                placeholder="Filter components…"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-ui text-ink-2 outline-none placeholder:text-ink-3"
              />
              <button
                type="button"
                onClick={onOpenPalette}
                className="h-4.5 shrink-0 rounded-xs border border-control bg-raised px-1.5 text-label text-ink-3 hover:text-ink-2"
              >
                ⌘K
              </button>
            </div>
            <button
              type="button"
              aria-label="Hide component list"
              aria-expanded
              onClick={toggle}
              className="flex h-7.5 w-7 shrink-0 items-center justify-center rounded-ctrl text-ink-3 hover:bg-inset hover:text-ink"
            >
              <Icon name="chevron-left" size={14} />
            </button>
          </div>

          <a
            {...linkProps({ slug: null })}
            className={cn(
              'shrink-0 truncate rounded-ctrl px-2 py-1 text-ui',
              selected === null ? 'bg-accent-subtle text-accent' : 'text-ink-2 hover:text-ink',
            )}
          >
            All
          </a>
          {shownGroups.map((group) => (
            <div key={group} className="flex shrink-0 flex-col gap-0.5">
              <span className="truncate px-2 font-mono text-label uppercase tracking-(--tracking-label) text-ink-3">
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
                      'shrink-0 truncate rounded-ctrl px-2 py-1 text-ui',
                      selected === d.slug
                        ? 'bg-accent-subtle text-accent'
                        : 'text-ink-2 hover:text-ink',
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
