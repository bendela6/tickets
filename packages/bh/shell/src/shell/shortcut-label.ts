// What the search field's kbd hint shows.

import { isAppleShortcutPlatform } from './is-apple-shortcut-platform';

/** The label for the search shortcut on this platform. */
export function shortcutLabel(): string {
  return isAppleShortcutPlatform() ? '⌘K' : 'Ctrl K';
}
