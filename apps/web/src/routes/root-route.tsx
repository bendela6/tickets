import { Outlet, createRootRoute } from '@tanstack/react-router';
import { MutationErrorToasts } from '../components/mutation-error-toasts';
import { CurrentUserProvider } from '../state/current-user-context';
import { ToastProvider } from '@bh/ui';

function RootLayout() {
  return (
    <CurrentUserProvider>
      <ToastProvider>
        <MutationErrorToasts />
        <Outlet />
      </ToastProvider>
    </CurrentUserProvider>
  );
}

export const rootRoute = createRootRoute({ component: RootLayout });
