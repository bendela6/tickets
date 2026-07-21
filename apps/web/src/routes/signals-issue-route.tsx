import { createRoute } from '@tanstack/react-router';
import { AppShell } from '../components/shell/app-shell';
import { IssueDetailScreen } from '../components/signals/issue-detail-screen';
import { rootRoute } from './root-route';

function SignalsIssuePage() {
  const { issueId } = signalsIssueRoute.useParams();
  return (
    <AppShell>
      <IssueDetailScreen issueId={Number(issueId)} />
    </AppShell>
  );
}

export const signalsIssueRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signals/issues/$issueId',
  component: SignalsIssuePage,
});
