import { createRoute } from '@tanstack/react-router';
import { collectDemos, GalleryShell, sortDemos } from '@tickets/ui/gallery';
import { packageDemos } from '@tickets/ui/gallery/demos';
import { ToastProvider } from '../ui/toast';
import { TooltipProvider } from '../ui/tooltip';
import { rootRoute } from './root-route';

const webDemos = collectDemos(
  import.meta.glob('../**/*.demo.tsx', { eager: true }) as Record<string, unknown>,
);

function GalleryScreen() {
  return (
    <GalleryShell
      demos={sortDemos([...packageDemos, ...webDemos])}
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
