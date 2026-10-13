import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app';
import { AppErrorBoundary } from './components/app-error-boundary';
import { STORAGE_KEYS } from './utils/storage-keys';
import { applyTheme, readStoredTheme } from '@bh/shell';
import { Button } from '@bh/ui';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles.css';

// Minimal centered fallback for the top-level error boundary — a way out
// (reload) instead of a blank page.
function AppCrashedFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-1 font-sans text-gray-12">
      <div className="flex flex-col items-center gap-16 text-center">
        <p className="text-gray-12">Something broke.</p>
        <Button variant="solid" onClick={() => location.reload()}>
          Reload
        </Button>
      </div>
    </div>
  );
}

// Stamped before the first render, from what the reader picked last, so the
// page never paints in the wrong theme; `system` (nothing picked) follows the OS.
applyTheme(readStoredTheme(STORAGE_KEYS.theme), STORAGE_KEYS.theme);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
    },
  },
});

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary fallback={<AppCrashedFallback />}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
