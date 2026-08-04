import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SignalsErrorBoundary } from '@bendela6/signals-react';

import { App } from './app';
import { initWebSignals } from './signals-init';
import { Button } from '@tickets/ui';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@tickets/playground/styles.css';

// Fire-and-forget: self-report errors to Signals without delaying render.
void initWebSignals();

// Minimal centered fallback for the top-level error boundary — the dashboard's
// own /signals screens render inside this boundary too, so if Signals itself
// throws we still get a reportable error and a way out (reload).
function AppCrashedFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-1 font-sans text-gray-12">
      <div className="flex flex-col items-center gap-16 text-center">
        <p className="text-gray-12">Something broke. If Signals is connected, the error was reported.</p>
        <Button variant="solid" onClick={() => location.reload()}>
          Reload
        </Button>
      </div>
    </div>
  );
}

const storedTheme = window.localStorage.getItem('tickets-theme');

if (storedTheme === 'light' || storedTheme === 'dark') {
  document.documentElement.dataset.theme = storedTheme;
} else {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = prefersDark ? 'dark' : 'light';
}

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
    <SignalsErrorBoundary fallback={<AppCrashedFallback />}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </SignalsErrorBoundary>
  </StrictMode>,
);
