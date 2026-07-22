import { SignalsErrorBoundary } from '@bendela6/signals-react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app';
import { initEerSignals } from './signals-init';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/tailwind.css';
import './styles/debug.scss';

// The viewer is a dark-only tool; mark the root so tokens resolve.
document.documentElement.dataset.theme = 'dark';

// Fire-and-forget: self-report errors to Signals without delaying render.
void initEerSignals();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <SignalsErrorBoundary
      fallback={
        <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-gray-900 text-gray-50">
          <p className="text-lg">Something broke.</p>
          <button
            type="button"
            className="rounded-md border border-gray-600 px-4 py-2 text-sm text-gray-200 hover:text-gray-50"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      }
    >
      <App />
    </SignalsErrorBoundary>
  </StrictMode>,
);
