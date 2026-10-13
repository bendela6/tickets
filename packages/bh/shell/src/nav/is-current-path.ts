// Whether a nav destination is the route on screen. Shared by the sidebar's
// rows and its rail so a deep link lights exactly one entry in both.

/**
 * True when a nav path is the current route or one of its descendants.
 *
 * `/` is matched exactly: as a prefix it is a prefix of every route, which
 * would leave the first destination lit on every page.
 *
 * @param path A destination's path, as the nav data gives it.
 * @param currentPath The path on screen.
 */
export function isCurrentPath(path: string, currentPath: string): boolean {
  if (path === '/') {
    return currentPath === '/';
  }
  return currentPath === path || currentPath.startsWith(`${path}/`);
}
