// Route-backed tabs under a page header: the active tab is the one whose path
// is the longest the address is at or under, none when it is under none, each
// tab may count something beside its name, something that is not a tab may
// follow the last one, and the row scrolls sideways when it is wider than the
// screen.

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Tabs } from '@bh/ui';
import { fillParams } from './fill-params';

/** A tab that routes to a path, which may carry `$name` placeholders. */
export interface TabSpec {
  /** The route pattern, e.g. `/books/$id/copies`; `params` fill its placeholders. */
  to: string;
  /** The tab's name. */
  label: string;
  /** Beside the name, in small mono: a count, "3 unset", "…". Nothing when unset. */
  badge?: ReactNode;
}

/**
 * How the row looks: `underline` under a page header, on its rule; `pill`
 * for a second row of tabs inside the body, under a heading of its own.
 */
export type TabNavVariant = 'underline' | 'pill';

/** Props for TabNav component. */
export interface TabNavProps {
  /** The tabs, in order. */
  tabs: TabSpec[];
  /** Values for the tabs' `$name` placeholders, URL-encoded as they are filled in. */
  params?: Record<string, string>;
  /** The row's name for a screen reader. */
  label?: string;
  /** `underline` under a page header, `pill` for a row inside the body. */
  variant?: TabNavVariant;
  /**
   * After the last tab, in the same row, but not a tab: never lit, and not
   * one of the strip's items, e.g. a "New view" button. Nothing when unset.
   */
  trailing?: ReactNode;
}

/** The strip alone: as wide as its tabs, and an underline's rule at least the row's width. */
const STRIP: Record<TabNavVariant, string> = {
  underline: 'w-max min-w-full',
  pill: 'w-max',
};

/**
 * The strip with something after it: the strip as wide as its tabs, and the
 * rest of the row holding what follows. Under `underline` the rest carries on
 * the rule `Tabs` draws under the strip, so it still runs the row's width.
 */
const WITH_TRAILING: Record<TabNavVariant, { row: string; strip: string; rest: string }> = {
  underline: {
    row: 'flex w-max min-w-full',
    strip: 'w-max',
    rest: 'flex flex-1 items-center border-b-2 border-gray-6 pl-12',
  },
  pill: {
    row: 'flex w-max items-center gap-8',
    strip: 'w-max',
    rest: 'flex items-center',
  },
};

/** A path without its trailing slash, so `/books/7/` is at `/books/7`; the root stays `/`. */
function trimmed(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

/** Whether the path on screen is a tab's path or under it. */
function isAtOrUnder(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(path === '/' ? '/' : `${path}/`);
}

/**
 * Tabs that read their active value from the URL and navigate on click.
 *
 * The active tab is the one whose path is the longest that the path on
 * screen is at or under, so a tab at the page's own path, `/books/7`, gives
 * way to `/books/7/copies` on that tab and anything under it. When the path
 * is under no tab, none is lit. Wider than the screen, the row scrolls
 * sideways rather than wrap, and keeps the active tab in view. `trailing`
 * follows the last tab outside the strip, so it is never lit and never
 * counted as a tab.
 */
export function TabNav({
  tabs,
  params,
  label = 'Sections',
  variant = 'underline',
  trailing,
}: TabNavProps) {
  const navigate = useNavigate();
  const pathname = trimmed(useRouterState({ select: (state) => state.location.pathname }));
  const items = tabs.map((tab) => {
    return { value: fillParams(tab.to, params), label: tab.label, badge: tab.badge };
  });
  let active: (typeof items)[number] | undefined;
  for (const item of items) {
    const path = trimmed(item.value);
    if (isAtOrUnder(pathname, path) && path.length > trimmed(active?.value ?? '').length) {
      active = item;
    }
  }
  const value = active?.value ?? '';

  // On a phone the active tab can sit past the row's right edge, the last of
  // seven say. This scrolls the row, and only the row, until the tab shows:
  // scrollIntoView would scroll the page under it as well. The tab is looked
  // for in the strip, the row's first group: with none lit, a pressed toggle in
  // `trailing` is not one.
  const row = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const scroller = row.current;
    const strip = scroller?.querySelector('[role="group"]');
    const tab = strip?.querySelector<HTMLElement>(':scope > [aria-pressed="true"]');
    if (!scroller || !tab) {
      return;
    }
    const box = scroller.getBoundingClientRect();
    const at = tab.getBoundingClientRect();
    if (at.left < box.left) {
      scroller.scrollLeft -= box.left - at.left;
    } else if (at.right > box.right) {
      scroller.scrollLeft += at.right - box.right;
    }
  }, [value]);

  const layout = trailing == null ? null : WITH_TRAILING[variant];
  const strip = (
    <Tabs
      role="group"
      variant={variant}
      size="md"
      items={items}
      value={value}
      onChange={(to) => void navigate({ to })}
      label={label}
      // As wide as its tabs, so each keeps its width and the row scrolls.
      className={layout?.strip ?? STRIP[variant]}
    />
  );

  return (
    <div ref={row} className="overflow-x-auto">
      {layout ? (
        <div className={layout.row}>
          {strip}
          <div className={layout.rest}>{trailing}</div>
        </div>
      ) : (
        strip
      )}
    </div>
  );
}
