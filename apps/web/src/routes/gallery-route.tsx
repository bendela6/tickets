import { createRoute } from '@tanstack/react-router';
import { collectDemos, prepareDemos, rebaseGlobKeys, WEB_SRC_ROOT } from '@tickets/ui/gallery';
import { packageDemos } from '@tickets/ui/gallery/demos';
import { packageComponentSources, packageDemoSources } from '@tickets/ui/gallery/demo-sources';
import { GalleryShell } from '@tickets/playground';
import { ToastProvider } from '../ui/toast';
import { TooltipProvider } from '../ui/tooltip';
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

function GalleryScreen() {
  return (
    <GalleryShell
      demos={allDemos}
      title="Instrument — primitives gallery"
      sources={{ ...packageDemoSources, ...webDemoSources }}
      implSources={{ ...packageComponentSources, ...webComponentSources }}
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
