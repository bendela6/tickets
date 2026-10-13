// What each status looks like and says. One table, so the row, the rail and a
// screen reader can never disagree about which tone means what.

import type { NavStatus } from './nav-types';

/**
 * Each status's dot class and its words: `up` green, "Up"; `warn` orange,
 * "Up, with warnings"; `down` red, "Down"; `unknown` gray, "Not checked yet".
 */
export const NAV_STATUS: Record<NavStatus, { tone: string; label: string }> = {
  up: { tone: 'bg-green-9', label: 'Up' },
  warn: { tone: 'bg-orange-9', label: 'Up, with warnings' },
  down: { tone: 'bg-red-9', label: 'Down' },
  unknown: { tone: 'bg-gray-8', label: 'Not checked yet' },
};
