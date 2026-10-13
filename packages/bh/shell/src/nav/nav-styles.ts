// What the sidebar's rows, its rail icons and its small controls share, so the
// three can never drift: the focus treatment, the active state, and the two
// resting treatments.

import { focusRing } from '@bh/ui';

/**
 * The classes the sidebar's rows, rail icons and small controls share:
 * `focusRing` (inset), `active` (the lit row), `resting` (a row), and
 * `control` (a control beside the rows, a rung quieter).
 */
export const NAV_STYLES = {
  // Inward rather than outward because the rows are full-bleed: an outward halo
  // would be clipped by the sidebar's own edge. Instrument's helper rather than
  // a hand-written shadow, so the rung follows the design system.
  focusRing: focusRing('indigo', 'focus-visible', 'inward'),
  active: 'bg-indigo-3 text-indigo-11',
  resting: 'text-gray-11 hover:bg-surface-inset hover:text-gray-12',
  // A destination is worth more ink than a control beside it: the brand row's
  // collapse button, the rail's icons and the footer's trigger rest a rung
  // quieter than a row does.
  control: 'text-gray-10 hover:bg-surface-inset hover:text-gray-12',
} as const;
