import { Outlet, createRootRoute } from '@tanstack/react-router';
import { CurrentUserProvider } from '../state/current-user-context';

function RootLayout() {
  return (
    <CurrentUserProvider>
      <Outlet />
    </CurrentUserProvider>
  );
}

export const rootRoute = createRootRoute({ component: RootLayout });
