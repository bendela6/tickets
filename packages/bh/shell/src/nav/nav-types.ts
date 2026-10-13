// The nav's data shape. Each app keeps its own list of sections; this package
// only says what a section and a destination are.

import type { LucideIcon } from 'lucide-react';

/**
 * How a destination is doing, when the app knows: up, up with something worth
 * reading, down, or not asked yet. The nav draws it as a dot in one of four
 * tones and says it in words to a screen reader; what it is the status OF is
 * the app's business.
 */
export type NavStatus = 'up' | 'warn' | 'down' | 'unknown';

/** A page under a destination: a row in the expanded sidebar, an entry in the rail's menu. */
export interface NavLeaf {
  /** The page's name in the row and in the menu. */
  label: string;
  /** Where it links. When several of the pages match the path on screen, the longest is lit. */
  path: string;
  /** Trailing badge on its row in the expanded sidebar; the rail's menu shows none. */
  count?: string | number;
}

/** One destination in the sidebar's rows and in its rail. */
export interface NavItem {
  /** The row's label, and the rail icon's name and tooltip. */
  label: string;
  /** Where it links. Lit while the path on screen is this one or under it; `/` only when exact. */
  path: string;
  /** A lucide icon, drawn at 18px on the row and in the rail. */
  icon: LucideIcon;
  /** Trailing badge — a total for the destination, e.g. `1,284`. */
  count?: string | number;
  /** Trailing attention dot, e.g. a destination with something failing. */
  dot?: boolean;
  /** A four-tone status dot, trailing on the row and on the rail's icon. */
  status?: NavStatus;
  /**
   * The destination's own pages. With them the row opens to show them — by
   * itself while one of them is on screen, by its chevron otherwise — and the
   * rail's icon opens a menu of them, so every page stays reachable at 48px.
   */
  children?: readonly NavLeaf[];
}

/** A button at the right of a section's header, e.g. "New project" beside Projects. */
export interface NavSectionAction {
  /** The button's accessible name, and its tooltip. */
  label: string;
  /** A lucide icon, the button's only content. */
  icon: LucideIcon;
  /** Called when it is pressed; the section stays open or shut. */
  onSelect: () => void;
}

/** A group of destinations under one header; in the rail, a run of icons between rules. */
export interface NavSection {
  /** Stable key for the section's collapsed state; the label is free to change. */
  id: string;
  /** Omitted for the leading section, whose rows sit above the first header. */
  label?: string;
  /**
   * A button at the right of the header, in the expanded sidebar and the
   * phone's drawer. The leading section has no header to carry one, and the
   * rail, with no headers, shows none.
   */
  action?: NavSectionAction;
  /** Its destinations, in the order they are drawn. */
  items: readonly NavItem[];
}
