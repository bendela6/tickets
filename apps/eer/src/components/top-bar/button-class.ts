// Shared default top-bar button look — used by both <TopBar/>'s own buttons
// (Fit, Rearrange, …) and <ModelMenu/>'s (New, Save), so it's defined once here
// instead of duplicated in each file.

import { cn } from '../../ui/cn';

export const btn = cn(
  'rounded-md border border-gray-600 bg-gray-900 px-3 py-2',
  'text-sm font-medium whitespace-nowrap text-gray-200',
  'hover:border-gray-500 hover:bg-gray-800 hover:text-gray-50',
);
