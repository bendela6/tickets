import { createRoute } from '@tanstack/react-router';
import { collectDemos, prepareDemos } from '@tickets/ui/gallery';
import { packageDemos } from '@tickets/ui/gallery/demos';
import { packageDemoSources } from '@tickets/ui/gallery/demo-sources';
import { GalleryShell } from '@tickets/playground';
import { ToastProvider } from '../ui/toast';
import { TooltipProvider } from '../ui/tooltip';
import { rootRoute } from './root-route';

const webDemos = collectDemos(
  import.meta.glob('../**/*.demo.tsx', { eager: true }) as Record<string, unknown>,
);
const webDemoSources = import.meta.glob('../**/*.demo.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const allDemos = prepareDemos([...packageDemos, ...webDemos]);

function GalleryScreen() {
  return (
    <GalleryShell
      demos={allDemos}
      title="Instrument — primitives gallery"
      sources={{ ...packageDemoSources, ...webDemoSources }}
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
