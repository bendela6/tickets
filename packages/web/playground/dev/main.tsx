import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles.css';
import { createRoot } from 'react-dom/client';
import { GalleryShell } from '../src';
import { ToastProvider, TooltipProvider } from '@tickets/ui';
import { packageComponentSources, packageDemos, packageDemoSources } from '@tickets/ui';

createRoot(document.getElementById('root')!).render(
  <GalleryShell
    demos={packageDemos}
    title="@tickets/ui — gallery"
    sources={packageDemoSources}
    implSources={packageComponentSources}
    // Toast and Tooltip moved into @tickets/ui, and their demos need context.
    // apps/web wraps the same way in gallery-route.
    providers={(children) => (
      <TooltipProvider>
        <ToastProvider>{children}</ToastProvider>
      </TooltipProvider>
    )}
  />,
);
