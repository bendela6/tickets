// Shared default top-bar button look — <TopBar/>'s own buttons (Lines, Fit,
// Rearrange, …), defined once here instead of duplicated per-button.

import { cn } from '@tickets/ui';

export const btn = cn(
  'rounded-md border border-gray-6 bg-gray-2 px-3 py-2',
  'text-sm font-medium whitespace-nowrap text-gray-11',
  'hover:border-gray-7 hover:bg-gray-3 hover:text-gray-12',
);
