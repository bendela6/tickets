import { useMemo } from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { collectDemos, packageComponentSources, packageDemos, packageDemoSources, prepareDemos, rebaseGlobKeys, ToastProvider, TooltipProvider, WEB_SRC_ROOT } from '@tickets/ui';
import { GalleryShell, isPlainClick, type GalleryNavigation, type GalleryTarget } from '@tickets/playground';
import { rootRoute } from './root-route';

// Every map below is rebased onto WEB_SRC_ROOT for the same reason the
// package's maps are rebased onto UI_SRC_ROOT: raw glob keys are relative to
// the globbing module, so merging the two sets without rebasing lets one
// package's `../x.tsx` shadow the other's.
const webDemos = collectDemos(
  rebaseGlobKeys(
    WEB_SRC_ROOT,
    import.meta.glob('../**/*.demo.tsx', { eager: true }) as Record<string, unknown>,
  ),
);
const webDemoSources = rebaseGlobKeys(
  WEB_SRC_ROOT,
  import.meta.glob('../**/*.demo.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
);
// The app's own component files for the Implementation tab. LAZY on purpose —
// eager-inlining every source file under src/ would put the whole app's text
// into this bundle; each file becomes its own chunk, fetched only when the
// tab is opened. Same contract as @tickets/ui's packageComponentSources.
const webComponentSources = rebaseGlobKeys(
  WEB_SRC_ROOT,
  import.meta.glob(['../**/*.{ts,tsx}', '!../**/*.demo.tsx', '!../**/*.test.{ts,tsx}'], {
    query: '?raw',
    import: 'default',
  }) as Record<string, () => Promise<string>>,
);

const allDemos = prepareDemos([...packageDemos, ...webDemos]);

// Real URLs rather than the package's default hash scheme: `/gallery`,
// `/gallery/pill`, `/gallery/pill/docs`. The fragment goes back to being just
// an anchor — `/gallery/pill#pill--solid` scrolls to a state cell.
export function galleryPath(target: GalleryTarget): string {
  if (!target.slug) return '/gallery';
  return target.tab ? `/gallery/${target.slug}/${target.tab}` : `/gallery/${target.slug}`;
}

function useGalleryNavigation(slug: string | null, tab: string | null): GalleryNavigation {
  const routerNavigate = useNavigate();
  return useMemo(
    () => ({
      slug,
      tab,
      navigate: (target) => void routerNavigate({ to: galleryPath(target) }),
      linkProps: (target) => ({
        href: galleryPath(target),
        onClick: (event) => {
          // Let the browser handle modified clicks so cmd/ctrl-click still
          // opens the component in a new tab — the payoff for real hrefs.
          if (!isPlainClick(event)) return;
          event.preventDefault();
          void routerNavigate({ to: galleryPath(target) });
        },
      }),
    }),
    [slug, tab, routerNavigate],
  );
}

function GalleryScreen({ slug = null, tab = null }: { slug?: string | null; tab?: string | null }) {
  const navigation = useGalleryNavigation(slug, tab);
  return (
    <GalleryShell
      demos={allDemos}
      title="Instrument — primitives gallery"
      sources={{ ...packageDemoSources, ...webDemoSources }}
      implSources={{ ...packageComponentSources, ...webComponentSources }}
      navigation={navigation}
      providers={(children) => (
        <TooltipProvider>
          <ToastProvider>{children}</ToastProvider>
        </TooltipProvider>
      )}
    />
  );
}

export const galleryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/gallery',
  component: GalleryScreen,
});

function GalleryComponentPage() {
  const { slug } = galleryComponentRoute.useParams();
  return <GalleryScreen slug={slug} />;
}

export const galleryComponentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/gallery/$slug',
  component: GalleryComponentPage,
});

function GalleryComponentTabPage() {
  const { slug, tab } = galleryComponentTabRoute.useParams();
  return <GalleryScreen slug={slug} tab={tab} />;
}

export const galleryComponentTabRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/gallery/$slug/$tab',
  component: GalleryComponentTabPage,
});
