import { Outlet, createRootRoute } from '@tanstack/react-router';
import { CurrentUserProvider } from '../state/current-user-context';
import { ToastProvider } from '@tickets/ui';

function RootLayout() {
  return (
    <CurrentUserProvider>
      <ToastProvider>
        <Outlet />
      </ToastProvider>
    </CurrentUserProvider>
  );
}

export const rootRoute = createRootRoute({ component: RootLayout });
