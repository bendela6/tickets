// The router's own "active" test, pinned to the exact page for the rows where
// its default would lie. TanStack Router's Link sets aria-current="page" by
// itself on every active link, after the props it was given, and by default a
// link is active on any page under its path — so under a destination with
// pages of its own, the destination, its first page and the page on screen
// would all say "this is the page". Exact, and blind to the search string (a
// filtered view is still the page), it says so on the link to the page on
// screen alone.

/**
 * The `activeOptions` a destination with pages, and each of its pages, gives
 * its `Link`: active on its own path only, whatever the search string, so the
 * router marks the page on screen and no other.
 */
export const EXACT_MATCH = { exact: true, includeSearch: false } as const;
