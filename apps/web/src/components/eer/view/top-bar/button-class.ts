// Shared default top-bar button look — <TopBar/>'s own buttons (Lines, Fit,
// Rearrange, …), defined once here instead of duplicated per-button.

import { cn } from '@tickets/ui';

export const btn = cn(
  'rounded-md border border-gray-600 bg-gray-900 px-3 py-2',
  'text-sm font-medium whitespace-nowrap text-gray-200',
  'hover:border-gray-500 hover:bg-gray-800 hover:text-gray-50',
);
