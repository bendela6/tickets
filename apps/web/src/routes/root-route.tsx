import { Outlet, createRootRoute } from '@tanstack/react-router';
import { MutationErrorToasts } from '../components/mutation-error-toasts';
import { Frame } from '../components/shell/frame';
import { CurrentUserProvider } from '../state/current-user-context';
import { ToastProvider } from '@bh/ui';

// Every page is drawn inside the one frame, mounted here around the routed
// page: a route never wraps itself in it.
function RootLayout() {
  return (
    <CurrentUserProvider>
      <ToastProvider>
        <MutationErrorToasts />
        <Frame>
          <Outlet />
        </Frame>
      </ToastProvider>
    </CurrentUserProvider>
  );
}

export const rootRoute = createRootRoute({ component: RootLayout });
