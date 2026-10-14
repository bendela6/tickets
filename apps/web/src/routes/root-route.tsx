import { Outlet, createRootRoute } from '@tanstack/react-router';
import { MutationErrorToasts } from '../components/mutation-error-toasts';
import { Frame } from '../components/shell/frame';
import { CurrentUserProvider } from '../state/current-user-context';
import { ConfirmProvider, ToastProvider } from '@bh/ui';

// Every page is drawn inside the one frame, mounted here around the routed
// page: a route never wraps itself in it. The toasts and the confirm dialog
// that `useConfirm` asks in are held here too, once for the whole app.
function RootLayout() {
  return (
    <CurrentUserProvider>
      <ToastProvider>
        <ConfirmProvider>
          <MutationErrorToasts />
          <Frame>
            <Outlet />
          </Frame>
        </ConfirmProvider>
      </ToastProvider>
    </CurrentUserProvider>
  );
}

export const rootRoute = createRootRoute({ component: RootLayout });
