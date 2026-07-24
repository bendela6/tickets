import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles.css';
import { createRoot } from 'react-dom/client';
import { GalleryShell } from '../src';
import { packageDemos } from '@tickets/ui/gallery/demos';
import { packageDemoSources } from '@tickets/ui/gallery/demo-sources';

createRoot(document.getElementById('root')!).render(
  <GalleryShell demos={packageDemos} title="@tickets/ui — gallery" sources={packageDemoSources} />,
);
