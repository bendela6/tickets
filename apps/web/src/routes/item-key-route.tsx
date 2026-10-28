import { Link, Navigate, createRoute } from '@tanstack/react-router';
import { Page, PageBody, PageHeader } from '@tilewise/shell/layout';
import { ScreenState } from '@tilewise/ui';
import { useItemByKey } from '../api/use-item-by-key';
import { rootRoute } from './root-route';

// /i/<key>: an item by its key alone, wherever it is written (a key is unique
// across every project), sent on to its page in its project.
function ItemKeyScreen() {
  const { itemKey } = itemKeyRoute.useParams();
  const found = useItemByKey(itemKey);
  if (found.data) {
    return (
      <Navigate
        to="/p/$projectKey/t/$itemKey"
        params={{ projectKey: found.data.projectKey, itemKey: found.data.key }}
        replace
      />
    );
  }
  return (
    <Page header={<PageHeader title={itemKey} />}>
      <PageBody>
        {found.isError ? (
          <ScreenState
            tone="danger"
            icon="triangle-alert"
            title={`Could not find ${itemKey}`}
            body={(found.error as Error).message}
            action={
              <Link
                to="/"
                className="inline-flex h-32 w-max items-center rounded-8 border-1 border-gray-7 bg-surface-raised px-12 font-sans text-13/19 text-gray-12 hover:bg-surface-inset"
              >
                ← projects
              </Link>
            }
          />
        ) : (
          <ScreenState title={`Finding ${itemKey}…`} />
        )}
      </PageBody>
    </Page>
  );
}

export const itemKeyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/i/$itemKey',
  component: ItemKeyScreen,
});
