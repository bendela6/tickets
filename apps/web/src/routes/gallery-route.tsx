import { createRoute } from '@tanstack/react-router';
import { collectDemos, prepareDemos } from '@tickets/ui/gallery';
import { packageDemos } from '@tickets/ui/gallery/demos';
import { GalleryShell } from '@tickets/playground';
import { ToastProvider } from '../ui/toast';
import { TooltipProvider } from '../ui/tooltip';
import { rootRoute } from './root-route';

const webDemos = collectDemos(
  import.meta.glob('../**/*.demo.tsx', { eager: true }) as Record<string, unknown>,
);

const allDemos = prepareDemos([...packageDemos, ...webDemos]);

function GalleryScreen() {
  return (
    <GalleryShell
      demos={allDemos}
      title="Instrument — primitives gallery"
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
