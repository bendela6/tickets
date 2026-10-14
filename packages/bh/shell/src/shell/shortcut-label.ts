// What the search field's kbd hint showed, before the field drew bh's Kbd.

import { isAppleShortcutPlatform } from './is-apple-shortcut-platform';

/**
 * Deprecated: the label the search field's hint showed, `⌘K` or `Ctrl K`. The
 * field draws `<Kbd keys="mod+K" />` from `@bh/ui` now, which names the key
 * the same way and draws the cap.
 *
 * @deprecated Draw `<Kbd keys="mod+K" />`. Kept so an app that drew its own
 * hint keeps working; it goes with the next breaking release.
 */
export function shortcutLabel(): string {
  return isAppleShortcutPlatform() ? '⌘K' : 'Ctrl K';
}
