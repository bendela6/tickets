import { createRoute } from '@tanstack/react-router';
import { AppShell } from '../components/shell/app-shell';
import { AppDetailScreen } from '../components/signals/app-detail-screen';
import { rootRoute } from './root-route';

function SignalsAppDetailPage() {
  const { appId } = signalsAppDetailRoute.useParams();
  return (
    <AppShell>
      <AppDetailScreen appId={Number(appId)} />
    </AppShell>
  );
}

export const signalsAppDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signals/apps/$appId',
  component: SignalsAppDetailPage,
});
