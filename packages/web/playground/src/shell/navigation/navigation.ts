import { useCallback, useEffect, useState, type MouseEvent } from 'react';

// How the gallery moves between components and tabs. The shell never touches
// the URL itself: it asks the host for the current location and for the props
// to hang on a link. That keeps the package usable in a host with a real
// router (apps/web, which gives it `/gallery/:slug/:tab`) and in the
// standalone dev app, which has no router at all and falls back to the hash.

export type GalleryTarget = { slug?: string | null; tab?: string | null };

export interface GalleryNavigation {
  /** Selected component, or null for the All view. Not yet validated. */
  slug: string | null;
  /** Tab within the selected component, or null for its default. */
  tab: string | null;
  /** Props for a real anchor: an href a browser can open, plus the click
   *  handler that keeps in-app navigation from reloading the page. */
  linkProps: (target: GalleryTarget) => {
    href: string;
    onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  };
  /** Navigation with no link behind it — the command palette. */
  navigate: (target: GalleryTarget) => void;
}

// A click the host should handle itself, rather than letting the browser
// open a new tab/window or download the target.
export function isPlainClick(event: MouseEvent): boolean {
  return (
    event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
  );
}

// The fragment is left to do its original job — scrolling to a state cell
// (`#pill--solid`) — under either navigation scheme, so this is shared.
export function useHashAnchor(): string | null {
  const [anchor, setAnchor] = useState(() => window.location.hash.replace(/^#/, ''));
  useEffect(() => {
    const onHash = () => setAnchor(window.location.hash.replace(/^#/, ''));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return anchor || null;
}

// --- hash scheme (standalone dev app) ------------------------------------
// `#pill` · `#pill--solid` (state anchor) · `#pill::docs` (tab). `::` can't
// occur in a kebab slug or a state anchor, so the forms never collide.

const TAB_SEPARATOR = '::';

export function parseHashLocation(rawHash: string): { slug: string | null; tab: string | null } {
  if (!rawHash) return { slug: null, tab: null };
  const [anchor = '', tab] = rawHash.split(TAB_SEPARATOR);
  const slug = anchor.includes('--') ? anchor.split('--')[0]! : anchor;
  return { slug: slug || null, tab: tab || null };
}

export function hashHref(target: GalleryTarget): string {
  if (!target.slug) return '#';
  return target.tab ? `#${target.slug}${TAB_SEPARATOR}${target.tab}` : `#${target.slug}`;
}

export function useHashNavigation(): GalleryNavigation {
  const [rawHash, setRawHash] = useState(() => window.location.hash.replace(/^#/, ''));

  useEffect(() => {
    const onHash = () => setRawHash(window.location.hash.replace(/^#/, ''));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Driven directly rather than waiting on the hashchange event, which the
  // browser skips when the hash is unchanged (All -> All).
  const navigate = useCallback((target: GalleryTarget) => {
    const href = hashHref(target);
    window.location.hash = href;
    setRawHash(href.replace(/^#/, ''));
  }, []);

  const { slug, tab } = parseHashLocation(rawHash);
  return {
    slug,
    tab,
    navigate,
    linkProps: (target) => ({
      href: hashHref(target),
      onClick: (event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        navigate(target);
      },
    }),
  };
}
