// A page's own sections, listed beside it, with the one being read lit the way
// the sidebar lights the page on screen. The app hands in the sections, from
// its headings, and says how a pick gets there if scrolling isn't all of it;
// which one is in view comes from @bh/hooks' useScrollSpy, read in the element
// the page scrolls in: the shell's <main>, unless the app names another.

import { useCallback, useState } from 'react';
import { useScrollSpy } from '@bh/hooks';
import { cn } from '@bh/ui';
import { ActiveBar, NAV_STYLES } from '../nav';

/** One of a page's sections, as OnThisPage lists it. */
export interface PageSection {
  /** Its heading's element id: what the entry links to, and where it watches. */
  id: string;
  /** What the entry says: the heading's text, as a rule. */
  label: string;
  /**
   * Its heading's level: 2 for an `h2`, since the page's title is its `h1`.
   * A section is listed under the nearest one before it with a lower level.
   * 2 when left out.
   */
  level?: number;
}

/** Props for OnThisPage component. */
export interface OnThisPageProps {
  /** The page's sections, in the order they come on it. Without any, it draws nothing. */
  sections: readonly PageSection[];
  /**
   * Called with the section picked, after it is lit, to go to it: to scroll
   * there and put its id in the address, say. Without it, the section's
   * heading scrolls to the top of `root`.
   */
  onSelect?: (section: PageSection) => void;
  /**
   * The element the page scrolls in. Left out, the `<main>` the list sits in,
   * as AppShell's, or the window outside one. `null` while it is not known
   * yet, as an element kept in state before its ref has run.
   */
  root?: Element | null;
  /**
   * How far below the top of `root` a section's heading has to pass to be the
   * one being read, in pixels: 120 unless given, a line a little way down
   * where reading starts.
   */
  offset?: number;
  /** The list's heading, and its name for a screen reader. */
  label?: string;
}

/** How far in a row sits, by how deep its section is: one step a level, three at most. */
const INDENT = ['pl-14', 'pl-28', 'pl-42'] as const;

/** A section and the ones listed under it. */
interface Branch {
  section: PageSection;
  under: Branch[];
}

/** The sections as a tree: each under the nearest one before it with a lower level. */
function nest(sections: readonly PageSection[]): Branch[] {
  const top: Branch[] = [];
  const open: { branch: Branch; level: number }[] = [];
  for (const section of sections) {
    const level = section.level ?? 2;
    const branch: Branch = { section, under: [] };
    while ((open.at(-1)?.level ?? -Infinity) >= level) {
      open.pop();
    }
    (open.at(-1)?.branch.under ?? top).push(branch);
    open.push({ branch, level });
  }
  return top;
}

/**
 * Scrolls `root`, or the window, until the section's heading is at its top,
 * less the heading's own scroll margin. Only `root` moves: a page around it,
 * scrolling too, stays where it is.
 */
function scrollToSection(id: string, root: Element | null | undefined): void {
  const section = document.getElementById(id);
  if (!section) {
    return;
  }
  const margin = Number.parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
  const top = section.getBoundingClientRect().top - margin;
  if (root) {
    const from = root.getBoundingClientRect().top + root.clientTop;
    root.scrollTo({ top: root.scrollTop + top - from, behavior: 'smooth' });
  } else {
    window.scrollTo({ top: window.scrollY + top, behavior: 'smooth' });
  }
}

/**
 * The sections of the page on screen, the one being read lit as the sidebar
 * lights its page. It follows the scroll, and a click lights its section at
 * once and keeps it lit until the reader scrolls by hand, while the page
 * scrolls there.
 *
 * It draws the list and nothing around it: the app puts it in a rail of its
 * own, beside the page, kept in view as the page scrolls past.
 */
export function OnThisPage({
  sections,
  onSelect,
  root,
  // A line a little way down the screen, where reading starts.
  offset = 120,
  label = 'On this page',
}: OnThisPageProps) {
  // The <main> the list sits in, or the window outside one (undefined); null
  // until the list is on the page.
  const [found, setFound] = useState<Element | null | undefined>(null);
  const listRef = useCallback((nav: HTMLElement | null) => {
    setFound(nav ? (nav.closest('main') ?? undefined) : null);
  }, []);
  const scroller = root === undefined ? found : root;
  const { activeId, pin } = useScrollSpy(
    sections.map((section) => section.id),
    { root: scroller, offset },
  );

  if (sections.length === 0) {
    return null;
  }

  const pick = (section: PageSection) => {
    // Lit until the reader scrolls by hand: a short page bottoms out before a
    // late heading reaches the line.
    pin(section.id);
    if (onSelect) {
      onSelect(section);
    } else {
      scrollToSection(section.id, scroller);
    }
  };

  return (
    // Named in the label's own case: the heading over the list is drawn in capitals.
    <nav ref={listRef} aria-label={label} className="flex flex-col pb-12">
      {/* Set like the sidebar's section headers. */}
      <p className="text-12 font-500 text-gray-10 flex h-44 shrink-0 items-center px-14 tracking-[0.04em] uppercase">
        {label}
      </p>
      <Entries branches={nest(sections)} depth={0} activeId={activeId} onPick={pick} />
    </nav>
  );
}

interface EntriesProps {
  branches: readonly Branch[];
  depth: number;
  activeId: string | undefined;
  onPick: (section: PageSection) => void;
}

/** One level of the list, and the levels under each of its entries. */
function Entries({ branches, depth, activeId, onPick }: EntriesProps) {
  return (
    <ul className="flex flex-col">
      {branches.map(({ section, under }) => {
        const active = section.id === activeId;
        return (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              aria-current={active ? 'location' : undefined}
              onClick={(event) => {
                event.preventDefault();
                onPick(section);
              }}
              className={cn(
                // The sidebar's own row: the same height, hover, lit state and bar.
                'rounded-4 text-13 relative flex h-32 items-center pr-12',
                INDENT[Math.min(depth, INDENT.length - 1)],
                NAV_STYLES.focusRing,
                active ? cn(NAV_STYLES.active, 'font-500') : cn(NAV_STYLES.resting, 'font-400'),
              )}
            >
              {active ? <ActiveBar /> : null}
              <span className="truncate">{section.label}</span>
            </a>
            {under.length > 0 ? (
              <Entries branches={under} depth={depth + 1} activeId={activeId} onPick={onPick} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
